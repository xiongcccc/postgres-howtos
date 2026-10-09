"""Check article 107's FK locks and diagnostics in a disposable cluster."""
import argparse
import json
import os
from pathlib import Path
import re
import select
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', type=Path, required=True)
parser.add_argument('--check-output', action='store_true',
                    help='Compare the article result blocks with this fresh run')
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
article = (Path(__file__).resolve().parents[1] / 'docs/107.md').read_text()
sql_blocks = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
blocks = dict(sql_blocks)
required = {'setup', 'a', 'observe-a', 'b', 'observe-ab', 'b-commit',
            'c', 'observe-ac', 'finish', 'final', 'cleanup', 'slru', 'activity'}
if set(blocks) != required or len(sql_blocks) != len(required):
    raise ValueError('Expected all uniquely named experiment and diagnostic SQL blocks')
result_blocks = dict(re.findall(r'<!-- result:([a-z-]+) -->\s*```text\n(.*?)\n```', article, re.S))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['LC_ALL'] = 'C'


def run(name, *args, **kwargs):
    return subprocess.run([str(bin_dir / name), *args], env=env,
                          check=True, text=True, capture_output=True,
                          timeout=60, **kwargs)


with tempfile.TemporaryDirectory(prefix='howto-107-', dir='/tmp') as temp:
    data = str(Path(temp) / 'data')
    sessions = []
    run('initdb', '-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8')
    try:
        run('pg_ctl', '-D', data, '-l', str(Path(temp) / 'server.log'), '-o',
            f"-p 55417 -k {temp} -c listen_addresses='' -c shared_buffers=32MB",
            '-w', 'start')
        psql_args = ['-X', '-qAt', '-h', temp, '-p', '55417', '-d', 'postgres']

        def sql(query):
            return run('psql', *psql_args, '-v', 'ON_ERROR_STOP=1',
                       input="SET statement_timeout='5s';\n" + query).stdout.strip()

        class Session:
            def __init__(self):
                self.p = subprocess.Popen([str(bin_dir / 'psql'), '-X', '-q',
                    '-h', temp, '-p', '55417', '-d', 'postgres',
                    '-v', 'ON_ERROR_STOP=0'], env=env, stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                sessions.append(self.p)
                self.execute("SET statement_timeout='5s'; SET idle_in_transaction_session_timeout='30s';")
                self.pid = self.scalar('SELECT pg_backend_pid();')

            def scalar(self, query):
                return self.execute('\\pset format unaligned\n\\pset tuples_only on\n'
                                    + query + '\n\\pset format aligned\n\\pset tuples_only off')

            def execute(self, query):
                self.p.stdin.write((query + '\n\\echo MX_DONE :SQLSTATE\n').encode())
                self.p.stdin.flush()
                output = b''
                deadline = time.monotonic() + 10
                while True:
                    marker = re.search(rb'(?:^|\n)MX_DONE ([0-9A-Z]{5})\r?\n', output)
                    if marker:
                        body = output[:marker.start()].decode().strip()
                        assert marker[1] == b'00000', body
                        assert not re.search(r'(?:^|\n)(?:ERROR|FATAL):', body), body
                        return body
                    remaining = deadline - time.monotonic()
                    if remaining <= 0 or not select.select([self.p.stdout], [], [], remaining)[0]:
                        raise TimeoutError(output.decode())
                    chunk = os.read(self.p.stdout.fileno(), 65536)
                    if not chunk:
                        raise RuntimeError(output.decode())
                    output += chunk

        a, b, c, observer = Session(), Session(), Session(), Session()
        outputs = {'setup': observer.execute(blocks['setup'])}
        assert sql('SELECT id, name, xmax FROM mx_demo.customers ORDER BY id;') == '1|Alice|0\n2|Bob|0'
        outputs['a'] = a.execute(blocks['a'])
        xid_a = a.scalar('SELECT pg_current_xact_id();')
        outputs['observe-a'] = observer.execute(blocks['observe-a'])
        xmax_a = sql('SELECT xmax FROM mx_demo.customers WHERE id=1;')
        assert xmax_a == xid_a, (xmax_a, xid_a)
        outputs['b'] = b.execute(blocks['b'])
        xid_b = b.scalar('SELECT pg_current_xact_id();')
        outputs['observe-ab'] = observer.execute(blocks['observe-ab'])
        multi_ab = sql('SELECT xmax FROM mx_demo.customers WHERE id=1;')
        assert observer.scalar("SELECT :'mx_ab';") == multi_ab
        members = "SELECT json_agg(m ORDER BY xid::text::bigint) FROM pg_get_multixact_members('%s'::xid) m;"
        members_ab = json.loads(sql(members % multi_ab))
        assert {m['xid'] for m in members_ab} == {xid_a, xid_b}, members_ab
        assert {m['mode'] for m in members_ab} == {'keysh'}, members_ab
        b.execute(blocks['b-commit'])
        outputs['c'] = c.execute(blocks['c'])
        xid_c = c.scalar('SELECT pg_current_xact_id();')
        outputs['observe-ac'] = observer.execute(blocks['observe-ac'])
        multi_ac = sql('SELECT xmax FROM mx_demo.customers WHERE id=1;')
        members_ac = json.loads(sql(members % multi_ac))
        assert {m['xid'] for m in members_ac} == {xid_a, xid_c}, members_ac
        assert {m['mode'] for m in members_ac} == {'keysh'}, members_ac
        assert multi_ab != multi_ac, (multi_ab, multi_ac)
        assert json.loads(sql(members % multi_ab)) == members_ab
        assert sql('SELECT xmax FROM mx_demo.customers WHERE id=2;') == '0'
        settings = sql("SELECT name, setting, unit, context FROM pg_settings "
                       "WHERE name IN ('multixact_offset_buffers','multixact_member_buffers') ORDER BY name;")
        assert 'multixact_member_buffers|32|8kB|postmaster' in settings, settings
        assert 'multixact_offset_buffers|16|8kB|postmaster' in settings, settings
        stats, activity = (sql(blocks[name]) for name in ['slru', 'activity'])
        assert {row.split('|')[0] for row in stats.splitlines()} == {'multixact_member', 'multixact_offset'}, stats
        assert {row.split('|')[0] for row in activity.splitlines()} == {a.pid, c.pid}, activity
        c.execute(blocks['finish'])
        a.execute(blocks['finish'])
        outputs['final'] = observer.execute(blocks['final'])
        assert sql('SELECT id, customer_id, amount FROM mx_demo.orders ORDER BY id;') == '100|1|100.00\n101|1|200.00\n102|1|300.00'
        assert sql('SELECT xmax FROM mx_demo.customers WHERE id=1;') == multi_ac
        observer.execute(blocks['cleanup'])
        assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='mx_demo';") == '0'
        if args.check_output:
            assert set(result_blocks) == set(outputs), 'Missing or extra article result blocks'
            normalize = lambda value: '\n'.join(line.rstrip() for line in value.strip().splitlines())
            for name, output in outputs.items():
                assert normalize(result_blocks[name]) == normalize(output), f'{name}: output differs\n{output}'
        print(json.dumps({'server': sql('SHOW server_version;'), 'xid_a': xid_a,
                          'xmax_after_a': xmax_a, 'multi_ab': multi_ab, 'members_ab': members_ab,
                          'multi_ac': multi_ac, 'members_ac': members_ac,
                          'pg_settings': settings, 'pg_stat_slru': stats,
                          'long_transactions': activity,
                          'outputs': outputs,
                          'article_outputs_checked': args.check_output,
                          'scope': 'Compatible FK locks and MultiXact replacement; not a throughput benchmark'},
                         ensure_ascii=False, indent=2))
    finally:
        for p in sessions:
            if p.poll() is None:
                try:
                    p.stdin.write(b'ROLLBACK;\n\\q\n')
                    p.stdin.flush()
                    p.communicate(timeout=5)
                except (BrokenPipeError, subprocess.TimeoutExpired):
                    p.kill()
                    p.communicate()
        if (Path(data) / 'postmaster.pid').exists():
            run('pg_ctl', '-D', data, '-m', 'immediate', '-w', 'stop')
