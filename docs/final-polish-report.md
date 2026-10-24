# 发布后深度精修报告

日期：2026-10-24。工作分支：`codex/site-redesign`。基线及 `origin/master`：`eb067abd83f9b5f5efc25865c6618b4b9a98d3f5`。下文保留发布前的本地精修与验收记录。

发布补充：后续经用户授权，实现提交 `36c598a` 已推送并完成 Pages 部署。本报告保留本地精修阶段记录，发布后实际域名检查另见 [正式站验收](final-production-check.md)。

## 本次实际改动

1. 首页初始 HTML 包含完整正文，从既有首页模板生成。关闭 JavaScript 也能查看专题、路径、最近收录和静态文章；启用后仍使用原有搜索及 Docsify 体验。
2. 新增 `/topics/`、`/paths/` 两个静态目录，内容直接复用同轮生成的 Markdown，未另建分类或推荐规则。补齐可抓取导航、面包屑、canonical 和 Sitemap。
3. 修复搜索摘要残留 `&quot;`。构建期按 HTML 语义提取可见文字，而不是全局解码源文件，保证代码里的实体字面量不变。
4. 修复静态技术图片的 alt 二次转义；保留既有图片缩放、原始尺寸及触摸平移。
5. 修复头部同路由点击不回顶，以及预渲染接管期间页脚闪现引起的位移；统一首页浏览器标题，消除重复品牌文案。
6. 增加 SEO、无 JS 发现、延迟接管、实体保真及启动布局回归。纯 HTTP 核验不再要求安装 Playwright。
7. README 仅补充许可现状；维护文档说明新产物及测试用法。

未更换框架、未改首页布局与 Logo、未调整文章分类、编号或学习路径。`docs/1.md` 至 `docs/109.md`、`data/articles.json`、首页源模板和品牌资源没有内容改动。大量 `articles/*/index.html` 差异来自生成器更新的导航及资源哈希，不是重写文章。

另对 122 个受保护源文件逐个与 HEAD 比较，字节完全一致，见 [源文件完整性记录](visual-qa/final/after/source-integrity.json)。

## 主要文件

| 文件 | 用途 |
| --- | --- |
| `maintenance/build-catalog.mjs` | 同源首页预渲染、搜索正文提取、构建资源哈希 |
| `maintenance/html-tools.mjs` | 构建期 DOM 文字提取与静态链接转换 |
| `maintenance/static-pages.mjs`、`static-template.html` | 两个新目录、静态导航与 canonical、图片 alt |
| `scripts/article-view.js`、`reading.js` | 共享目录元信息，保持静态/旧入口元数据一致 |
| `scripts/site.js`、`styles/custom.css`、`index.html` | 可抓取头部链接的 JS 增强、同页回顶、首页初始内容与加载状态 |
| `maintenance/readme-template.md`、`README.md` | 说明当前无统一项目级 LICENSE，不替外部内容授予许可 |
| `maintenance/test-seo.cjs`、`test-final.cjs` | 新增静态语义与浏览器专项检查 |
| 现有目录、视觉和细节测试、CI | 覆盖新增目录及 Sitemap，HTTP-only 延迟加载浏览器依赖 |
| `vendor/parse5.mjs`、许可文件与清单 | 固定版本的构建期 HTML 解析器，记录来源、哈希及依赖许可 |
| `topics/index.html`、`paths/index.html`、既有生成文件 | 统一构建输出，不手工维护 |

parse5 不进入浏览器下载，不需要网站运行服务或 npm install。现有 Mermaid 约 3.34 MB 的本地文件仍按需加载；普通首页不加载它，本轮未扩展其职责或引入另一套运行时。

## SEO 验收

| 项目 | 结果 |
| --- | --- |
| 线上版本核对 | 修改前 138 个 HTTP 文件与基线一致；线上浏览器验证首页、搜索、旧文章及静态长文 |
| 最终本地产物 | 140 个 HTTP 文件逐个核对状态与 SHA-256，全部与最终工作区一致 |
| 独立文章 | 109 个静态入口，关闭 JavaScript 后逐页可读，正文及来源未丢失 |
| 元数据 | 检查 title、description、canonical、OG、JSON-LD；编号文章均指向自己的静态地址 |
| 静态发现 | 首页、专题、路径、全部文章通过普通链接发现全部编号文章，未发现孤立文章或失效静态章节目标 |
| Sitemap/robots | 113 个唯一 URL，无 fragment、查询参数或伪造 lastmod；robots 指向实际 Sitemap |
| 旧链接 | 全部编号 Hash 入口、`.md` 形式、章节链接继续可用，不强制迁移或重定向 |
| 错误入口 | 不存在的静态文章返回 HTTP 404；旧 Hash 入口显示可恢复的站内提示，不误称其 HTTP 返回 404 |

根初始 HTML 不硬编码首页 canonical，原因是它同时承载旧 Hash 文章。独立页面有初始自引用 canonical，旧入口运行后按实际路由设置。取舍及官方参考见 [审计报告](final-review.md#seo-判断)。

## 搜索与导航

新增专项以桌面/移动、深浅主题四种组合运行，每组 13 个查询，共 52 次：

| 查询 | 应命中文章 |
| --- | --- |
| `work_mem`、`WORK_MEM` | 92 |
| `pg_stat_statements`、`pg stat statements` | 5 |
| `EXPLAIN BUFFERS` | 1 |
| `autovacuum` | 102 |
| `xmin` | 45 |
| `replication lag` | 93 |
| `WAL` | 31 |
| `锁等待`、`锁 等待` | 42 |
| `索引膨胀` | 46 |
| `vacuum freeze` | 44 |

既有回归另验证首页 Enter、Ctrl/Cmd+K、结果上下选择、Escape 返回输入、清除、显示更多、组合筛选、前进后退与刷新恢复。实际阻断全文索引请求，验证标题/别名回退及重试，不在正常状态误报失败。带 HTML 的查询没有插入可执行节点。

摘要中的正文引号恢复正常，代码字面量保持原样。专题与路径的新旧入口 canonical 一致；侧栏保留手动展开状态、当前专题及文章高亮，移动抽屉检查焦点约束、Escape 和内容 inert 状态。同首页头部再次点击能够回顶并聚焦正文。

## 阅读与视觉

核心样本为 EXPLAIN（1）、pg_stat_statements（7）、锁树（42）、bpftrace（98）、Autovacuum（102）、逻辑复制（105）；另逐页遍历全部 109 篇旧文章及无 JS 静态文章。

- 650 个 fenced block 的字符、空格、缩进和换行与 Markdown 解析结果一致。SQL 高亮，EXPLAIN/psql 保留 `white-space: pre`，不强制折行。
- 鼠标、Enter 键和移动触摸复制通过；剪贴板与代码 DOM 内容完全一致，反馈、焦点边框及复制后状态正常。
- 宽表格和执行计划在本地容器内滚动，不扩大整个页面。CDP 真实触摸序列覆盖 360/390px、深浅色四组情况；未隐藏数据列。
- 图片比例完整；24 组图片阅读场景验证适应窗口/原始尺寸、局部滚动、键盘平移、移动触摸、关闭焦点、小图、竖图和横屏。
- TOC 多层级、当前章节、折叠状态、短视口 sticky、跳转和刷新通过；16 组延迟图表场景验证不会覆盖读者主动滚动。
- 六种精确视口、两种主题，共 192 组页面与 12 组组件验收通过；记录中无页面级横向溢出、浏览器异常或未处理资源错误。
- Logo 保留原资源，深浅主题切换、16–64px 的 1x/2x 符号像素检查通过。

七张代表性截图与本轮修改前的 PNG 字节完全一致，包括四种首页场景、SQL、移动暗色表格、移动暗色长文。该对比说明这些已成熟页面没有因本次静态增强发生视觉变化，不代表仅靠七张截图就覆盖整个网站。详见 [对比数据](visual-qa/final/after/visual-comparison.json)，其余覆盖以矩阵和专项测试为准。

### 性能记录

预渲染接管期间的页脚闪现曾触发桌面 CLS `0.186`，已被测试拦截并修复；保留中间失败记录，不将它混作修改前线上缺陷。修复后的 V2.1 实验：首页桌面 LCP 132ms / CLS 0，移动 LCP 112ms / CLS 0；静态长文 LCP 84ms / CLS 约 0.0102。

条件为本机 Chrome、1000px 高度、无网络/CPU 节流、独立配置、内容后等待约 1 秒、屏蔽统计请求。补充启动专项另测首页桌面/移动 CLS 均为 0。这里只是本地实验值，没有 Lighthouse 分数、INP 或真实用户 CWV 分位数，不能推导生产性能达标。

## 构建与回归

本机为 Node.js 20.14、Chrome 155.0.8059.86。浏览器使用已有 Playwright，不使用用户登录配置。

| 命令 | 实测结果 |
| --- | --- |
| `node maintenance/build-catalog.mjs --check` | 109 条元数据，127 个生成文件一致，索引版本 `c19fb2e9005eac97` |
| `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs` | 28/28 通过，已纳入 CI |
| `node maintenance/test-site.cjs` | 全路由、首页入口、搜索、失败重试、抽屉、复制及响应式通过 |
| `node maintenance/test-v2.1.cjs` | 109 篇无 JS 阅读、650 块代码保真、目录/检索/版本及本地性能通过 |
| `node maintenance/test-v2.2-final.cjs` | 140 个 HTTP 文件，192 组页面、12 组组件通过 |
| `node maintenance/test-v2.2.1.cjs` | 24 组图片阅读与复制焦点通过 |
| `node maintenance/test-anchor-stability.cjs` | 16 组延迟图表及锚点场景通过 |
| `node maintenance/test-v2.2-touch.cjs` | 四组移动触摸横向滚动通过 |
| `node maintenance/test-v2.2-details.cjs` | 字体、图片比例、焦点、相邻文章、Sitemap、真实 404 通过 |
| `node maintenance/test-v2.2.cjs` | 品牌、六种宽度、两种主题、符号像素与 reduced motion 通过 |
| `node maintenance/test-final.cjs` | 无 JS 发现、52 次检索、新旧 canonical、延迟接管和启动稳定性通过 |
| `git diff --check`、运行时代码语法检查 | 通过 |

浏览器命令需按本机安装设置 `PLAYWRIGHT_PACKAGE`、`CHROME_PATH`；可用 `HOWTO_URL` 指定预览，`HOWTO_SCREENSHOTS` 指定输出。纯 HTTP 模式 `node maintenance/test-v2.2-final.cjs --http-only` 不需 Playwright。

最终八套既有浏览器回归的起止时间、退出码见 [results.json](visual-qa/final/after/results.json)。补充专项见 [focused.json](visual-qa/final/after/focused.json)。截图、完整数据及日志索引见 [验收证据](visual-qa/final/README.md)。

## 最终验收清单

- [x] 首页设计、SVG Logo 与克制装饰保持现状。
- [x] 专题统计及侧栏主归属口径准确，导航状态正常。
- [x] 搜索准确，空结果、失败回退和重试状态清楚。
- [x] 核心样本及全量文章阅读、SQL/EXPLAIN/终端格式与复制正常。
- [x] 表格和图片完整，TOC、章节跳转和刷新正常。
- [x] 所测视口的移动布局及深浅主题通过真实 Chrome 回归。
- [x] 旧文章 URL、静态入口、SEO 产物、README 与构建经过验证。
- [x] 修改前后截图和回归数据已保存。
- [ ] Google/Bing 实际收录、搜索引擎选择的 canonical：未验证。
- [ ] 物理手机 Safari/微信浏览器、Android/Windows 字体：未验证。
- [ ] Lighthouse 分数及线上真实用户 CWV：未验证。
- [x] 后续经用户授权完成发布，正式域名验收单独存档于 [正式站验收](final-production-check.md)。

## 本地预览

- 首页：<http://127.0.0.1:4176/>
- 无 JS 也可读的专题：<http://127.0.0.1:4176/topics/>
- 学习路径：<http://127.0.0.1:4176/paths/>
- 静态文章：<http://127.0.0.1:4176/articles/105/>

既有预览服务保持运行，没有添加外部服务，也没有修改生产环境。
