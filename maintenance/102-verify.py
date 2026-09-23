"""Check vacuum mechanisms in a disposable PG18 cluster; never use an existing DB."""
import argparse
import json
import os
from pathlib import Path
import re
import select
import subprocess
import tempfile
import time


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", default="/opt/homebrew/opt/postgresql@18/bin")
args = parser.parse_args()
bin_dir = Path(args.pg_bin)
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}


def command(name, *args, **kwargs):
    return subprocess.run([str(bin_dir / name), *args], env=env,
                          check=True, text=True, capture_output=True,
                          timeout=90, **kwargs)


with tempfile.TemporaryDirectory(prefix="howto102-", dir="/tmp") as temp:
    data = str(Path(temp) / "data")
    sessions = []
    command("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
    try:
        command("pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"),
                "-o", f"-F -p 55402 -k {temp} -c listen_addresses='' "
                "-c autovacuum=off -c shared_buffers=32MB -c max_connections=10",
                "-w", "start")
        psql_args = ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", temp,
                     "-p", "55402", "-d", "postgres"]

        def sql(query):
            return command("psql", *psql_args,
                           input="SET statement_timeout='30s';\n" + query)

        def rows(query):
            query = query.strip().rstrip(";")
            return json.loads(sql("SELECT coalesce(json_agg(q),'[]'::json) FROM (" + query + ") q;").stdout)

        class Session:
            def __init__(self):
                self.process = subprocess.Popen([str(bin_dir / "psql"), *psql_args],
                    env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                sessions.append(self.process)
                self.execute("SET statement_timeout='30s'; SET idle_in_transaction_session_timeout='60s';")

            def execute(self, query):
                marker = b"HOWTO102_DONE\n"
                self.process.stdin.write((query + "\n\\echo HOWTO102_DONE\n").encode())
                self.process.stdin.flush()
                output = b""
                deadline = time.monotonic() + 35
                while marker not in output:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0 or not select.select([self.process.stdout], [], [], remaining)[0]:
                        raise TimeoutError("psql session did not complete")
                    chunk = os.read(self.process.stdout.fileno(), 65536)
                    if not chunk:
                        raise RuntimeError(output.decode())
                    output += chunk
                return output.replace(marker, b"").decode().strip()

        results = {"server": sql("SELECT version();").stdout.strip()}
        sql("CREATE TABLE vacuum_probe(id integer PRIMARY KEY, payload text); "
            "INSERT INTO vacuum_probe SELECT i, repeat('x',100) FROM generate_series(1,10000) AS i; "
            "ANALYZE vacuum_probe;")
        reader = Session()
        assert reader.execute("BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM vacuum_probe;") == "10000"
        reader_pid = int(reader.execute("SELECT pg_backend_pid();"))
        sql("DELETE FROM vacuum_probe WHERE id <= 5000;")
        held = sql("VACUUM (VERBOSE, TRUNCATE FALSE) vacuum_probe;").stderr
        assert "5000 are dead but not yet removable" in held, held
        assert reader.execute("SELECT count(*) FROM vacuum_probe;") == "10000"
        assert sql("SELECT count(*) FROM vacuum_probe;").stdout.strip() == "5000"
        xmin = rows(f"SELECT state, backend_xmin::text FROM pg_stat_activity WHERE pid={reader_pid}")[0]
        assert xmin["backend_xmin"] is not None and xmin["state"] == "idle in transaction"
        reader.execute("COMMIT;")
        released = sql("VACUUM (VERBOSE, TRUNCATE FALSE) vacuum_probe;").stderr
        assert "5000 removed" in released and "0 are dead but not yet removable" in released, released
        results["snapshot"] = {
            "reader_state": xmin["state"],
            "held": next(line.strip() for line in held.splitlines() if line.startswith("tuples:")),
            "released": next(line.strip() for line in released.splitlines() if line.startswith("tuples:")),
            "old_snapshot_count": 10000, "new_snapshot_count": 5000}

        locker = Session()
        locker.execute("BEGIN; LOCK TABLE vacuum_probe IN SHARE ROW EXCLUSIVE MODE;")
        locker_pid = int(locker.execute("SELECT pg_backend_pid();"))
        waiter = subprocess.Popen([str(bin_dir / "psql"), *psql_args,
            "-c", "SET application_name='howto102-vacuum'; SET statement_timeout='20s';",
            "-c", "VACUUM vacuum_probe;"], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        sessions.append(waiter)
        deadline = time.monotonic() + 10
        while True:
            waits = rows("SELECT pid, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers "
                         "FROM pg_stat_activity WHERE application_name='howto102-vacuum'")
            if waits and waits[0]["wait_event_type"] == "Lock":
                break
            if time.monotonic() > deadline:
                raise TimeoutError("Vacuum did not reach a lock wait")
            time.sleep(0.05)
        assert waits[0]["blockers"] == [locker_pid], waits
        results["relation_lock"] = {"wait_event_type": waits[0]["wait_event_type"],
                                    "wait_event": waits[0]["wait_event"], "blocker_matches": True}
        locker.execute("ROLLBACK;")
        _, stderr = waiter.communicate(timeout=25)
        assert waiter.returncode == 0, stderr.decode()

        results["settings"] = rows("SELECT name, setting, context FROM pg_settings WHERE name IN "
            "('autovacuum_max_workers','autovacuum_worker_slots','autovacuum_vacuum_max_threshold',"
            "'autovacuum_work_mem','track_cost_delay_timing','idle_replication_slot_timeout') ORDER BY name")
        contexts = {r["name"]: r["context"] for r in results["settings"]}
        assert contexts["autovacuum_max_workers"] == "sighup"
        assert contexts["autovacuum_worker_slots"] == "postmaster"

        article = Path(__file__).resolve().parent.parent / "docs/102.md"
        if article.exists():
            queries = re.findall(r"```sql\n(.*?)\n```", article.read_text(), re.S)
            assert len(queries) == 3, "Update verification for new article SQL"
            for query in queries:
                sql(query)
            results["article_queries_executed"] = len(queries)
        print(json.dumps(results, ensure_ascii=False, indent=2))
    finally:
        for process in sessions:
            if process.poll() is None:
                process.terminate()
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate(timeout=5)
        if (Path(data) / "postmaster.pid").exists():
            command("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
