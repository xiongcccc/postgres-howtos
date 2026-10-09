# 106：来源与技术校订记录

核对日期：2026-09-30。中文整理与技术校订：xiongcc。

## 来源与定位

- 用户提供 33 页 PDF：*PostgreSQL 19: What to Expect from the Upcoming Release*。完整提取阅读，并渲染查看第 15、18、22 页的 REPACK 语法、并行示意与复制功能说明。
- 作者 Pranav Ghotekar / Mydbops，MyWebinar #55，2026-09-25。Mydbops Webinar 目录与主办方 Meetup 活动页交叉确认。原独立注册页抓取失败，因此元数据使用主办方活动页，不上传第三方 PDF。
- 归入“专题解读”，主专题“复制、校验与升级”，交叉收录“存储、WAL 与 Vacuum”“查询性能与观测”。Webinar 沿用会议材料来源类别，正文准确标明线上分享，不伪称 PGConf 场次。
- 按 DBA 维护、复制与升级评估重组内容，不逐页翻译，不扩展成完整新版本功能清单。

## 核对与取舍

| 原材料 | 正文处理与核对依据 |
| --- | --- |
| 第 1、6 页发布日期 | 以 9 月 24 日官方 Beta 4 公告为准，19 尚未 GA。10 月是预计窗口，不把“10 月末”写成承诺日期。 |
| 第 15 页 REPACK 语法 | 按 PG19 REPACK 文档改为 `REPACK (CONCURRENTLY) table_name`；补充权限、事务块、主键或索引复制标识条件。 |
| 第 16 页在线重整 | 说明逻辑解码捕获增量、最终切换仍有 ACCESS EXCLUSIVE 锁、等待锁期间变更可能延长持锁；保留额外空间、并发 DDL、MVCC 与关系类型限制。未把内置命令与 pg_repack 扩展实现等同。 |
| 第 17–18 页 parallel autovacuum | 按 runtime-config-vacuum 限定 index vacuuming/index cleanup；默认 autovacuum_max_parallel_workers=0；参数针对单个 autovacuum worker。未把示意图“最慢索引耗时”当整个 Vacuum 的性能公式。 |
| 第 17 页任务评分 | 按 routine-vacuuming 和参数说明解释评分来源与观测入口；不宣称自动解决旧快照、资源不足。 |
| 第 22–23 页序列同步 | 按 logical-replication-sequences 区分初始/显式同步与持续 nextval 传播；worker 完成即退出，REFRESH 语句返回不等于同步已完成；发布端需 PG19+。未将序列 page_lsn 对比写成逐次取号的可靠检测。 |
| 第 22 页动态 WAL 级别 | 按 runtime-config-wal 区分配置 wal_level 与 effective_wal_level；限定 replica 起点及槽变化，不写成 minimal 任意无重启提升，也不宣称可解码未记录的历史。 |
| 第 22 页 retain_dead_tuples | 按 CREATE SUBSCRIPTION 文档修正归属：订阅选项、冲突检测信息。说明停用订阅/apply 停止时不评估保留超时；不宣传为自动双向冲突解决。 |
| 第 24 页 WAIT | SQL 名称为 WAIT，具体语法 WAIT FOR LSN；原材料这一语法本身正确。补充提交之后取 pg_current_wal_insert_lsn、同一物理备库、standby_replay、锁/快照限制、错误状态与时间线。示例 LSN 明确是占位值，没有把它写成实测输出。 |
| 第 25 页 advice | 按 pg_plan_advice / pg_stash_advice 说明为随附模块，需加载并检查匹配反馈；不保证任意计划可强制生成，不宣称升级即自动拥有计划基线管理。 |
| 第 27–29 页撤回 | 以 Beta 3 公告确认 GROUP BY ALL 新功能撤回，以 Beta 4 公告确认 SQL/PGQ、在线校验和、FOR PORTION OF、MERGE/SPLIT PARTITIONS 撤回；未承诺 PG20 上线。 |
| 第 30 页兼容变化 | 按 release-19、相应配置文档说明 JIT、TOAST、锁容量、字符串与 RADIUS；TOAST 限定支持 LZ4 的构建，否则默认 pglz；区分网络类型 GiST opclass 调整和普通 CREATE INDEX 默认 B-tree。 |

正文将官方链接集中到参考资料，保留必要版本与操作边界。未使用原材料之外的性能数字，未虚构生产事故、执行结果或个人使用经历。

## 验证范围

本篇为 Beta 版本文档解读。技术核对来自原 PDF、PG19 文档及官方 Beta 公告；额外搭建了 PostgreSQL 19beta4 隔离实例，执行正文 plan advice 的两个 SQL 块。元数据标为 `tested`，说明中明确限定为这一小节，不能理解为全部新功能已经验证。没有执行本文的 REPACK、序列刷新或 WAIT 示例，也没有进行性能压测。

环境为 macOS aarch64，从官方 `https://ftp.postgresql.org/pub/source/v19beta4/postgresql-19beta4.tar.bz2` 编译。源码 SHA-256 与官方校验文件一致：

```text
83157ee9c599d03b2f7a3d73ef3a56ec24e0e79cc2b3501a64d1364f56398c86
```

构建使用临时前缀，配置 `--without-readline --without-icu --without-zlib`，额外安装 `contrib/pg_plan_advice`；这些裁剪只服务本次扫描计划实验，不作为生产构建建议。临时实例采用 UTF8、无 locale、32 MB shared_buffers，仅通过私有临时目录的 Unix socket 连接，不监听 TCP，不修改现有数据库或安装后台服务。

复现入口（先准备已安装该模块的 PostgreSQL 19）：

```sh
python3 maintenance/106-verify.py --pg-bin /path/to/postgresql-19/bin
```

脚本直接提取正文 SQL，建十万行临时表，并在同一会话检查：

- 默认计划：`Index Scan using advice_demo_id_idx`，生成 `INDEX_SCAN` 和 `NO_GATHER` advice。
- 应用 `SEQ_SCAN(d)`：计划变为 `Seq Scan`，反馈 `matched`。
- 执行 RESET：恢复索引扫描，不再显示 supplied advice。
- 使用错误别名 `missing_alias`：反馈 `not matched`，仍为索引扫描。
- 数据检查：100000 行，ID 范围 1 到 100000。

正文中的两个计划输出来自本次实验，不含虚构耗时。脚本连续两次运行通过，每次均自动停止服务器并清理数据目录。实验只能证明干预与匹配行为，不能证明性能收益。验证结束后已删除本次下载的源码包、源码目录与临时安装前缀，保留复现脚本和结果记录。

## 读者视角修订

- REPACK 先解释旧表服务业务、新文件复制、增量追赶与最终切换，再说明空间、锁和旧快照限制；用跨表读取场景解释快照风险。
- 用序列取号冲突说明迁移意义，动态 WAL 级别另设小节，避免在序列章节堆放多个复制功能。
- plan advice 增加可执行的小例子、真实计划及逐项解释，让读者能观察功能作用。
- 去掉正文中的材料纠错口吻，原文偏差与核对过程保留在本记录。
- 结尾区分所有升级都需检查的兼容性，以及 DBA 主动启用或应用配合的能力，并列出各自评估指标。
- 将理解门槛、机制解释、例子证据、读者收益及非模板化结构补入 `maintenance/editorial-standard.md`，后续文章沿用。

## 页面与目录检查

- 运行目录生成器，更新首页最近收录、侧栏、专题、系列、会议入口及搜索索引；最近收录显示 2026-09-30，原有文章编号与路由不变。
- `node --test maintenance/test-catalog.cjs`：11 项通过。新增 PG19 别名、来源与系列、Beta 版本信息、限定实测范围、站内链接与正文结构检查。首页维持最近 5 篇，101 仍在系列、专题和会议入口，不再要求它永久出现在首页最近收录中。
- 完整 `maintenance/test-site.cjs` 回归通过：全部 106 篇文章路由、中文标题与元数据，首页入口与日期，检索/过滤、目录跳转、索引加载失败及重试。
- 第 106 篇现有 6 个 SQL 块、2 个实测计划输出、1 个 Mermaid 流程图和 2 张表格。回归覆盖 390/768/1280 宽度暗色模式、整页横向溢出，以及 390 宽度两张表格的实际横向滚动。
- 人工查看桌面文章开头、移动端暗色执行计划及评估表截图，文字可读，长代码保持局部横向滚动；流程图沿用站点现有浅色画布，没有为本文修改公共主题。
- 浏览器使用独立临时配置，无用户登录状态；屏蔽统计与评论网络请求。首次沙箱内 Chrome 启动被系统终止，授权在沙箱外运行后通过，未修改浏览器配置或测试断言规避失败。
- 没有提交或推送。
