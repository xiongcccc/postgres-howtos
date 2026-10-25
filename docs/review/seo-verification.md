# SEO 与线上版本核验

日期：2026-10-25（Asia/Shanghai）。机器数据的 `checkedAt` 使用 UTC，可能显示 2026-10-24。本轮只读核验生产；修复仅在本地。

## 版本与发布链路

| 检查 | 证据与结论 |
| --- | --- |
| HEAD / `origin/master` | `5e6ec69844ed42b420310a4d27a917e5fedfb6d4` |
| 相关实现 | `36c598aaf8a7cca594b9efe8b073da08a0c6e2cf`，最新 HEAD 只补生产验收材料 |
| Pages 运行 | [40102431557](https://github.com/xiongcccc/postgres-howtos/actions/runs/40102431557)，上述 HEAD，`completed/success` |
| CI 运行 | [40102431806](https://github.com/xiongcccc/postgres-howtos/actions/runs/40102431806)，上述 HEAD，`completed/success` |
| 线上字节核验 | 修改前 140 个文件全部 HTTP 200，SHA-256 与当时工作区即 HEAD 一致 |
| 线上 HTML 三方比对 | 36 组 HTTP / `git show 5e6ec69:文件` / JS DOM 比对通过 |
| 本地修复 | HEAD 加未提交修改；140 个本地 HTTP 文件与当前工作区一致，另有 36 组三方比对通过；尚未发布 |

实际 Git remote 为 `xiongcccc/postgres-howtos.git`；用户惯用的 singular 仓库地址仍在 README 等入口保留。没有更改远程地址。

构建由 `maintenance/build-catalog.mjs` 生成仓库内的静态文件；站点不需要 Node 服务。仓库有根目录 `.nojekyll`、`CNAME`（`postgres-howto.cn`）、`index.html`、`articles/`、`topics/`、`paths/`。仓库内 Actions 负责 Node 20 的目录/SEO 检查，push、pull_request 均触发；实际 Pages 运行路径是 GitHub 的 `dynamic/pages/pages-build-deployment`，不是新加的框架部署流水线。

未认证访问 Pages 管理 API 返回 404，不能据此认定站点 404，也不能声称直接读取了后台的 branch/folder 设置。成功部署运行与公开文件逐字一致能核实已发布版本；根目录发布结构有充分佐证，后台设置本身标记为未直接核实。

本轮没有增加手填 `version.json`：成功运行 SHA 和 140 文件指纹已能核实版本，另加固定 SHA 容易在下次发布失真，也没有必要为此改变 Pages 发布方式。证据中的 `version.json` 是验收输出，不是公开站点版本端点。

## 路由与三种内容

| 入口 | 原始 HTTP / 构建 HTML | JavaScript 后 DOM |
| --- | --- | --- |
| `/` | 200，完整首页、专题、路径、最近文章及真实链接；一个 H1 | Docsify 接管，挂载搜索；无重复主正文 |
| `/#/docs/编号`、`.md` | fragment 不传给服务器，响应仍是共享根 HTML | 对应完整文章、中文标题、来源、目录、文章 schema 与独立 canonical |
| `/articles/` | 200，全部 109 个编号文章的静态链接 | 保留静态目录，提供主题/搜索等渐进增强 |
| `/articles/编号/` | 200，完整技术正文、来源、版本说明、代码、TOC、JSON-LD | 保留原正文；增强图片、复制、目录、图表等交互 |
| `/topics/`、`/paths/` | 200，完整静态分类/路径、原生章节链接 | 保持正文、导航与自引用 canonical；不重新载入 Docsify |
| `/articles/99999/` | 线上与本地均为真实 HTTP 404 | 不把缺失文章回退成 200 首页 |
| `/#/docs/does-not-exist` | SPA 外壳本身 200 | 可恢复的未找到页面，`noindex,follow`；不是静态 404 状态 |

36 组比较涵盖桌面浅色和移动深色下的首页、三种静态目录，以及 #1、#7、#42、#97、#98、#102、#105 的独立/历史入口。记录 title、description、canonical、H1、初始段落、正文摘要指纹、内部链接、代码与结构化数据。

初始 HTTP 与对应 Git 产物逐字相同。静态页执行 JS 后 title、description、H1、schema 不变；所有初始段落仍在，非 Mermaid 代码文本逐字不变。Mermaid 从源码变为 SVG，源码仍可展开，不把该预期变化当作正文丢失。首页搜索与旧入口的链接形态变化是既有渐进增强，初始 HTML 已经提供无 fragment 的可发现路径。

详见 `../visual-qa/latest/online/responses.json` 和 `../visual-qa/latest/after/responses.json`。全部 109 篇的初始代码保真还由 SEO 单测及无 JS 浏览器逐块核验。

## Canonical、Sitemap 与可发现性

- 独立文章初始和最终 canonical 均为各自的 `https://postgres-howto.cn/articles/编号/`，未统一指向首页；旧文章 DOM 同样声明对应规范入口。
- `/topics/`、`/paths/`、`/articles/` 各自引用自身；旧专题和路径声明对应静态规范页。
- 根共享外壳初始不硬编码 canonical，因为服务端无法看到 fragment；运行时根据首页或具体文章补齐唯一 canonical。没有先声明首页、再在文章页改成另一个规范地址。
- Sitemap 实际返回 200，共 113 个唯一 URL：首页、3 个目录页、109 篇编号文章。只包含规范无参数、无 fragment URL，不包含不存在的编号。
- 所有规范入口都能经初始 HTML 内部链接发现；测试遍历链接图和章节锚点，不仅检查 XML 中是否出现字符串。140 文件线上核验覆盖了 Sitemap 对应的全部静态 HTML 文件。
- Sitemap 不提供 `lastmod`，没有用构建时间伪装文章更新时间。文章 JSON-LD 的 `datePublished` 使用元数据的 `addedOn`，不是生成器临时编造。
- 新文章进入同一元数据后，构建器会在同一循环生成独立页、目录与 Sitemap；测试按当前元数据遍历全部文章，要求编号文档与元数据集合完全一致，不维护另一份 SEO 文章清单。
- 目录与文章没有初始 `noindex`；搜索/筛选状态和缺失的旧 Hash 路由在运行时设 `noindex,follow`。`robots.txt` 允许抓取并指向真实 Sitemap。

这些设计与 Google 对预渲染、唯一 canonical、fragment 链接和错误页的建议一致；Google 将抓取、渲染、索引分为不同阶段，不能从 HTTP 200 推出已经收录。[Google JavaScript SEO 文档](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)

## 外部抓取工具为什么仍显示旧内容

本轮再次观察到两个不同结果：

1. 外部页面提取工具打开根地址，仍显示旧 title 和早期简介，标记 `Crawled: yesterday`；打开专题、路径、独立文章时给出工具内部「不可访问」信息，没有提供可核实的源站 HTTP 状态。
2. 直接 HTTP 请求、Chrome-like UA、Googlebot 字符串 UA 三种请求方式，共 12 次得到正确完整 HTML，全部 200、字节与 HEAD 一致；真实浏览器也显示当前内容。响应为 GitHub Pages，`Cache-Control: max-age=600`，记录中 MISS/HIT 轮次均为正确字节。

因此，已将差异定位到「外部提取工具返回的内容」与「本轮直接获取的站点响应」之间；没有证据支持当前部署错版、站点只靠空外壳或文章正文缺失。不能进一步断言该工具内部究竟是缓存、代理、历史索引还是提取策略问题，其内部机制不可见，仍未验证。

将 User-Agent 改为 Googlebot 只能排查明显的 UA 差异，不能冒充真实 Googlebot，也不能替代其实际渲染或索引记录。没有 Search Console/Bing 权限，本报告不判断抓取队列、已收录数量或排名。观察记录见 `../visual-qa/latest/online/external-fetch-observation.json`、`../visual-qa/latest/online/http-variants.json`。

## 可重复执行

先按 `maintenance/CATALOG.md` 配置已有 Playwright / Chrome；本地服务位于 4176。

```sh
node maintenance/build-catalog.mjs --check
node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs
node maintenance/test-v2.2-final.cjs --http-only
node maintenance/test-seo-response.cjs
```

核验生产时必须指定被核验的已发布提交，不拿未提交修复和线上旧文件做「一致」比较：

```sh
HOWTO_URL=https://postgres-howto.cn/ \
HOWTO_COMPARE_REF=5e6ec69844ed42b420310a4d27a917e5fedfb6d4 \
HOWTO_SCREENSHOTS=/tmp/howto-production-seo \
node maintenance/test-seo-response.cjs
```

28 项目录/SEO 单测由既有 CI 自动执行；新增三方浏览器脚本是发布前/后显式验收，未偷偷增加 CI 浏览器安装或生产服务。版本核验不包含生产数据库访问。
