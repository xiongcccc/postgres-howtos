<div class="home-hero">
  <div class="home-hero__brand">
    <img src="./images/logo.png" alt="PostgreSQL Howto 中文版 logo" width="96" height="74" loading="lazy">
    <div>
      <p class="home-hero__eyebrow">postgres-howto in chinese</p>
      <h1>PostgreSQL Howto 中文版</h1>
    </div>
  </div>
  <p class="home-hero__lead">面向 DBA、DBRE 和后端工程师的 PostgreSQL 工程实践知识库。</p>
  <p class="home-hero__summary">这里不追求把官方文档重写一遍，而是整理那些在真实生产环境里经常遇到的问题：查询为什么慢、索引该怎么建、锁该怎么查、WAL 为什么暴涨、复制延迟如何定位、参数调优从哪里下手。</p>

<div class="home-actions">
  <a href="#/docs/topics" class="home-action home-action--primary" data-docs-route="/docs/topics">按专题阅读</a>
  <a href="#/docs/paths" class="home-action home-action--accent" data-docs-route="/docs/paths">推荐路径</a>
  <a href="#/docs/1" class="home-action" data-docs-route="/docs/1">从第 1 篇开始</a>
  <a href="https://github.com/xiongcccc/postgres-howto" class="home-action" target="_blank" rel="noopener">GitHub</a>
</div>
</div>

## 适合谁阅读

<div class="feature-grid">
  <section>
    <h3>数据库工程师</h3>
    <p>快速定位锁、复制、WAL、膨胀、统计信息和参数配置相关问题。</p>
  </section>
  <section>
    <h3>后端工程师</h3>
    <p>理解 SQL 执行计划、索引代价、事务行为和常见 schema 变更风险。</p>
  </section>
  <section>
    <h3>学习 PostgreSQL 的同学</h3>
    <p>从真实问题进入 PostgreSQL，而不是只停留在语法和概念层面。</p>
  </section>
</div>

## 推荐阅读路径

1. 先读 [EXPLAIN ANALYZE or EXPLAIN (ANALYZE, BUFFERS)](./docs/1.md)，建立正确的性能分析习惯。
2. 再读 [pg_stat_statements 系列](./docs/5.md)，了解如何从整体负载找到最值得优化的 SQL。
3. 接着进入 [索引维护](./docs/53.md)、[未使用索引](./docs/75.md)、[冗余索引](./docs/76.md)，补齐索引治理思路。
4. 如果你负责生产环境，建议继续阅读 [锁分析系列](./docs/22.md)、[WAL 目录增长排查](./docs/31.md)、[复制延迟排查](./docs/93.md)。
5. 如果想少走弯路，可以直接使用 [推荐路径](./docs/paths.md) 或 [专题索引](./docs/topics.md)。

## 项目来源

除上游译文外，本站也持续整理个人实践与社区会议内容。[会议精选](/docs/conferences.md) 的第一篇是 [如何安全执行 PostgreSQL 在线变更](/docs/99.md)，涵盖 DDL、数据回填与批量删除。

最新整理：[如何排查 LISTEN／NOTIFY 引起的提交阻塞](/docs/100.md)，讨论高并发通知的锁竞争，以及批量发送与持久事件的边界。

原项目由 [@NikolayS](https://twitter.com/samokhvalov) 于 2023-09-26 发起：

> Postgres docs are awesome but often lack practical pieces of advice (howtos).

原始仓库：[postgres-ai/postgresql-consulting/postgres-howtos](https://gitlab.com/postgres-ai/postgresql-consulting/postgres-howtos)

中文站点：[postgres-howto.cn](https://postgres-howto.cn/)

阅读过程中如果发现错误、过期内容或更好的实践，欢迎通过 GitHub issue、邮件或微信反馈。觉得项目不错，也欢迎点个 Star。

## Hi 👋, I'm xiongcc.

### About Me

PostgreSQL expert, open-source enthusiast, and software engineer. Personal homepage: [https://xiongcc.cn](https://xiongcc.cn)

- 🛠 Founder of [PostgreSQL-howto in chinese](https://github.com/xiongcccc/postgres-howto) project
- 📚 Translator of [PostgreSQL 14 Internals](https://postgres-internals.cn/)
- 📝 PostgreSQL 14 Internals in chinese: [https://postgres-internals.cn/](https://postgres-internals.cn/)
- 🧑‍💻 Personal Homepage: [https://xiongcc.cn](https://xiongcc.cn)
- 🧘🏻‍♂️ PostgreSQL DBA Daily 5.0 Author

Feel free to Connect with Me：

- [GitHub](https://github.com/xiongcccc) | 微信公众号：PostgreSQL学徒
- 📨 xiongcc_1994@126.com / xiongcc19950101@gmail.com

## 交流群

阅读过程中如果有什么问题，可以加群沟通。群聊二维码会不定期更新，如果过期，可以联系译者。

<p class="wechat-group">
  <img src="./images/wechatgroup.jpeg" alt="PostgreSQL 学徒交流群二维码" width="280" height="420" loading="lazy">
</p>
