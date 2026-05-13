# 推荐路径

如果你不知道从哪一篇开始，可以先按下面几条路线阅读。每条路径都尽量从“建立判断力”开始，再进入具体排障和优化动作。

<div class="path-grid">
  <section class="path-card">
    <h2>性能优化路径</h2>
    <p>适合正在处理慢 SQL、整体负载升高、索引效果不确定的场景。</p>
    <ol>
      <li><a href="./1.md">EXPLAIN 为什么应该带 BUFFERS</a></li>
      <li><a href="./5.md">pg_stat_statements 入门</a></li>
      <li><a href="./12.md">为 pg_stat_statements 找到真实 SQL 样例</a></li>
      <li><a href="./14.md">如何判断一个查询是否太慢</a></li>
      <li><a href="./13.md">如何做基准测试</a></li>
      <li><a href="./92.md">work_mem 调优</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>DBA 排障路径</h2>
    <p>适合生产环境值班、处理重启、WAL 增长、复制延迟和锁等待。</p>
    <ol>
      <li><a href="./2.md">排查并加速 Postgres 停止和重启</a></li>
      <li><a href="./3.md">排查 Postgres 启动缓慢</a></li>
      <li><a href="./31.md">排查 pg_wal 目录增长</a></li>
      <li><a href="./22.md">heavyweight locks 分析：基础</a></li>
      <li><a href="./71.md">理解 DDL 被什么阻塞</a></li>
      <li><a href="./93.md">排查流复制延迟</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>索引治理路径</h2>
    <p>适合做索引评审、清理无效索引、降低写入和规划开销。</p>
    <ol>
      <li><a href="./18.md">过度索引</a></li>
      <li><a href="./61.md">创建索引：基础</a></li>
      <li><a href="./62.md">创建索引：进阶</a></li>
      <li><a href="./53.md">索引维护</a></li>
      <li><a href="./75.md">查找未使用索引</a></li>
      <li><a href="./76.md">查找冗余索引</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>在线变更路径</h2>
    <p>适合上线 schema 变更、避免锁等待扩大、降低 DDL 风险。</p>
    <ol>
      <li><a href="./30.md">处理 OLTP 长事务</a></li>
      <li><a href="./42.md">heavyweight locks 分析：锁树</a></li>
      <li><a href="./55.md">删除列</a></li>
      <li><a href="./60.md">添加列</a></li>
      <li><a href="./69.md">无停机添加 CHECK 约束</a></li>
      <li><a href="./70.md">添加外键</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>存储与 Vacuum 路径</h2>
    <p>适合理解膨胀、XID 回卷、WAL、页面布局和 autovacuum 行为。</p>
    <ol>
      <li><a href="./4.md">理解 tuple 在表中的稀疏存储</a></li>
      <li><a href="./9.md">理解 LSN 和 WAL 文件名</a></li>
      <li><a href="./44.md">监控 XID 回卷风险</a></li>
      <li><a href="./45.md">监控 xmin horizon 避免回卷和膨胀</a></li>
      <li><a href="./46.md">处理 bloat</a></li>
      <li><a href="./67.md">Autovacuum 队列和进度</a></li>
    </ol>
  </section>

  <section class="path-card">
    <h2>日常工具路径</h2>
    <p>适合补齐 psql、备份恢复、Docker、脚本化和日常操作手感。</p>
    <ol>
      <li><a href="./25.md">如何退出 psql</a></li>
      <li><a href="./58.md">使用 Docker 运行 Postgres</a></li>
      <li><a href="./19.md">导入 CSV 到 Postgres</a></li>
      <li><a href="./20.md">使用 pg_restore</a></li>
      <li><a href="./49.md">在 psql 脚本中使用变量</a></li>
      <li><a href="./68.md">psql 快捷操作</a></li>
    </ol>
  </section>
</div>
