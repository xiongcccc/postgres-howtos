# PostgreSQL Howto 中文版

面向真实工程问题的 PostgreSQL 实践知识库。围绕查询性能、锁等待、索引、WAL、Vacuum 和复制，整理实用指南、实践剖析与专题解读。

[在线阅读](https://postgres-howto.cn/) · [搜索文章](https://postgres-howto.cn/#/docs/find) · [静态文章目录](https://postgres-howto.cn/articles/)

## 技术专题

<!-- TOPICS -->

## 学习路径

<!-- PATHS -->

## 最近收录

<!-- RECENT -->

## 来源与致谢

项目起步于 Nikolay Samokhvalov 发起的 [PostgreSQL Howtos](https://gitlab.com/postgres-ai/postgresql-consulting/postgres-howtos) 中文翻译，目前也持续收录个人工程实践、社区会议和技术博客解读。每篇保留原始来源，版本说明及验证范围集中记录，不将外部案例写成本站实测。

中文翻译、解读与技术校订：**xiongcc**。技术材料、图片及第三方库沿用各自的原始版权与许可声明，本项目不改变这些声明。

## 贡献与反馈

欢迎通过 [Issues](https://github.com/xiongcccc/postgres-howto/issues) 反馈问题或提交 Pull Request。请提供文章链接、PostgreSQL 版本和最小例子，移除业务数据与连接信息。

文章元数据以 `data/articles.json` 为准；新增与维护流程见 [维护说明](maintenance/CATALOG.md)，写作及校订要求见 [编辑标准](maintenance/editorial-standard.md)。

```sh
node maintenance/build-catalog.mjs
node --test maintenance/test-catalog.cjs
```

[关于项目](https://postgres-howto.cn/#/docs/about) · [个人主页](https://xiongcc.cn/) · 微信公众号：PostgreSQL 学徒
