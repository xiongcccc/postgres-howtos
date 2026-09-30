"""Verify logical replication semantics in two disposable, socket-only clusters."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", default="/opt/homebrew/opt/postgresql@18/bin")
pg_bin = Path(parser.parse_args().pg_bin)
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
env["LC_ALL"] = "C"
article = Path(__file__).resolve().parent.parent / "docs/105.md"
sql_blocks = re.findall(r"```sql\n(.*?)\n```", article.read_text(), re.S)
assert len(sql_blocks) == 3, "Review SQL block execution mapping"


def run(name, *args, **kwargs):
    return subprocess.run([str(pg_bin / name), *args], env=env,
                          text=True, capture_output=True, check=True,
                          timeout=60, **kwargs)


with tempfile.TemporaryDirectory(prefix="howto105-", dir="/tmp") as temp:
    nodes = {}
    try:
        for name, port in [("pub", 55405), ("sub", 55406)]:
            data = str(Path(temp) / name)
            run("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
            nodes[name] = (data, port)
            run("pg_ctl", "-D", data, "-l", str(Path(temp) / (name + ".log")),
                "-o", f"-p {port} -k {temp} -c listen_addresses='' "
                "-c shared_buffers=32MB -c wal_level=logical "
                "-c max_replication_slots=10 -c max_wal_senders=10 "
                "-c max_logical_replication_workers=8", "-w", "start")

        def sql(node, query, expected=None):
            proc = subprocess.run([str(pg_bin / "psql"), "-X", "-qAt",
                "-h", temp, "-p", str(nodes[node][1]), "-d", "postgres",
                "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"],
                input="SET statement_timeout='20s';\n" + query,
                env=env, text=True, capture_output=True, timeout=25)
            if expected:
                assert proc.returncode != 0 and expected in proc.stderr, proc
                return proc.stderr.strip()
            assert proc.returncode == 0, (query, proc.stderr)
            return proc.stdout.strip()

        def wait_sql(node, query, expected):
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                actual = sql(node, query)
                if actual == expected:
                    return actual
                time.sleep(0.1)
            raise AssertionError((query, actual, expected))

        connection = f"host={temp} port=55405 dbname=postgres"
        results = {"server": sql("pub", "SELECT version();")}

        sql("pub", "CREATE SCHEMA lr_demo; CREATE TABLE lr_demo.first_table(id int PRIMARY KEY); "
            "CREATE PUBLICATION schema_pub FOR TABLES IN SCHEMA lr_demo;")
        sql("sub", "CREATE SCHEMA lr_demo; CREATE TABLE lr_demo.first_table(id int PRIMARY KEY);")
        sql("sub", f"CREATE SUBSCRIPTION schema_sub CONNECTION '{connection}' PUBLICATION schema_pub;")
        wait_sql("sub", "SELECT count(*) FROM pg_subscription_rel WHERE srsubstate='r';", "1")
        assert sql("sub", "SELECT substream FROM pg_subscription WHERE subname='schema_sub';") == "p"
        sql("sub", "CREATE TABLE lr_demo.later_table(id int PRIMARY KEY);")
        sql("pub", "CREATE TABLE lr_demo.later_table(id int PRIMARY KEY); INSERT INTO lr_demo.later_table VALUES(1);")
        assert sql("pub", "SELECT string_agg(tablename,',' ORDER BY tablename) FROM pg_publication_tables WHERE pubname='schema_pub';") == "first_table,later_table"
        assert sql("sub", "SELECT count(*) FROM pg_subscription_rel WHERE srrelid='lr_demo.later_table'::regclass;") == "0"
        sql("sub", "ALTER SUBSCRIPTION schema_sub REFRESH PUBLICATION;")
        wait_sql("sub", "SELECT count(*) FROM pg_subscription_rel WHERE srsubstate='r';", "2")
        wait_sql("sub", "SELECT count(*) FROM lr_demo.later_table;", "1")
        results["schema_publication"] = {"publisher_includes_new_table": True,
            "subscriber_requires_refresh": True, "default_substream": "p"}
        sql("sub", "DROP SUBSCRIPTION schema_sub;")

        # Publication creation succeeds; UPDATE checks the identity dependency later.
        sql("pub", sql_blocks[0])
        error = sql("pub", sql_blocks[1], "42P10")
        assert "replica identity" in error.lower(), error
        sql("pub", sql_blocks[2])
        assert sql("pub", "SELECT tenant_id FROM public.filter_demo WHERE id=1;") == "20"
        sql("pub", "UPDATE public.filter_demo SET tenant_id=10 WHERE id=1;")
        sql("sub", "CREATE TABLE public.filter_demo(id int PRIMARY KEY, tenant_id int);")
        sql("sub", f"CREATE SUBSCRIPTION filter_sub CONNECTION '{connection}' PUBLICATION filter_pub;")
        wait_sql("sub", "SELECT count(*) FROM pg_subscription_rel WHERE srsubstate='r';", "1")
        wait_sql("sub", "SELECT count(*) FROM public.filter_demo;", "1")
        sql("pub", "UPDATE public.filter_demo SET tenant_id=20 WHERE id=1;")
        wait_sql("sub", "SELECT count(*) FROM public.filter_demo;", "0")
        sql("pub", "UPDATE public.filter_demo SET tenant_id=10 WHERE id=1;")
        wait_sql("sub", "SELECT count(*) FROM public.filter_demo;", "1")
        sql("pub", "ALTER PUBLICATION filter_pub SET (publish='insert'); "
            "ALTER TABLE public.filter_demo REPLICA IDENTITY DEFAULT; "
            "INSERT INTO public.filter_demo VALUES(2,10);")
        wait_sql("sub", "SELECT count(*) FROM public.filter_demo;", "2")
        sql("pub", "CREATE FUNCTION public.is_tenant(int) RETURNS boolean LANGUAGE sql IMMUTABLE AS 'SELECT $1=10';")
        sql("pub", "CREATE PUBLICATION udf_pub FOR TABLE public.filter_demo WHERE (public.is_tenant(tenant_id)) WITH (publish='insert');", "0A000")
        results["row_filter"] = {"non_identity_update": "42P10", "identity_full": "success",
            "update_leaving_filter": "row deleted", "update_entering_filter": "row inserted",
            "insert_only_non_identity_filter": "success", "immutable_user_function": "0A000"}
        sql("sub", "DROP SUBSCRIPTION filter_sub;")

        sql("pub", "CREATE TABLE public.order_details(order_id int, product_id int, qty int, PRIMARY KEY(order_id,product_id)); "
            "CREATE PUBLICATION identity_pub FOR TABLE public.order_details;")
        sql("sub", "CREATE TABLE public.order_details(order_id int PRIMARY KEY, product_id int, qty int);")
        sql("sub", f"CREATE SUBSCRIPTION identity_sub CONNECTION '{connection}' PUBLICATION identity_pub WITH(disable_on_error=true);")
        wait_sql("sub", "SELECT count(*) FROM pg_subscription_rel WHERE srsubstate='r';", "1")
        sql("pub", "INSERT INTO public.order_details VALUES(1,10,1);")
        wait_sql("sub", "SELECT qty FROM public.order_details WHERE order_id=1;", "1")
        sql("pub", "UPDATE public.order_details SET qty=2 WHERE order_id=1 AND product_id=10;")
        wait_sql("sub", "SELECT qty FROM public.order_details WHERE order_id=1;", "2")
        sql("pub", "INSERT INTO public.order_details VALUES(1,20,1);")
        wait_sql("sub", "SELECT subenabled FROM pg_subscription WHERE subname='identity_sub';", "f")
        log = (Path(temp) / "sub.log").read_text()
        assert "conflict=insert_exists" in log and 'Key already exists in unique index "order_details_pkey"' in log, log[-6000:]
        assert sql("sub", "SELECT count(*) FROM public.order_details;") == "1"
        results["different_keys"] = {"update_with_subscriber_subset_key": "success",
            "second_product_same_order": "subscriber unique violation; subscription disabled"}
        sql("sub", "DROP SUBSCRIPTION identity_sub;")

        sql("pub", "BEGIN; SELECT pg_create_logical_replication_slot('rollback_demo','pgoutput'); ROLLBACK;")
        assert sql("pub", "SELECT count(*) FROM pg_replication_slots WHERE slot_name='rollback_demo';") == "1"
        sql("pub", "SELECT pg_drop_replication_slot('rollback_demo');")
        results["slot_after_rollback"] = "persistent logical slot remains"

        if article.exists():
            blocks = re.findall(r"```bash\n(.*?)\n```", article.read_text(), re.S)
            assert len(blocks) == 1, "Review shell block execution mapping"
            bench_env = dict(env, PATH=str(pg_bin) + os.pathsep + env.get("PATH", ""),
                             PGHOST=temp, PGPORT="55405", PGDATABASE="postgres",
                             PGOPTIONS="-c statement_timeout=20000")
            proc = subprocess.run(["/bin/bash", "-eu", "-o", "pipefail", "-c", blocks[0]],
                                  env=bench_env, capture_output=True, text=True, timeout=45)
            assert proc.returncode == 0, (proc.stdout, proc.stderr)
            assert sql("pub", "SELECT count(*) FROM pg_replication_slots WHERE slot_name='decode_demo_slot';") == "0"
            results["article_decode_command"] = "pg_recvlogical reaches end LSN; slot cleaned up"

        print(json.dumps(results, indent=2, ensure_ascii=False))
    finally:
        # Stop the subscriber first, including on a failed assertion or timeout.
        for name in reversed(nodes):
            data, _ = nodes[name]
            if (Path(data) / "postmaster.pid").exists():
                run("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
