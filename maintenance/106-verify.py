"""Run the article's plan-advice example in a disposable PostgreSQL 19 cluster."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", required=True, type=Path)
pg_bin = parser.parse_args().pg_bin.resolve()
env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
env["LC_ALL"] = "C"
article = Path(__file__).resolve().parent.parent / "docs/106.md"
section = article.read_text().split("## Plan advice：", 1)[1].split("\n## ", 1)[0]
blocks = re.findall(r"```sql\n(.*?)\n```", section, re.S)
assert len(blocks) == 2, "Review the article's plan-advice SQL mapping"


def run(name, *args, **kwargs):
    return subprocess.run([str(pg_bin / name), *args], env=env,
                          text=True, capture_output=True, check=True,
                          timeout=60, **kwargs)


version = run("postgres", "--version").stdout.strip()
assert re.search(r"PostgreSQL\) 19(?:\D|$)", version), version

with tempfile.TemporaryDirectory(prefix="howto106-", dir="/tmp") as temp:
    data = Path(temp) / "data"
    log = Path(temp) / "server.log"
    try:
        run("initdb", "-D", str(data), "-A", "trust", "--no-locale", "-E", "UTF8")
        run("pg_ctl", "-D", str(data), "-l", str(log), "-o",
            f"-p 55416 -k {temp} -c listen_addresses='' -c shared_buffers=32MB",
            "-w", "start")
        query = "SELECT payload FROM advice_demo AS d WHERE id = 42;"
        sql = (
            "SET statement_timeout='20s';\n"
            "\\echo HOWTO106_BASELINE\n" + blocks[0] + "\n"
            "\\echo HOWTO106_ADVICE\n" + blocks[1] + "\n"
            "\\echo HOWTO106_RESET\nEXPLAIN (COSTS OFF) " + query + "\n"
            "\\echo HOWTO106_UNMATCHED\n"
            "SET pg_plan_advice.advice='SEQ_SCAN(missing_alias)';\n"
            "EXPLAIN (COSTS OFF) " + query + "\n"
            "RESET pg_plan_advice.advice;\n"
            "\\echo HOWTO106_DATA\n"
            "SELECT count(*), min(id), max(id) FROM advice_demo;\n"
        )
        output = run("psql", "-X", "-qAt", "-h", temp, "-p", "55416", "-d",
                     "postgres", "-v", "ON_ERROR_STOP=1", input=sql).stdout

        def result(name, following=None):
            part = output.split("HOWTO106_" + name + "\n", 1)[1]
            if following:
                part = part.split("HOWTO106_" + following + "\n", 1)[0]
            return part.strip()

        baseline = result("BASELINE", "ADVICE")
        advised = result("ADVICE", "RESET")
        reset = result("RESET", "UNMATCHED")
        unmatched = result("UNMATCHED", "DATA")
        assert "Index Scan using advice_demo_id_idx" in baseline, baseline
        assert "Generated Plan Advice:" in baseline, baseline
        assert "Seq Scan on advice_demo d" in advised, advised
        assert "SEQ_SCAN(d) /* matched */" in advised, advised
        assert "Index Scan using advice_demo_id_idx" in reset, reset
        assert "Supplied Plan Advice:" not in reset, reset
        assert "not matched" in unmatched, unmatched
        assert "Index Scan using advice_demo_id_idx" in unmatched, unmatched
        assert result("DATA") == "100000|1|100000", output
        print(json.dumps({"server": version, "baseline": baseline,
                          "advised": advised, "after_reset": reset,
                          "unmatched_alias": unmatched,
                          "scope": "Plan selection and advice feedback only; no timing benchmark"},
                         indent=2, ensure_ascii=False))
    except subprocess.CalledProcessError as error:
        print(error.stdout)
        print(error.stderr)
        if log.exists():
            print(log.read_text())
        raise
    finally:
        if (data / "postmaster.pid").exists():
            run("pg_ctl", "-D", str(data), "-m", "immediate", "-w", "stop")
