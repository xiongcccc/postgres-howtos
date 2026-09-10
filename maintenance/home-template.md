<div class="home-hero">
  <div class="home-hero__brand">
    <img src="./images/logo.png" alt="PostgreSQL Howto 中文版 logo" width="96" height="74" loading="lazy">
    <div>
      <p class="home-hero__eyebrow">postgres-howto in chinese</p>
      <h1>PostgreSQL Howto 中文版</h1>
    </div>
  </div>
  <p class="home-hero__lead">面向 DBA、DBRE 和后端工程师的 PostgreSQL 工程实践知识库。</p>
  <p class="home-hero__summary">从慢 SQL、锁等待到日常运维，按实际问题查找，也可以沿专题系统阅读。</p>

<!-- HOME_DISCOVERY -->

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

<!-- HOME_FEATURED -->

## 项目来源

除上游译文外，本站也持续整理个人实践与社区会议内容。[会议精选](/docs/conferences.md) 收录社区分享，文章同时归入对应技术专题。

原项目由 [@NikolayS](https://twitter.com/samokhvalov) 于 2023-09-26 发起：

> Postgres docs are awesome but often lack practical pieces of advice (howtos).

原始仓库：[postgres-ai/postgresql-consulting/postgres-howtos](https://gitlab.com/postgres-ai/postgresql-consulting/postgres-howtos)

中文站点：[postgres-howto.cn](https://postgres-howto.cn/)

阅读过程中如果发现错误、过期内容或更好的实践，欢迎通过 GitHub issue、邮件或微信反馈。觉得项目不错，也欢迎点个 Star。

<section class="author-profile" aria-labelledby="about-author">
  <header class="author-profile__intro">
    <h2 id="about-author">Hi 👋, I'm xiongcc.</h2>
    <p><strong>🐘 PostgreSQL · 🔬 Database Internals · ⚙️ AI Infrastructure</strong></p>
    <p>I'm a PostgreSQL and Greenplum engineer, open-source enthusiast, and technical writer.<br>I focus on database internals, production practices, and data infrastructure in the AI era.</p>
    <p class="author-profile__tagline">🧭 Exploring internals · 🧰 Building practical tools · ✍️ Writing field notes</p>
    <p class="author-profile__links"><a href="https://xiongcc.cn">个人主页</a><a href="https://xiongcc.cn">PostgreSQL 学徒</a><a href="mailto:xiongcc_1994@126.com">Email</a><a href="https://github.com/xiongcccc">GitHub</a></p>
  </header>
  <h3>👋 About Me</h3>
  <img class="author-profile__elephant" src="https://raw.githubusercontent.com/xiongcccc/xiongcccc/master/assets/pg-elephant.svg" width="88" height="88" alt="PostgreSQL elephant" loading="lazy">
  <ul>
    <li>PostgreSQL ACE / MVP and an active contributor to the Chinese PostgreSQL community</li>
    <li>Chinese translator of PostgreSQL 14 Internals</li>
    <li>Author of PostgreSQL DBA Daily</li>
    <li>Founder and maintainer of PostgreSQL-focused open-source projects, including pg-mastery, pgcheck, and postgres-howto</li>
    <li>Writer behind <strong>PostgreSQL 学徒</strong>, with 100+ technical articles</li>
  </ul>
  <h3>🧭 代表作品</h3>
  <ul>
    <li>📖 <a href="https://postgres-internals.cn/"><strong>《PostgreSQL 内参：深入解析运行原理》</strong></a><br>《PostgreSQL 14 Internals》中文版，系统梳理 PostgreSQL 的内部工作机制。</li>
    <li>🧰 <a href="https://postgres-howto.cn/"><strong>PostgreSQL 中文 HowTo</strong></a><br>面向真实使用场景的 PostgreSQL 中文实践手册。</li>
    <li>🗺️ <strong>PostgreSQL DBA Daily 5.0</strong><br>覆盖日常巡检、故障排查、性能优化与生产实践的知识图谱。</li>
    <li>🎓 <a href="https://coding.imooc.com/class/1009.html"><strong>PostgreSQL 入门到进阶实战</strong></a><br>面向 AI 时代数据基础设施的 PostgreSQL 系统课程。</li>
  </ul>
  <h3>🛠️ 开源项目</h3>
  <div class="table-scroll" tabindex="0" role="region" aria-label="开源项目，可横向滚动">
    <table><thead><tr><th>项目</th><th>我想解决的问题</th></tr></thead><tbody>
      <tr><td><a href="https://github.com/xiongcccc/pg-mastery">pg-mastery</a></td><td>把内核原理、DBA 实践、性能调优和生产案例整理成可检索的 PostgreSQL 知识库</td></tr>
      <tr><td><a href="https://github.com/xiongcccc/pgcheck">pgcheck</a></td><td>为 DBA 与 SRE 提供轻量、直接的 PostgreSQL 健康检查工具</td></tr>
      <tr><td><a href="https://github.com/xiongcccc/postgres-howto">postgres-howto</a></td><td>持续沉淀 PostgreSQL 中文 HowTo 与可复用实践</td></tr>
      <tr><td><a href="https://github.com/xiongcccc/pg-slide-harvester">pg-slide-harvester</a></td><td>自动收集 PostgreSQL 大会演讲资料，建立本地可搜索的技术档案</td></tr>
    </tbody></table>
  </div>
  <h3>✍️ 最近写了</h3>
  <ul>
    <li><time datetime="2026-09-07">2026-09-07</time> · <a href="https://xiongcc.cn/2026/09/07/postgresql-2026-next-decade/">PostgreSQL 的 2026 与下一个十年</a></li>
    <li><time datetime="2026-08-14">2026-08-14</time> · <a href="https://xiongcc.cn/2026/08/14/what-dbas-need-when-answers-are-cheap/">当答案不再稀缺，DBA 真正稀缺的是什么？</a></li>
    <li><time datetime="2026-07-23">2026-07-23</time> · <a href="https://xiongcc.cn/2026/07/23/postgresql-ai-era-course/">AI 时代首选数据库：PostgreSQL 入门到进阶实战</a></li>
    <li><time datetime="2026-07-23">2026-07-23</time> · <a href="https://xiongcc.cn/2026/07/23/pg-slide-harvester/">pg-slide-harvester：自动收集 PG 大会演讲资料</a></li>
    <li><time datetime="2026-07-06">2026-07-06</time> · <a href="https://xiongcc.cn/2026/07/06/higobase-database-backend-platform/">从数据库到后端底座：HigoBase 想讲一个什么新故事？</a></li>
  </ul>
  <h3>🌐 找到我</h3>
  <ul>
    <li>个人主页：<a href="https://xiongcc.cn">xiongcc.cn</a></li>
    <li>微信公众号：<strong>PostgreSQL 学徒</strong></li>
    <li>Email：<a href="mailto:xiongcc_1994@126.com">xiongcc_1994@126.com</a> / <a href="mailto:xiongcc19950101@gmail.com">xiongcc19950101@gmail.com</a></li>
  </ul>
  <p>如果你也在研究 PostgreSQL、Greenplum 或数据库内核，欢迎交流。</p>
  <p class="author-profile__tagline">同步自 <a href="https://github.com/xiongcccc">GitHub 个人主页</a> · 2026-09-11</p>
</section>

## 交流群

阅读过程中如果有什么问题，可以加群沟通。群聊二维码会不定期更新，如果过期，可以联系译者。

<p class="wechat-group">
  <img src="./images/wechatgroup.jpeg" alt="PostgreSQL 学徒交流群二维码" width="280" height="420" loading="lazy">
</p>
