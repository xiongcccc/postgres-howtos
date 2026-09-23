# 102：实验与校订记录

核对日期：2026-09-23。中文整理与技术校订：xiongcc。

## 来源与选题

- 用户提供的 PDF：*Autovacuum Blocked, Backlogged, or Slow?! Understanding Why It Can't Keep Up*，38 页。
- Baji Shaik、Mohamed Ali，AWS。Postgres Conference 2026，San Jose；[会议议程](https://postgresconf.org/conferences/postgresconf_2026)确认场次日期为 2026-04-23。
- 全文提取阅读，并渲染检查第 28、29 页，核对内存对比和并行清理相关表述。
- 归入“专题解读”，主专题“存储、WAL 与 Vacuum”，交叉收录“运维排障与日常工具”。文章解释诊断判断，不按幻灯片逐页翻译，也不重复第 67 篇的完整队列 SQL。
- 不上传整份第三方 PDF。正文以独立叙述整理材料，补充本地机制实验。

## 技术校订

| 原材料位置 | 校订与取舍 |
| --- | --- |
| 第 6、20 页 | `autovacuum_worker_slots` 需要重启；PG18 可重载的是 `autovacuum_max_workers`，并受预留槽位限制。以本机 `pg_settings.context` 再次确认。 |
| 第 7、8、22 页 | PG18 的更新/删除门槛有 `autovacuum_vacuum_max_threshold` 上限；插入门槛需考虑未冻结比例，不仅是总行数。队列估算应区分触发路径。 |
| 第 12–17 页 | 旧快照约束回收边界与关系锁等待分开讲；不能按事务开始时间或 `idle in transaction` 标签直接判定同一种阻碍。复制槽的 `xmin`、`catalog_xmin`、`restart_lsn` 作用也分别说明。 |
| 第 15、36 页 | `idle_replication_slot_timeout` 在 PG18 引入，未沿用 PG16+ 标注。槽失效可能导致下游重建，不建议直接删除所有非活跃槽。`max_standby_streaming_delay` 不作为通用查询超时。 |
| 第 21、27 页 | worker 的成本均衡有表级参数例外。增加 worker 不自动按比例增加吞吐；不把固定成本参数作为适合所有 SSD 的推荐值。 |
| 第 23、30、32 页 | 区分 aggressive vacuum、anti-wraparound 触发与 failsafe；不直接沿用统一告警阈值。不从 failsafe 推导所有索引都必须重建。 |
| 第 24 页 | `n_dead_tup` 是估计值，不能单独当作物理膨胀率。目录频繁 DDL 和维护压力保留为排查方向。 |
| 第 28 页 | 原页 27 分 52 秒和 22 秒的对照伴随阶段、扫描比例和索引周期变化，不将其作为内存调整的通用加速比。采用机制解释及应比较的指标。`autovacuum_work_mem` 并非 PG15 才有，不沿用该版本标签。 |
| 第 28、36 页 | PG17 改进死条目标识存储及进度字段，并移除 Vacuum 原有 1 GB 内存使用限制，不写成 `maintenance_work_mem` 参数此前无法配置超过 1 GB。 |
| 第 29 页 | PG18 autovacuum 与手动并行索引 Vacuum 分开；默认主表 Vacuum 会处理 TOAST；不声称每次都对每个索引完整扫描。删除索引需审查约束、低频使用和统计周期。未沿用“无锁重建”“零停机”等绝对表述。 |
| 第 6、29、30、36 页 | PG19 功能不纳入本文的 PG18 操作建议，不依照演示材料把未来版本行为混入当前版本。 |
| 第 16 页 | 损坏页与无效数据库归入故障处置，不提供直接丢弃数据的快捷修复。 |

## 补充实验

环境：PostgreSQL 18.4（Homebrew），macOS，aarch64。脚本：`maintenance/102-verify.py`。

```sh
python3 maintenance/102-verify.py
# PostgreSQL 安装位置不同时：
python3 maintenance/102-verify.py --pg-bin /path/to/postgresql18/bin
```

脚本仅依赖 Python 标准库以及 PostgreSQL 的 `initdb`、`pg_ctl`、`psql`，以普通用户运行。每次创建独立临时数据目录和 Unix socket；不开放 TCP、不连接已有实例。为了控制实验时序，关闭该临时集群的 autovacuum；为减少测试开销关闭 fsync。会话、语句和进程都有超时，结束后关闭会话、停止集群并删除临时数据。

### 旧快照与回收边界

1. 建立包含 10,000 行的 `vacuum_probe` 表和主键，每行含 100 字符文本。
2. 会话 A 以 `REPEATABLE READ` 查询该表，保持事务打开。
3. 会话 B 删除前 5,000 行并提交。
4. 执行 `VACUUM (VERBOSE, TRUNCATE FALSE) vacuum_probe`，确认日志为 `0 removed`、`5000 are dead but not yet removable`。
5. 此时 A 读取 10,000 行，新会话读取 5,000 行；A 为 `idle in transaction` 且 `backend_xmin` 非空。
6. A 提交后再执行相同 Vacuum，确认 `5000 removed`、`0 are dead but not yet removable`。

正文使用移除数量和不可回收数量，不将 Vacuum 对扫描页面的 `remain` 统计误写为全表精确行数。此实验验证回收机制，不验证 autovacuum 的自动触发时间或 worker 调度。

### 关系锁等待

另一个会话持有 `SHARE ROW EXCLUSIVE` 表锁，再执行手动 Vacuum。观测到 `Lock / relation`，`pg_blocking_pids()` 精确指向持锁会话；回滚持锁事务后，Vacuum 正常完成。

这里验证的是手动 Vacuum 的关系锁冲突，autovacuum 的跳过、取消及防回卷例外按照文档核对，没有将两者行为等同。

### 参数及查询

| 参数 | PostgreSQL 18.4 实例值 | context |
| --- | --- | --- |
| autovacuum_max_workers | 3 | sighup |
| autovacuum_worker_slots | 16 | postmaster |
| autovacuum_vacuum_max_threshold | 100000000 | sighup |
| autovacuum_work_mem | -1 | sighup |
| idle_replication_slot_timeout | 0 | sighup |
| track_cost_delay_timing | off | superuser |

脚本提取正文的三个 SQL 代码块，在测试实例中实际执行，检查字段、权限下的执行结果和语法。参数查询读取真实配置；未搭建复制拓扑，也未复现 BufferPin、成本限速压力、索引内存瓶颈或 XID 回卷故障。

## 核对资料

- [PostgreSQL 18 日常 Vacuum](https://www.postgresql.org/docs/18/routine-vacuuming.html)
- [Vacuum 参数](https://www.postgresql.org/docs/18/runtime-config-vacuum.html)
- [Vacuum 进度](https://www.postgresql.org/docs/18/progress-reporting.html#VACUUM-PROGRESS-REPORTING)
- [VACUUM 命令](https://www.postgresql.org/docs/18/sql-vacuum.html)
- [维护内存](https://www.postgresql.org/docs/18/runtime-config-resource.html)
- [复制槽](https://www.postgresql.org/docs/18/view-pg-replication-slots.html)、[备库参数](https://www.postgresql.org/docs/18/runtime-config-replication.html)
- [PG17 发布说明](https://www.postgresql.org/docs/17/release-17.html)、[PG18 发布说明](https://www.postgresql.org/docs/18/release-18.html)

## 编辑检查

来源在开头一次性交代，官方链接集中在文末。正文保留影响生产安全的条件，不反复插入材料未提供环境等声明。不冒充生产经历，不使用“讲者”、写作指令式标题或反差口号。本文未修改旧文章正文和路由。

## 页面验收

- 目录生成与七项静态测试通过，`git diff --check` 通过。
- 独立浏览器检查第 102 篇的桌面展示、390/768/1536 像素暗色模式、移动端表格横向滑动、SQL 代码块无页面横向溢出，以及搜索、系列、专题、会议入口，均通过；截图已人工查看。
- 整站测试曾完成全部 102 篇路由检查，但后续重跑在既有 Mermaid 页等待渲染时超时；另有首页加载超时和外部 CDN 502 的观察。本次不将整站回归标记为完全通过，也未为此改动生产资源加载方式。
