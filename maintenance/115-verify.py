"""Execute article 115 SQL in order and check planner transformations on PG18."""
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
article = (Path(__file__).resolve().parents[1] / 'docs/115.md').read_text()
blocks = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
assert len(blocks) == 38 and len(dict(blocks)) == 38
assert len(re.findall(r'^```sql$', article, re.M)) == len(blocks)
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
env['LC_ALL'] = 'C'
env['PGOPTIONS'] = '-c statement_timeout=30000 -c work_mem=64MB -c jit=off'


def run(name, *params, sql=None):
    return subprocess.run([str(bin_dir / name), *params], input=sql, env=env,
                          text=True, capture_output=True, check=True,
                          timeout=90).stdout.strip()


def walk(node):
    yield node
    for child in node.get('Plans', []):
        yield from walk(child)


with tempfile.TemporaryDirectory(prefix='howto-115-', dir='/tmp') as temp:
    data = Path(temp) / 'data'
    try:
        version = run('postgres', '--version')
        assert 'PostgreSQL) 18.' in version, version
        run('initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
        run('pg_ctl', '-D', str(data), '-l', str(Path(temp) / 'postgres.log'),
            '-o', f"-p 55435 -k {temp} -c listen_addresses='' -c shared_buffers=64MB",
            '-w', 'start')

        def sql(query):
            return run('psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                       '-P', 'null=<NULL>', '-h', temp, '-p', '55435',
                       '-d', 'postgres', sql=query)

        plans, outputs = {}, {}
        for name, query in blocks:
            if query.startswith('EXPLAIN (COSTS OFF)'):
                json_query = query.replace('EXPLAIN (COSTS OFF)',
                                           'EXPLAIN (FORMAT JSON, COSTS OFF)', 1)
                plans[name] = json.loads(sql(json_query))[0]['Plan']
                outputs[name] = sql(query)
            else:
                outputs[name] = sql(query)
        assert len(plans) == 31, len(plans)

        def nodes(name):
            return list(walk(plans[name]))

        def index_nodes(name):
            return [node for node in nodes(name) if 'Index Name' in node]

        def relation_nodes(name, relation):
            return [node for node in nodes(name) if node.get('Relation Name') == relation]

        def has_join(name, kind=None):
            return any('Join Type' in node and (kind is None or kind in node['Join Type'])
                       for node in nodes(name))

        def has_filter(name, relation, fragment):
            return any(fragment in node.get('Filter', '')
                       for node in relation_nodes(name, relation))

        for name in ['constant-add', 'constant-literal', 'constant-reversed',
                     'constant-add-reversed', 'immutable-fold', 'constant-in', 'constant-exists']:
            assert any(node['Index Name'] == 'users_pkey'
                       and node.get('Index Cond') == '(user_id = 200)'
                       for node in index_nodes(name)), (name, outputs[name])
        for name in ['column-expression', 'column-expression-reversed',
                     'expression-index-commuted', 'row-dependent-expression']:
            assert not index_nodes(name), (name, outputs[name])
        assert any(node['Index Name'] == 'users_expr_idx'
                   for node in index_nodes('expression-index-match'))
        assert sql("SELECT provolatile FROM pg_proc WHERE oid='triple(integer)'::regprocedure;") == 'v'
        assert any(node.get('Index Cond') == '(user_id = 300)'
                   for node in index_nodes('sql-inline-fold'))
        assert any('now()' in node.get('Index Cond', '')
                   for node in index_nodes('stable-index-condition'))
        assert all(node['Node Type'] != 'Subquery Scan' for node in nodes('flatten-subquery'))
        assert any(node.get('Index Cond') == '(user_id = 42)'
                   for node in index_nodes('flatten-subquery'))
        assert any(node['Node Type'] == 'Subquery Scan' and 'user_id = 100' in node.get('Filter', '')
                   for node in nodes('limit-barrier'))
        assert any(node['Node Type'] == 'Limit' for node in nodes('limit-barrier'))
        assert not has_filter('limit-barrier', 'users', 'user_id = 100')
        assert outputs['limit-original-result'] in ('0', '1')
        assert outputs['limit-pushed-result'] == '1'
        assert has_filter('group-filter-equality', 'orders', 'order_user_id = 100')
        assert has_filter('group-filter-range', 'orders', 'order_user_id > 100')
        assert any(node.get('Index Cond') == '(user_id = 100)'
                   for node in index_nodes('join-equality-propagation'))
        assert any('o.order_user_id' in node.get('Index Cond', '')
                   for node in index_nodes('join-range-propagation'))
        assert not has_join('left-join-elimination')
        assert not relation_nodes('left-join-elimination', 'users')
        assert has_join('foreign-key-inner-join', 'Inner')
        assert relation_nodes('foreign-key-inner-join', 'users')
        assert relation_nodes('foreign-key-inner-join', 'orders')
        assert not has_join('self-join-elimination')
        assert len(relation_nodes('self-join-elimination', 'orders')) == 1
        for name in ['in-semi-join', 'exists-semi-join', 'semi-join-pushdown']:
            assert has_join(name, 'Semi'), (name, outputs[name])
        assert has_join('not-exists-anti-join', 'Anti')
        assert not has_join('not-in-subplan')
        assert any('hashed SubPlan' in node.get('Filter', '') for node in nodes('not-in-subplan'))
        assert has_filter('semi-join-pushdown', 'orders', 'order_user_id = 100')
        assert any(node['Node Type'] == 'Limit' for node in nodes('min-index-shortcut'))
        assert any(node['Index Name'] == 'orders_pkey' for node in index_nodes('min-index-shortcut'))
        assert not any(node['Node Type'] == 'Limit' for node in nodes('count-scan'))
        assert any(node['Node Type'] == 'Aggregate' for node in nodes('count-scan'))
        assert any(node.get('Group Key') == ['order_user_id'] for node in nodes('group-min-scan'))

        checks = {}
        checks['row_counts'] = sql('SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM orders);')
        assert checks['row_counts'] == '200000|500000'
        checks['min_and_count'] = sql('SELECT min(order_id),count(order_id) FROM orders;')
        assert checks['min_and_count'] == '1|500000'
        checks['null_semantics'] = sql('''SELECT
            1 NOT IN (SELECT x FROM (VALUES (1),(NULL::int)) t(x)),
            2 NOT IN (SELECT x FROM (VALUES (1),(NULL::int)) t(x)),
            NOT EXISTS (SELECT 1 FROM (VALUES (1),(NULL::int)) t(x) WHERE x=2);''')
        assert checks['null_semantics'] == 'f|<NULL>|t'
        checks['ordered_limit'] = sql('''SELECT
            (SELECT count(*) FROM (SELECT user_id FROM users ORDER BY user_id LIMIT 3) t WHERE user_id=100),
            (SELECT count(*) FROM (SELECT user_id FROM users WHERE user_id=100 ORDER BY user_id LIMIT 3) t);''')
        assert checks['ordered_limit'] == '0|1'
        checks['self_join_switch'] = sql('''SET enable_self_join_elimination=off;
            EXPLAIN (FORMAT JSON, COSTS OFF)
            SELECT a.order_status,b.order_user_id FROM orders a JOIN orders b ON a.order_id=b.order_id;''')
        disabled = json.loads(checks.pop('self_join_switch'))[0]['Plan']
        assert any('Join Type' in node for node in walk(disabled))
        checks['self_join_switch'] = 'off: join retained; on: join eliminated'
        if args.check_output:
            expected = {}
            pattern = r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```'
            for match in re.finditer(pattern, article, re.S):
                name, query = match.groups()
                if query.startswith('EXPLAIN (COSTS OFF)'):
                    result = re.match(r'\s*```text\n(.*?)\n```', article[match.end():], re.S)
                    assert result, ('Missing displayed plan', name)
                    expected[name] = result.group(1).strip()
            assert set(expected) == set(plans), set(plans) - set(expected)
            for name, output in expected.items():
                assert outputs[name] == output, (name, outputs[name], output)
        print(json.dumps({'postgres': version, 'source_sql_blocks': len(blocks),
                          'explain_plans': len(plans), 'article_outputs_checked': args.check_output,
                          'checks': checks,
                          'plans': outputs}, ensure_ascii=False, indent=2))
    finally:
        if (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')
