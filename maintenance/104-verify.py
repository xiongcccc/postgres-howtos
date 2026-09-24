"""Verify lock and isolation behavior using only a disposable PostgreSQL cluster."""
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
bin_dir = Path(parser.parse_args().pg_bin)
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
env["LC_ALL"] = "C"


def command(name, *args, **kwargs):
    return subprocess.run([str(bin_dir / name), *args], env=env,
                          check=True, text=True, capture_output=True,
                          timeout=90, **kwargs)


with tempfile.TemporaryDirectory(prefix="howto104-", dir="/tmp") as temp:
    data = str(Path(temp) / "data")
    processes = []
    command("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
    try:
        command("pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"),
                "-o", f"-p 55404 -k {temp} -c listen_addresses='' "
                "-c shared_buffers=32MB -c max_connections=10", "-w", "start")
        psql_args = ["-X", "-qAt", "-h", temp, "-p", "55404", "-d", "postgres"]

        def sql(query):
            return command("psql", *psql_args, "-v", "ON_ERROR_STOP=1",
                           input="SET statement_timeout='20s';\n" + query).stdout.strip()

        def rows(query):
            return json.loads(sql("SELECT coalesce(json_agg(q),'[]'::json) FROM (" + query + ") q;"))

        class Session:
            def __init__(self):
                self.process = subprocess.Popen([str(bin_dir / "psql"), *psql_args,
                    "-v", "ON_ERROR_STOP=0"], env=env, stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                processes.append(self.process)
                self.execute("SET statement_timeout='20s'; SET idle_in_transaction_session_timeout='60s';")
                self.pid = int(self.execute("SELECT pg_backend_pid();"))

            def send(self, query):
                self.process.stdin.write((query + "\n\\echo HOWTO104_DONE :SQLSTATE\n").encode())
                self.process.stdin.flush()

            def receive(self, expected="00000"):
                output = b""
                deadline = time.monotonic() + 25
                while True:
                    marker = re.search(rb"(?:^|\n)HOWTO104_DONE ([0-9A-Z]{5})\r?\n", output)
                    if marker:
                        body = output[:marker.start()].decode().strip()
                        code = marker[1].decode()
                        assert code == expected, (code, expected, body)
                        return body
                    remaining = deadline - time.monotonic()
                    if remaining <= 0 or not select.select([self.process.stdout], [], [], remaining)[0]:
                        raise TimeoutError(output.decode())
                    chunk = os.read(self.process.stdout.fileno(), 65536)
                    if not chunk:
                        raise RuntimeError(output.decode())
                    output += chunk

            def execute(self, query, expected="00000"):
                self.send(query)
                return self.receive(expected)

        def wait_for_lock(waiter, holder):
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                state = rows(f"SELECT wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers "
                             f"FROM pg_stat_activity WHERE pid={waiter.pid}")[0]
                if state["wait_event_type"] == "Lock":
                    assert state["blockers"] == [holder.pid], state
                    assert state["wait_event"] == "transactionid", state
                    return state
                time.sleep(0.025)
            raise TimeoutError("Expected transactionid wait was not observed")

        sql("CREATE SCHEMA lock_demo; CREATE TABLE lock_demo.account "
            "(id integer PRIMARY KEY, balance integer NOT NULL CHECK (balance >= 0)); "
            "INSERT INTO lock_demo.account VALUES (1,100);")
        a, b = Session(), Session()
        results = {"server": sql("SELECT version();"), "same_row": {}}
        for isolation in ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]:
            sql("UPDATE lock_demo.account SET balance=100;")
            b.execute(f"BEGIN ISOLATION LEVEL {isolation};")
            assert b.execute("SELECT balance FROM lock_demo.account WHERE id=1;") == "100"
            a.execute("BEGIN;")
            a.execute("UPDATE lock_demo.account SET balance=balance-70 WHERE id=1;")
            b.send("UPDATE lock_demo.account SET balance=balance-50 WHERE id=1 AND balance>=50 RETURNING balance;")
            wait_for_lock(b, a)
            holder = rows(f"SELECT state, wait_event_type, wait_event FROM pg_stat_activity WHERE pid={a.pid}")[0]
            assert holder == {"state": "idle in transaction", "wait_event_type": "Client", "wait_event": "ClientRead"}, holder
            a.execute("COMMIT;")
            expected = "00000" if isolation == "READ COMMITTED" else "40001"
            response = b.receive(expected)
            if expected == "00000":
                assert response == "", response
                b.execute("COMMIT;")
            else:
                b.execute("ROLLBACK;")
            assert sql("SELECT balance FROM lock_demo.account;") == "30"
            results["same_row"][isolation] = {"wait": "Lock/transactionid", "holder": holder,
                                                 "sqlstate": expected, "balance": 30}

        # A lock-only transaction does not invalidate the repeatable-read snapshot.
        sql("UPDATE lock_demo.account SET balance=100;")
        a.execute("BEGIN;")
        a.execute("SELECT id FROM lock_demo.account WHERE id=1 FOR UPDATE;")
        b.execute("BEGIN ISOLATION LEVEL REPEATABLE READ;")
        b.execute("SELECT balance FROM lock_demo.account WHERE id=1;")
        b.send("UPDATE lock_demo.account SET balance=balance-50 WHERE id=1 RETURNING balance;")
        wait_for_lock(b, a)
        a.execute("COMMIT;")
        assert b.receive() == "50"
        b.execute("COMMIT;")
        results["repeatable_read_after_lock_only"] = "success, balance=50"

        sql("CREATE TABLE lock_demo.flight (id integer PRIMARY KEY, seats integer NOT NULL); "
            "INSERT INTO lock_demo.flight VALUES (1,2); "
            "CREATE TABLE lock_demo.booking (who text PRIMARY KEY, flight_id integer NOT NULL, booked integer NOT NULL);")
        available = "SELECT seats-(SELECT coalesce(sum(booked),0) FROM lock_demo.booking WHERE flight_id=1) FROM lock_demo.flight WHERE id=1;"
        results["write_skew"] = {}
        for isolation in ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]:
            sql("TRUNCATE lock_demo.booking;")
            a.execute(f"BEGIN ISOLATION LEVEL {isolation};")
            b.execute(f"BEGIN ISOLATION LEVEL {isolation};")
            assert a.execute(available) == b.execute(available) == "2"
            a.execute("INSERT INTO lock_demo.booking VALUES ('a',1,2);")
            b.execute("INSERT INTO lock_demo.booking VALUES ('b',1,2);")
            a.execute("COMMIT;")
            b.execute("COMMIT;", "40001" if isolation == "SERIALIZABLE" else "00000")
            b.execute("ROLLBACK;")
            booked = int(sql("SELECT sum(booked) FROM lock_demo.booking;"))
            assert booked == (2 if isolation == "SERIALIZABLE" else 4), booked
            results["write_skew"][isolation] = {"initial_capacity": 2, "booked": booked}

        article = Path(__file__).resolve().parent.parent / "docs/104.md"
        assert article.exists(), "Article is required for SQL verification"
        if article.exists():
            blocks = re.findall(r"```sql\n(.*?)\n```", article.read_text(), re.S)
            assert len(blocks) == 8, "Review SQL block execution mapping"
            sql("DROP SCHEMA lock_demo CASCADE;")
            sql(blocks[1])
            a.execute(blocks[2])
            b.send(blocks[3])
            wait_for_lock(b, a)
            diagnostic = sql(blocks[0])
            assert str(a.pid) in diagnostic and str(b.pid) in diagnostic, diagnostic
            a.execute(blocks[4])
            assert b.receive() == ""
            b.execute(blocks[5])
            sql(blocks[6])
            assert sql(blocks[7]) == "20"

            # The same function releases locks only when its outer transaction ends.
            a.execute("BEGIN;")
            assert a.execute("SELECT lock_demo.debit(1,5);") == "15"
            b.send("UPDATE lock_demo.account SET balance=balance+1 WHERE id=1 RETURNING balance;")
            wait_for_lock(b, a)
            a.execute("COMMIT;")
            assert b.receive() == "16"
            assert a.execute("SELECT lock_demo.debit(1,1);") == "15"
            assert b.execute("UPDATE lock_demo.account SET balance=balance+1 WHERE id=1 RETURNING balance;") == "16"
            a.execute("SELECT lock_demo.debit(1,1000);", "P0001")
            for amount in ["0", "-1", "NULL"]:
                a.execute(f"SELECT lock_demo.debit(1,{amount});", "22023")
            a.execute("SELECT lock_demo.debit(999,1);", "P0001")
            assert sql("SELECT balance FROM lock_demo.account WHERE id=1;") == "16"
            results["article_sql_blocks_executed"] = len(blocks)
            results["function"] = "atomic debit; invalid/missing/insufficient rejected; outer transaction retains locks"
        print(json.dumps(results, ensure_ascii=False, indent=2))
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
                try:
                    process.communicate(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.communicate(timeout=5)
        if (Path(data) / "postmaster.pid").exists():
            command("pg_ctl", "-D", data, "-m", "fast", "-w", "stop")
