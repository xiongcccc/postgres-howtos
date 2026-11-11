# 115：翻译、技术校订与验证记录

日期：2026-11-11。中文翻译与校订：xiongcc。

## 来源与完整性

- 用户提供 The Consensus 网页截图 PDF，文件名 `screencapture-theconsensus-dev-p-2026-09-13-query-plan-rewriting-in-postgresql-html-2026-11-11-17_02_38.pdf`，5 页，创建于 2026-11-11 17:02。作者 Phil Eaton，原文发表于 2026-09-13。
- 原文：`https://theconsensus.dev/p/2026/09/13/query-plan-rewriting-in-postgresql.html`。
- 已渲染并查看五页。主体从第一页标题、导言，到第五页 Parting thoughts。长 SQL 的截图右侧存在裁切，回查原网页确认建表字段、WHERE 条件、连接条件、函数体与索引名称，不靠 OCR 或残缺图像猜测。
- 保留导言、PostgreSQL 18 安装、200000/500000 行数据初始化、常量折叠、子查询展开、三种连接算法、跨连接条件传播、连接消除、IN/EXISTS/NOT EXISTS/NOT IN、MIN/COUNT/分组聚合及结尾，未重组为专题解读。
- 原终端 `echo "SQL" | sudo -u postgres psql` 改为原 SQL 与对应计划分别展示，去掉 shell 外壳导致的美元符号转义；仅规范末尾分号、空白和计划缩进。保留初始化执行示例，正文计划省略重复的 psql 表头、横线和行数，不省略计划节点及条件。不另加“省略表头”的说明段落。
- 38 个 SQL 块、31 份计划均有隐藏验证标记。译文中的每一条 SQL 都由验证脚本直接读取执行，防止单独维护另一套实验代码。
- 广告、订阅表单、招聘、活动、作者履历和装饰性插画不属于技术正文，未收录。作者署名、来源与日期保留，首段交代计划归原作者；实验记录与译注不冒充原文内容。

## 技术核对

核对 PostgreSQL 18 官方文档中的查询处理阶段、函数易变性、子查询表达式、表达式索引、查询规划配置、多列索引，以及 PostgreSQL wiki 的 loose index scan 说明。源码按 REL_18_STABLE 核对 clauses.c、prepjointree.c 与 analyzejoins.c。

1. 原文将标识符解析到计划的过程作了简化，也将 rewriting 用于规划器变换。加译注区分 parse/analyze 后的查询树、正式 rewrite 和最终计划，不把所有优化都归为规则重写系统。
2. `triple(int)` 未写易变性属性，默认 VOLATILE。clauses.c 的 inline_function 对简单 SQL 表达式有专门处理，再递归常量化；实测目录属性为 v、计划条件为 user_id=300。没有写成“任意 VOLATILE 函数可以折叠”。
3. `now()` 的结果由事务开始时间确定，不将稳定结果误译为只能物理调用一次。STABLE 可用于索引扫描条件，仍保留函数表达式。
4. length(user_name) 的例子是依赖当前行，不能用它证明 length 本身属于 VOLATILE。
5. prepjointree.c 的 is_simple_subquery 排除 LIMIT 等结构；保持先 LIMIT 后过滤的语义。原文无 ORDER BY 的 LIMIT 返回 0 仅为该次结果，不能当作 SQL 保证；额外的有序对照只在后台验证，不扩写正文。
6. 左外连接消除依赖右侧匹配唯一和没有需要保留的右侧引用；有外键并不意味着本例内连接会被 PostgreSQL 18 消除。analyzejoins.c 同时有自连接消除逻辑，实测开关 on/off。
7. pull_up_sublinks 仅在允许的位置和条件下将 ANY/EXISTS/NOT EXISTS 拉起为半连接/反连接。正文不把任意子查询都写成必然转换，也不把 hashed SubPlan 误写为逐外侧行重新扫描整个子查询。
8. NOT IN 的 NULL 规则补充“没有相等匹配”的条件：有相等值时即使另含 NULL 仍为 false；无相等匹配且包含 NULL 时才为 NULL。保留原文两侧 NOT NULL 下仍使用 hashed SubPlan 的观察，不替换为其他版本的计划。
9. MIN 的索引捷径不等于所有聚合都可以只看一个索引值；COUNT 也可能采用索引访问，但仍需计数所有可见匹配项。正文“同样的方式”专指单值捷径，不写成 COUNT 永远不能使用索引。
10. 原文最后链接为 loose index scan。它与 PostgreSQL 18 的多列 B-tree skip scan 不同；而原例还缺少按分组键排列的索引，不能单凭此例推导所有分组 MIN 的访问方式。
11. 连接算法引用中的左右侧指物理解释，不能据此固定 SQL 中表名与哈希构建侧的对应关系。正文短译注说明，详细计划仍按原文保留。

## 实际验证

脚本：`maintenance/115-verify.py`。环境：PostgreSQL 18.4 (Homebrew, arm64)。独立临时集群，Unix socket，端口 55435，禁用 TCP 监听；shared_buffers=64MB，work_mem=64MB，jit=off，statement_timeout=30s。没有修改既有数据库或全局配置；结束后停止并移除临时集群。

```sh
python3 maintenance/115-verify.py \
  --pg-bin /opt/homebrew/opt/postgresql@18/bin --check-output
```

已依次执行全部 38 个源 SQL 块，其中 31 条 EXPLAIN 同时通过 JSON 格式检查结构、通过文本输出核对展示。`--check-output` 逐份比较正文计划与本机实际计划，在本次环境中 31 份全部一致。使用 FORMAT JSON 是后台检查，不改原文 EXPLAIN 语句。

关键输出：

```text
users / orders 行数: 200000 | 500000
常量化索引条件: user_id = 200 / user_id = 300
triple 的 provolatile: v
表达式匹配索引: users_expr_idx
交换加法操作数: 保留 Seq Scan 和表达式 Filter
STABLE 索引条件: 仍含 now()
简单子查询: 无 Subquery Scan
LIMIT: 保留 Subquery Scan -> Limit -> Seq Scan
分组过滤: orders 扫描层含等值或范围 Filter
等值传播: users 的 Index Cond 为常量 100
范围条件: users 的 Index Cond 仍引用 o.order_user_id
LEFT JOIN: 只扫描 orders
外键内连接: 仍为 Hash Join
自连接: 单次 orders 扫描；关闭开关后保留 Join
IN / EXISTS: Hash Right Semi Join
NOT EXISTS: Parallel Hash Anti Join
NOT IN: hashed SubPlan，不是 Anti Join
MIN: Result -> InitPlan -> Limit -> Index Only Scan
COUNT: 完整聚合扫描，无 Limit
GROUP BY MIN: HashAggregate -> Seq Scan
min / count: 1 | 500000
NOT IN 有匹配并含 NULL / 无匹配并含 NULL / NOT EXISTS: f | NULL | t
有序 LIMIT 前后过滤: 0 | 1
```

以上验证优化行为与 SQL 语义，不是性能基准。正文展示的计划仍归原作者。物理算法与并行度受配置、统计及环境影响，不保证在其他机器上逐字一致。

## 读者与措辞复核

- 面向会读基本 SQL、正在学习执行计划的 DBA 和后端工程师。按原文先常量、再子查询、连接、聚合逐步展开，三种连接算法在相关计划出现前说明。
- 读者应能根据计划区分“常量折叠”“索引条件”“执行时 Filter”，解释表达式索引的结构匹配、LIMIT 对下推的限制、半连接与反连接的意义，并避免将 NOT IN 和 NOT EXISTS 直接互换。
- 不添加多余建表确认、样例行、清理章节或性能结论；保留初始化数据是复现原文所必需，并提示 DROP 的影响范围。
- 技术修正就近标为译注，详细来源与后台过程集中在本记录。没有逐句重复官网链接，没有套用“先把……说清楚”“反直觉”或会议角色标签。
- 主观编辑复核：忠实性 24/25、技术准确性 24/25、中文可读性 23/25、可核查性 24/25，合计 95/100。这是编辑自评，不是独立专家或实际读者评分。

## 网站检查

- `python3 maintenance/115-verify.py --pg-bin /opt/homebrew/opt/postgresql@18/bin --check-output` 成功，38 个 SQL、31 份计划的结构检查与正文计划文本对比通过。辅助 NULL、LIMIT 和自连接开关检查通过。
- `node maintenance/build-catalog.mjs`：115 条文章记录通过，技术文章为 114 篇（不含项目后记）。元数据、首页最近收录、专题、系列、侧栏、全文索引、静态页与 Sitemap 均由生成器更新，没有手工修改生成文件。
- `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs`：33 项通过。新增译文分类、作者检索、SQL 完整性与关键校订检查；110 退出最近五篇后只调整首页相关旧断言，保留专题、系列和会议入口检查。首页全部精选链接继续由通用 SEO 测试覆盖。
- `git diff --check` 通过；已有文章正文、样式和运行脚本没有手工修改。
- `/tmp/howto115-qa.cjs`：静态 `/articles/115/` 与旧 `#/docs/115`，390/768/1440 三种宽度、深浅色，共 12 组通过。中文标题、来源、系列、canonical 正确；页面无整体横向溢出，长代码可在容器内横向滚动，无 pageerror。
- 12 组均点击目录中的“IN 与 EXISTS”，检查标题定位，刷新后仍定位到同节。技术译文 + 技术博客组合筛选检索“查询计划重写”仅返回 115，刷新保持筛选及结果。
- 无 JavaScript 静态页面包含完整标题与全部 73 个代码/结果块：38 个 SQL、31 份计划、2 个计数结果、1 个安装 shell、1 个初始化执行输出。
- 人工查看桌面浅色首屏、移动暗色首屏与半连接计划截图。截图在 `/tmp/howto115-qa`，未加入仓库；未执行真机 Safari 检查。
- 本地预览：`http://127.0.0.1:4177/articles/115/`；旧入口：`http://127.0.0.1:4177/#/docs/115`。未提交或推送。
