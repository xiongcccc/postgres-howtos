"""Verify article 108's bounded memory and query-error examples in a fresh cluster."""
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
parser.add_argument('--check-output', action='store_true')
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
article = (Path(__file__).resolve().parents[1] / 'docs/108.md').read_text()
steps = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
required = ['setup', 'sample', 'sort-low', 'sort-high', 'probe', 'recursive',
            'after-recursive', 'temp-limit', 'after-temp-limit', 'timeout',
            'after-timeout', 'cleanup']
assert [name for name, _ in steps] == required, 'Missing, duplicate, or reordered SQL steps'
results = dict(re.findall(r'<!-- result:([a-z-]+) -->\s*```text\n(.*?)\n```', article, re.S))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['LC_ALL'] = 'C'


def run(name, *command_args, **kwargs):
    return subprocess.run([str(bin_dir / name), *command_args], env=env,
                          text=True, capture_output=True, check=True, timeout=60, **kwargs)


with tempfile.TemporaryDirectory(prefix='howto-108-', dir='/tmp') as temp:
    data = str(Path(temp) / 'data')
    session = None
    run('initdb', '-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8')
    try:
        run('pg_ctl', '-D', data, '-l', str(Path(temp) / 'server.log'), '-o',
            f"-p 55418 -k {temp} -c listen_addresses='' -c shared_buffers=32MB "
            '-c max_connections=10 -c log_temp_files=0', '-w', 'start')
        psql_args = ['-X', '-q', '-h', temp, '-p', '55418', '-d', 'postgres']
        session = subprocess.Popen([str(bin_dir / 'psql'), *psql_args,
            '-v', 'ON_ERROR_STOP=0'], env=env, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

        def execute(query, expected='00000'):
            session.stdin.write((query + '\n\\echo MEM_DONE :SQLSTATE\n').encode())
            session.stdin.flush()
            output = b''
            deadline = time.monotonic() + 25
            while True:
                marker = re.search(rb'(?:^|\n)MEM_DONE ([0-9A-Z]{5})\r?\n', output)
                if marker:
                    body = output[:marker.start()].decode().strip()
                    assert marker[1].decode() == expected, body
                    if expected == '00000':
                        assert not re.search(r'(?:^|\n)(?:ERROR|FATAL):', body), body
                    return body
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([session.stdout], [], [], remaining)[0]:
                    raise TimeoutError(output.decode())
                chunk = os.read(session.stdout.fileno(), 65536)
                if not chunk:
                    raise RuntimeError(output.decode())
                output += chunk

        def scalar(query):
            return execute('\\pset format unaligned\n\\pset tuples_only on\n'
                           + query + '\n\\pset format aligned\n\\pset tuples_only off')

        version = scalar('SHOW server_version;')
        assert version.startswith('18.'), 'The memory-context path example requires PostgreSQL 18'
        pid_before = scalar('SELECT pg_backend_pid();')
        outputs = {}
        states = {'temp-limit': '53400', 'timeout': '57014'}
        for name, query in steps:
            outputs[name] = execute(query, states.get(name, '00000'))
            if name == 'recursive':
                row = outputs[name].splitlines()[2].split('|')
                assert int(row[0]) == 100000, outputs[name]
                assert 1 < float(row[1]) < 32, outputs[name]
            if name == 'after-recursive':
                assert int(outputs[name].splitlines()[2]) == 0, outputs[name]
            if name in ['after-temp-limit', 'after-timeout']:
                assert int(outputs[name].splitlines()[2]) == 1, outputs[name]
                assert scalar('SELECT pg_backend_pid();') == pid_before
        assert 'external merge' in outputs['sort-low'], outputs['sort-low']
        assert 'quicksort' in outputs['sort-high'], outputs['sort-high']
        assert scalar("SELECT count(*) FROM pg_namespace WHERE nspname='bad_query_demo';") == '0'
        assert scalar('SHOW work_mem;') == '4MB'
        temp_files_logged = 'temporary file:' in (Path(temp) / 'server.log').read_text()
        assert temp_files_logged, 'Expected the low-memory sort to produce temporary files'
        if args.check_output:
            assert set(results) == {'sample', 'sort-low', 'sort-high', 'recursive',
                                    'after-recursive', 'temp-limit', 'after-temp-limit',
                                    'timeout', 'after-timeout'}
            normalize = lambda value: '\n'.join(line.rstrip() for line in value.strip().splitlines())
            for name, expected in results.items():
                assert normalize(outputs[name]) == normalize(expected), f'{name}: output differs\n{outputs[name]}'
        print(json.dumps({'server': version, 'backend_pid_unchanged': True,
                          'error_sqlstates': states, 'outputs': outputs,
                          'temp_files_logged': temp_files_logged,
                          'article_outputs_checked': args.check_output,
                          'scope': 'Bounded 100k-node test; no OOM, Linux overcommit, or provider benchmark'},
                         ensure_ascii=False, indent=2))
    finally:
        if session is not None and session.poll() is None:
            try:
                session.communicate(b'ROLLBACK;\n\\q\n', timeout=5)
            except subprocess.TimeoutExpired:
                session.kill()
                session.communicate()
        if (Path(data) / 'postmaster.pid').exists():
            run('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')
