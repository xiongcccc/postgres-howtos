"""Verify article 99 in a disposable cluster; never connects to existing databases."""
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
    article = (Path(__file__).resolve().parents[1] / 'docs/99.md').read_text()
    examples = dict(re.findall(r'<!-- example: ([\w-]+) -->\n```sql\n(.*?)\n```', article, re.S))
    children = []
    with tempfile.TemporaryDirectory(prefix='howto99-', dir='/tmp') as tmp:
        env = dict(os.environ, PGHOST=tmp, PGPORT='55449', PGDATABASE='postgres',
                   PGUSER=os.environ.get('USER', ''), PGOPTIONS='')
        data = str(Path(tmp) / 'data')
        def tool(name, *parts, **kwargs):
            return subprocess.run([str(args.pg_bin / name), *parts], env=env,
                                  text=True, capture_output=True, check=True, **kwargs)
        tool('initdb', '-D', data, '-A', 'trust', '--no-locale', '-E', 'UTF8')
        tool('pg_ctl', '-D', data, '-l', str(Path(tmp) / 'server.log'),
             '-o', f"-k {tmp} -p 55449 -c listen_addresses=''", '-w', 'start')
        psql = [str(args.pg_bin / 'psql'), '-XAt', '-v', 'ON_ERROR_STOP=1']
        def sql(query, ok=True):
            result = subprocess.run(psql, input=query, env=env, text=True,
                                    capture_output=True, timeout=40)
            if ok and result.returncode:
                raise AssertionError(result.stderr)
            return result
        def value(query):
            return sql(query).stdout.strip()
        def example(name):
            # psql -c may wrap multiple commands; stdin preserves statement boundaries.
            return sql(examples[name]).stdout.strip()
        def session(name, query):
            child = subprocess.Popen(psql, env=dict(env, PGAPPNAME=name), stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            children.append(child)
            child.stdin.write(query + '\n')
            child.stdin.flush()
            return child
        def wait_for(query):
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if value(query) == 't':
                    return
                time.sleep(.05)
            raise AssertionError('State not observed: ' + query)
        try:
            sql("""
CREATE TABLE events(id integer PRIMARY KEY, created_at timestamptz);
INSERT INTO events SELECT i, '2026-01-01'::timestamptz FROM generate_series(1,20001) i;
INSERT INTO events VALUES (30000, '2026-03-01');
CREATE TABLE subscriptions(starts_at timestamptz, ends_at timestamptz);
INSERT INTO subscriptions VALUES ('2026-01-01', '2026-01-02');
CREATE TABLE users(id integer PRIMARY KEY, email text);
INSERT INTO users VALUES (1, 'one@example.test');
CREATE TABLE orders(id integer PRIMARY KEY, user_id integer);
INSERT INTO orders VALUES (1, 1);
CREATE TABLE work_item(id integer PRIMARY KEY, status text, num_retries integer, retry_timestamp timestamptz);
INSERT INTO work_item SELECT i, 'active', 11, '2026-01-01'::timestamptz FROM generate_series(1,10001) i;
INSERT INTO work_item VALUES (20000, 'active', 1, '2026-01-01');
""")
            example('blockers')
            example('timeout-ddl')
            example('check-add')
            assert value("SELECT convalidated FROM pg_constraint WHERE conname='subscriptions_valid_period'") == 'f'
            assert sql("INSERT INTO subscriptions VALUES ('2026-02-01','2026-01-01')", ok=False).returncode
            example('check-validate')
            assert value("SELECT convalidated FROM pg_constraint WHERE conname='subscriptions_valid_period'") == 't'
            example('foreign-key')
            assert sql('INSERT INTO orders VALUES (2, 999)', ok=False).returncode
            example('not-null-legacy')
            assert sql('INSERT INTO users VALUES (2, NULL)', ok=False).returncode
            example('unique-index')
            example('unique-attach')
            assert sql("INSERT INTO users VALUES (2, 'one@example.test')", ok=False).returncode
            example('volatile-default')
            assert value('SELECT count(*) FROM events WHERE processed_at IS NOT NULL') == '0'
            sql("INSERT INTO events(id,created_at) VALUES(30001,'2026-03-01')")
            assert value('SELECT processed_at IS NOT NULL FROM events WHERE id=30001') == 't'
            print('PASS: DDL, staged constraints, unique index, new-row defaults', flush=True)

            counts = [int(example('update-batch')) for _ in range(4)]
            assert counts == [5000, 5000, 1, 0], counts
            assert value("SELECT status FROM work_item WHERE id=20000") == 'active'
            counts = [int(example('delete-batch')) for _ in range(4)]
            assert counts == [10000, 10000, 1, 0], counts
            assert value('SELECT count(*) FROM events') == '2'
            # Run the article's actual driver, including its termination condition.
            sql("UPDATE work_item SET status='active' WHERE id<=10001")
            Path(tmp, 'batch.sql').write_text(examples['update-batch'])
            driver = re.search(r'```bash\n(.*?)\n```', article, re.S).group(1)
            result = subprocess.run(['bash'], input=driver, text=True, cwd=tmp,
                                    env=dict(env, PATH=str(args.pg_bin) + ':' + env['PATH']),
                                    capture_output=True, timeout=40, check=True)
            assert 'batch=4 rows=0' in result.stdout
            print('PASS: independent batches, unchanged excluded rows, actual Bash driver', flush=True)

            a = session('howto99-A', 'BEGIN; SELECT * FROM events LIMIT 1;')
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='howto99-A' AND state='idle in transaction')")
            b = session('howto99-B', "SET lock_timeout='3s'; ALTER TABLE events ADD COLUMN queued integer;")
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='howto99-B' AND wait_event_type='Lock')")
            c = session('howto99-C', 'SELECT count(*) FROM events;')
            wait_for("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='howto99-C' AND wait_event_type='Lock')")
            b.communicate(timeout=10)
            assert b.returncode != 0
            out, err = c.communicate(timeout=10)
            assert c.returncode == 0 and out.strip() == '2', (out, err)
            assert value("SELECT state FROM pg_stat_activity WHERE application_name='howto99-A'") == 'idle in transaction'
            a.communicate('ROLLBACK;\n', timeout=5)
            print('PASS: queued DDL blocks readers; timeout releases queue before long transaction ends', flush=True)
            print('Server:', value('SHOW server_version'))
            print('PG18-only syntax not executed; no replication or capacity test.')
        finally:
            for child in children:
                if child.poll() is None:
                    child.terminate()
                    child.communicate(timeout=5)
            tool('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')


if __name__ == '__main__':
    main()
