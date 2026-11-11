"""Check article 114 semantics, not its source author's performance benchmarks."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

import duckdb


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', type=Path, required=True)
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
env['LC_ALL'] = 'C'
env['PGOPTIONS'] = '-c statement_timeout=15000'


def run(name, *params, sql=None):
    return subprocess.run([str(bin_dir / name), *params], input=sql, env=env,
                          text=True, capture_output=True, check=True,
                          timeout=60).stdout.strip()


with tempfile.TemporaryDirectory(prefix='howto-114-', dir='/tmp') as temp:
    data = Path(temp) / 'data'
    try:
        pg_version = run('postgres', '--version')
        assert 'PostgreSQL) 18.' in pg_version, pg_version
        run('initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
        run('pg_ctl', '-D', str(data), '-l', str(Path(temp) / 'postgres.log'),
            '-o', f"-p 55434 -k {temp} -c listen_addresses='' -c shared_buffers=32MB",
            '-w', 'start')

        def sql(query):
            return run('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', temp,
                       '-p', '55434', '-d', 'postgres', sql=query)

        pg = {}
        pg['sizes'] = sql('''CREATE TEMP TABLE t(x numeric(15,2));
            INSERT INTO t VALUES (123456.00);
            SELECT pg_column_size(x), pg_column_size(123456.00::numeric) FROM t;''')
        assert pg['sizes'] == '7|10', pg
        pg['scales'] = sql('SELECT 1.5+1.50, 2.0*3.00, 10.0/4;')
        assert pg['scales'] == '3.00|6.000|2.5000000000000000', pg
        pg['division'] = sql('SELECT 1/3::numeric, 1000000/3::numeric, 0.001/3::numeric;')
        assert pg['division'] == (
            '0.33333333333333333333|333333.333333333333|0.00033333333333333333'), pg
        pg['equality'] = sql('''SELECT 1.0=1.00, (1.0)::text=(1.00)::text,
            hash_numeric(1.0)=hash_numeric(1.00);''')
        assert pg['equality'] == 't|f|t', pg
        pg['stored_scales'] = sql('''CREATE TEMP TABLE t(x numeric);
            INSERT INTO t VALUES (1.5),(1.50),(1.500);
            SELECT x::text FROM t ORDER BY scale(x);''')
        assert pg['stored_scales'] == '1.5\n1.50\n1.500', pg
        pg['type_properties'] = sql('''SELECT typname,typlen,typbyval FROM pg_type
            WHERE typname IN ('numeric','int8') ORDER BY typname;''')
        assert pg['type_properties'] == 'int8|8|t\nnumeric|-1|f', pg
        pg['sum_types'] = sql('''SELECT pg_typeof(sum(v)) FROM
            (VALUES(1::bigint),(2::bigint)) AS t(v);''')
        assert pg['sum_types'] == 'numeric', pg

        connection = duckdb.connect(':memory:')
        with connection:
            duck = {}

            def check(name, query, expected):
                actual = connection.execute(query).fetchall()
                assert actual == expected, (name, actual, expected)
                duck[name] = actual

            check('literal_types', 'SELECT typeof(1.5),typeof(1.50),typeof(1.500);',
                  [('DECIMAL(2,1)', 'DECIMAL(3,2)', 'DECIMAL(4,3)')])
            check('product', 'SELECT typeof(1.8*1.9),CAST(1.8*1.9 AS VARCHAR);',
                  [('DECIMAL(4,2)', '3.42')])
            connection.execute('CREATE TABLE t AS SELECT * FROM (VALUES(1.5),(1.50),(1.500)) v(x);')
            check('column_scale', 'SELECT typeof(x),CAST(x AS VARCHAR) FROM t;',
                  [('DECIMAL(4,3)', '1.500')] * 3)
            check('result_widths', '''SELECT
                typeof(1::DECIMAL(18,2)*1::DECIMAL(18,2)),
                typeof(1::DECIMAL(20,2)*1::DECIMAL(20,2));''',
                  [('DECIMAL(18,4)', 'DECIMAL(38,4)')])
            check('operation_types', '''SELECT
                typeof(1::DECIMAL(10,2)/3::DECIMAL(10,2)),
                typeof(AVG(1::DECIMAL(10,2))),
                typeof(1::DECIMAL(10,2)%3::DECIMAL(10,2));''',
                  [('DOUBLE', 'DOUBLE', 'DECIMAL(10,2)')])
            check('default_decimal', 'SELECT typeof(1::DECIMAL);', [('DECIMAL(18,3)',)])
            try:
                connection.execute('''SELECT CAST(999999999999999999 AS DECIMAL(18,0))
                    * CAST(999999999999999999 AS DECIMAL(18,0));''')
            except duckdb.OutOfRangeException as error:
                assert 'Overflow in multiplication of DECIMAL(18)' in str(error), error
                duck['overflow'] = str(error).splitlines()[0]
            else:
                raise AssertionError('Expected the source example to overflow')
        print(json.dumps({'postgres': pg_version, 'duckdb': duckdb.__version__,
                          'pg': pg, 'duck': duck}, ensure_ascii=False, indent=2))
    finally:
        if (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')
