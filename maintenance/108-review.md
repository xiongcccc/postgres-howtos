# 108：来源与技术校订记录

核对日期：2026-10-09。中文解读与技术校订：xiongcc。

## 来源与定位

- Kevin Biju Kizhake Kanichery，ClickHouse Blog，2026-09-28：[Can your Postgres survive a bad query?](https://clickhouse.com/blog/can-your-postgres-survive-a-bad-query)。核对页面作者、发布时间、递归压力测试和故障分类。
- “专题解读”，主专题“查询性能与观测”，交叉收录“运维排障与日常工具”；来源为技术博客，不进入会议精选。
- 面向有基本 SQL、执行计划和事务知识的 DBA、后端工程师。主线为 work_mem 的覆盖范围、递归去重状态、可处理错误与后端异常退出的不同影响。
- 不逐段翻译原文，不复刻原文 API 业务表和服务商热图。云服务对比只作简短、明确归属的背景介绍，不将厂商测试写成独立排名或本站亲历。

## 技术核对

- PostgreSQL 18 Resource Consumption：work_mem 为执行操作预算；hash_mem_multiplier；temp_file_limit 按进程、显式临时表不在限制内、变更权限。避免把参数写成整条查询或实例硬上限。
- Parallel Plans：普通 Hash 在参与进程中可能各建一份，Parallel Hash 共建共享表；leader 专属节点不能按 worker 数重复计算。示例预算相加明确是示意，不作为实际峰值或精确 RSS。
- PostgreSQL 18.4 nodeRecursiveunion.c：build_hash_table 调用 BuildTupleHashTable；逐条 LookupTupleHashEntry 进行跨轮次去重；working_table 与 intermediate_table 由 work_mem 创建 tuplestore。内存去重集合与可落盘的工作/结果存储分开说明。
- WITH Queries：UNION 去重比较完整输出行；有环图的 UNION ALL 与加入递增深度后失去节点去重效果。未建议直接换 UNION ALL，也未把父级 LIMIT 当成通用终止保障。
- pg_backend_memory_contexts：只看当前后端，18 的 path 列用于聚合父子上下文，先物化同一份快照，避免多次取样的层级 ID 不一致。total_bytes 是分配量，包含空闲空间，不写成 RSS 或整个查询峰值。
- mcxt.c / MemoryContextAllocationFailure：常规可处理分配失败可抛出 53200；临界区等路径不能泛化为所有 OOM 都能保留连接。
- postmaster.c / CleanupBackend、HandleChildCrash：共享内存普通后端异常退出会扩大影响范围；正常 ERROR 与正常 FATAL 终止不能混为 SIGKILL。只讨论单实例，不推导全体副本都宕机。
- Linux kernel overcommit-accounting、PostgreSQL Kernel Resources：严格承诺检查是主机级策略、承诺量不等于 RSS、不能完全消除 OOM；cgroup-v2 的 memory.max 还可能触发本组 OOM。没有给未验证的生产 sysctl 配方。
- Client Connection Defaults、System Administration Functions、错误码附录：超时 57014，临时文件超限 53400；自动提交与显式事务中的失败状态分开；pg_log_backend_memory_contexts 的结果写入日志，不返回远程内存表。

## 最小实验

```sh
python3 maintenance/108-verify.py --pg-bin /opt/homebrew/opt/postgresql@18/bin --check-output
```

现有 Homebrew PostgreSQL 18.4，macOS aarch64。新建 UTF8、无 locale 的临时实例，shared_buffers=32MB、max_connections=10，只监听私有 Unix socket，不连接本机已有数据库。结束或失败时关闭会话、停止实例并移除目录。

脚本直接提取正文 12 个具名 SQL 块，按序执行专用 schema、10 万行环形边表、样例查询、两次排序、采样函数、递归、查询结束后观察、两次预期错误、连接复用与清理。会话保持自动提交，默认超时 10 秒、临时文件上限 32MB；不执行原文 1260 万节点并发负载，也不触发 OOM。

三轮运行通过，后两轮 `--check-output` 对照正文九段实际输出：

- 1MB work_mem 下排序为 external merge，Disk=4624kB；32MB 下为 quicksort，Memory=8541kB。输出关闭 timing、cost 和 buffers，仅保留支撑判断的节点与资源信息。
- 递归到达 100000 个不同节点，最后一个节点处的去重上下文树分配量为 4.00MB，超过当前 1MB work_mem；结束后对应上下文数量为 0。
- temp_file_limit=0 的排序报 53400；100ms 的 pg_sleep(1) 报 57014。两次错误后的 SELECT 1 成功，PID 与最初相同，未依赖重新连接。
- 服务端日志确认实验产生过临时文件；清理后 schema 不存在，work_mem 恢复默认 4MB。

验证范围是上述有限规模机制及自动提交错误恢复。不覆盖 Linux OOM、严格 overcommit、云服务商压测、并行内存总量或压力下的连接隔离。生产诊断 SQL 为文档核对示例，未冒充现场输出。

## 读者视角复核

- 开头直接交代业务风险：同一类耗内存查询为什么会有不同影响范围。正文沿预算、实测、故障路径、生产判断展开。
- 先用十万节点环解释全局去重，再展示内存上下文；术语随需要解释，不要求读者先掌握内存分配器实现。
- 正文包含建表、样例数据、所有实验 SQL、九组实际结果、预期错误后的继续操作、适用权限与清理。无需运行 maintenance 才能复现。
- 三层范围分开：执行器临时文件上限、语句时间、主机内存承诺策略。没有用一种限制替代其他限制。
- 结尾给出诊断和处置依据，区分工作集大、并发过高和递归无界；明确只读与重试不自动解决资源问题。
- 官方依据集中在文末，未使用“先把……说清楚”“反直觉”等模板句式，没有额外杜撰个人事故或大段免责说明。

## 页面与目录检查

- 生成器验证 108 篇记录，更新首页最近收录、侧栏、两个专题、系列摘要、搜索索引及本地资源哈希；旧路由保留，较早文章仍可通过专题和全部系列入口检索。
- `node --test maintenance/test-catalog.cjs`：13 项通过。新增博客/专题/运维筛选、英文原题和中文别名、来源日期、验证范围、12 个实验步骤与九组输出、站内路由检查。
- 完整 `maintenance/test-site.cjs` 回归通过：108 篇文章、中文标题与元数据、首页日期与入口、搜索和筛选重载、目录定位、索引失败降级与重试。
- 第 108 篇覆盖 390、768、1280 宽度暗色模式，流程图、13 个 SQL 块、九个实际输出块和故障范围表正常；整页无横向溢出，390 宽度表格实际横向滚动成功。
- 人工查看桌面首页段落、桌面暗色图表、手机暗色递归结果和表格截图。查询结果可读，长 SQL 在局部区域横向滚动；进一步压缩流程图长标签，改善手机可读性。
- 回归中的会议分类断言改为检查正文 h3 条目，不把页底“下一篇”当作会议收录；旧文章退出最近六篇或首页最近五篇后，测试仍检查其主题和全部系列筛选入口，不要求摘要永久列出所有文章。
- 逐篇回归在检查评论数量前等待容器插入，避免标题及元数据先完成、评论插件稍后完成造成瞬时误报；没有修改网站评论逻辑。
- 使用独立无头 Chrome，不使用用户浏览器配置，统计与评论请求屏蔽。预览：`http://127.0.0.1:4175/#/docs/108`。未执行 commit、push 或线上部署。
