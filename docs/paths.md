# 推荐路径

如果你不知道从哪一篇开始，可以先按下面几条路线阅读。每条路径都尽量从“建立判断力”开始，再进入具体排障和优化动作。

<div class="path-grid">
  <section class="path-card">
    <h2>性能优化路径</h2>
    <p>适合正在处理慢 SQL、整体负载升高、索引效果不确定的场景。</p>
    <ol>
      <li><a href="#/docs/1" data-docs-route="/docs/1">EXPLAIN 为什么应该带 BUFFERS</a></li>
      <li><a href="#/docs/96" data-docs-route="/docs/96">actual time 和 Execution Time 为什么差异很大？</a></li>
      <li><a href="#/docs/5" data-docs-route="/docs/5">pg_stat_statements 入门</a></li>
      <li><a href="#/docs/12" data-docs-route="/docs/12">为 pg_stat_statements 找到真实 SQL 样例</a></li>
      <li><a href="#/docs/14" data-docs-route="/docs/14">如何判断一个查询是否太慢</a></li>
      <li><a href="#/docs/13" data-docs-route="/docs/13">如何做基准测试</a></li>
      <li><a href="#/docs/92" data-docs-route="/docs/92">work_mem 调优</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>DBA 排障路径</h2>
    <p>适合生产环境值班、处理重启、WAL 增长、复制延迟和锁等待。</p>
    <ol>
      <li><a href="#/docs/2" data-docs-route="/docs/2">排查并加速 Postgres 停止和重启</a></li>
      <li><a href="#/docs/3" data-docs-route="/docs/3">排查 Postgres 启动缓慢</a></li>
      <li><a href="#/docs/31" data-docs-route="/docs/31">排查 pg_wal 目录增长</a></li>
      <li><a href="#/docs/22" data-docs-route="/docs/22">heavyweight locks 分析：基础</a></li>
      <li><a href="#/docs/71" data-docs-route="/docs/71">理解 DDL 被什么阻塞</a></li>
      <li><a href="#/docs/100" data-docs-route="/docs/100">排查 LISTEN／NOTIFY 引起的提交阻塞</a></li>
      <li><a href="#/docs/93" data-docs-route="/docs/93">排查流复制延迟</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>索引治理路径</h2>
    <p>适合做索引评审、清理无效索引、降低写入和规划开销。</p>
    <ol>
      <li><a href="#/docs/18" data-docs-route="/docs/18">过度索引</a></li>
      <li><a href="#/docs/61" data-docs-route="/docs/61">创建索引：基础</a></li>
      <li><a href="#/docs/62" data-docs-route="/docs/62">创建索引：进阶</a></li>
      <li><a href="#/docs/53" data-docs-route="/docs/53">索引维护</a></li>
      <li><a href="#/docs/75" data-docs-route="/docs/75">查找未使用索引</a></li>
      <li><a href="#/docs/76" data-docs-route="/docs/76">查找冗余索引</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>在线变更路径</h2>
    <p>适合上线 schema 变更、避免锁等待扩大、降低 DDL 风险。</p>
    <ol>
      <li><a href="#/docs/99" data-docs-route="/docs/99">安全执行在线变更：DDL、回填与批量删除</a></li>
      <li><a href="#/docs/30" data-docs-route="/docs/30">处理 OLTP 长事务</a></li>
      <li><a href="#/docs/42" data-docs-route="/docs/42">heavyweight locks 分析：锁树</a></li>
      <li><a href="#/docs/55" data-docs-route="/docs/55">删除列</a></li>
      <li><a href="#/docs/60" data-docs-route="/docs/60">添加列</a></li>
      <li><a href="#/docs/69" data-docs-route="/docs/69">无停机添加 CHECK 约束</a></li>
      <li><a href="#/docs/70" data-docs-route="/docs/70">添加外键</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>存储与 Vacuum 路径</h2>
    <p>适合理解膨胀、XID 回卷、WAL、页面布局和 autovacuum 行为。</p>
    <ol>
      <li><a href="#/docs/4" data-docs-route="/docs/4">理解 tuple 在表中的稀疏存储</a></li>
      <li><a href="#/docs/9" data-docs-route="/docs/9">理解 LSN 和 WAL 文件名</a></li>
      <li><a href="#/docs/44" data-docs-route="/docs/44">监控 XID 回卷风险</a></li>
      <li><a href="#/docs/45" data-docs-route="/docs/45">监控 xmin horizon 避免回卷和膨胀</a></li>
      <li><a href="#/docs/46" data-docs-route="/docs/46">处理 bloat</a></li>
      <li><a href="#/docs/67" data-docs-route="/docs/67">Autovacuum 队列和进度</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>日常工具路径</h2>
    <p>适合补齐 psql、备份恢复、Docker、脚本化和日常操作手感。</p>
    <ol>
      <li><a href="#/docs/25" data-docs-route="/docs/25">如何退出 psql</a></li>
      <li><a href="#/docs/58" data-docs-route="/docs/58">使用 Docker 运行 Postgres</a></li>
      <li><a href="#/docs/19" data-docs-route="/docs/19">导入 CSV 到 Postgres</a></li>
      <li><a href="#/docs/20" data-docs-route="/docs/20">使用 pg_restore</a></li>
      <li><a href="#/docs/49" data-docs-route="/docs/49">在 psql 脚本中使用变量</a></li>
      <li><a href="#/docs/68" data-docs-route="/docs/68">psql 快捷操作</a></li>
    </ol>
  </section>
</div>
