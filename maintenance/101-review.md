# 101：实验与校订记录

核对日期：2026-09-23。中文整理与技术校订：xiongcc。

本文属于专题解读，不是上游逐字翻译。已在 PostgreSQL 18.4 中验证计划选择、分区锁范围、TOAST 清理及对象大小查询，元数据设为 `tested`，并明确注明这四项验证范围。

## 本地实验

环境：PostgreSQL 18.4（Homebrew），macOS，aarch64。执行日期：2026-09-23。

在仓库根目录运行：

```sh
python3 maintenance/101-verify.py
# 其他安装位置可指定 PostgreSQL 二进制目录：
python3 maintenance/101-verify.py --pg-bin /path/to/postgresql18/bin
```

需要 `initdb`、`pg_ctl`、`psql` 和随 PostgreSQL 提供的 `pgstattuple` 扩展，以普通用户运行。脚本创建独立临时集群，只监听临时目录内的 Unix socket，不开放 TCP，也不连接已有实例；完成后停止服务并删除临时数据。为固定观察时点，实验关闭 autovacuum；为减少临时集群初始化成本，关闭 fsync。这些设置仅用于本次可丢弃的测试环境。

### 分区锁范围

建立 12 个范围分区，每个分区 1,000 行，执行 `PREPARE by_event(integer) AS SELECT count(*) FROM events WHERE event_id=$1`。分别强制自定义计划和通用计划，先执行一次，再在新事务中运行 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) EXECUTE by_event(500)`。随后从 `pg_locks` 统计本会话在叶子分区上持有的 `AccessShareLock`。

| 计划模式 | 扫描分区 | 叶子分区锁数量 | Subplans Removed |
| --- | --- | --- | --- |
| force_custom_plan | events_0 | 1 | 0 |
| force_generic_plan | events_0 | 12 | 11 |

计数排除父表和系统目录。实验说明执行初始化时裁剪的分区仍可能已被锁定，没有进行并发压测，也没有把锁数量差异直接等同于 LockManager 性能瓶颈。

### 自动计划选择

建立 100,000 行测试表：99,900 行的键值为 0，其余 100 行键值各异；创建 B-tree 索引并执行 `ANALYZE`。在同一会话内设置 `plan_cache_mode = auto`，预备等值查询，针对同一个稀有值执行 10 次。

`pg_prepared_statements` 返回 `custom_plans = 10`、`generic_plans = 0`。该结果用于说明第六次执行不一定切换通用计划，不外推为所有倾斜数据的固定选择。

### 主表 Vacuum 与 TOAST

建立 50 行大文本测试表，使用 `STORAGE EXTERNAL` 避免压缩影响观察，然后更新全部文本。通过 `pgstattuple` 检查关联 TOAST 表：

| 时点 | TOAST 死元组数 |
| --- | --- |
| 更新完成后 | 850 |
| 对主表执行 VACUUM 后 | 0 |

测试没有直接对 TOAST 表执行 Vacuum，也没有运行 `VACUUM FULL`。结果说明默认主表 Vacuum 会处理关联 TOAST，不涉及文件是否缩小的保证。

### 正文大小查询

脚本直接提取正文 SQL 执行，避免单独维护一份测试查询。`toast_probe` 返回：主表主 fork 为 8192 bytes，主表索引为 0 bytes，TOAST 总大小为 3392 kB，关系总大小为 3432 kB。关系总大小包含辅助 fork，因此不能只将主 fork、索引和 TOAST 三列相加作为总大小。

原分享中 598 ms 至 0.203 ms 的性能案例、备库反馈案例和连接内存案例采用材料中的归属说明，未在本次实验中复现。

## 原始材料

- 用户提供 `HOW TO ACTUALLY FIX POSTGRESQL PERFORMANCE.pdf`，39 页，标题为 *Stop Guessing: How to Actually Fix PostgreSQL Performance*。
- 作者：Anita Singh、Ranjan Burman，AWS。会议为 Postgres Conference 2026，San Jose。
- [会议详情](https://postgresconf.org/conferences/postgresconf_2026/program/proposals/postgresql-statistics-unleashed-mastering-query-optimization-through-data-driven-insights)确认日期为 2026-04-22 14:00 PDT。链接 slug 与标题不同，但页面标题和作者匹配。
- 全文提取阅读，并检查第 27、33 页渲染，确认有争议文字确实来自原页，而非文本提取错误。
- 不上传整份第三方 PDF；正文保留公开来源链接，以选题式解读与必要案例摘要呈现。

## 技术取舍

| PDF 页码 | 原始内容 | 本文处理 |
| --- | --- | --- |
| 5、7–15 | 性能诊断顺序、资源与执行计划 | 组织为“现象与下一步证据”，不照抄参数推荐值。 |
| 18 | 统计目标 300 改为 8000；规划时间 598 ms 改善至 0.203 ms | 标为原案例，保留执行约 1.5 ms 的对照；不外推改善比例，不把规划慢唯一归因于统计信息。 |
| 20 | 复合索引缺少前导列时不可用 | 修正为成本与扫描范围问题；PG18 skip scan 的适用效果依赖数据分布。 |
| 26–28 | 第六次切换通用计划、分区锁争用 | 补上成本比较前提；采用 PG18 文档对执行初始化裁剪仍加锁的描述，不声称规划时裁剪就只锁一个关系。 |
| 28 | 增大 max_locks_per_transaction 缓解争用、删除分区等 | 不作为通用修复步骤；本文只提供受控比较方向，不执行生产配置或删表命令。 |
| 32 | 备库长查询、hot_standby_feedback、主库清理延迟 | 区分资源不足与回收边界受限；max_standby_streaming_delay 不是全部查询的时长上限。 |
| 33–34 | Vacuum 忽略 TOAST、超过 2 KB 一定外置 | 按 PROCESS_TOAST 默认行为和 TOAST 存储策略修正。大小查询不解释为膨胀测量。 |
| 9–10、23–25 | 连接内存与 work_mem 公式 | 解释按操作、并发、并行进程及 hash_mem_multiplier 的影响，不把粗略乘法当作精确内存预算。 |
| 35–37 | 子事务与 SLRU | 未展开。独立成文时应补查版本、读写子事务区别、缓存与等待机制，并进行实验。 |

## 核对资料

- [统计视图](https://www.postgresql.org/docs/18/monitoring-stats.html)
- [pg_stat_statements](https://www.postgresql.org/docs/18/pgstatstatements.html)
- [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)
- [规划器统计信息](https://www.postgresql.org/docs/18/planner-stats.html)
- [多列索引](https://www.postgresql.org/docs/18/indexes-multicolumn.html)
- [PREPARE](https://www.postgresql.org/docs/18/sql-prepare.html)
- [分区裁剪](https://www.postgresql.org/docs/18/ddl-partitioning.html#DDL-PARTITION-PRUNING)
- [日常清理](https://www.postgresql.org/docs/18/routine-vacuuming.html)
- [复制参数](https://www.postgresql.org/docs/18/runtime-config-replication.html)
- [VACUUM](https://www.postgresql.org/docs/18/sql-vacuum.html)
- [TOAST](https://www.postgresql.org/docs/18/storage-toast.html)
- [对象大小函数](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-DBSIZE)
- [资源参数](https://www.postgresql.org/docs/18/runtime-config-resource.html)

## 编辑检查

正文保留一条经过执行验证的只读查询，说明对象范围与大小口径。官方资料统一收在文末；去除反复的材料局限声明、行文预告和刻意制造反差的标题。保留影响生产安全的提醒与必要版本区别，不把原分享的案例改成作者亲历。

后续素材按 `maintenance/editorial-standard.md` 先选择实用指南、实践剖析或专题解读，再确定结构。技术主题、文章系列与材料来源分别维护。
