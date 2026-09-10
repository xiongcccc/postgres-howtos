# 会议精选

从 PostgreSQL 社区会议中选择值得展开的议题，按实际问题整理为 Howto。每篇保留讲者和原始材料来源，区分演讲观点、整理者补充与验证结果。

文章同时归入对应技术专题；这里按会议汇总，方便回溯来源。

## PG DATA 2026

### [如何排查 LISTEN／NOTIFY 引起的提交阻塞](/docs/100.md)

**讲者：** Jimmy Angelakos（pgEdge）<br>
**分类：** 锁、事务与在线变更<br>
**原题：** LISTEN Carefully: How NOTIFY Can Trip Up Your Database

定位 NOTIFY 在提交阶段的特殊对象锁，拆解 advisory lock 合并发送方案，并验证队尾滞留和过期丢弃的边界，讨论通知与持久事件的分工。

[原始演讲材料](https://vyruss.org/computing/slides/pgdata2026_listen_carefully.pdf) · [阅读 Howto](/docs/100.md)

## PGConf.DE 2026

### [如何安全执行 PostgreSQL 在线变更：DDL、数据回填与批量删除](/docs/99.md)

**讲者：** Daria Nikolaenko（Data Egret）  
**分类：** 锁、事务与在线变更  
**原题：** PostgreSQL Migrations Without Drama

从 DDL 锁队列出发，整理约束分阶段验证、默认值与表重写、独立事务分批修改，以及变更前后的检查方法。

[原始演讲材料](https://dataegret.com/wp-content/uploads/2026/04/DariaNikolaenko-pgconf2026.reveal.pdf) · [阅读 Howto](/docs/99.md)
