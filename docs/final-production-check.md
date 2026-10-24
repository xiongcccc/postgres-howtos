# 静态发现精修：正式站验收

日期：2026-10-24。正式地址：[postgres-howto.cn](https://postgres-howto.cn/)。本记录对应用户授权提交、推送后，在实际域名执行的检查，不以本地截图或修改前线上基线替代发布后证据。

## 发布版本

- 实现提交：`36c598aaf8a7cca594b9efe8b073da08a0c6e2cf`，`feat: improve static discovery and post-release quality`。
- 远程分支：`master`，从 `eb067ab` 快进推送，没有改写历史或修改另一个工作目录中的本地分支。
- [目录与 SEO 校验](https://github.com/xiongcccc/postgres-howtos/actions/runs/40101565784)：completed / success。
- [Pages 构建与部署](https://github.com/xiongcccc/postgres-howtos/actions/runs/40101565802)：completed / success。

确认 Pages 成功后，先对根首页、两个新目录和全文索引逐项比较内容哈希，再执行完整 HTTP 及浏览器核验。检查使用公开原始 URL，没有通过临时缓存绕过参数宣称部署完成。

## 已核对的发布内容

140 项 HTTP 文件均返回 200，SHA-256 与实现提交一致，覆盖首页、脚本、样式、品牌资源、元数据、搜索索引、Sitemap、robots、109 篇静态文章、文章目录、静态专题和学习路径。

搜索索引版本为 `c19fb2e9005eac97`。新增入口为：

- [静态专题](https://postgres-howto.cn/topics/)
- [静态学习路径](https://postgres-howto.cn/paths/)

## 浏览器复查结果

| 范围 | 正式站实测结果 |
| --- | --- |
| 首页 | 根地址、`#/`、`#/README` 正常；搜索、问题入口、专题、路径、最近收录及数量正确，没有重复正文或旧封面 |
| 搜索 | 桌面/移动、深浅主题共 52 次查询通过；`work_mem`、`EXPLAIN BUFFERS`、`vacuum freeze` 等命中预期文章；正文摘要不再残留转义字符 |
| 搜索交互 | 快捷键、键盘选结果、筛选、清除、显示更多、前进后退及刷新恢复正常；模拟阻断全文索引后，标题回退及重试正常 |
| 文章 | 全部 109 个旧编号路由通过，中文标题、来源、主专题与图表正常；独立静态文章 HTTP 内容与提交一致 |
| 新静态入口 | `/topics/`、`/paths/` 直接打开正常，初始 HTML 各有一个 `#main`，标题与自引用 canonical 正确，无意外 noindex |
| 新旧入口互通 | 旧专题和路径显示对应静态 canonical；静态页的搜索快捷键、手机导航正常，原有文章链接可用 |
| 无 JavaScript | 桌面/移动共 8 组首页、专题、路径及全部文章页面可读；首页链接能进入正确静态章节 |
| 长文与章节 | TOC 跳转及刷新在图表稳定后定位正确，不被固定页头遮挡；代码复制与局部横向滚动正常 |
| 手机暗色 | 360/390px 的首页、搜索、文章、表格、Logo 和新目录正常，无页面级横向溢出 |
| 错误入口 | 不存在的 `/articles/99999/` 返回 HTTP 404；旧 Hash 未找到页面显示站内恢复入口 |

覆盖 1440×900、1280×800、1024×768、768×1024、390×844、360×800 六种视口和深浅两种主题。精确矩阵共 192 组页面、12 组组件全部通过，记录中没有浏览器异常、意外控制台错误或 HTTP 资源错误。

在正式域名分别运行 `maintenance/test-v2.2-final.cjs`、`maintenance/test-final.cjs`、`maintenance/test-site.cjs`，三者退出码均为 0。新目录响应为 `text/html; charset=utf-8`。以上不是仅凭推送成功或本地测试作出的判断。

## 证据

数据与截图单独保存在 `docs/visual-qa/final/production/`：

- [部署与首页内容核对](visual-qa/final/production/deployment.json)
- [140 项 HTTP 资源](visual-qa/final/production/version.json)及[初始 HTML 与 404 响应](visual-qa/final/production/responses.json)
- [浏览器运行记录](visual-qa/final/production/results.json)、[精确尺寸矩阵](visual-qa/final/production/matrix.json)、[新目录与搜索专项](visual-qa/final/production/focused.json)
- [正式站首页](visual-qa/final/production/home-1440x900-light.png)、[手机暗色首页](visual-qa/final/production/home-390x844-dark.png)
- [静态专题](visual-qa/final/production/static-topics-1440x900-light.png)、[手机暗色学习路径](visual-qa/final/production/static-paths-390x844-dark.png)
- [搜索结果](visual-qa/final/production/search-1440x900-light.png)、[手机暗色表格](visual-qa/final/production/table-390x844-dark.png)、[章节刷新定位](visual-qa/final/production/anchor-refresh-390x844-dark.png)

上述代表截图已实际查看。完整场景结果以 JSON 和日志为准，没有把修改前或本地截图复制成正式站证据。

## 验证边界

真实浏览器为本机独立 Chrome 配置，移动场景采用移动视口和触摸模拟；统计请求被屏蔽，不评价统计服务。没有真机 Safari、微信内置浏览器或线上用户 CWV 数据。

独立网页抓取工具仍返回旧缓存首页，并未读取到新目录；该结果不能作为本次部署或实际收录的判断依据。本次发布以正式域名直接 HTTP 响应、Pages 状态及 Chrome 访问为证据，Google/Bing 的实际索引和 canonical 选择仍未验证。

本报告及其证据是发布后的文档补充，不再次修改运行时代码、文章内容或生成页面。
