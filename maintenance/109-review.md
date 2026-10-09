# 109：来源与技术校订记录

核对日期：2026-10-09。中文解读与技术校订：xiongcc。

## 来源与定位

- Christophe Pettus，The Build，2026-09-26：[All Your GUCs in a Row: max_standby_archive_delay and max_standby_streaming_delay](https://thebuild.com/blog/all-your-gucs-in-a-row-max_standby_archive_delay-and-max_standby_streaming_delay/)。
- 专题解读，主专题为复制、校验与升级，交叉收录存储和运维；来源为技术博客，不进入会议精选。
- 面向有基本事务与物理主备知识的 DBA、后端工程师，围绕报表被取消、等待预算和反馈的代价建立因果关系。原文的历史沿革与 ORM 细节不作为正文主线。
- 采用独立的 10000 行、4 秒预算实验，不转用原文 10 秒、50000 行的输出。原文归档实验没有写成本地验证结果。

## 技术核对

- PostgreSQL 18 Replication：两种来源的等待范围，默认 30s、裸数字毫秒、0 和 -1；修改上下文为 sighup，在备库 reload 生效。不是每条语句独享的超时，亦不是总复制延迟硬上限。
- REL_18_4 standby.c：GetStandbyLimitTime 取 GetXLogReceiptTime，再加相应参数；WaitExceedsMaxStandbyDelay 依此取消冲突虚拟事务。快照冲突按 horizon 和数据库筛选，不按正在读取的关系筛选。
- REL_18_4 xlogrecovery.c：流复制追上最新 chunk 才推进 XLogReceiptTime；非流式段打开也更新时间、使用 archive 分支。避免写成每条 WAL、每次冲突或 walreceiver 每次网络收包都重置预算。
- Hot Standby、postgres.c：行版本清理、关系锁、buffer pin、表空间等冲突；活动顶层语句通常 ERROR 40001，闲置事务和子事务可能 FATAL；DROP DATABASE 是直接终止连接的例外。正文不声称所有 40001 或所有 FATAL 均可无条件重试。
- hot_standby_feedback 和 pg_stat_replication.backend_xmin：反馈保留边界，主库保留旧版本；异步反馈到达前不能假定保护已经建立。释放 RR 快照后，backend_xmin 不要求为 NULL，必须确认边界已推进到删除事务之后。
- VACUUM TRUNCATE、runtime-config-vacuum、12 的表级存储参数：普通 Vacuum 尾部截断需要 AccessExclusiveLock；TRUNCATE FALSE 不关闭行版本清理，反馈不能阻止关系锁冲突；参数和表选项必须在主库影响产生 WAL 的操作。
- 复制统计：冲突计数比较增量；replay_lag 空闲时可为 NULL；LSN 差是字节差，不能直接转换为秒；最后回放事务年龄不能独自证明主库仍有未回放写入。
- synchronous_commit / remote_apply：若该备库参与同步应用确认，回放等待会影响主库提交；接收持久化与回放位置分开，不直接把回放积压写成必然数据丢失。

## 最小实验

```sh
python3 maintenance/109-verify.py --pg-bin /opt/homebrew/opt/postgresql@18/bin --check-output
```

现有 Homebrew PostgreSQL 18.4，macOS aarch64。新建 UTF8、无 locale 的主库，pg_basebackup -X stream -R 创建物理备库，均仅监听私有 Unix socket；每节点 shared_buffers=32MB、max_connections=20。不访问已有数据库、不绑定 TCP。脚本结束或断言失败时关闭会话，停止备库和主库并移除临时目录。

脚本直接提取正文 20 个具名 SQL 块，在主库和四个备库会话中按依赖顺序执行。内部用主库当前 WAL LSN 等待备库回放，以及 age() 比较动态读取的反馈边界。没有硬编码事务 ID 或通过固定 sleep 假设回放和反馈已完成。

两轮完整运行通过，第二轮 `--check-output` 对照正文七组输出。第一轮时间作为正文样本，第二轮确认机制与输出稳定：

- 第一轮：A 的 sleep 起点 0.001s，清理 A 完成 0.005s，清理 C 完成 1.288s，B 的 sleep 起点 1.291s；观察到两条语句取消均为 4.102s。观察间隔约 25ms，并未声称两个信号的精确时间完全一致。
- 第二轮：A 起点 0.001s，清理 A 0.005s，清理 C 1.377s，B 起点 1.378s；两条语句取消均在 4.233s 被观察到。允许合理的调度、轮询和取消处理误差，不以精确毫秒作为稳定断言。
- 两个 REPEATABLE READ 事务仅读 control 表，均报 40001 和行版本清理 DETAIL；startup 的 IPC / RecoveryConflictSnapshot 可观察，confl_snapshot 从 0 到 2，confl_lock 仍为 0。
- 开启反馈并确认主库收到 backend_xmin 后，删除和 VACUUM 保留 10000 个不可清理死版本；备库旧快照仍读到 10000，新快照读到 0。等待超过 4 秒，快照冲突计数未增加。
- 释放旧快照并等待反馈边界推进到删除后的 horizon，第二次 VACUUM 清掉 10000 个版本。只比较“比原 xmin 新”不够：反馈还可能停在删除事务位置，必须等待它越过相应清理边界。
- 尾部截断实验先等待删除回放、反馈更新，TRUNCATE FALSE 清完死版本但保留 173 页；备库读事务随后取得表锁，主库普通 VACUUM TRUNCATE TRUE 报 truncated 173 to 0 pages。备库报关系锁冲突 40001，最终计数为 snapshot=2、lock=1。
- 正文主库复制诊断 SQL 在临时拓扑执行，replay_gap_bytes 在追平后为 0；replay_lag 仍可能保留最近约 4 秒的等待值，未把此值当作当前字节积压或预计追平秒数。
- schema 删除后，备库也确认不存在；服务端日志有 snapshot 和 lock 两种恢复等待记录。VACUUM 的 INFO 是客户端详细输出，不称其为本地服务端日志。

实测范围为物理流复制的快照冲突、共享预算、反馈保留与释放、普通 Vacuum 尾部截断。归档/本地非流式路径、FATAL 和 DROP DATABASE 例外、remote_apply 按官方文档和 18.4 源码核对，未作独立运行验证。无生产压测或故障切换时长结论。

## 读者视角复核

- 开头从“没跑够配置时间就被取消”进入，先解释主库已完成清理、备库必须回放，再引入时间基准；不用源码名词替代因果说明。
- 通过只读 control 却被 victim 表清理取消的实验，解释按数据库快照年代筛选，而非按已经访问的表筛选。
- 第二组用主库死版本保留与两种备库可见结果说明反馈如何生效；第三组先把死版本清干净，再隔离尾部截断的表锁因素，避免把锁错误误判为反馈失败。
- 正文包含测试表与样例数据、P/A/B/O 的会话顺序、动态 LSN 等待方法、实际时间表与输出、回滚和配置恢复。需要既有隔离物理主备；自动脚本补全建库和复制初始化，不要求读者改动自己的数据库。
- 线上建议以冲突类型和增量为依据；开启反馈同时检查版本保留成本，调整延迟同时检查可接受的新鲜度；不通用推荐无限等待或任意固定生产值。
- 版本及验证范围集中在元数据；官网链接统一在文末。没有“讲者”“先把……说具体”等写作指令式语气，也没有杜撰亲历事故或重复免责说明。

## 页面与目录检查

- 生成器覆盖 109 篇文章，首页最近收录加入日期，侧栏及复制、存储、运维专题交叉收录；博客/专题解读筛选、原题和别名检索、旧路由保持正常。
- `node --test maintenance/test-catalog.cjs`：14 项通过。检查 20 个实验与诊断 SQL、七组结果、来源与验证记录、分类和内部链接。
- 完整 `maintenance/test-site.cjs` 通过：109 篇文章的中文标题、浏览器标题、元数据与评论挂载；首页入口、搜索、过滤重载、目录定位及索引失败降级/重试。
- 第 109 篇在 390、768、1280 宽度暗色模式下检查图、表、SQL 和反馈结果；整页无横向溢出，390 宽度表格实际横向滚动。独立无头 Chrome，不使用用户配置，统计与评论外部请求屏蔽。
- 人工查看桌面开头和手机暗色图表/结果截图。标题缩短，避免桌面最后一个汉字单独换行；手机代码和长参数仅在各自区域滚动，正文可读。
- 第 104 篇退出首页最近五篇、第 105 篇退出系列摘要最近六篇；测试改查它们仍保留的入口和完整系列筛选，不要求摘要永久保留所有文章。无其他旧文内容改动。
- 本地预览 `http://127.0.0.1:4175/#/docs/109`。未执行 commit、push 或线上部署。
