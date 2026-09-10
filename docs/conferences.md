# 会议精选

从 PostgreSQL 社区会议中选择值得展开的议题，按实际问题整理为 Howto。每篇保留讲者和原始材料来源，区分演讲观点、整理者补充与验证结果。

文章同时归入对应技术专题；这里按会议汇总，方便回溯来源。

## PGConf.DE 2026

### [如何安全执行 PostgreSQL 在线变更：DDL、数据回填与批量删除](/docs/99.md)

**讲者：** Daria Nikolaenko（Data Egret）  
**分类：** 锁、事务与在线变更  
**原题：** PostgreSQL Migrations Without Drama

从 DDL 锁队列出发，整理约束分阶段验证、默认值与表重写、独立事务分批修改，以及变更前后的检查方法。

[原始演讲材料](https://dataegret.com/wp-content/uploads/2026/04/DariaNikolaenko-pgconf2026.reveal.pdf) · [阅读 Howto](/docs/99.md)
