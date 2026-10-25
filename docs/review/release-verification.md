# 搜索与旧入口修复：正式站验收

日期：2026-10-25（Asia/Shanghai）。正式地址：[postgres-howto.cn](https://postgres-howto.cn/)。本记录是在用户授权提交、推送并完成 Pages 部署之后，直接对正式域名进行的验收，不使用本地通过或旧线上基线代替本次结果。

## 发布版本

- 修复提交：`f0ea4c453d187d82cbc11f49974f91a6694fa0d1`，`fix: prevent stale search updates and restore legacy navigation states`。
- 远程 `master` 从 `5e6ec69` 正常快进至该提交，没有强推或改写历史；另一个工作目录的本地 master 未修改。
- [目录与 SEO CI](https://github.com/xiongcccc/postgres-howtos/actions/runs/40164378951)：completed / success。
- [Pages 构建与部署](https://github.com/xiongcccc/postgres-howtos/actions/runs/40164378538)：completed / success。
- 部署后先比对首页及关键脚本等 8 个原始 URL，再核验 140 个文件：全部 HTTP 200、SHA-256 与实现提交一致。没有用缓存绕过参数宣称部署成功。
- 全文索引修订为 `c19fb2e9005eac97`，文章内容未变化，索引版本无需人为递增；运行时文件内容哈希已经更新。

## 两项重点验证

### 快速点击搜索结果不再串改 URL

正式站执行原问题的复现过程：打开 `#/docs/find?q=work_mem`，输入 `xmin` 后，在 120ms 防抖完成前立即点击仍显示的 #92 结果。

1440px 桌面、390px 移动 × 浅色/深色 × 正常响应/人为延迟文章响应 350ms，共 8 次均通过：

- 跳转后的地址始终是 `#/docs/92`，正文标题为「work_mem 调优」。
- 刷新仍是 #92，返回能恢复原搜索页与关键词。
- 没有再被写回 `#/docs/find?q=xmin`，没有旧任务访问已销毁 DOM 的异常。
- 延迟场景均确认实际拦截了 1 次文章请求，未用缓存命中冒充慢响应。

这些结论基于 URL、标题、刷新、历史和异常记录，不仅凭文章截图判断。

### 旧 `.md` 入口正确高亮

直接打开 `#/docs/topics.md`、`#/docs/paths.md`，覆盖桌面/移动、深浅色，共 8 次均通过。Header 和 Sidebar 分别只将「专题」或「学习路径」设置为当前页面；移动端实际展开抽屉后再截图。

另有 4 次加载中清空首页搜索的检查，结果区域均恢复 `aria-busy="false"`。三类边界共 20/20 通过，未捕获浏览器脚本异常。

## 首页、搜索与文章

| 范围 | 正式站结果 |
| --- | --- |
| 首页与导航 | `/`、`#/`、`#/README`、首页问题/专题/路径入口、计数及最近收录日期正常，没有旧封面或重复正文 |
| 全文搜索 | 13 个查询 × 桌面/移动与深浅色，共 52 次命中预期文章；含 `work_mem`、`EXPLAIN BUFFERS`、`xmin`、`vacuum freeze` 等 |
| 搜索交互 | 快捷键、键盘选择、筛选、清除、显示更多、前进后退和刷新恢复正常；模拟索引失败后的降级与重试通过 |
| 旧文章入口 | 全部 109 个编号路由通过；中文标题、来源、主专题、当前文章高亮与图表正常；另核验历史 `.md` 文章入口 |
| 静态文章与目录 | 首页、三种目录及七篇代表文章的新旧入口，共 36 组 HTTP/提交产物/JS DOM 对照通过；初始正文、代码及 canonical 正确 |
| 阅读交互 | 代码复制、SQL/EXPLAIN 局部横向滚动、TOC 点击/刷新、图片查看、字号设置、抽屉及对话框焦点恢复通过 |
| 错误入口 | `/articles/99999/` 返回真实 HTTP 404；不存在的旧 Hash 路由显示恢复页并设置 `noindex,follow` |
| 精确尺寸矩阵 | 1440×900、1280×800、1024×768、768×1024、390×844、360×800 × 深浅色，204 组页面及 12 组组件全部通过；浏览器异常、意外控制台错误及 HTTP 资源错误均为 0 |

运行脚本为 `test-latest.cjs`、`test-site.cjs`、`test-final.cjs`、`test-seo-response.cjs` 和 `test-v2.2-final.cjs`，正式域名执行退出码全部为 0；未启用容错基线模式。

## 证据与范围

最终数据及代表截图保存在 `docs/visual-qa/latest/release/`；与 `online/` 中的修改前 `5e6ec69` 记录分开，保留历史证据。

- [部署状态](../visual-qa/latest/release/deployment.json)、[140 个文件指纹](../visual-qa/latest/release/version.json)、[各脚本退出码](../visual-qa/latest/release/results.json)。
- [搜索竞态与 `.md` 高亮的 20 个边界记录](../visual-qa/latest/release/boundaries.json)、[52 次搜索及静态入口](../visual-qa/latest/release/focused.json)、[36 组 HTTP/产物/DOM 对照](../visual-qa/latest/release/responses.json)、[精确尺寸矩阵](../visual-qa/latest/release/matrix.json)。
- [桌面旧专题入口](../visual-qa/latest/release/alias-topics-1440-light.png)、[手机暗色旧路径入口](../visual-qa/latest/release/alias-paths-390-dark.png)。
- [快速点击后的文章](../visual-qa/latest/release/navigated-fast-1440-light.png)、[延迟响应后的手机文章](../visual-qa/latest/release/navigated-slow-390-dark.png)。
- [正式站首页](../visual-qa/latest/release/home-1440x900-light.png)、[手机暗色搜索](../visual-qa/latest/release/search-390x844-dark.png)、[360px 执行计划](../visual-qa/latest/release/sql-360x800-dark.png)、[章节刷新定位](../visual-qa/latest/release/anchor-refresh-390x844-dark.png)。

本轮使用独立 Chrome 配置，手机条件为移动视口和触摸模拟，不冒充实体 iPhone Safari/微信测试。不蒜子被屏蔽，不评价统计准确性；不据本次前端验收宣称 Google/Bing 已收录。

发布验收阶段没有再改动运行时代码、文章正文、CSS、Logo 或生成 HTML。本报告及截图作为后续文档提交保存，不改变已验收的运行时文件。
