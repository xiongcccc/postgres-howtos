"""Test article 100 in a disposable PostgreSQL cluster, with no external services."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True, type=Path)
    args = parser.parse_args()
    text = (Path(__file__).resolve().parents[1] / 'docs/100.md').read_text()
    examples = dict(re.findall(r'<!-- example: ([\w-]+) -->\n```sql\n(.*?)\n```', text, re.S))
    children = []
    with tempfile.TemporaryDirectory(prefix='howto100-', dir='/tmp') as tmp:
        env = dict(os.environ, PGHOST=tmp, PGPORT='55450', PGDATABASE='postgres',
                   PGUSER=os.environ.get('USER', ''), PGOPTIONS='')
        data = str(Path(tmp) / 'data')
        def tool(name, *parts):
            return subprocess.run([str(args.pg_bin / name), *parts], env=env,
                                  text=True, capture_output=True, check=True)
        tool('initdb', '-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8')
        tool('pg_ctl', '-D', data, '-l', str(Path(tmp) / 'server.log'),
             '-o', f"-k {tmp} -p 55450 -c listen_addresses=''", '-w', 'start')
        psql = [str(args.pg_bin / 'psql'), '-XAt', '-v', 'ON_ERROR_STOP=1']
        def sql(query, ok=True):
            r = subprocess.run(psql, input=query, env=env, text=True,
                               capture_output=True, timeout=15)
            if ok and r.returncode:
                raise AssertionError(r.stderr)
            return r
        def value(query):
            return sql(query).stdout.strip()
        def wait_for(query):
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                if value(query) == 't':
                    return
                time.sleep(.05)
            raise AssertionError('State not observed: ' + query)
        def session(name, query, db='postgres'):
            child = subprocess.Popen(psql, env=dict(env, PGAPPNAME=name, PGDATABASE=db),
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, text=True)
            children.append(child)
            child.stdin.write(query + '\n')
            child.stdin.flush()
            return child
        def idle(name):
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='" + name + "' AND state LIKE 'idle%')")
        try:
            listener = session('howto100-listener', examples['listen'])
            idle('howto100-listener')
            sql(examples['publish'].replace('COMMIT;', 'ROLLBACK;'))
            sql("BEGIN; SELECT pg_notify('order_watchers_json','dedup'); SELECT pg_notify('order_watchers_json','dedup'); COMMIT;")
            sql(examples['publish'])
            out, err = listener.communicate('SELECT 1;\n', timeout=5)
            assert listener.returncode == 0, err
            assert out.count('Asynchronous notification') == 2, out
            assert out.count('with payload "dedup"') == 1, out
            assert sql("SELECT pg_notify('size_test',repeat('a',8000))", ok=False).returncode != 0
            sql("SELECT pg_notify('size_test',repeat('a',7999))")
            print('PASS: rollback suppression, same-transaction deduplication, payload byte boundary', flush=True)

            sql(examples['outbox'])
            sql("BEGIN; INSERT INTO app_outbox(event_type,payload) VALUES('demo','{}'); ROLLBACK;")
            assert value('SELECT count(*) FROM app_outbox') == '0'
            sql("INSERT INTO app_outbox(event_type,payload) VALUES('demo','{}')")
            wake_listener = session('howto100-wakeup', 'LISTEN outbox_wakeup;')
            idle('howto100-wakeup')
            sql(examples['wakeup'])
            out, err = wake_listener.communicate('SELECT 1;\n', timeout=5)
            assert wake_listener.returncode == 0 and 'with payload "pending"' in out, (out, err)
            assert value('SELECT count(*) FROM app_outbox WHERE processed_at IS NULL') == '1'
            for name in ('activity', 'notify-locks', 'triggers', 'queue-usage'):
                sql(examples[name])
            print('PASS: diagnostic SQL; wakeup leaves durable event pending', flush=True)

            # Minimal model of the published fragments, not the author's complete trigger.
            sql('CREATE UNLOGGED TABLE transient_queue(tstamp timestamptz DEFAULT clock_timestamp(), payload text NOT NULL)')
            winner = session('howto100-winner', 'BEGIN; SELECT pg_try_advisory_xact_lock(4242100); DELETE FROM transient_queue;')
            idle('howto100-winner')
            result = value("BEGIN; INSERT INTO transient_queue(payload) VALUES('tail'); SELECT pg_try_advisory_xact_lock(4242100); COMMIT;")
            assert '\nf\n' in '\n' + result + '\n', result
            winner.communicate('COMMIT;\n', timeout=5)
            assert value('SELECT count(*) FROM transient_queue') == '1'
            sql('DELETE FROM transient_queue')
            sql("INSERT INTO transient_queue VALUES(clock_timestamp()-interval '20 seconds','expired')")
            assert value("WITH notifs AS (DELETE FROM transient_queue WHERE tstamp<=clock_timestamp() RETURNING *) SELECT count(*) FROM notifs WHERE tstamp>clock_timestamp()-interval '10 seconds'") == '0'
            assert value('SELECT count(*) FROM transient_queue') == '0'
            print('PASS: deterministic stranded tail and deleted-but-not-sent expired row', flush=True)

            tool('createdb', 'notify_other')
            sql("ALTER SYSTEM SET synchronous_standby_names='howto100_absent'; SELECT pg_reload_conf();")
            wait_for("SELECT current_setting('synchronous_standby_names')='howto100_absent'")
            a = session('howto100-A', "BEGIN; SET LOCAL synchronous_commit=on; INSERT INTO app_outbox(event_type,payload) VALUES('sync','{}'); NOTIFY channel_a; COMMIT;")
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='howto100-A' AND wait_event='SyncRep')")
            b = session('howto100-B', "SET synchronous_commit=off; NOTIFY different_channel;", db='notify_other')
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='howto100-B' AND wait_event_type='Lock')")
            q = """SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a USING(pid)
WHERE a.application_name IN ('howto100-A','howto100-B') AND l.locktype='object'
AND l.database=0 AND l.classid='pg_database'::regclass AND l.objid=0
AND l.mode='AccessExclusiveLock'"""
            assert value(q) == '2'
            locks = sql(examples['notify-locks']).stdout
            assert 'howto100-A|object|AccessExclusiveLock|t' in locks, locks
            assert 'howto100-B|object|AccessExclusiveLock|f' in locks, locks
            sql("ALTER SYSTEM RESET synchronous_standby_names; SELECT pg_reload_conf();")
            for child in (a, b):
                out, err = child.communicate(timeout=10)
                assert child.returncode == 0, (out, err)
            print('PASS: synchronous commit wait holds NOTIFY object lock; other database/channel also waits', flush=True)
            print('Server:', value('SHOW server_version'))
            print('No throughput benchmark, real standby, crash recovery, or end-to-end delivery test.')
        finally:
            sql("ALTER SYSTEM RESET synchronous_standby_names; SELECT pg_reload_conf();", ok=False)
            for child in children:
                if child.poll() is None:
                    child.terminate()
                    child.communicate(timeout=5)
            tool('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')


if __name__ == '__main__':
    main()
