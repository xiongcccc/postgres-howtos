"""Check TOAST mechanisms from article 116 on an isolated, reduced PG18 dataset."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', type=Path, required=True)
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
article = (Path(__file__).resolve().parents[1] / 'docs/116.md').read_text()
blocks = re.findall(r'<!-- verify:([a-z0-9-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
assert len(blocks) == len(dict(blocks))
assert len(blocks) == len(re.findall(r'^```sql$', article, re.M))
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
env['LC_ALL'] = 'C'
env['PGOPTIONS'] = '-c statement_timeout=30000 -c jit=off -c max_parallel_workers_per_gather=0'


def run(name, *params, sql=None):
    return subprocess.run([str(bin_dir / name), *params], input=sql, env=env,
                          text=True, capture_output=True, check=True,
                          timeout=90).stdout.strip()


def walk(node):
    yield node
    for child in node.get('Plans', []):
        yield from walk(child)


with tempfile.TemporaryDirectory(prefix='howto-116-', dir='/tmp') as temp:
    data = Path(temp) / 'data'
    try:
        version = run('postgres', '--version')
        assert 'PostgreSQL) 18.' in version, version
        run('initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
        run('pg_ctl', '-D', str(data), '-l', str(Path(temp) / 'postgres.log'),
            '-o', f"-p 55436 -k {temp} -c listen_addresses='' -c shared_buffers=64MB",
            '-w', 'start')

        def sql(query):
            return run('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                       '-P', 'null=<NULL>', '-h', temp, '-p', '55436',
                       '-d', 'postgres', sql=query)

        def explain(query):
            return json.loads(sql('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query))[0]['Plan']

        outputs, checks = {}, {}
        for name, original in blocks:
            # Limit resource use, preserving payload distribution and every SQL operation.
            query = original.replace('\\timing on\n', '')
            if name == 'load':
                assert 'generate_series(1, 100000)' in query
                query = query.replace('generate_series(1, 100000)', 'generate_series(1, 1000)')
            if name.startswith('benchmark-'):
                assert 'generate_series(1, 100000)' in query
                query = query.replace('generate_series(1, 100000)', 'generate_series(1, 200)')
            if name.startswith('offset-'):
                query = query.replace('OFFSET 99999', 'OFFSET 999')
            if name == 'inspect-page':
                block = sql("SELECT split_part(trim(both '()' from ctid::text), ',', 1) "
                            "FROM event_log WHERE event_id=335;")
                query = query.replace("'event_log', 57", f"'event_log', {int(block)}")
            if name == 'update':
                sql('CREATE TABLE before_update AS SELECT event_id, '
                    'pg_column_toast_chunk_id(event_data) AS toast_id FROM event_log;')
            outputs[name] = sql(query)
            if name == 'main-copy':
                checks['row_counts'] = sql('SELECT (SELECT count(*) FROM event_log), '
                                          '(SELECT count(*) FROM non_toast);')
                assert checks['row_counts'] == '1000|1000'
                checks['field_999_counts'] = sql("SELECT (SELECT count(event_data->>'field_999') FROM event_log), "
                                               "(SELECT count(event_data->>'field_999') FROM non_toast);")
                assert checks['field_999_counts'] == '2|2'
                checks['external_counts'] = sql('SELECT '
                    '(SELECT count(*) FROM event_log WHERE pg_column_toast_chunk_id(event_data) IS NOT NULL), '
                    '(SELECT count(*) FROM non_toast WHERE pg_column_toast_chunk_id(event_data) IS NOT NULL);')
                extended, main = map(int, checks['external_counts'].split('|'))
                assert 0 < extended < 1000 and main < extended
                checks['heap_bytes'] = sql("SELECT pg_relation_size('event_log'),pg_relation_size('non_toast');")
                small, large = map(int, checks['heap_bytes'].split('|'))
                assert small < large
                checks['count_buffers'] = explain('SELECT count(event_data) FROM event_log;')
                checks['field_buffers'] = explain("SELECT count(event_data->>'field_999') FROM event_log;")
                count_plan, field_plan = checks['count_buffers'], checks['field_buffers']
                touches = lambda plan: plan['Shared Hit Blocks'] + plan['Shared Read Blocks']
                assert touches(field_plan) > touches(count_plan)
                checks['toast_chunk_max'] = sql('SELECT max(octet_length(chunk_data)) FROM ' +
                    sql("SELECT reltoastrelid::regclass FROM pg_class WHERE oid='event_log'::regclass;") + ';')
                assert checks['toast_chunk_max'] == '1996'
            if name == 'update':
                checks['changed_toast_ids'] = sql('SELECT count(*) FROM event_log e JOIN before_update b USING(event_id) '
                    'WHERE pg_column_toast_chunk_id(e.event_data) IS DISTINCT FROM b.toast_id;')
                assert checks['changed_toast_ids'] == '0'
            if name == 'split':
                checks['split_rows'] = sql('SELECT count(*) FROM event_log e JOIN event_log_data d USING(event_id);')
                assert checks['split_rows'] == '1000'
                checks['identity_after_explicit_copy'] = sql('SELECT last_value,is_called FROM event_new_event_id_seq;')
                assert checks['identity_after_explicit_copy'] == '1|f'
                checks['split_heap_bytes'] = sql("SELECT pg_relation_size('event_log');")
                assert int(checks['split_heap_bytes']) < int(checks['heap_bytes'].split('|')[0])
            if name == 'view-plan':
                plan = explain('SELECT event_id,strike,shares FROM event_log_all WHERE event_id=42;')
                assert not any('Join Type' in n for n in walk(plan))
                assert not any(n.get('Relation Name') == 'event_log_data' for n in walk(plan))
                checks['view_join_eliminated'] = True
                with_data = explain('SELECT event_id,event_data FROM event_log_all WHERE event_id=42;')
                assert any(n.get('Relation Name') == 'event_log_data' for n in walk(with_data))
                checks['view_join_retained_when_needed'] = True
            if name.startswith('benchmark-'):
                assert outputs[name] == '18000000', (name, outputs[name])
                method = name.removeprefix('benchmark-')
                assert sql('SELECT DISTINCT pg_column_compression(payload) FROM squeeze;') == method

        checks['low_target_probe'] = sql('''CREATE TABLE target_probe (payload text) WITH (toast_tuple_target=128);
            ALTER TABLE target_probe ALTER payload SET STORAGE EXTERNAL;
            INSERT INTO target_probe VALUES (repeat('x',512)),(repeat('x',3000));
            SELECT length(payload),pg_column_toast_chunk_id(payload) IS NOT NULL
            FROM target_probe ORDER BY length(payload);''')
        assert checks['low_target_probe'] == '512|f\n3000|t'
        print(json.dumps({'postgres': version, 'article_sql_blocks': len(blocks),
                          'scope': {'event_rows': 1000, 'compression_benchmark_rows': 200,
                                    'original_timings_reproduced': False},
                          'checks': checks, 'outputs': outputs}, ensure_ascii=False, indent=2))
    finally:
        if (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')
