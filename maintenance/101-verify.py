"""Verify article 101 mechanisms in a disposable, Unix-socket-only PG18 cluster."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", default="/opt/homebrew/opt/postgresql@18/bin")
args = parser.parse_args()
bin_dir = Path(args.pg_bin)
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}


def command(name, *args, **kwargs):
    return subprocess.run([str(bin_dir / name), *args], env=env,
                          check=True, text=True, capture_output=True,
                          timeout=90, **kwargs)


with tempfile.TemporaryDirectory(prefix="howto101-", dir="/tmp") as temp:
    data = str(Path(temp) / "data")
    command("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
    try:
        command("pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"),
                "-o", f"-F -p 55401 -k {temp} -c listen_addresses='' "
                "-c autovacuum=off -c shared_buffers=32MB -c max_connections=10",
                "-w", "start")

        def sql(text):
            return command("psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
                           "-h", temp, "-p", "55401", "-d", "postgres",
                           input="SET statement_timeout='30s';\n" + text).stdout.strip()

        results = {"server": sql("SELECT version();")}
        sql("""
CREATE TABLE events (event_id integer) PARTITION BY RANGE (event_id);
DO $$ BEGIN
  FOR i IN 0..11 LOOP
    EXECUTE format('CREATE TABLE events_%s PARTITION OF events FOR VALUES FROM (%s) TO (%s)',
                   i, i * 1000, (i + 1) * 1000);
  END LOOP;
END $$;
INSERT INTO events SELECT generate_series(0, 11999);
ANALYZE events;
""")
        results["partition_plans"] = {}
        for mode in ["force_custom_plan", "force_generic_plan"]:
            output = sql(f"""
SET plan_cache_mode='{mode}';
PREPARE by_event(integer) AS SELECT count(*) FROM events WHERE event_id=$1;
EXECUTE by_event(500);
BEGIN;
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) EXECUTE by_event(500);
SELECT json_build_object('leaf_locks', count(DISTINCT l.relation))
FROM pg_locks l JOIN pg_inherits i ON l.relation=i.inhrelid
WHERE i.inhparent='events'::regclass AND l.pid=pg_backend_pid()
  AND l.granted AND l.mode='AccessShareLock';
ROLLBACK;
""")
            # psql emits one scalar, then an EXPLAIN JSON array and a JSON row.
            decoder = json.JSONDecoder()
            plan, end = decoder.raw_decode(output, output.index("["))
            locks = json.loads(output[end:].strip())
            def leaves(node):
                return ([node["Relation Name"]] if "Relation Name" in node else []) + [
                    name for child in node.get("Plans", []) for name in leaves(child)]
            def removed(node):
                return node.get("Subplans Removed", 0) + sum(removed(n) for n in node.get("Plans", []))
            results["partition_plans"][mode] = {
                **locks, "scanned_relations": leaves(plan[0]["Plan"]),
                "subplans_removed": removed(plan[0]["Plan"])}
        assert results["partition_plans"]["force_custom_plan"]["leaf_locks"] == 1
        assert results["partition_plans"]["force_custom_plan"]["scanned_relations"] == ["events_0"]
        assert results["partition_plans"]["force_generic_plan"]["leaf_locks"] == 12
        assert results["partition_plans"]["force_generic_plan"]["scanned_relations"] == ["events_0"]
        assert results["partition_plans"]["force_generic_plan"]["subplans_removed"] == 11

        sql("""
CREATE TABLE skew (k integer);
INSERT INTO skew SELECT CASE WHEN i <= 99900 THEN 0 ELSE i END FROM generate_series(1, 100000) AS i;
CREATE INDEX ON skew(k);
ANALYZE skew;
""")
        output = sql("SET plan_cache_mode='auto'; PREPARE rare(integer) AS SELECT count(*) FROM skew WHERE k=$1;\n"
                     + "EXECUTE rare(100000);\n" * 10
                     + "SELECT json_build_object('custom',custom_plans,'generic',generic_plans) FROM pg_prepared_statements WHERE name='rare';")
        results["auto_plan_after_ten_executions"] = json.loads(output.splitlines()[-1])
        assert results["auto_plan_after_ten_executions"] == {"custom": 10, "generic": 0}

        sql("""
CREATE EXTENSION pgstattuple;
CREATE TABLE toast_probe (id integer, payload text);
ALTER TABLE toast_probe ALTER COLUMN payload SET STORAGE EXTERNAL;
INSERT INTO toast_probe SELECT i, repeat(md5(i::text), 1024) FROM generate_series(1, 50) AS i;
UPDATE toast_probe SET payload=repeat(md5(id::text || '-new'), 1024);
""")
        toast_dead = "SELECT dead_tuple_count FROM pgstattuple((SELECT reltoastrelid::regclass FROM pg_class WHERE oid='toast_probe'::regclass));"
        before = int(sql(toast_dead))
        sql("VACUUM toast_probe;")
        after = int(sql(toast_dead))
        results["toast_dead_tuples"] = {"before_vacuum": before, "after_vacuum": after}
        assert before > 0 and after == 0

        article = (Path(__file__).resolve().parent.parent / "docs/101.md").read_text()
        query = re.search(r"```sql\n(.*?)\n```", article, re.S).group(1).strip().rstrip(";")
        rows = json.loads(sql("SELECT coalesce(json_agg(q),'[]'::json) FROM (" + query + ") q;"))
        assert any(row["table_name"] == "toast_probe" for row in rows)
        results["article_size_query"] = rows
        print(json.dumps(results, ensure_ascii=False, indent=2))
    finally:
        if (Path(data) / "postmaster.pid").exists():
            command("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
