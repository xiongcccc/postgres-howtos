"""Run article 110 in two disposable socket-only PostgreSQL 18/19 clusters."""
import argparse
import json
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg18-bin', type=Path, required=True)
parser.add_argument('--pg19-bin', type=Path, required=True)
parser.add_argument('--hint-build', type=Path,
                    help='Optional compiled pg_hint_plan source directory; no system installation needed')
parser.add_argument('--check-output', action='store_true')
args = parser.parse_args()
article = (Path(__file__).resolve().parents[1] / 'docs/110.md').read_text()
blocks = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
steps = dict(blocks)
assert len(steps) == len(blocks), 'Duplicate SQL step'
required = ['setup', 'baseline', 'planner-switch', 'hint-scan', 'hint-table-set',
            'hint-table-priority', 'advice-generate', 'advice-scan',
            'advice-invalid', 'stash-set']
assert list(steps) == required, 'Review SQL execution mapping'
results = dict(re.findall(r'<!-- result:([a-z-]+) -->\s*```text\n(.*?)\n```', article, re.S))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['LC_ALL'] = 'C'

# Auxiliary checks and teardown stay out of the reader-facing examples.
fixtures = {
    'disabled': '''
CREATE TABLE hint_demo.heap_only AS
SELECT id FROM hint_demo.items WHERE id <= 10;
ANALYZE hint_demo.heap_only;
BEGIN;
SET LOCAL enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT count(*) FROM hint_demo.heap_only;
ROLLBACK;
''',
    'hint-alias': '''
EXPLAIN (COSTS OFF)
/*+ SeqScan(items) */
SELECT payload FROM hint_demo.items AS i WHERE id = 42;
''',
    'hint-table-clear': '''
DELETE FROM hint_plan.hints WHERE application_name = 'howto110';
RESET pg_hint_plan.enable_hint_table;
EXPLAIN (COSTS OFF)
SELECT payload FROM hint_demo.items AS i WHERE id = 42;
''',
    'hint-cleanup': '''
DELETE FROM hint_plan.hints WHERE application_name = 'howto110';
RESET pg_hint_plan.enable_hint_table;
RESET application_name;
RESET compute_query_id;
DROP EXTENSION pg_hint_plan;
DROP SCHEMA hint_demo CASCADE;
''',
    'advice-cleanup': '''
RESET pg_stash_advice.stash_name;
RESET pg_plan_advice.advice;
SELECT pg_drop_advice_stash('howto110');
DROP EXTENSION pg_stash_advice;
DROP SCHEMA hint_demo CASCADE;
''',
}


def run(bin_dir, name, *command_args):
    return subprocess.run([str(bin_dir / name), *command_args], env=env,
                          text=True, capture_output=True, check=True, timeout=60)


class Session:
    def __init__(self, bin_dir, socket, port):
        self.proc = subprocess.Popen([str(bin_dir / 'psql'), '-X', '-qAt',
            '-h', socket, '-p', str(port), '-d', 'postgres', '-v', 'ON_ERROR_STOP=0'],
            env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    def execute(self, query):
        self.proc.stdin.write((query + '\n\\echo HINT_DONE :SQLSTATE\n').encode())
        self.proc.stdin.flush()
        output = b''
        deadline = time.monotonic() + 30
        while True:
            marker = re.search(rb'(?:^|\n)HINT_DONE ([0-9A-Z]{5})\r?\n', output)
            if marker:
                body = output[:marker.start()].decode().strip()
                assert marker[1].decode() == '00000', body
                assert not re.search(r'(?:^|\n)(?:ERROR|FATAL):', body), body
                return body
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not select.select([self.proc.stdout], [], [], remaining)[0]:
                raise TimeoutError(output.decode())
            chunk = os.read(self.proc.stdout.fileno(), 65536)
            if not chunk:
                raise RuntimeError(output.decode())
            output += chunk

    def close(self):
        if self.proc.poll() is None:
            try:
                self.proc.communicate(b'ROLLBACK;\n\\q\n', timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.communicate()


def bind_query_id(session):
    plan = json.loads(session.execute('SET compute_query_id=on; '
        'EXPLAIN (VERBOSE, FORMAT JSON) '
        'SELECT payload FROM hint_demo.items AS i WHERE id=42;'))
    query_id = plan[0]['Query Identifier']
    assert isinstance(query_id, int)
    session.execute(f'\\set query_id {query_id}')


with tempfile.TemporaryDirectory(prefix='howto-110-', dir='/tmp') as temp:
    nodes = []
    sessions = []
    output = {}
    versions = {}
    try:
        for major, port, bin_dir in [(18, 55421, args.pg18_bin.resolve()),
                                     (19, 55422, args.pg19_bin.resolve())]:
            version = run(bin_dir, 'postgres', '--version').stdout.strip()
            assert re.search(r'PostgreSQL\) ' + str(major) + r'(?:\D|$)', version), version
            versions[str(major)] = version
            data = Path(temp) / str(major)
            run(bin_dir, 'initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
            options = (f"-p {port} -k {temp} -c listen_addresses='' "
                       '-c shared_buffers=32MB -c max_connections=10')
            if major == 18 and args.hint_build:
                source = args.hint_build.resolve()
                extension = Path(temp) / 'share' / 'extension'
                extension.mkdir(parents=True)
                for file in [*source.glob('*.control'), *source.glob('pg_hint_plan--*.sql')]:
                    shutil.copy2(file, extension / file.name)
                assert (extension / 'pg_hint_plan.control').exists()
                assert any((source / ('pg_hint_plan' + suffix)).exists()
                           for suffix in ['.so', '.dylib', '.dll'])
                options += (f" -c dynamic_library_path='{source}:$libdir'"
                            f" -c extension_control_path='{extension.parent}:$system'")
            if major == 19:
                options += ' -c shared_preload_libraries=pg_plan_advice,pg_stash_advice'
            log = Path(temp) / f'{major}.log'
            nodes.append((bin_dir, data))
            run(bin_dir, 'pg_ctl', '-D', str(data), '-l', str(log), '-o', options, '-w', 'start')
            s = Session(bin_dir, temp, port)
            sessions.append(s)
            s.execute("SET statement_timeout='10s'; SET jit=off;")
            s.execute(steps['setup'])
            for step in ['baseline', 'planner-switch']:
                value = s.execute(steps[step])
                if major == 18:
                    output[step] = value
                else:
                    assert value == output[step], (step, value, output[step])
            disabled = s.execute(fixtures['disabled'])
            assert 'Disabled: true' in disabled, disabled
            output[f'disabled-pg{major}'] = disabled
            assert 'Index Scan using items_pkey' in output['baseline']
            assert 'Rows Removed by Filter: 19999' in output['planner-switch']
            assert s.execute('SHOW enable_indexscan; SHOW enable_seqscan;') == 'on\non'

            if major == 18:
                output['hint-scan'] = s.execute(steps['hint-scan'])
                output['hint-alias'] = s.execute(fixtures['hint-alias'])
                bind_query_id(s)
                for step in ['hint-table-set', 'hint-table-priority']:
                    output[step] = s.execute(steps[step])
                assert output['hint-scan'] == output['planner-switch'], output['hint-scan']
                assert 'Index Scan' in output['hint-alias'], output['hint-alias']
                assert 'Seq Scan' in output['hint-table-priority'], output['hint-table-priority']
                assert s.execute("SELECT extversion FROM pg_extension WHERE extname='pg_hint_plan';") == '1.8.1'
                constant_plan = s.execute('EXPLAIN (COSTS OFF) SELECT payload FROM hint_demo.items AS i WHERE id=43;')
                assert 'Seq Scan' in constant_plan, constant_plan
                s.execute("SET application_name='other_application';")
                other_plan = s.execute('EXPLAIN (COSTS OFF) SELECT payload FROM hint_demo.items AS i WHERE id=42;')
                assert 'Index Scan' in other_plan, other_plan
                output['hint-scope'] = {'other_constant': constant_plan, 'other_application': other_plan}
                output['hint-table-clear'] = s.execute(fixtures['hint-table-clear'])
                assert 'Index Scan' in output['hint-table-clear'], output['hint-table-clear']
                s.execute(fixtures['hint-cleanup'])
            else:
                for step in ['advice-generate', 'advice-scan', 'advice-invalid']:
                    output[step] = s.execute(steps[step])
                bind_query_id(s)
                output['stash-set'] = s.execute(steps['stash-set'])
                assert 'Generated Plan Advice:' in output['advice-generate'], output['advice-generate']
                assert 'SEQ_SCAN(i) /* matched */' in output['advice-scan'], output['advice-scan']
                assert 'inapplicable' in output['advice-invalid'] and 'failed' in output['advice-invalid'], output['advice-invalid']
                assert 'SEQ_SCAN(i) /* matched */' in output['stash-set'], output['stash-set']
                s.close()
                s = Session(bin_dir, temp, port)
                sessions.append(s)
                output['stash-reconnect'] = s.execute("SET pg_stash_advice.stash_name='howto110'; "
                    'EXPLAIN (COSTS OFF) SELECT payload FROM hint_demo.items AS i WHERE id=42;')
                assert 'SEQ_SCAN(i) /* matched */' in output['stash-reconnect']
                s.close()
                run(bin_dir, 'pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')
                assert (data / 'pg_stash_advice.tsv').exists(), 'Expected clean shutdown to persist the stash'
                run(bin_dir, 'pg_ctl', '-D', str(data), '-l', str(log), '-o', options, '-w', 'start')
                s = Session(bin_dir, temp, port)
                sessions.append(s)
                output['stash-restart'] = s.execute("SET pg_stash_advice.stash_name='howto110'; "
                    'EXPLAIN (COSTS OFF) SELECT payload FROM hint_demo.items AS i WHERE id=42;')
                assert 'SEQ_SCAN(i) /* matched */' in output['stash-restart'], output['stash-restart']
                cleanup, remainder = fixtures['advice-cleanup'].split('DROP EXTENSION', 1)
                s.execute(cleanup)
                assert s.execute("SELECT count(*) FROM pg_get_advice_stashes() WHERE stash_name='howto110';") == '0'
                s.execute('DROP EXTENSION' + remainder)
            assert s.execute("SELECT count(*) FROM pg_namespace WHERE nspname='hint_demo';") == '0'
        if args.check_output:
            assert set(results) == {'baseline', 'planner-switch',
                                    'hint-table-priority', 'advice-generate', 'advice-scan',
                                    'advice-invalid'}
            normalize = lambda value: '\n'.join(line.rstrip() for line in value.strip().splitlines())
            for name, expected in results.items():
                assert normalize(expected) == normalize(output[name]), (name, output[name], expected)
        print(json.dumps({'versions': versions, 'outputs': output,
                          'article_outputs_checked': args.check_output,
                          'scope': 'Plan selection, rule matching, precedence and clean-restart persistence; no performance benchmark'},
                         ensure_ascii=False, indent=2))
    except subprocess.CalledProcessError as error:
        print(error.stdout)
        print(error.stderr)
        raise
    finally:
        for session in reversed(sessions):
            session.close()
        for bin_dir, data in reversed(nodes):
            if (data / 'postmaster.pid').exists():
                run(bin_dir, 'pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')
