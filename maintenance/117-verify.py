"""Verify live wait flags and the article's arithmetic, not its workload benchmark."""
import argparse
from decimal import Decimal
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile
import time


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pg-bin', type=Path, required=True)
args = parser.parse_args()
bin_dir = args.pg_bin.resolve()
env = {key: value for key, value in os.environ.items() if not key.startswith('PG')}
env['LC_ALL'] = 'C'
env['PGOPTIONS'] = '-c statement_timeout=10000'


def run(name, *params, sql=None):
    return subprocess.run([str(bin_dir / name), *params], input=sql, env=env,
                          capture_output=True, text=True, check=True, timeout=60).stdout.strip()


def line(process):
    ready, _, _ = select.select([process.stdout], [], [], 5)
    assert ready, 'Timed out waiting for psql output'
    value = process.stdout.readline().strip()
    assert value, ('Missing psql output', process.poll())
    return value


with tempfile.TemporaryDirectory(prefix='howto-117-', dir='/tmp') as temp:
    data = Path(temp) / 'data'
    log = Path(temp) / 'postgres.log'
    processes = []
    try:
        version = run('postgres', '--version')
        assert 'PostgreSQL) 18.' in version, version
        run('initdb', '-D', str(data), '-A', 'trust', '--no-locale', '-E', 'UTF8')
        run('pg_ctl', '-D', str(data), '-l', str(log), '-o',
            f"-p 55437 -k {temp} -c listen_addresses='' -c shared_buffers=32MB "
            '-c log_lock_waits=on -c deadlock_timeout=100ms', '-w', 'start')
        params = ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', temp, '-p', '55437', '-d', 'postgres']

        def sql(query):
            return run('psql', *params, sql=query)

        def client(name, query):
            process = subprocess.Popen([str(bin_dir / 'psql'), *params],
                env={**env, 'PGAPPNAME': name}, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
            processes.append(process)
            process.stdin.write(query + '\n')
            process.stdin.flush()
            return process

        def observe(name, event):
            end = time.monotonic() + 5
            while time.monotonic() < end:
                value = sql("SELECT state||'|'||coalesce(wait_event_type,'NULL')||':'||coalesce(wait_event,'NULL') "
                            f"FROM pg_stat_activity WHERE application_name='{name}';")
                if event in value:
                    return value
                time.sleep(.01)
            raise AssertionError((name, event, value))

        sql('CREATE TABLE wait_demo (id integer PRIMARY KEY, v integer); INSERT INTO wait_demo VALUES (1,0);')
        holder = client('howto117_holder', "BEGIN; UPDATE wait_demo SET v=v+1 WHERE id=1; SELECT 'holder_ready';")
        assert line(holder) == 'holder_ready'
        idle_holder = observe('howto117_holder', 'Client:ClientRead')
        waiter = client('howto117_waiter', 'UPDATE wait_demo SET v=v+1 WHERE id=1 RETURNING v;')
        blocked = observe('howto117_waiter', 'Lock:transactionid')
        blocking_relation = sql("SELECT h.pid=ANY(pg_blocking_pids(w.pid)) "
            "FROM pg_stat_activity h CROSS JOIN pg_stat_activity w "
            "WHERE h.application_name='howto117_holder' AND w.application_name='howto117_waiter';")
        assert blocking_relation == 't'
        assert sql("SELECT count(*)>0 FROM pg_locks WHERE NOT granted "
                   "AND pid=(SELECT pid FROM pg_stat_activity WHERE application_name='howto117_waiter');") == 't'
        time.sleep(.25)
        holder.stdin.write("COMMIT; SELECT 'holder_done';\n")
        holder.stdin.flush()
        assert line(holder) == 'holder_done'
        assert line(waiter) == '2'
        after = observe('howto117_waiter', 'Client:ClientRead')
        log_text = log.read_text()
        assert 'still waiting for' in log_text and 'acquired' in log_text
        config = sql("SELECT name||'='||boot_val FROM pg_settings "
                     "WHERE name IN ('log_lock_waits','deadlock_timeout') ORDER BY name;")
        assert 'log_lock_waits=off' in config
        features = sql("SELECT to_regclass('pg_catalog.pg_stat_io') IS NOT NULL, "
                       "to_regclass('pg_catalog.pg_stat_lock') IS NULL, "
                       "to_regprocedure('pg_catalog.pg_stat_get_backend_io(integer)') IS NOT NULL, "
                       "EXISTS (SELECT 1 FROM pg_stat_io WHERE object='wal');")
        assert features == 't|t|t|t'

        # These are arithmetic checks of the author's numbers, not a local latency run.
        d = Decimal
        assert 30000*d('0.0002') == 300*d('0.020') == d(6)
        assert 29700*d('0.0001') + 300*d('0.0101') == d(6)
        assert 3600/d('0.010') == 360000
        assert 20*d('0.002')/d('0.010') == 4
        reduction = (d(972)-388)/972*100
        row_lock_share = d('10.97')/d('12.63')*100
        repeats = [(d(a)-b)/a*100 for a,b in [(125,0),(300,24),(334,245)]]
        assert reduction.quantize(d('1')) == 60
        assert row_lock_share.quantize(d('1')) == 87
        assert [x.quantize(d('1')) for x in repeats] == [100,92,27]
        print(json.dumps({'postgres': version,
            'scope': 'Live flags, blocking chain, lock-wait logs, PG18 feature boundaries and arithmetic only; no benchmark/tracer reproduction',
            'holder': idle_holder, 'blocked': blocked, 'after_release': after,
            'pg_blocking_pids_identifies_holder': blocking_relation == 't',
            'long_wait_logged_and_acquired': True, 'boot_defaults': config,
            'pg18_io_present_lock_stats_absent_backend_io_present_wal_present': features,
            'arithmetic': {'baseline_to_fix_c_reduction_percent': str(reduction.quantize(d('.01'))),
                           'one_request_lock_share_percent': str(row_lock_share.quantize(d('.01'))),
                           'repeat_reductions_percent': [str(x.quantize(d('.01'))) for x in repeats],
                           'expected_short_wait_samples': 4}}, ensure_ascii=False, indent=2))
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
            process.communicate(timeout=5)
        if (data / 'postmaster.pid').exists():
            run('pg_ctl', '-D', str(data), '-m', 'fast', '-w', 'stop')
