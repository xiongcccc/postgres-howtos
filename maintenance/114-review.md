# 114：翻译、技术校订与验证记录

日期：2026-11-11。中文翻译与校订：xiongcc。

## 材料与范围

- 用户提供 pgEdge 网页截图 PDF：`screencapture-pgedge-blog-why-is-postgresql-s-numeric-type-so-slow-2026-11-11-16_19_07.pdf`，7 页，创建于 2026-11-11 16:19。署名 Andrei Lepikhov，原文发表于 2026-10-08。
- 原文：`https://www.pgedge.com/blog/why-is-postgresql-s-numeric-type-so-slow`。
- PDF 无文本层，已渲染并查看七页。主体在第 1–6 页，第 7 页顶部接结尾，余下为营销及页脚。按 PDF 核对标题、章节顺序、两份执行计划、三张表及全部数值示例。
- 截图中的长代码、公式和引文被右边缘裁切。回查原网页确认公式、Thomas Munro 引文、select_div_scale 注释、FastLanes 引文、NumericSumAccum 注释与 DuckDB 溢出查询；不根据图像残缺内容猜测补全。
- 原网页的 varlena 术语解释也未写完，只翻译已明确的长度头含义；其他术语结合源码核对。pgdecimal2 链接按原页面跳转到 vitesse-ftian/pgdecimal，不凭项目名拼接 URL。
- 正文保留原文技术小节和论证顺序，未改成本站 Howto 或添加性能实验章节。引文译为中文，公式和字符图以等价 ASCII 排版重录，SQL、执行计划数值与输出保持原意；原站目录由本站自动目录取代，不收录营销和网站导航。
- 第一人称与性能测试属于原作者。PostgreSQL 与 DuckDB 性能数据没有写成本站实测；原文立场与存在简化的机制以明确译注区分。

## 完整性复核

2026-11-11 图片补查：重新对照七页 PDF 与原网页的 post-content-wrapper，正文 img 数为 0。两幅元组布局示意图是代码块中的字符图，已在译文保留；没有遗漏技术图片。原站其余图片为广告、标志与认证图标，不加入正文。

1. 开头与两份计划：numeric/double 分组聚合、4512.880/1620.060 ms、内存与页面计数、三种十进制扩展。
2. 四项设计：表示与列声明、值内 dscale、数据决定结果 scale、宽精度范围；六项术语表。
3. 存储：base-10000、weight 公式、1.5/1.50、正负号/短格式/特殊值、首尾零组、紧凑存储、7/10 字节例子。
4. DuckDB：整数系数、列类型确定 scale、三种 literal 类型、统一列后的输出、整数宽度梯级、Parquet、特殊值与范围。
5. 传递与元组拆解：Datum、按引用结果分配、Thomas Munro 引文、两千万行基准、两幅偏移图、PG18/19 改进、DuckDB 压缩与扫描差异。
6. 中间结果：舍入与结合性、加乘除输出、select_div_scale、FastLanes、文本/数值相等性、比较与哈希、NumericSumAccum、DuckDB 类型推导和溢出、除法/AVG/取余及原文金额规则判断。
7. 十进制成本与结论：缩放模型、编译器常量除法、输出转换、int128 运行库、24/44 位中间值、统计信息去溢出检查、40.0/13.9 ms 宽度转换示例、四项成本表及后续研究方向。

## 关键技术校订

核对 PostgreSQL REL_18_STABLE 的 numeric.c、varatt.h；DuckDB v1.5.5 的 arithmetic.cpp；PostgreSQL 18 数值类型与 C 函数接口文档；DuckDB 数值类型文档；CompactAttribute 提交及 David Rowley 开发邮件。

- `numeric(p,s)` 的整数位溢出和显式精度上限，与无约束 numeric 的范围区分，避免“几乎不溢出”被误用。
- 数字组为 base-10000。NumericShort 是内部两字节头，外层 varlena 的一字节长度头是另一层。NumericShort 的 dscale 范围为 0–63、weight 为 -64–63；外层短长度最大 127，采用内部短头时可装 62 个数字组，并非 62 位十进制数字。
- `10` 格式的符号在另一标志位，不代表没有正负号；NaN/Infinity 的尺寸按头部与外层长度区分。
- Datum 传递方式是类型属性，不能因某个值恰好小于八字节就自动按值传递；bigint 运算的一条指令说法是成本模型，仍需考虑溢出检查。
- 偏移图省略行头、NULL 与对齐；slot 拆解会保留已拆出的值，不能写成每取一列都从头重扫。
- 21%/44% 是开发邮件中 AMD Zen 2 + GCC 的一组补丁结果，其他环境不同，不能当作统一提速结论。
- `cmp_var_common` 不接收 dscale；按符号、weight、数字组比较。`hash_numeric` 明确不哈希 scale，也不哈希 sign，忽略首尾零组并混入 weight。原文“先统一 dscale 再比较”的解释不正确，正文保留论点并就近说明真实算法。
- 原文“求和保持结合性”需要不在中间步骤额外舍入等条件；numeric 支持并行聚合。
- `sum(bigint)` 返回 numeric 不代表逐行使用 NumericSumAccum，支持 HAVE_INT128 的构建可以采用 Int128AggState。
- DuckDB v1.5.5 的 DECIMAL(18) 乘法可保持 18 位结果并报告溢出；这是实现取舍，不是所有定长十进制算法都必然这样。
- PostgreSQL 的 `1/3::numeric` 仍为有限精度近似；“精确十进制除法”不等于精确有理数。原文从 AVG 返回 DOUBLE 推出的合规评价，正文明确为作者判断，并说明需看完整计算规则。
- 原文用整数系数的 `10^k` 模型解释 numeric 加法/舍入过于直接。源码按数字组和 weight 对齐，round_var 处理组内舍入；就近译注，避免把数学模型当作逐条实现。
- 保留原文关于 int128 的实现取舍与输出成本讨论，不扩大成“所有 decimal 都慢”“金融应用不能使用 DuckDB”或“更换为 float”的建议。

## 局部语义验证

验证脚本：`maintenance/114-verify.py`。实际运行成功：PostgreSQL 18.4 (Homebrew, arm64)，DuckDB 1.5.5。PostgreSQL 使用 `/tmp` 下的独立临时集群，仅 Unix socket，无 TCP 监听，端口 55434；运行结束已停止和清理，不修改现有数据库。

DuckDB 包安装在 `/tmp/howto114-deps-155`，没有增加网站依赖、修改项目环境或安装后台服务。

```sh
PYTHONPATH=/tmp/howto114-deps-155 \
  /Users/xiongcancan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
  maintenance/114-verify.py --pg-bin /opt/homebrew/opt/postgresql@18/bin
```

实际输出摘要：

```text
PostgreSQL 18.4
pg_column_size: 7 | 10
算术结果: 3.00 | 6.000 | 2.5000000000000000
除法: 0.33333333333333333333 | 333333.333333333333 | 0.00033333333333333333
数值相等 / 文本相等 / 哈希相等: t | f | t
无约束列输出: 1.5 / 1.50 / 1.500
类型属性: int8|8|t / numeric|-1|f
sum(bigint) 返回类型: numeric

DuckDB 1.5.5
literal 类型: DECIMAL(2,1) / DECIMAL(3,2) / DECIMAL(4,3)
统一列类型与输出: DECIMAL(4,3), 1.500 / 1.500 / 1.500
1.8 * 1.9: DECIMAL(4,2), 3.42
乘法结果类型: DECIMAL(18,4) / DECIMAL(38,4)
除法 / AVG / 取余类型: DOUBLE / DOUBLE / DECIMAL(10,2)
无参数 DECIMAL: DECIMAL(18,3)
18 位乘法例子: Overflow in multiplication of DECIMAL(18)
```

以上是语义核验，不覆盖原作者的聚合内存、两千万行 SUM、压缩扫描时间、宽度切换耗时或跨版本性能测试。

## 读者视角复核

- 主读者为有 PostgreSQL 使用经验的 DBA、后端工程师。术语表先解释 precision/scale 相关内部对象，后续按表示、访问和运算逐步展开。
- 读者应能解释：列声明为 numeric(15,2) 并不变成定长 int64；数值相等与输出形式不同可以同时成立；性能成本还包括结果分配、元组拆解和存储解压；DuckDB 的整数宽度边界也有代价。
- 所有性能数字只用于理解原文案例，不转化为本站调参建议；没有为翻译额外添加重复建表、清理或无关实验。
- 源码核对后对原文简化作了必要译注，未因追求“流畅”而重复错误；未把文章变成技术审计报告，详细依据留在本记录。
- 主观编辑自评：忠实性 23/25、技术校订 24/25、中文可读性 23/25、可核查性 23/25，合计 93/100。属于本次编辑判断，不是独立专家评分，也不表示已证明原文所有性能归因。

## 网站验证

- `node maintenance/build-catalog.mjs`：114 条文章记录通过校验。本文为 114，技术文章数为 113，项目后记不计入技术文章。
- `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs`：32 项通过。新增译文系列搜索、作者别名、技术校订及来源检查；109 退出首页最近五篇后，只取消其必须留在最近收录的旧断言，保留专题与系列可发现性。首页全部精选链接仍由 SEO 通用测试验证。
- `git diff --check` 通过。所有导航、搜索、静态文章与 Sitemap 均由构建器生成，没有手工修改产物。
- `/tmp/howto114-qa.cjs`：静态 `/articles/114/` 与旧 `#/docs/114`，390/768/1440 三种宽度、深浅色，共 12 组通过。标题、系列、来源、canonical 均正常，页面无整体横向溢出，无 pageerror；三张表在 390px 下均可局部横向滚动。
- 技术译文 + 技术博客组合筛选搜索 `NumericSumAccum` 仅返回 114，刷新后保持结果；无 JavaScript 的静态正文仍含标题、三张表和原始计划数据。
- 人工检查桌面浅色首屏、移动暗色术语表与执行计划截图，文字和边框对比清晰。截图放在 `/tmp/howto114-qa`，不加入仓库；未声称完成真机 Safari 检查。
- 本地预览：`http://127.0.0.1:4177/articles/114/`。未提交或推送。
