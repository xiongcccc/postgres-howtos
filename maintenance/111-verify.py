"""Check article 111 examples in a disposable, socket-only PostgreSQL cluster."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', type=Path, required=True)
parser.add_argument('--check-output', action='store_true')
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
article = (Path(__file__).resolve().parents[1] / 'docs/111.md').read_text()
blocks = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
steps = dict(blocks)
assert list(steps) == ['setup', 'nulls-last', 'nulls-first', 'backward', 'prefix', 'skip']
assert len(steps) == len(blocks)
results = dict(re.findall(r'<!-- result:([a-z-]+) -->\s*```text\n(.*?)\n```', article, re.S))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['LC_ALL'] = 'C'
env['PGOPTIONS'] = '-c max_parallel_workers_per_gather=0 -c jit=off -c statement_timeout=15000'


def run(name, *params, sql=None):
    return subprocess.run([str(bin_dir / name), *params], input=sql, env=env,
                          text=True, capture_output=True, check=True, timeout=60).stdout.strip()


with tempfile.TemporaryDirectory(prefix='howto-111-', dir='/tmp') as temp:
    data = Path(temp) / 'data'
    try:
        version = run('postgres', '--version')
        assert re.search(r'PostgreSQL\) 18\.', version), version
        run('initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
        run('pg_ctl', '-D', str(data), '-l', str(Path(temp) / 'postgres.log'),
            '-o', f"-p 55431 -k {temp} -c listen_addresses='' -c shared_buffers=32MB -c max_connections=10", '-w', 'start')

        def sql(query):
            return run('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', temp,
                       '-p', '55431', '-d', 'postgres', sql=query)

        sql(steps['setup'])
        outputs = {name: sql(query) for name, query in blocks if name != 'setup'}
        assert 'Index Only Scan using items_score' in outputs['nulls-last']
        assert 'Sort' not in outputs['nulls-last']
        assert 'Sort Method: top-N heapsort' in outputs['nulls-first']
        assert 'Seq Scan on items (actual rows=300000.00' in outputs['nulls-first']
        assert 'Index Only Scan Backward using items_score' in outputs['backward']
        assert 'Index Cond: (x = 3)' in outputs['prefix'] and 'Sort' not in outputs['prefix']
        assert 'Index Cond: (y = 123453)' in outputs['skip']
        searches = int(re.search(r'Index Searches: (\d+)', outputs['skip'])[1])
        assert searches > 1, outputs['skip']
        assert sql('SELECT x,y FROM btree_demo.items WHERE y=123453;') == '3|123453'
        assert sql('SELECT count(*) FROM btree_demo.items WHERE score IS NULL;') == '60000'
        assert sql('SELECT score IS NULL FROM btree_demo.items ORDER BY score DESC NULLS FIRST LIMIT 1;') == 't'
        sql('CREATE EXTENSION pageinspect;')
        levels = sql("SELECT level+1 FROM bt_metap('btree_demo.items_xy');")
        if args.check_output:
            assert set(results) == {'nulls-last', 'nulls-first', 'skip'}
            for name, expected in results.items():
                assert outputs[name] == expected.strip(), (name, outputs[name], expected)
        print(json.dumps({'version': version, 'outputs': outputs,
                          'items_xy_levels': int(levels), 'article_outputs_checked': args.check_output},
                         ensure_ascii=False, indent=2))
    except subprocess.CalledProcessError as error:
        print(error.stdout)
        print(error.stderr)
        raise
    finally:
        if (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')
