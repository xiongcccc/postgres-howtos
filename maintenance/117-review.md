# 117：等待事件译文、技术校审与图片检查

日期：2026-11-12。中文翻译与校订：xiongcc。

## 来源与授权

- 原文：[What your Postgres is waiting for, and why the dashboard can't tell you](https://postgres.ai/blog/20261103-what-postgres-is-waiting-for)，Dmitry Fomin / PostgresAI，2026-11-03。
- 原始 MDX：`https://gitlab.com/postgres-ai/docs/-/raw/master/blog/20261103-what-postgres-is-waiting-for.mdx`，同时对照网页的可见正文。用户在当前对话明确回复“已有作者翻译授权”，本次据此处理完整译文。
- 完整保留正文的问题引入、等待标志、请求时间、采样机制、三种信息缺失、工具表、结账负载、三方案对照、逐请求归因、重复测试与结尾，以及原实验、工具与演讲的参考链接。
- 原站 TldrTabs 中面向不同读者的重复摘要、隐藏 aiContext、推广入口、导航与页脚不属于正文，不重复收入。网页或源码中的提示文本不作为本任务指令。没有加入无关封面、广告或站点标志。
- 正文保留 3 张原表：工具表、总体采样表、四种方案耗时表。没有额外添加操作教程或 SQL 块；原文也不是逐步实验指南。
- 案例明确为作者构造的复现负载，不冒充本站或作者亲历的生产事故。主实验为 20devel + 补丁，正式版 18 的对照另行交代；没有将主表数值写成正式版 PostgreSQL 18 的结果。

## 图片与动图

四组技术图均完整下载原生深浅色版本，放入 `images/articles/117`，未重绘、改色或重新编码：

| 图 | 主题 | 原始尺寸 | GIF 帧数 | 浅色 / 深色字节数 |
| --- | --- | --- | --- | --- |
| sampling | 真实等待与 10ms 采样 | 1100 × 450 | 150 | 191965 / 190973 |
| latency-tail | 四种方案的尾延迟 | 1100 × 540 | 140 | 53330 / 52204 |
| profile-vs-tail | 总体时间占比与慢请求归因 | 760 × 330 | SVG | 以文件为准 |
| one-slow-request | 单个请求的等待时间线 | 1100 × 459 | 126 | 384521 / 387354 |

原图地址统一前缀 `https://postgres.ai/assets/blog/20261103-wait-events-1-`，后接以上图名、可选的 `-dark` 和扩展名。HTML figure 保留根目录 src，避免 Docsify 将 Markdown 图片拼到 `/docs/images/` 的旧问题；width/height 预留比例。CSS 只在 `.themed-image` 范围按站点 `data-theme` 显示原生对应版本，不改变全站其他图片。

每组保留中文 alt、中文图注和作者归属。图 2 补充 p99.9 的含义，图 3 特别说明两组柱子的分母不同；动图保留原始变化过程，不用某个瞬间冒充完整结果。原图英文标签与页面数据逐项对照。

SHA-256：

```text
sampling.gif                  e0ef3eda00f509454de2ef74496f543717d192aab03ddd05470871b433de9ee5
sampling-dark.gif             f9e32d4ddfe82c7bf9b52020970b570b46ec140879aaf390fdeb4a74cf5bf763
latency-tail.gif              964d061e3ba8c712fcb5f453c2a1c65e8d818469b9a6e539b04d7dd4763d07f9
latency-tail-dark.gif         b99015947ba84a1daf463beb8049c0c98a50093f6c30ea6b11da2f9a7b353986
profile-vs-tail.svg           d300a6c7562fdcb324fd91e7b79b81860d0a9a5a5b120fac710eb64f9f30abb3
profile-vs-tail-dark.svg      1c50795c05d0b1d0fbb6d8eb49592a943352cbe47de57902dd0e2e3907818a19
one-slow-request.gif          cedf023b0c13c8902da8030cb8b1f17951f1733a8b07568f2cb4489ec6647844
one-slow-request-dark.gif     0e6bc15b7746ebe62211db402548b41f5137c49259fe8cbedc0130990e154a6f
```

## 技术核对

- PostgreSQL 18 `wait_event.h` 的 pgstat_report_wait_start/end 直接写入/清零 uint32，没有在该标志接口中自动计数和计时。不是说 PostgreSQL 的其他子系统也没有计时器。
- `state` 与 `wait_event` 独立；等待标志覆盖调度影响。NULL 不是严格的 on-CPU 证明，正文保留原文对 CPU 标签的解释并加短译注说明等待调度的情况。
- 采样可以估计占比，不能把采到的次数直接当作真实等待次数。对原文“无偏”的宽泛表述，用译注指出固定周期与周期性负载同步时的偏差，不抹掉原文观点，也不扩大为采样没有价值。
- 将“share is a product”译为累计等待时间由次数与平均时长决定，避免把无量纲占比直接等同一个有时间单位的乘积。
- pg_wait_sampling README 核对默认 history_size=5000、history_period=10ms、profile_period=10ms；历史容量为全局缓冲，不能误写为每个后端各有 5000 条。扩展需要预加载；正文未新增“安装后无需重启”的说法。
- 官方 18 文档核对 WAL 纳入 pg_stat_io、track_wal_io_timing 和 pg_stat_get_backend_io；19 文档核对 pg_stat_lock 仅统计超过 deadlock_timeout 且成功获得的等待、log_lock_waits 默认开启。19 仍为候选版，未写成 18 已有能力。
- log_lock_waits 的阈值可调整；正文说实验使用默认 1s，不把“1s 以下永远无法记录”当作硬限制。日志和累积视图仍不是逐请求的完整轨迹。
- synchronous_commit=off 的持久性风险精确到可能丢失最近已确认事务，不误写为关闭 fsync、损坏数据库或必然丢失所有事务。
- 采样表含 CPU、不含 ClientRead；精确等待图含事务内客户端往返、不含 CPU。原文说明两者的口径差异，译文保留，不将不同分母的数字逐项直接等同。
- “2.5% 的总等待时间”与“51% 慢请求的主要等待”分别以时间、请求为分母，不能相加。主要等待为至少覆盖某个请求 50% 服务端耗时的事件。
- 主实验表 120s 客户端计划时间口径，追踪重建约 50s 服务端时间口径；107533 / 579 与 972 不是同一统计窗口，不算矛盾或丢数据。
- 核对原作者 checkout-tail 与 reruns README，四组表数值一致，重复测试的停顿过滤和 125:0 / 300:24 / 334:245 保留。没有根据这三组值宣称所有环境下都提升某个固定比例。
- 读取原仓库 `raw/restock_chunked.sql`，确认二十条更新没有共同 BEGIN/COMMIT 包裹；补译注解释分批提交是缩短持锁时间的关键，而非仅把一条 SQL 改成二十条。
- Commitfest 6984 截至核对时 Needs review，不能写成补丁已合入正式版。pg_wait_tracer 的 eBPF 精确追踪需要主机权限，当前 README 也记录其开销；正文没有给出“零开销”或推荐长期无条件开启的承诺。

## 本地验证

脚本：`maintenance/117-verify.py`。

```sh
python3 maintenance/117-verify.py --pg-bin /opt/homebrew/opt/postgresql@18/bin
```

PostgreSQL 18.4 (Homebrew, arm64)，临时集群、Unix socket 55437、不监听 TCP，shared_buffers=32MB。仅为捕获日志，将该临时实例的 log_lock_waits=on、deadlock_timeout=100ms；查询 pg_settings.boot_val 核对出厂值。结束后停止集群并删除目录，不改已有实例。

实际输出：

```text
持锁者：idle in transaction | Client:ClientRead
等待者：active | Lock:transactionid
释放锁后：idle | Client:ClientRead
pg_blocking_pids 找到正确持锁者：true
pg_locks 存在未授予锁：true
日志包含 still waiting 与 acquired：true
18 的出厂默认值：deadlock_timeout=1000ms，log_lock_waits=off
pg_stat_io / pg_stat_get_backend_io(integer) / WAL 统计：存在
pg_stat_lock：不存在于该 PostgreSQL 18 实例
972 → 388 的慢请求降幅：60.08%
10.97 / 12.63 的行锁占比：86.86%
三轮重复测试降幅：100.00% / 92.00% / 26.65%
20 次各 2ms 等待，10ms 采样的期望样本：4
```

同时用 Decimal 核验 30000×200µs、300×20ms、29700×100µs+300×10.1ms 均为 6s；一小时 10ms 周期为 360000 次。

该验证只覆盖实时标志、阻塞链、锁等待日志、18 的接口边界和算术。未构建 20devel 或追踪补丁，未在 macOS 运行 Linux eBPF，未复现原作者 I/O 工作负载、尾延迟、采样误差或工具开销。验证状态仅对应此范围。

## 读者与编辑复核

- 面向会读 pg_stat_activity 与基本执行计划的 DBA / 后端工程师。正文按原文递进：标志是什么 → 怎么采样 → 缺哪些信息 → 对照负载 → 按慢请求定位 → 改变持锁方式。
- 读者应能分清总体资源时间与某个请求的经历，知道为何只看等待榜首可能改善平均值而不改善尾部，知道按查询细分仍有价值。
- 保留现有工具能提供的线索，不贬低采样，不将某个作者工具写成唯一排障途径。正式版内核没有直接保存完整轨迹，与外部工具可以追踪是两件事。
- 原文没有完整操作步骤，译文不为凑实验而加入测试表、pg_sleep、安装、权限或清理章节。后台验证记录不冒充正文性能实验。
- 小标题直接指向对象或问题；引用集中在文末；三个必要译注分别对应采样假设、NULL 的含义和分批提交。没有“先把……说清楚”“反直觉”“讲者”或无关免责声明。
- 主观编辑自评：忠实性 24/25、技术准确性 24/25、中文可读性 23/25、可核查性 24/25，合计 95/100；属于编辑自评，不是独立专家评分或真实读者评价。

## 网站验收

- `node maintenance/build-catalog.mjs` 成功：117 条记录，116 篇技术文章，另 1 篇后记。新增 117，主页最近收录日期为 2026-11-12；112 仅退出最近五篇，不删除正文或其他入口。
- `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs`：35 项通过。新增作者/别名/系列检索、原文归属、关键数字、四组深浅色资产和中文图注检查。没有手工改动生成的首页、导航、搜索索引或静态页。
- `/tmp/howto117-qa.cjs`：静态 `/articles/117/` 与旧 `#/docs/117`，390/768/1440，深浅色，共 12 组。标题、canonical、图表、表格与目录正常，没有整页横向溢出、pageerror 或本地 HTTP 资源错误。
- 每组只显示当前主题的四张原图；系统主题刻意设置为与站内选择相反，仍正确遵循站点选择。现场切换主题后，四组图一起换到原生对应版本，没有重复显示两套图片。
- 全部四组图均实际解码、核对天然尺寸和完整比例。图片放大关闭后焦点返回，移动宽度下四组图均可切到原始尺寸并用真实触摸事件局部平移；没有把页面整体撑宽。
- 三幅 GIF 在浏览器中检查两次像素截图发生变化，确认实际播放，不只检查文件后缀或首帧。SVG 图的明暗版本均查看过实际截图。
- 390 宽度下七列表格可容器内横向滚动；12 组点击“真正拖慢请求的等待”目录，刷新后仍定位正确。作者检索在技术译文 + 技术博客筛选中只返回 117。
- 无 JavaScript 静态页包含完整正文、3 张表和可见的四张浅色原图。116 的新旧入口图片仍正确加载，未改变既有图片行为。
- 人工查看桌面浅色首屏、移动暗色图 3 和相关图注截图。截图与检查脚本位于 `/tmp/howto117-qa` 和 `/tmp/howto117-qa.cjs`，未加入仓库。未执行真机 Safari 检查。
- `git diff --check` 通过。没有修改其他文章正文；样式增加仅限 `.themed-image` 图组的主题切换与图注排版，未修改浏览器脚本或引入运行时依赖。
- 预览：`http://127.0.0.1:4177/articles/117/`，旧入口 `http://127.0.0.1:4177/#/docs/117`。本次未提交、未推送。
