# 103：实验与校订记录

核对日期：2026-09-24。中文整理与技术校订：xiongcc。

## 来源与归类

- 用户提供的 *Everything you need to know about collations*，39 页，Andreas Karlsson / Percona。已完整提取阅读，渲染核对第 32 页的 ICU 描述。
- [Percona 场次页面](https://percona.community/talks/2026/2026-04-21-everything-you-need-to-know-about-collations/)确认：PGConf.DE 2026，Essen，2026-04-21。
- 归入“专题解读”；主专题“SQL、数据建模与扩展玩法”，交叉收录“索引治理”“运维排障与日常工具”。
- 按文本比较、约束、索引与升级风险重组，不逐页翻译，不上传第三方整份 PDF。保留城市排序示例，补充唯一约束、执行计划和字符映射实验。

## 技术校订

| 原材料位置 | 处理 |
| --- | --- |
| 第 7–10 页 | 四种城市排序在本机重跑，与材料一致；明确码点顺序与语言排序的区别。 |
| 第 12–15 页 | 保留“修复对象后刷新版本”的顺序。版本变化是调查信号，不声称每次库升级都会改变所有字符串的排序。不能只用 `pg_depend` 的具名依赖列表覆盖数据库默认规则等全部情形。 |
| 第 16–24 页 | 保留列与表达式规则、显式覆盖隐式、拼接结果排序冲突的核心机制；省略长篇优先级排列组合。增加索引与查询 Collation 必须匹配的实验。 |
| 第 26 页 | 不将 libc 绝对判定为最慢；性能依赖平台、版本和数据。未推广额外兼容扩展。 |
| 第 30 页 | builtin provider 始于 PG17，`pg_unicode_fast` 始于 PG18。`C.UTF-8` 和 `PG_UNICODE_FAST` 面向 UTF-8，不把 UTF-8 限定泛化到所有 builtin locale。码点排序稳定与字符映射主版本变化分开，不沿用“升级永远不需要重建”的泛化表述。 |
| 第 32 页 | 原页 ICU provider 下写成 libc 升级风险，改为关注 ICU 自身版本与排序数据。PG19 性能变化不混入 PG18 的说明，不给出未测量的速度排名。 |
| 第 33–36 页 | 用合法 ICU locale 实测大小写、重音、数值排序。区分定制 locale 与 `deterministic=false`；不将非确定性解释成随机结果。省略不服务主线的 EBCDIC 自定义长规则。 |
| 第 37–38 页 | 默认采用 `pg_c_utf8` 作为 Andreas 的选型倾向交代，保留现有系统业务兼容性的边界，不鼓励直接修改生产库默认规则。 |

## 补充实验

环境：PostgreSQL 18.4（Homebrew），macOS / aarch64，UTF-8；所建德语 ICU Collation 的版本字符串为 `153.136`。

```sh
python3 maintenance/103-verify.py
# 可指定其他 PostgreSQL 18 安装：
python3 maintenance/103-verify.py --pg-bin /path/to/postgresql18/bin
```

仅使用 Python 标准库、initdb、pg_ctl、psql。每次生成独立临时数据目录及 Unix socket，不开放 TCP，不连接已有实例。临时实例关闭 fsync 以减少实验开销；SQL 和子进程带超时，finally 停止实例并清理目录。不能将此启动配置用于生产。

脚本直接提取正文九个 SQL 块并执行，另外用断言核对：

| 检查项 | 结果 |
| --- | --- |
| 码点序、德语、瑞典语、丹麦语城市排序 | 四组均与正文表格一致 |
| `und-u-ks-level2`，非确定性 | Alice / alice 相等，e / é 不相等 |
| 同 locale，确定性 | Alice / alice 不相等 |
| 唯一约束 | 插入 Alice 后插入 alice，捕获预期 SQLSTATE 23505 |
| DISTINCT / GROUP BY | Alice、alice、ALICE 合并为一组 |
| Unicode 规范形式 | 单码点 é 与 e + 组合重音比较相等 |
| PG18 非确定性 LIKE | Alice LIKE a% 为 true |
| ILIKE / SIMILAR TO / POSIX 正则 | 均捕获预期 SQLSTATE 0A000 |
| 数值排序 | ICU kn-true 下 file2 < file10；C 下不成立 |
| upper('ß') | pg_c_utf8 返回 ß，pg_unicode_fast 返回 SS |
| C 索引、C 排序 | Limit → Index Only Scan |
| C 索引、德语排序 | Limit → Sort → Seq Scan |
| 增加德语匹配索引 | Limit → Index Only Scan |
| 两条版本诊断 SQL | 成功执行 |

大小写映射按实际输出核对，未将简单映射的结果推断为大写 ẞ。索引实验只验证计划结构，不比较执行耗时；未模拟操作系统或 ICU 升级造成的索引损坏，未测试分区边界迁移或生产规模并发重建。

## 核对资料与编辑检查

正文文末集中列出 Collation Support、CREATE/ALTER COLLATION、PG17/18 发布说明、模式匹配、REINDEX 与系统信息函数的官方文档。

原分享来源集中交代，不重复使用“讲者”等角色词。操作安全提醒保留在升级处理位置，不将正文写成校订报告。不改动旧文章正文或既有路由。

## 页面验收

- 目录生成、八项静态测试与 `git diff --check` 通过；首页新增收录日期为 2026-09-24，与第 99 篇共用 PGConf.DE 2026 会议入口。
- 第 103 篇独立浏览器检查通过：九个 SQL 块、中文标题、来源与验证信息、目录跳转、首页最近收录、别名搜索、系列/专题/会议入口。
- 390/768/1536 像素下的浅色与暗色模式均已截图；两张表格在 390 像素宽度下都实际验证了横向滚动，无页面级横向溢出。人工查看桌面标题与移动端暗色表格截图。
- 本次没有重跑全部历史文章的浏览器回归。预览中观察到外部 CDN 的 Java 高亮文件返回 502；Docsify 对 `/docs/_sidebar.md`、`/docs/_navbar.md` 的探测返回 404 后正常回退到根目录导航。新文章检查通过，不据此声称外部资源始终可用；未修改网站的依赖加载策略。
