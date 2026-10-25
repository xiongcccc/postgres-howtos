# 文章目录与发布检查

`data/articles.json` 是文章展示信息的唯一编辑入口：中文标题、原题、主题、搜索别名、系列、来源、版本说明、验证状态。编号沿用原有文章，路由保持 `#/docs/编号`。

## 系列与来源

`series` 独立描述阅读形式：`guide`（实用指南）、`practice`（实践剖析）、`interpretation`（专题解读）。技术主题仍由 `topics` 决定，系列定义来自顶层 `series`，自动生成 `docs/series.md`。项目后记的系列为 `null`，不进入三个正文系列。

保留历史 `type` 字段与 URL 的 `type` 参数作为来源类别，避免旧筛选链接失效：`translation` 上游译文、`practice` 本站实践材料、`conference` 会议材料、`blog` 技术博客。具体归属与引用放在 `source`。界面将来源与系列分开筛选；会议入口仍按 `type=conference` 汇总，技术博客不进入会议页，也不改变文章的阅读系列。

现有 1–94、99 归入实用指南，96–98、100 归入实践剖析，101 为专题解读首篇。归类仅调整元数据，不改旧文章正文、编号与路径。后续按实际内容选择系列，不再由来源推断。

`maintenance/upstream-sources.json` 保留为上一次上游同步的审计记录，不作为前端目录。更新上游内容时，同步更新文章元数据中的来源与核对日期。

## 更新方式

1. 新增或修改 `docs/编号.md` 正文。原始 H1 保留用于溯源和旧锚点；网页显示中文标题。
2. 更新 `data/articles.json` 的对应记录。主题的第一个值决定侧栏位置，其他主题用于交叉收录；学习路径只填写不重复的真实文章 ID。
3. 首页文字在 `maintenance/home-template.md` 编辑，推荐文章 ID 在元数据的 `featured` 中编辑。
4. 执行 `node maintenance/build-catalog.mjs`。自动生成 README、网站首页、侧栏、专题、路径、会议页、搜索索引及静态文章；这些生成文件需要一起提交。
5. 执行 `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs` 和 `git diff --check`。

生成工具也会更新 `index.html` 中本地脚本和样式的内容哈希，避免发布后继续使用旧版资源。修改这些脚本或样式后也应重新运行生成工具。`index.html` 的其余配置仍可直接编辑。

生成工具使用 Node.js 与仓库内固定版本的 Marked、parse5 解析器，不需要 npm install。parse5 仅在构建和测试时使用，用于提取 HTML 可见文字和转换静态链接，不进入浏览器；不要通过全局替换实体字符改变代码字面量。网站访问不需要 Node.js 或额外服务。网站的全文索引在首次输入关键词时加载；失败时保留标题与别名搜索，显示重试入口。搜索内容不发送给外部搜索服务。

路径记录还需提供稳定的 `id` 和 `goal`。首页各区块通过 `maintenance/home-template.md` 的具名 HOME 标记生成到 `docs/home.md`；Docsify 保留 `#/README` 和 `#/README.md` 作为首页别名。GitHub README 由 `maintenance/readme-template.md` 独立生成，不再承担网站的 HTML 首页。关于项目文字位于 `maintenance/about-template.md`，生成 `docs/about.md`；`docs/not-found.md`、robots 和 sitemap 同样由生成器维护。

## 静态文章与 SEO

`maintenance/static-pages.mjs` 使用固定版本 Marked 与 Prism，在同一轮构建中从原始 Markdown 生成 `articles/编号/index.html` 及 `articles/index.html`。这些页面在初始 HTTP 响应中包含正文、中文标题、来源、版本说明、目录、代码高亮、canonical 与 JSON-LD，无需 JavaScript 即可阅读。Mermaid 在启用 JavaScript 后按需绘制；未启用时保留图表原文。

静态入口使用 `/articles/编号/`，自引用 canonical。旧 `#/docs/编号`、`.md` 形式及章节参数继续由 Docsify 提供，显示对应静态 canonical，不强制重定向。静态目录与 Sitemap 提供全部独立入口，首页页脚也链接到静态目录。仓库已有 `.nojekyll`，GitHub Pages 按原发布方式托管目录内的 index.html，不需要额外服务或 rewrite。

首页初始 HTML 也由同一份 `maintenance/home-template.md` 生成，位于 `index.html` 的 `HOME_PRERENDER_START/END` 标记之间，不直接编辑标记内内容。无 JavaScript 时提供完整专题、路径和最近文章；搜索需要 JavaScript，初始入口为静态文章目录。加载旧文章 URL 时先显示载入提示，不闪现首页正文；Docsify 正常启动后接管 `#app`，不保留重复正文。

`/topics/` 和 `/paths/` 从同轮生成的专题与路径 Markdown 构建，使用与文章一致的静态模板、样式及头部导航。首页初始链接、文章面包屑可直接进入这些页面；旧 Hash 入口继续工作，canonical 对应新静态入口。Sitemap 为首页、三种目录页和全部编号文章，不收录筛选参数或 Hash URL。共享 Hash 外壳的初始 HTML 不硬编码首页 canonical，以免旧文章地址先声明错误的 canonical；运行时按实际路由补齐，独立页面则始终在初始 HTML 提供自引用 canonical。

`scripts/article-view.js` 由 Node 构建和浏览器共享元数据、文末推荐、代码类型与结构化数据逻辑；静态页和旧文章共用 CSS 与 `reading.js` 渐进增强。静态页面模板为 `maintenance/static-template.html`，不要直接编辑生成的 HTML。语法核心仅在构建时使用，静态浏览器不下载 Docsify/Marked/Prism 来重新生成正文。

Sitemap 不填 fragment 地址，也不编造 lastmod。独立入口、可抓取正文、canonical 和结构化数据是可验证的工程条件，不保证搜索引擎收录或排名；上线后仍需核验生产 HTTP 响应及 Search Console。

`maintenance/test-seo.cjs` 与目录测试一起在 CI 运行：核对全部编号文章的初始正文、元数据、代码保真、标题 ID 唯一性，以及 Sitemap 内部链接、章节锚点和静态发现路径。测试从同一元数据读取预期值，不另维护文章清单。

`scripts/site.js` 管理主题、抽屉、对话框与剪贴板，`finder.js` 管理搜索状态，`reading.js` 管理文章导航、目录与元数据，`diagrams.js` 按需加载 Mermaid。基础版式在 custom.css，页面组件在 reading.css；修改后运行生成器更新内容哈希。Docsify 4.13.1 在 doneEach 之前计算锚点，阅读增强插入元数据和目录后会用其现有定位机制重新计算；升级框架时须回归深链接与刷新。

## 验证信息

- `tested` 必须提供现存验证记录、日期和实际覆盖范围。不能仅凭原文描述或同步成功标成实测。
- `not-recorded` 表示没有独立运行记录。同步日期仅说明内容核对，不说明兼容所有版本。
- 不根据文章中偶然出现的版本号推断最低适用版本；版本说明应人工核对后填写。

## 发布验收

推送前检查：根地址、`#/` 与 `#/README` 均直接显示可搜索首页；旧封面文件保留，但不再增加一次进入步骤。首页搜索、6 个问题入口、专题、系列、路径和会议页可用；元数据中的全部编号文档都能打开；系列与来源组合筛选、表格横向滚动、中文标题、目录定位、浏览器前进后退、移动端菜单和暗色模式正常。

可选浏览器回归：使用已有 Playwright 及 Chromium，执行 `node maintenance/test-site.cjs`。默认连接本机 4176 端口；可用 `HOWTO_URL` 指定预览地址，`PLAYWRIGHT_PACKAGE` 指定已有安装，`CHROME_PATH` 指定本机 Chrome 可执行文件。`HOWTO_SCREENSHOTS` 可指定截图输出位置。测试采用独立浏览器配置，并屏蔽统计请求。文章通过 Utterances 在页内评论，沿用原 GitHub Issues；首页及发现页不挂载评论。历史编号映射、专门回归与旧密钥撤销要求见 `maintenance/COMMENTS.md`。

V2.1 专项运行 `node maintenance/test-v2.1.cjs`：新增无 JavaScript 的全部静态文章、逐块代码保真、目录跨断点/刷新、九组检索、静态 URL、真实二维码图片加载和本地性能记录。环境变量与旧回归相同，默认截图输出 `docs/v2.1/after`。这些脚本不替代真机 Safari 与真实网络测试。

V2.2 视觉回归运行 `node maintenance/test-v2.2.cjs`，默认输出 `docs/v2.2/after`；`HOWTO_PHASE=before` 可记录修改前基线。它覆盖六种宽度、两种主题、页头对齐、装饰箭头数量、16–64px 的 1x/2x 符号截图和像素检查，以及 reduced motion 下的旧文章锚点与刷新。品牌资源位于 `images/brand`；修改 SVG 后先用 `node maintenance/render-brand.cjs` 导出 favicon、Apple 图标和社交预览，再运行目录构建。两条命令使用相同的 Playwright / Chrome 环境变量，不引入网站运行时依赖。

Docsify 4.13.1 的旧 Hash 锚点会自行启动 500ms JavaScript 动画；阅读插件在 reduced motion 下保留原事件重置流程，仅跳过该动画，改用原生即时定位。无图表文章的普通模式保持原行为，后续升级框架须同时回归两种行为。

含 Mermaid 的文章也使用即时锚点，避免旧动画的固定终点覆盖图表加载后的正确位置。图表完成后仅对未被读者操作打断、且地址未变化的深链接补定位；普通无图表文章仍保留原动画。运行 `node maintenance/test-anchor-stability.cjs` 可验证延迟图表、静态/旧入口、桌面/移动和读者滚动取消补定位。发布后精确尺寸矩阵使用 `node maintenance/test-v2.2-final.cjs`；环境变量与上述脚本相同，默认截图位于 `docs/visual-qa/local`。`--http-only` 仅对比 HTTP 资源，`--matrix-only` 跳过资源对比；`HOWTO_BASELINE=1` 用于记录未修复线上版本的已知问题，不代表通过验收。

提交后仍需待 GitHub Pages 完成部署，在实际域名复查首页、搜索索引版本与代表文章。静态检查通过不等于线上部署已完成；本地验收后不自动推送。

V2.2.1 图片阅读回归运行 `node maintenance/test-v2.2.1.cjs`：覆盖六种精确视口、两种主题、旧路由及静态文章的适应窗口/原始尺寸切换、局部滚动、键盘与触摸平移、关闭后的焦点返回、重开复位，以及小图、竖图与横屏。复制按钮使用内侧焦点边框，避免被代码容器裁切。环境变量与上述浏览器脚本相同；默认输出 `docs/visual-qa/v2.2.1/reading`。图标沿用 `images/icons/LICENSE` 下的 Lucide 资源，不增加运行时依赖。

发布后深度精修专项运行 `node maintenance/test-final.cjs`，默认输出 `docs/visual-qa/final/focused`。它验证无 JavaScript 的首页/专题/路径/目录，静态与旧入口的 canonical、四组桌面/移动深浅色检索、实体字符摘要、键盘复制、首页回顶，以及延迟加载 Docsify 时的初始内容与接管。通用精确尺寸矩阵现包含静态专题和路径；`test-v2.2-final.cjs --http-only` 不依赖 Playwright，只需 Node.js。

最新提交质量回归运行 `node maintenance/test-latest.cjs`：覆盖桌面/移动、深浅色下的旧 `.md` 专题与路径高亮、输入后立即跳转文章（包含延迟响应）、刷新与返回，以及清空加载中的首页搜索。结果中的 URL、正文标题与异常一并保存，不能只凭截图判断异步路由是否一致。

HTTP/产物/DOM 三方验证运行 `node maintenance/test-seo-response.cjs`，覆盖首页、静态目录及七篇代表文章的新旧入口，并检查真实 HTTP 404。默认比较当前工作区；核验已部署版本时设置 `HOWTO_URL` 和精确的 `HOWTO_COMPARE_REF`，从该 Git 提交读取对比 HTML，避免把未发布修复误判为线上漂移。输出到 `HOWTO_SCREENSHOTS` 指定目录，默认 `docs/visual-qa/latest/after/responses`。该检查不访问 Search Console，不能据此宣称已经收录。

# 收录日期

首页“最近收录”使用文章的 `addedOn`（YYYY-MM-DD），按日期倒序排列，同日按编号倒序。历史日期取 Git 首次新增该文章的日期，不使用会议日期或后续校订日期；新增精选项必须补齐此字段。
