# 105：实验与校订记录

核对日期：2026-09-24。中文整理与技术校订：xiongcc。

## 来源与定位

- 用户提供 *How to Hack on Logical Replication - Insights from contributors*，30 页 PDF。完整提取阅读，并渲染查看第 8、20、21、22 页的架构、槽恢复和历史快照图。
- [会议官方页面](https://2026.pgconf.dev/session/527)确认作者 Hayato Kuroda、Zhijie Hou / Fujitsu，PGConf.dev 2026，2026-05-21 09:30–10:20；参考资料指向场次及官方会议资料入口，不上传整份第三方 PDF。
- “专题解读”，主专题“复制、校验与升级”，交叉收录“存储、WAL 与 Vacuum”。以实现约束与故障恢复为主线，保留开发者视角，不改写成发布订阅安装教程。

## 技术校订

| PDF 页码 | 正文处理 |
| --- | --- |
| 8、25、29 | 分清 PG18 与原分享的 PG19 开发背景。序列同步 worker 不写成 PG18 功能；PG14 streaming、PG16 parallel apply、PG18 新建订阅默认 parallel 分开说明。 |
| 10–11 | 原命令混用 origin/consume 槽名、plugin 占位符，且订阅参数应为 enabled 而非 enable。正文使用完整、已执行的 pg_recvlogical 示例；先建槽再生成数据，用同名 pgoutput 槽消费至终点并清理。协议 v1 限定为非 streaming 基础路径，不把接收性能当纯函数性能或订阅端性能。 |
| 12 | 原 perf 百分比未改成普遍收益；核对 6ce1608 补丁，优化是把 relkind/relispartition 查询移到缓存重建块，保留未发布表负载也有解码开销的启示。 |
| 17 | FOR TABLES IN SCHEMA 包含未来表；GRANT ON ALL TABLES IN SCHEMA 不自动授权未来对象。另行验证订阅端表结构及 REFRESH PUBLICATION，避免暗示自动复制 DDL。 |
| 18 | 复制标识列限制针对发布 UPDATE/DELETE；仅 INSERT 时不要求过滤列属于复制标识。PG18 的 CREATE PUBLICATION 可先成功、UPDATE 时校验失败，正文不写成一定在创建时拒绝。FULL 的成本和适用范围一并说明。 |
| 19、23 | 同版本实测不当作跨版本兼容测试。发布端复合主键、订阅端子集主键可以工作，但订阅端的额外唯一性要求可能拒绝发布端合法数据。 |
| 20 | 持久槽与临时槽区分；持久逻辑槽 rollback 后保留已实测。ca307d5 是历史修复，last_saved_restart_lsn 保护恢复所需 WAL，不把缺陷写成当前预期行为。 |
| 21–22 | 当前目录与历史快照区分；IMMUTABLE 用户函数仍不允许用于 publication 过滤。未把扩展函数示意改成实际可执行的受支持配置。 |
| 26 | 不能直接照搬物理复制的延迟回放机制；未断言逻辑延迟复制永远无法实现，说明暂存、反馈、容量与恢复设计。 |
| 27 | 分别核对 e41d954 的 SIGINT/SIGUSR2 处理和 1528b0d 的 before_shmem_exit 回调。未宣称本地重现了这些历史缺陷。 |
| 28 | origin ID 具有本地生命周期、可复用；迁移讨论不宣传为 PG18 已有通用升级保证。 |
| 29 | on 是传输后文件暂存、parallel 可以提前应用；可见性仍受事务提交约束。未写成多 worker 可以随意拆分同一事务，也没有声称 streaming 完全消除 spill。 |

源码核对通过 PostgreSQL 官方 gitweb 的补丁内容及 postgres/postgres 提交页：6ce1608、ca307d5、e41d954、1528b0d、fc6600f。参考 PostgreSQL 18 publication、row filters、CREATE SUBSCRIPTION、pg_recvlogical、logical decoding streaming 和 replication origin 文档。

## 隔离实验

环境：PostgreSQL 18.4（Homebrew）、macOS / aarch64、UTF-8。脚本 `maintenance/105-verify.py` 仅依赖 Python 标准库及 PostgreSQL 工具。

```sh
python3 maintenance/105-verify.py
# 非默认安装路径：
python3 maintenance/105-verify.py --pg-bin /path/to/postgresql18/bin
```

每次创建两个临时数据目录，使用随机私有目录中的 Unix socket，端口编号 55405/55406、不监听 TCP、不连接现有数据库。保留默认 fsync 和同步提交，SQL 设置 statement_timeout，追赶用条件轮询，不依靠固定 sleep 判断成功。finally 中先停订阅端，再停发布端，删除全部临时数据。

完整验证通过，结果如下：

- schema publication 创建后新增表，发布端立即包含该表；订阅端 pg_subscription_rel 中没有该表，REFRESH PUBLICATION 后进入 ready 状态并复制已有行。
- 新订阅 `pg_subscription.substream='p'`。
- 直接提取并执行正文三个 SQL 块：publication 创建成功；过滤列不在 RI 中的 UPDATE 返回 42P10；设置 FULL 后更新成功。
- 双节点验证过滤范围的退出与进入，订阅端分别删除、插入该行。
- 切换 INSERT-only、恢复默认 RI 后，非 RI 过滤列的插入仍可复制。
- 使用 IMMUTABLE 用户函数创建过滤 publication，返回 0A000。
- 发布端主键 (order_id,product_id)，订阅端主键 order_id：单条明细插入与更新成功；相同订单的第二种商品在订阅端触发 `conflict=insert_exists`，日志指出 order_details_pkey 已有该键。测试显式配置 disable_on_error=true，因此订阅自动停用，没有把它描述为默认行为。
- 在显式事务中创建持久逻辑槽后 ROLLBACK，pg_replication_slots 中该槽仍存在；显式删除后消失。
- 直接提取正文唯一 bash 块，以临时发布端的连接环境运行：10,000 行负载、记录终点 LSN、pg_recvlogical 使用 pgoutput/proto_version=1 接收至终点，成功退出并清理槽、表和 publication。该实验验证命令流程，不作为性能基准。

不包含跨版本节点组合、历史快照故障复现、崩溃注入、并行 worker 失败注入、PG19 序列同步或吞吐压测。这些部分分别按原分享、文档及历史修复解释，没有把整篇标成完整性能复现。

## 编辑与页面检查

采用问题导向小标题，来源集中交代，官网链接集中在文末。不虚构生产事故，不反复使用角色标签或免责句。示例与正文围绕实现约束展开，未扩大为完整逻辑复制运维手册。

- 目录生成、十项静态测试、浏览器测试脚本语法检查和 `git diff --check` 通过。
- 第 105 篇独立浏览器验收通过：中文标题、来源与验证信息、三个 SQL 块、一个 bash 块、一个 Mermaid 流程图、独立目录定位。
- 390/768/1536 像素分别检查浅色和暗色，三张表格在 390 像素下均验证实际横向滚动；流程图已渲染且尺寸正常，无整页横向溢出。人工查看桌面首屏、移动端暗色流程图和进度表格截图。
- 首页最近收录日期 2026-09-24，别名搜索“逻辑复制开发”，专题、系列、会议入口及浏览器前进后退通过；首页评论仍不显示。
- 本次执行第 105 篇的独立浏览器检查，没有重跑所有历史文章的完整浏览器测试。主题切换时观察到一次远程 dark.css 请求被取消，但页面主题断言和截图均正常，没有页面 JavaScript 异常；没有修改网站加载策略。
