"""Verify article 103 in a temporary PG18 cluster, never an existing database."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", default="/opt/homebrew/opt/postgresql@18/bin")
bin_dir = Path(parser.parse_args().pg_bin)
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}


def command(name, *args, **kwargs):
    return subprocess.run([str(bin_dir / name), *args], env=env, check=True,
                          text=True, capture_output=True, timeout=90, **kwargs)


with tempfile.TemporaryDirectory(prefix="howto103-", dir="/tmp") as temp:
    data = str(Path(temp) / "data")
    command("initdb", "-D", data, "-A", "trust", "--no-locale", "-E", "UTF8")
    try:
        command("pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"),
                "-o", f"-F -p 55403 -k {temp} -c listen_addresses='' "
                "-c shared_buffers=32MB -c max_connections=10", "-w", "start")

        def sql(query):
            return command("psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
                           "-h", temp, "-p", "55403", "-d", "postgres",
                           input="SET statement_timeout='30s';\n" + query).stdout.strip()

        def plan(query):
            result = json.loads(sql("EXPLAIN (FORMAT JSON, COSTS OFF) " + query))[0]["Plan"]

            def nodes(node):
                return [node["Node Type"]] + [n for p in node.get("Plans", []) for n in nodes(p)]

            return nodes(result)

        article = Path(__file__).resolve().parent.parent / "docs/103.md"
        blocks = re.findall(r"```sql\n(.*?)\n```", article.read_text(), re.S)
        assert len(blocks) == 9, "Update verification when article SQL changes"
        results = {"server": sql("SELECT version();")}
        for block in blocks[:5]:
            sql(block)
        base_query = "SELECT name FROM collation_demo.item ORDER BY name LIMIT 20"
        de_query = "SELECT name FROM collation_demo.item ORDER BY name COLLATE collation_demo.de LIMIT 20"
        before = {"matching": plan(base_query), "different": plan(de_query)}
        assert "Sort" not in before["matching"] and "Index Only Scan" in before["matching"], before
        assert "Sort" in before["different"], before
        for block in blocks[5:]:
            sql(block)
        after = plan(de_query)
        assert "Sort" not in after and "Index Only Scan" in after, after
        results["index_plans"] = {**before, "after_matching_index": after}

        expected = {
            "pg_c_utf8": ["Aarhus", "Essen", "Oslo", "Valencia", "Ängelholm", "Åre", "Öhringen", "Östersund"],
            "collation_demo.de": ["Aarhus", "Ängelholm", "Åre", "Essen", "Öhringen", "Oslo", "Östersund", "Valencia"],
            "collation_demo.sv": ["Aarhus", "Essen", "Oslo", "Valencia", "Åre", "Ängelholm", "Öhringen", "Östersund"],
            "collation_demo.da": ["Essen", "Oslo", "Valencia", "Ängelholm", "Öhringen", "Östersund", "Åre", "Aarhus"],
        }
        for collation, names in expected.items():
            actual = sql(f"SELECT name FROM collation_demo.city ORDER BY name COLLATE {collation};").splitlines()
            assert actual == names, (collation, actual)
        results["city_orders"] = expected
        assert sql("SELECT 'Alice' = 'alice' COLLATE collation_demo.ignore_case, "
                   "'e' = 'é' COLLATE collation_demo.ignore_case;") == "t|f"
        sql("DO $$ BEGIN INSERT INTO collation_demo.account VALUES ('alice'); "
            "RAISE EXCEPTION 'Expected unique violation'; EXCEPTION WHEN unique_violation THEN NULL; END $$;")
        assert sql("SELECT count(DISTINCT s COLLATE collation_demo.ignore_case) "
                   "FROM (VALUES ('Alice'),('alice'),('ALICE')) AS v(s);") == "1"
        assert sql("SELECT count(*) FROM (SELECT s COLLATE collation_demo.ignore_case "
                   "FROM (VALUES ('Alice'),('alice'),('ALICE')) v(s) GROUP BY 1) g;") == "1"
        sql("CREATE COLLATION collation_demo.deterministic (provider=icu, locale='und-u-ks-level2');")
        assert sql("SELECT 'Alice' = 'alice' COLLATE collation_demo.deterministic;") == "f"
        assert sql(r"SELECT U&'\00e9' = U&'e\0301' COLLATE collation_demo.ignore_case;") == "t"
        assert sql("SELECT 'Alice' LIKE 'a%' COLLATE collation_demo.ignore_case;") == "t"
        for operator in ["ILIKE", "SIMILAR TO", "~"]:
            sql(f"DO $$ BEGIN PERFORM 'Alice' {operator} 'a%' COLLATE collation_demo.ignore_case; "
                "RAISE EXCEPTION 'Expected unsupported operation'; "
                "EXCEPTION WHEN feature_not_supported THEN NULL; END $$;")
        sql("CREATE COLLATION collation_demo.numeric (provider=icu, locale='und-u-kn-true');")
        assert sql("SELECT 'file2' < 'file10' COLLATE collation_demo.numeric, "
                   "'file2' < 'file10' COLLATE \"C\";") == "t|f"
        case_mapping = sql("SELECT upper('ß' COLLATE pg_c_utf8), upper('ß' COLLATE pg_unicode_fast);")
        assert case_mapping == "ß|SS", case_mapping
        results.update(article_sql_blocks_executed=len(blocks),
                       equality="case-insensitive, accent-sensitive; deterministic tie-break verified",
                       unique_conflict="23505 caught", distinct_groups=1, group_by_groups=1,
                       unicode_normal_forms_equal=True, numeric_order=True,
                       like_supported=True, ilike_similar_regex="0A000 caught",
                       case_mapping=case_mapping,
                       icu_collation_version=sql("SELECT collversion FROM pg_collation WHERE oid='collation_demo.de'::regcollation;"))
        print(json.dumps(results, ensure_ascii=False, indent=2))
    finally:
        if (Path(data) / "postmaster.pid").exists():
            command("pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
