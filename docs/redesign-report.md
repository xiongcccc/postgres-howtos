# PostgreSQL Howto 全站改版报告

交付日期：2026-10-23。本报告记录发布前的本地实现与验收结果；经维护者确认后发布，线上结果在部署完成后另行核验。

本地预览：[首页](http://127.0.0.1:4176/#/README) · [文章](http://127.0.0.1:4176/#/docs/109) · [查找文章](http://127.0.0.1:4176/#/docs/find) · [专题](http://127.0.0.1:4176/#/docs/topics)。

## 范围与设计判断

保留 Docsify、Hash URL、Markdown 目录与静态 GitHub Pages 发布方式，不引入框架迁移、搜索服务、账号或后端。首页、搜索、导航、阅读、主题和附属功能统一在同一套设计语言下实现。

白色页面、深灰正文、深蓝品牌、克制的青绿导航。用字号、间距与细分隔线区分层级，专题和路径都是轻列表，不采用营销式 Hero、渐变背景或大卡片墙。中文、英文和代码分别使用可用的 Noto Sans SC、Inter、JetBrains Mono 与系统回退栈；没有强制下载中文字库或造成字体等待的外部请求。

### 首页

- 根地址、`#/`、`#/README` 直接进入同一个可搜索首页，取消额外的整屏封面步骤；原 `_coverpage.md` 与品牌素材仍保留在仓库。
- 按项目定位、搜索、六个问题、九个专题、六条真实路径、最近收录、简洁项目介绍排列。
- 主页不再承担完整个人简历。保留 xiongcc 身份与个人主页；来源、版权说明、贡献方式和交流入口集中到“关于项目”。
- 最近收录继续使用真实 `addedOn`，新增专题、系列与来源说明，不虚构摘要、发布日期或验证状态。

### 检索与信息架构

- 主题为主要筛选，系列、来源放入可展开的高级筛选；有组合筛选时自动展开，可一次清除，URL 与重载状态一致。
- 支持 Ctrl/Cmd+K、结果方向键、Escape 回到输入、分页、加载状态、失败降级及重试。查询不发送给外部搜索服务。
- 标题与正文高亮复用同一归一化规则，支持大小写、全角、空格、下划线等技术拼写。用户输入通过文本节点与 mark 渲染，不作为 HTML 注入。
- 构建时通过固定版本 Marked lexer 生成纯文本索引，保留 SQL 内容，减少 Markdown 标记对摘要的干扰。
- 修复 Docsify 同一文件只变 Hash 查询参数时可能不重新渲染的问题，搜索和筛选会从 URL 恢复；保留首页 `about-author` 锚点。
- 侧栏默认只展开当前文章的主专题，编号弱化，保留当前分类与文章状态，自动定位当前文章。面包屑稳定使用元数据第一个 topic。

### 阅读体验

- 桌面采用专题导航、正文、文章目录三栏；1280px 以下目录回到正文，1024px 以下专题导航变为抽屉，不挤压正文。
- H2–H4 自动目录，滚动高亮与锚点偏移匹配顶栏。历史文章正文中的额外 H1 仅在显示层降为 H2，原锚点与 Markdown 均不变。
- 统一中文标题、来源、收录日期、版本与验证说明。来源折叠保留原有署名，第三方材料不会变成本站原创。
- 本地主题控制支持系统/浅色/深色，字号可恢复；代码与表格跟随阅读字号。两种主题使用同一布局模型。
- 代码复制直接读取 code.textContent；SQL、终端和 EXPLAIN 空格与换行不变。宽代码与表格局部滚动，表格参数名不再拆成多行。
- 图片保持原始来源与比例，可用鼠标或键盘在原生 dialog 中放大。Mermaid 按需加载，以高对比中性画布保证深色下可读。
- 文末有同主专题上一篇/下一篇、基于主题重合的相关文章、源码、纠错与历史讨论入口，不做随机推荐。

### 附属功能与工程组织

- 统计、赞赏、交流群移至页脚或按需对话框，不悬浮覆盖正文。二维码沿用原素材，点击后才加载。
- 去掉页面中的 Gitalk OAuth client secret 与内嵌登录脚本，讨论保留在原 GitHub Issues，通过文章路径查找；现在在 GitHub 查看和参与，而不是在站内登录。
- 主题、抽屉、对话框和复制归入 `scripts/site.js`；搜索状态归入 `finder.js`；文章导航与元数据由 `reading.js` 管理；图表由 `diagrams.js` 按需加载。
- Color、Typography、Spacing、容器、断点与组件变量集中到两份有职责边界的 CSS。新增功能后 CSS 总字节数略增，不将压缩行数宣称为性能提升。
- Docsify、Prism、Mermaid、构建用 Marked 和 Lucide 图标均固定版本并保留许可证。vendor/manifest.json 记录来源与校验摘要，测试会核对；不需要 npm install。

## 数据与内容兼容性

| 项目 | 核对结果 |
| --- | --- |
| 编号文档 | 109 篇，均能打开 |
| 技术文章 / 项目后记 | 108 / 1 |
| 技术专题 | 9 个 |
| 主归属计数之和 | 109，与编号文档一致 |
| 跨专题收录 | 14 篇，多专题收录总计 129 次 |
| 文章元数据记录 | 与改版前逐项相同；仅路径新增稳定 id 与学习目标 |
| 编号 Markdown、SQL、技术图片 | 没有修改或删除；git diff 中无编号文章正文变化 |
| 路由 | 保留 `#/docs/编号`、`.md` 形式、旧首页锚点及原筛选参数 |

首页明确显示技术文章与后记，专题入口标注含跨专题收录。侧栏只列主归属文章，专题索引包含交叉收录；两者数字不同是有意的数据口径，而非漏文。

## 实际验证

### 自动化

```bash
node maintenance/build-catalog.mjs
node --test maintenance/test-catalog.cjs
git diff --check
```

18 项目录、搜索、数据、资源摘要和颜色对比度测试通过。正文/次要文字、品牌链接、青绿交互和代码文字在两种主题中与对应背景的对比度均至少 4.5:1。

浏览器验收：

```bash
PLAYWRIGHT_PACKAGE=/你的路径/node_modules/playwright \
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
node maintenance/test-site.cjs
```

独立无头 Chrome，不使用用户浏览器配置，统计请求屏蔽。全部检查通过：

- 109 篇编号文章、中文 H1、来源、主专题、面包屑、结构化信息及现有 Mermaid 图。
- 根入口、所有问题/专题/路径入口、日期、旧 `.md` 路由与首页作者锚点。
- 归一化摘要、高亮、键盘导航、显示更多、筛选组合、刷新与前进后退、同页 Hash 参数变化。
- 目录定位不被固定顶栏遮挡；代码复制与原文字符完全一致；字号恢复；有恢复入口的 404。
- 1440、1280、1024、768、390、360px，浅色与深色，覆盖首页、专题、搜索及 EXPLAIN、pg_stat_statements、锁、bpftrace、Autovacuum、WAL/复制与 psql 文章。120 组代表页面/宽度/主题检查无页面级横向溢出。
- 手机表格与宽 SQL 实际设置 scrollLeft 并验证其大于 0，不以存在 overflow 样式代替验证。
- 抽屉初始焦点、Tab 约束、Escape、选择链接后的关闭与正文焦点；原生对话框关闭后的焦点恢复。
- 模拟全文索引失败与慢加载，保留元数据检索并能重试恢复；恶意 HTML 查询不生成可执行 DOM。
- 锁树文章的原始技术图片实际加载为 1409×565，并完成键盘放大、关闭和焦点恢复。41 张历史外部图片的路径与 alt 均保留，不把单张验证写成全部远程资源永久有效。

### 性能与 SEO

原始浏览器记录见 [metrics.json](redesign/after/metrics.json)。本轮五次本地有缓存的搜索界面响应为 130、149、143、143、148ms，含 120ms 输入防抖。它们不是现场 INP，也不是公网移动网络下的速度承诺。

- 首页没有请求约 3.34MB 的 Mermaid；只在含图文章加载。全文索引约 654KB，在输入查询后加载；构建用 Marked 不进入浏览器。
- 小型品牌标识复用约 7.9KB 的已有 favicon，不再为首页小图加载约 631KB 原图。字体无外部下载；不必要的远程主题、计数、分页与 OAuth 插件已移除。
- 页面 title、description、OG 和文章 JSON-LD 随路由更新，生成 robots.txt 与只含真实根地址的 sitemap，不把 fragment URL 假装为独立静态文章。
- Hash 路由仍不能保证文章被搜索引擎独立发现与收录。本轮未迁移 URL；将来若做预渲染或独立 HTML URL，需要先建立旧 Hash 的兼容、canonical 和回退方案。参考 [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)。
- 未测量真实用户 LCP、CLS、INP，没有宣称达到现场 Core Web Vitals。键盘与对比度检查也不等于完整的 WCAG 2.2 AA 认证。

## 改版前后截图

| 页面 | 改版前 | 改版后 |
| --- | --- | --- |
| 桌面首页 | [查看](redesign/before/home-desktop.png) | [查看](redesign/after/home-desktop.png) |
| 手机首页 | [查看](redesign/before/home-mobile.png) | [查看](redesign/after/home-mobile.png) |
| 专题索引 | [查看](redesign/before/topics.png) | [查看](redesign/after/topics.png) |
| 搜索 | [查看](redesign/before/search.png) | [查看](redesign/after/search.png) |
| 技术文章 | [查看](redesign/before/article.png) | [查看](redesign/after/article.png) |

另有 [手机深色首页](redesign/after/home-mobile-dark.png)、[手机深色表格](redesign/after/article-mobile-dark.png)、[导航抽屉](redesign/after/navigation-mobile.png)、[图片预览](redesign/after/image-viewer.png)、[搜索失败](redesign/after/search-failed.png)、[无结果](redesign/after/search-empty.png)与 [404](redesign/after/not-found.png)。

## 最终验收清单

- [x] 首页层级清晰，以搜索、问题、专题和学习路径为主。
- [x] 侧栏可折叠，文章及当前主专题状态明确。
- [x] 搜索、筛选、清除、加载、失败与重试可用。
- [x] 中文技术排版、SQL、终端空格、表格和图片正常。
- [x] 桌面、平板、手机及浅深主题通过真实浏览器检查。
- [x] 历史路由、内容、图片、作者和上游来源保留。
- [x] 统一 tokens、组件、焦点、对话框和减少动效样式。
- [x] 元数据与合理 SEO/性能优化完成，限制如实记录。
- [x] 静态生成、18 项测试和浏览器回归通过，无已知阻塞性功能回归。
- [ ] 生产环境验收：发布后在实际域名复查，不提前将本地结果视为线上通过；真实设备与真实网络指标仍需后续观察。
- [ ] 旧 OAuth 凭据的撤销/轮换：须维护者在 GitHub 操作；代码删除不能抹除历史版本中的公开值。
- [ ] 搜索引擎独立文章收录：保留 Hash 架构下的已知限制，不作已解决声明。

后续维护仍以 `data/articles.json` 为唯一文章入口，修改模板/脚本/样式后运行生成器。验收截图不是运行依赖，删除截图不会影响站点。
