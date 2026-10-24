# 本轮验收证据

日期：2026-10-24。基线 `eb067abd83f9b5f5efc25865c6618b4b9a98d3f5`。Chrome 155.0.8059.86，独立浏览器配置，统计请求屏蔽；移动场景为视口/触摸模拟，不是真机截图。

## 修改前

`before/` 保存本轮修改前新采集的基线，不复用往轮截图。

- `manifest.json`：来源路径、文件大小和 SHA-256。
- `matrix.json`：168 组页面、12 组组件，包含全部视口和主题。
- `version.json`：本地基线 HTTP 资源核对。
- `production-http.json`：线上 138 个 HTTP 文件与基线一致。
- `production-browser.json`：线上真实浏览器核验，另有等待全文索引后的 `fullText` 记录；Hash 切换未产生新 HTTP 响应时，status 为 null，不伪记 200。
- `seo.json`、`browser.json`、`home-no-js.png`、`search-entities.png`：首页缺少完整初始内容、搜索实体残留、静态图片 alt 的基线。
- `production-*.png`：实际域名的首页和全文检索截图。它们是旧版基线，不是本轮改动已上线的证据。

## 修改后

`after/` 对应最终未提交工作区及本地 `http://127.0.0.1:4176/`，没有推送或部署。

- `manifest.json`：保留截图和数据的来源及哈希。
- `version.json`：140 个 HTTP 文件逐个与最终工作区一致。
- `matrix.json`：192 组页面、12 组组件的布局、颜色、溢出及错误记录。
- `results.json`、八份测试 `.log`：最终八套既有浏览器回归全部退出码为 0。
- `focused.json`：无 JS 页面、静态/旧入口、四组主题/宽度的 52 次检索、延迟接管和启动指标。
- `reading.json`：24 组图片阅读；其他专项 JSON：触摸、锚点、字体、品牌和交互记录。
- `seo.json`：初始 HTML 的标题、大小、正文和静态链接样本。
- `source-integrity.json`：122 个文章、元数据、首页模板及品牌源文件与 HEAD 字节一致。
- `visual-comparison.json`：七组代表截图的前后 PNG SHA-256 完全一致。
- `v2.1-metrics.json`：109 篇无 JS 文章、650 个代码块、本地搜索与实验性能数据。
- `layout-shift-before.json`、`bootstrap-before-fix.log`：实施中出现、已修复的首页启动位移，不属于线上基线。最终复测见 `focused.json` 和 `v2.1-metrics.json`。

保留了桌面和移动首页、深浅主题、专题、路径、静态目录、搜索、六种文章样本、SQL、表格、TOC、侧栏、图片原始尺寸及无 JS 截图。为控制仓库体积，不把完整矩阵每一页的 PNG 全部重复存入 Git；完整场景数以保存的 JSON 和日志为准。

部分首页截图是全页长图，查看时应放大到实际像素。不要据缩略图判断字号或对比度。

这些记录不代表 Google 实际收录、Lighthouse 分数、线上 CWV 或真机 Safari 已验收。详见 [审计报告](../../final-review.md) 和 [精修报告](../../final-polish-report.md)。

## 发布后

后续经用户授权，`36c598a` 已推送并完成 Pages 部署。发布后的实际域名结果单独保存于 `production/`，与上面的本地及修改前基线分开。结论见 [正式站验收](../../final-production-check.md)。
