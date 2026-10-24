# 发布后深度审计

审计日期：2026-10-24。基线为 `eb067abd83f9b5f5efc25865c6618b4b9a98d3f5`，开始工作时本地 HEAD 与新获取的 `origin/master` 一致，工作区干净。本报告中的修复位于其后的未提交工作区，不代表已发布。

## 结论

网站已经具备独立静态文章，不存在“使用 Hash 路由，所以所有文章都无法被抓取”的问题。109 个编号入口的正文、标题、来源、代码和 canonical 已在初始 HTML 中提供，旧链接也能正常阅读。需要补足的是首页及专题、学习路径的静态发现能力，以及少量文本提取和导航细节；不需要更换框架或重做首页。

本轮保留现有 Logo、版式、配色、九个专题、六条路径、108 篇技术文章与一篇后记。所有编号 Markdown、SQL/Shell 示例和文章元数据均未修改。

## 检查范围

| 范围 | 实际检查入口 |
| --- | --- |
| 首页 | `/`、`#/`、`#/README`、`#/README.md`，含关闭 JavaScript |
| 内容发现 | `/articles/`、旧专题/路径入口、搜索与组合筛选；新增 `/topics/`、`/paths/` |
| 技术阅读 | `#/docs/1`、`7`、`42`、`98`、`102`、`105`，对应静态入口；其他编号文章逐页回归 |
| 错误与深链接 | 不存在的文章、`.md` 旧地址、章节跳转和刷新、延迟 Mermaid、读者主动滚动 |
| 响应式 | 1440×900、1280×800、1024×768、768×1024、390×844、360×800，深浅两种主题 |
| 工程产物 | 初始 HTTP、运行后 DOM、robots、Sitemap、canonical、OG、JSON-LD、生成器、搜索索引、依赖清单、README |

线上基线核验了 138 个 HTTP 文件，均与开始时的仓库内容一致。修改前另行运行了 168 组本地页面和 12 组组件检查，建立了本轮的新基线，没有用历史截图代替本次检查。记录见 [基线证据](visual-qa/final/before/manifest.json)。

## 已确认的问题与改进

| 编号 | 优先级与性质 | 证据 | 处理 |
| --- | --- | --- | --- |
| R1 | P1，初始内容缺口 | 根 HTML 仅 7,541 字节，无 `#main`、无直接文章链接；禁用 JS 只显示简短介绍 | 从现有首页源模板生成完整初始正文，保留 Docsify 渐进接管 |
| R2 | P1，发现能力改进 | 原有专题与路径只有 Hash 入口，不能像编号文章一样直接读取其完整初始正文 | 新增同源生成的 `/topics/`、`/paths/`，加入导航、面包屑与 Sitemap；旧入口保留 |
| R3 | P2，已复现的显示问题 | `work_mem` 检索中两条摘要显示 `&quot;差异&quot;`、`&quot;配额&quot;` | 使用构建期 HTML 解析提取实际可见文字；不对 SQL 等代码做全局实体替换 |
| R4 | P2，已复现的可访问文本问题 | 静态文章 42 图片的 DOM alt 中残留 `&quot;forest of lock trees&quot;` | 修正二次转义，保留真实引号和正确属性转义 |
| R5 | P2，验证工具耦合 | `--http-only` 仍在模块顶层加载 Playwright，没有该包便无法进行纯 HTTP 核验 | 浏览器模式才加载可选依赖；HTTP 核验只需 Node.js |
| R6 | P2，说明缺口 | README 已有定位、主题、路径、来源及贡献说明，但仓库没有统一项目级 LICENSE | 仅补充许可现状，明确不替上游及外部材料重新授权 |

R1、R2 是可直接验证的静态发现缺口，不是搜索引擎已经拒绝收录的证据。R2 对应的静态端点是本轮增量，不应把修改前不存在这些端点当成历史文章 404。

### 实施期间发现并修复的回归

- 头部改为可抓取链接并保留 JS 路由后，在同一首页底部点击品牌没有触发 Hash 变化，也就没有回顶。现已显式处理同路由头部导航，并验证焦点返回正文。
- 预渲染接管期间过早显示页脚，使其短暂进入首屏，桌面本地观测 CLS 为 `0.186`。恢复内容就绪后显示页脚的规则，无 JS 情况单独正常显示。补充回归记录中桌面和移动启动 CLS 均为 `0`。这是本轮实施中拦截的回归，不是线上基线缺陷。详见 [位移来源](visual-qa/final/after/layout-shift-before.json) 和 [复测数据](visual-qa/final/after/focused.json)。

## SEO 判断

### 初始内容与内部发现

109 篇文章在禁用 JavaScript 的浏览器中逐页验证，650 个 fenced block 与 Markdown 解析结果逐字符比较，包含缩进、换行和实体字面量。每篇静态文章具有自己的中文标题、description、OG、canonical 和结构化数据；不存在所有文章 canonical 指向首页的问题。

修复后根 HTML 为 16,307 字节，包含完整首页及 10 个直接静态文章/目录链接；专题、路径、全部文章进一步链接到所有编号文章。Sitemap 从 111 项变为 113 项，新增两个目录入口，不填 Hash、筛选参数或虚构的 lastmod。自动化检查从根页面沿普通链接遍历发现全部文章，并检查静态链接和章节目标。

[Google 的链接指南](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)要求可解析的 `a[href]`；[URL 指南](https://developers.google.com/search/docs/crawling-indexing/url-structure)也不建议依赖 fragment 表示不同内容。本轮补齐这些工程条件，不对实际收录、排名或流量增长作承诺。

### Canonical 与旧入口

`/articles/编号/`、`/topics/`、`/paths/`、`/articles/` 在初始 HTML 提供自引用 canonical。旧文章 Hash 入口运行后指向对应静态文章；旧专题和路径也对应新静态地址。

根 `index.html` 同时承载旧 Hash 文章，初始 HTML 不硬编码首页 canonical，避免旧文章先声明首页再被 JS 改写。运行后根据实际路由补齐。[Google JavaScript SEO 指南](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)说明可用 JavaScript 设置 canonical，但不建议更改 HTML 中已经指定的不同 canonical。这里是保留共享外壳的明确取舍，不是漏修所有页面的 canonical。

Google 可以执行 JavaScript，但渲染和最终索引是不同环节；[Bing 指南](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a)同样强调内容发现及正确链接。未访问任何站长平台，不能据此宣称搜索引擎已实际收录全部文章。

## 保留现状的部分

- 侧栏已经是“专题名 + 数字”，统一说明主归属口径；较长统计文字仅供屏幕阅读器使用，不存在截图中每项重复说明的问题。
- 首页专题已经主要显示收录数，主归属数放在辅助说明中；数量从元数据生成，不再增加一套统计。
- 侧栏只默认展开当前主专题，并保存手动展开状态。DOM 包含全部文章不等于视觉上全部展开。
- Logo 为现有清晰 SVG，移动端和暗色符号切换正常；不更换品牌、不增加装饰箭头。
- SQL、EXPLAIN 和终端输出已有局部滚动与保留空白策略；表格、图片、TOC 和复制的实测未发现需要重写其结构的问题。
- README 已经是专业项目入口，而非早期编号列表；只补许可说明，不重写现有介绍。

## 后续机会与未验证边界

| 项目 | 判断 |
| --- | --- |
| 实际收录与 canonical 选择 | 未验证。需发布后由站点所有者在 Google Search Console/Bing Webmaster Tools 查看 URL 检查结果 |
| 真机 Safari、微信内置浏览器、Android 字体 | 未验证。本轮为真实 Chrome 执行、移动视口及 CDP 触摸模拟，不等于物理手机验收 |
| Lighthouse 与真实用户 CWV | 未生成 Lighthouse 分数，没有线上用户分位数；仅记录无节流本地实验的 LCP/CLS，不能当成线上达标结论 |
| 分词及排序进一步提升 | 当前术语、别名、空格归一化和正文检索通过；不是自然语言语义搜索，也没有声称覆盖所有问题表达 |
| 无 JavaScript 的交互 | 首页与静态文章/目录可读；全文搜索、抽屉、复制、图片弹窗仍需 JS；Mermaid 禁用 JS 时保留图表源码 |
| 后续增加文章 | 继续维护 `data/articles.json` 与 Markdown；不要手工维护第二份专题、路径或静态页面 |
| 发布验收 | 本轮没有提交、推送或部署。新入口当前仅本地有效，生产复核须在获准发布后另做 |

完整实施、命令和验收记录见 [精修报告](final-polish-report.md)。
