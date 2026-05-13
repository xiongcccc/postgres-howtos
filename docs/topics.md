# 专题索引

这份索引按使用场景组织文章，适合在遇到具体问题时快速定位，也适合按主题系统阅读。

<div class="topic-grid">
  <a class="topic-card" href="#/docs/topics?id=topic-performance">
    <strong>查询性能与观测</strong>
    <span>EXPLAIN、pg_stat_statements、benchmark、FlameGraph。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-indexes">
    <strong>索引治理</strong>
    <span>创建、维护、清理、冗余索引和过度索引。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-locks">
    <strong>锁、事务与在线变更</strong>
    <span>长事务、DDL 阻塞、锁队列和零停机 schema 变更。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-storage">
    <strong>存储、WAL 与 Vacuum</strong>
    <span>WAL 增长、膨胀、XID 回卷、页面和存储布局。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-ops">
    <strong>运维排障与日常工具</strong>
    <span>备份恢复、psql、Docker、Linux 参数和脚本化处理。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-sql">
    <strong>SQL、数据建模与扩展玩法</strong>
    <span>数组、UUID、元数据、测试数据和 SQL 风格。</span>
  </a>
  <a class="topic-card" href="#/docs/topics?id=topic-replication">
    <strong>复制、校验与升级</strong>
    <span>复制延迟、物理/逻辑复制转换、主版本升级。</span>
  </a>
</div>

<span id="topic-performance"></span>

## 查询性能与观测

先建立正确的分析习惯，再从全局负载逐步定位到具体 SQL。

- [EXPLAIN ANALYZE or EXPLAIN (ANALYZE, BUFFERS)](./1.md)
- [How to work with pg_stat_statements, part 1](./5.md)
- [How to work with pg_stat_statements, part 2](./6.md)
- [How to work with pg_stat_statements, part 3](./7.md)
- [How to troubleshoot Postgres performance using FlameGraphs and eBPF (or perf)](./10.md)
- [Ad-hoc monitoring](./11.md)
- [How to find query examples for problematic pg_stat_statements records](./12.md)
- [How to benchmark](./13.md)
- [How to decide when a query is too slow and needs optimization](./14.md)
- [How to tune work_mem](./92.md)

<span id="topic-indexes"></span>

## 索引治理

索引不是越多越好。这里关注创建、维护、清理和风险控制。

- [How to monitor CREATE INDEX / REINDEX progress in Postgres 12+](./15.md)
- [Over-indexing](./18.md)
- [Index maintenance](./53.md)
- [How to check btree indexes for corruption](./26.md)
- [How to check btree indexes for corruption (pg_amcheck)](./54.md)
- [How to create an index, part 1](./61.md)
- [How to create an index, part 2](./62.md)
- [How to find unused indexes](./75.md)
- [How to find redundant indexes](./76.md)
- [How to rebuild many indexes using many backends avoiding deadlocks](./79.md)

<span id="topic-locks"></span>

## 锁、事务与在线变更

生产环境里的 DDL 和长事务，重点是降低锁等待、避免阻塞链扩大。

- [How to analyze heavyweight locks, part 1](./22.md)
- [How to deal with long-running transactions (OLTP)](./30.md)
- [How to redefine a PK without downtime](./33.md)
- [How to use subtransactions in Postgres](./35.md)
- ["Find-or-insert" using a single query](./36.md)
- [How to enable data checksums without downtime](./37.md)
- [How to analyze heavyweight locks, part 2](./42.md)
- [How to drop a column](./55.md)
- [How to add a column](./60.md)
- [How to add a CHECK constraint without downtime](./69.md)
- [How to add a foreign key](./70.md)
- [How to understand what's blocking DDL](./71.md)
- [How to remove a foreign key](./72.md)
- [How to analyze heavyweight locks, part 3. Persistent monitoring](./73.md)

<span id="topic-storage"></span>

## 存储、WAL 与 Vacuum

理解数据如何落盘、WAL 如何增长、Vacuum 如何工作，是排查很多线上问题的基础。

- [Understanding how sparsely tuples are stored in a table](./4.md)
- [How to understand LSN values and WAL filenames](./9.md)
- [How to get into trouble using some Postgres features](./16.md)
- [How to troubleshoot a growing pg_wal directory](./31.md)
- [How to monitor transaction ID wraparound risks](./44.md)
- [How to monitor xmin horizon to prevent XID/MultiXID wraparound and high bloat](./45.md)
- [How to deal with bloat](./46.md)
- [How to reduce WAL generation rates](./52.md)
- [How many tuples can be inserted in a page](./66.md)
- [Autovacuum "queue" and progress](./67.md)
- [How to flush caches (OS page cache and Postgres buffer pool)](./74.md)
- [How to find int4 PKs with out-of-range risks in a large database](./80.md)
- [How to find the best order of columns to save on storage ("Column Tetris")](./84.md)
- [How to quickly check data type and storage size of a value](./85.md)

<span id="topic-ops"></span>

## 运维排障与日常工具

面向日常 DBA 工作流：启动停止、备份恢复、psql、Docker、Linux 参数和脚本化处理。

- [How to troubleshoot and speed up Postgres stop and restart attempts](./2.md)
- [How to troubleshoot long Postgres startup](./3.md)
- [How to speed up pg_dump when dumping large databases](./8.md)
- [How to import CSV to Postgres](./19.md)
- [How to use pg_restore](./20.md)
- [How to compile Postgres on Ubuntu 22.04](./27.md)
- [How to perform initial / rough Postgres tuning](./34.md)
- [How to install Postgres 16 with plpython3u](./47.md)
- [How to use Docker to run Postgres](./58.md)
- [psql tuning](./59.md)
- [psql shortcuts](./68.md)
- [How to tune Linux parameters for OLTP Postgres](./88.md)
- [How to use lib_pgquery in shell to normalize and match queries from various sources](./90.md)
- [How to format text output in psql scripts](./91.md)

<span id="topic-sql"></span>

## SQL、数据建模与扩展玩法

这里适合补充 SQL 风格、数据生成、数组、UUID、元数据和一些有趣玩法。

- [How to use OpenAI APIs right from Postgres to implement semantic search and GPT chat](./23.md)
- [How to work with metadata](./24.md)
- [How to work with arrays, part 1](./28.md)
- [How to work with arrays, part 2](./29.md)
- [How to speed up bulk load](./32.md)
- [How to format SQL (SQL style guide)](./43.md)
- [How to generate fake data](./48.md)
- [How to use UUID](./64.md)
- [UUID v7 and partitioning (TimescaleDB)](./65.md)
- [How to estimate the YoY growth of a very large table using row creation timestamps and the planner statistics](./78.md)
- [How to draw frost patterns using SQL](./82.md)

<span id="topic-replication"></span>

## 复制、校验与升级

复制延迟、物理/逻辑复制切换、主版本升级，都是高风险但高价值主题。

- [How to determine the replication lag](./17.md)
- [How to convert a physical replica to logical](./57.md)
- [Postgres major upgrade without any downtime for a very large cluster running under heavy load](./77.md)
- [How to troubleshoot streaming replication lag](./93.md)
