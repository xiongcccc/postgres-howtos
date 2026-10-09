"""Reproduce recovery conflicts using a disposable physical streaming pair."""
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
article = (Path(__file__).resolve().parents[1] / 'docs/109.md').read_text()
blocks = re.findall(r'<!-- verify:([a-z-]+) -->\s*```sql\n(.*?)\n```', article, re.S)
steps = dict(blocks)
assert len(steps) == len(blocks), 'Duplicate SQL step'
required = ['configure', 'setup', 'hold-a', 'clean-a', 'observe', 'clean-c',
            'hold-b', 'conflicts', 'feedback-config', 'feedback-setup',
            'feedback-hold', 'feedback-check', 'feedback-delete', 'feedback-clean',
            'truncate-setup', 'truncate-clean', 'truncate-hold', 'truncate-vacuum',
            'replication-status', 'cleanup']
assert list(steps) == required, 'Review SQL execution mapping'
results = dict(re.findall(r'<!-- result:([a-z-]+) -->\s*```text\n(.*?)\n```', article, re.S))
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['LC_ALL'] = 'C'


def run(name, *command_args):
    return subprocess.run([str(bin_dir / name), *command_args], env=env,
                          text=True, capture_output=True, check=True, timeout=60)


class Session:
    def __init__(self, socket, port):
        self.proc = subprocess.Popen([str(bin_dir / 'psql'), '-X', '-q',
            '-h', socket, '-p', str(port), '-d', 'postgres',
            '-v', 'ON_ERROR_STOP=0'], env=env, stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        self.pending = False
        self.execute("SET statement_timeout='25s';")

    def send(self, query):
        assert not self.pending
        self.pending = True
        self.started = time.monotonic()
        self.proc.stdin.write((query + '\n\\echo STANDBY_DONE :SQLSTATE\n').encode())
        self.proc.stdin.flush()

    def finish(self, expected='00000'):
        output = b''
        deadline = time.monotonic() + 30
        while True:
            marker = re.search(rb'(?:^|\n)STANDBY_DONE ([0-9A-Z]{5})\r?\n', output)
            if marker:
                self.pending = False
                body = output[:marker.start()].decode().strip()
                assert marker[1].decode() == expected, body
                assert ('ERROR:' in body) == (expected != '00000'), body
                return body
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not select.select([self.proc.stdout], [], [], remaining)[0]:
                raise TimeoutError(output.decode())
            chunk = os.read(self.proc.stdout.fileno(), 65536)
            if not chunk:
                raise RuntimeError(output.decode())
            output += chunk

    def execute(self, query, expected='00000'):
        self.send(query)
        return self.finish(expected)

    def scalar(self, query):
        return self.execute('\\pset format unaligned\n\\pset tuples_only on\n'
                            + query + '\n\\pset format aligned\n\\pset tuples_only off')

    def close(self):
        if self.proc.poll() is None:
            try:
                self.proc.communicate(b'ROLLBACK;\n\\q\n', timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.communicate()


with tempfile.TemporaryDirectory(prefix='howto-109-', dir='/tmp') as temp:
    nodes = {'primary': (str(Path(temp) / 'primary'), 55419),
             'standby': (str(Path(temp) / 'standby'), 55420)}
    sessions = []
    try:
        primary_data, primary_port = nodes['primary']
        standby_data, standby_port = nodes['standby']
        run('initdb', '-D', primary_data, '-A', 'trust', '--no-locale', '-E', 'UTF8')
        common = f"-k {temp} -c listen_addresses='' -c shared_buffers=32MB -c max_connections=20"
        run('pg_ctl', '-D', primary_data, '-l', str(Path(temp) / 'primary.log'),
            '-o', f'-p {primary_port} {common} -c wal_level=replica -c max_wal_senders=4', '-w', 'start')
        run('pg_basebackup', '-h', temp, '-p', str(primary_port),
            '-D', standby_data, '-X', 'stream', '-R', '--checkpoint=fast')
        run('pg_ctl', '-D', standby_data, '-l', str(Path(temp) / 'standby.log'),
            '-o', f'-p {standby_port} {common} -c log_recovery_conflict_waits=on '
            '-c deadlock_timeout=100ms', '-w', 'start')
        for port in [primary_port, standby_port, standby_port, standby_port, standby_port]:
            sessions.append(Session(temp, port))
        p, o, a, b, observer = sessions

        def wait_sql(session, query, expected, timeout=15):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                actual = session.scalar(query)
                if actual == expected:
                    return actual
                time.sleep(0.05)
            raise AssertionError((query, actual, expected))

        def sync():
            lsn = p.scalar('SELECT pg_current_wal_lsn();')
            wait_sql(o, f"SELECT pg_last_wal_replay_lsn() >= '{lsn}'::pg_lsn;", 't')

        def hold(session, name):
            prefix, sleep = steps[name].rsplit('SELECT pg_sleep', 1)
            session.execute(prefix)
            session.send('SELECT pg_sleep' + sleep)

        outputs = {}
        version = p.scalar('SHOW server_version;')
        assert version.startswith('18.'), 'Review version-specific assertions before running'
        assert o.scalar('SELECT pg_is_in_recovery();') == 't'
        o.execute(steps['configure'])
        wait_sql(o, 'SHOW max_standby_streaming_delay;', '4s')
        wait_sql(o, 'SHOW hot_standby_feedback;', 'off')
        p.execute(steps['setup'])
        sync()
        assert o.scalar('SELECT count(*) FROM standby_demo.victim_a;') == '10000'
        assert o.scalar('SELECT count(*) FROM standby_demo.victim_c;') == '10000'
        epoch = time.monotonic()
        hold(a, 'hold-a')
        a_start = a.started - epoch
        p.execute(steps['clean-a'])
        clean_a_at = time.monotonic() - epoch
        wait_sql(observer, "SELECT wait_event FROM pg_stat_activity WHERE backend_type='startup';", 'RecoveryConflictSnapshot')
        outputs['waiting'] = observer.execute(steps['observe'])
        time.sleep(1.2)
        p.execute(steps['clean-c'])
        clean_c_at = time.monotonic() - epoch
        hold(b, 'hold-b')
        b_start = b.started - epoch
        # Observe both cancellations independently of the order we drain stdout.
        all_pids = observer.scalar("SELECT string_agg(pid::text,',' ORDER BY query_start) FROM pg_stat_activity "
                                  "WHERE query='SELECT pg_sleep(20);' AND state='active';")
        pids = [int(pid) for pid in all_pids.split(',')]
        assert len(pids) == 2, all_pids
        finished = {}
        deadline = time.monotonic() + 10
        while len(finished) < 2 and time.monotonic() < deadline:
            states = observer.scalar(f"SELECT string_agg(pid::text,',' ORDER BY pid) FROM pg_stat_activity "
                                     f"WHERE pid IN ({','.join(map(str,pids))}) AND state='active';")
            active = {int(pid) for pid in states.split(',') if pid}
            for pid in pids:
                if pid not in active and pid not in finished:
                    finished[pid] = time.monotonic() - epoch
            time.sleep(0.025)
        outputs['a_error'] = a.finish('40001')
        outputs['b_error'] = b.finish('40001')
        assert all('row versions that must be removed' in outputs[name] for name in ['a_error','b_error'])
        assert len(finished) == 2, finished
        a_end, b_end = [finished[pid] for pid in pids]
        assert 3 < a_end - clean_a_at < 7, (clean_a_at, a_end)
        assert b_end - b_start < 3.5, (b_start, b_end)
        assert abs(b_end - a_end) < 0.5, finished
        a.execute('ROLLBACK;')
        b.execute('ROLLBACK;')
        sync()
        wait_sql(o, "SELECT confl_snapshot FROM pg_stat_database_conflicts WHERE datname=current_database();", '2')
        outputs['conflicts'] = o.execute(steps['conflicts'])

        o.execute(steps['feedback-config'])
        wait_sql(o, 'SHOW hot_standby_feedback;', 'on')
        p.execute(steps['feedback-setup'])
        sync()
        assert a.execute(steps['feedback-hold']).splitlines()[2].strip() == '10000'
        wait_sql(p, 'SELECT backend_xmin IS NOT NULL FROM pg_stat_replication;', 't')
        outputs['feedback_boundary'] = p.execute(steps['feedback-check'])
        outputs['retained'] = p.execute(steps['feedback-delete'])
        after_delete_xmax = p.scalar('SELECT pg_snapshot_xmax(pg_current_snapshot());')
        assert '0 removed, 10000 remain, 10000 are dead but not yet removable' in outputs['retained']
        sync()
        time.sleep(4.2)
        assert a.scalar('SELECT count(*) FROM standby_demo.feedback_rows;') == '10000'
        assert o.scalar('SELECT count(*) FROM standby_demo.feedback_rows;') == '0'
        assert o.scalar("SELECT confl_snapshot FROM pg_stat_database_conflicts WHERE datname=current_database();") == '2'
        a.execute('ROLLBACK;')
        wait_sql(p, f"SELECT age(backend_xmin) <= age('{after_delete_xmax}'::xid) FROM pg_stat_replication;", 't')
        outputs['removed'] = p.execute(steps['feedback-clean'])
        assert '10000 removed, 0 remain, 0 are dead but not yet removable' in outputs['removed'], outputs['removed']
        sync()

        p.execute(steps['truncate-setup'])
        sync()
        tail_xmax = p.scalar('SELECT pg_snapshot_xmax(pg_current_snapshot());')
        wait_sql(p, f"SELECT age(backend_xmin) <= age('{tail_xmax}'::xid) FROM pg_stat_replication;", 't')
        outputs['tail_before'] = p.execute(steps['truncate-clean'])
        assert '10000 removed, 0 remain, 0 are dead but not yet removable' in outputs['tail_before'], outputs['tail_before']
        sync()
        before = int(p.scalar("SELECT pg_relation_size('standby_demo.empty_tail') / current_setting('block_size')::integer;"))
        assert before > 0
        hold(a, 'truncate-hold')
        wait_sql(p, 'SELECT backend_xmin IS NOT NULL FROM pg_stat_replication;', 't')
        outputs['tail_after'] = p.execute(steps['truncate-vacuum'])
        assert p.scalar("SELECT pg_relation_size('standby_demo.empty_tail');") == '0', outputs['tail_after']
        outputs['lock_error'] = a.finish('40001')
        assert 'relation lock for too long' in outputs['lock_error'], outputs['lock_error']
        a.execute('ROLLBACK;')
        sync()
        wait_sql(o, "SELECT confl_lock FROM pg_stat_database_conflicts WHERE datname=current_database();", '1')
        outputs['final_conflicts'] = o.execute(steps['conflicts'])
        outputs['replication'] = p.execute(steps['replication-status'])
        p.execute(steps['cleanup'])
        sync()
        assert o.scalar("SELECT count(*) FROM pg_namespace WHERE nspname='standby_demo';") == '0'
        log = (Path(temp) / 'standby.log').read_text()
        assert 'recovery conflict on snapshot' in log and 'recovery conflict on lock' in log
        if args.check_output:
            mapping = {'waiting': 'waiting', 'conflicts': 'conflicts', 'retained': 'retained',
                       'removed': 'removed', 'tail': 'tail_after', 'lock-error': 'lock_error',
                       'final-conflicts': 'final_conflicts'}
            assert set(results) == set(mapping), 'Missing or unmapped article output'
            normalize = lambda value: '\n'.join(line.rstrip() for line in value.strip().splitlines())
            for name, key in mapping.items():
                assert normalize(results[name]) in normalize(outputs[key]), (name, outputs[key])
        print(json.dumps({'server': version, 'stream_delay': '4s',
            'timeline_seconds': {key: round(value, 3) for key, value in {
                'a_start': a_start, 'clean_a': clean_a_at, 'clean_c': clean_c_at,
                'b_start': b_start, 'a_cancel': a_end, 'b_cancel': b_end}.items()},
            'heap_pages_before_truncate': before, 'outputs': outputs,
            'article_outputs_checked': args.check_output,
            'scope': 'Physical streaming snapshot budget, feedback retention and plain VACUUM truncation; no archive-only recovery'},
            ensure_ascii=False, indent=2))
    finally:
        for session in reversed(sessions):
            session.close()
        for data, _ in reversed(list(nodes.values())):
            if (Path(data) / 'postmaster.pid').exists():
                run('pg_ctl', '-D', data, '-m', 'immediate', '-w', 'stop')
