# V2.2 最终视觉验收证据

采集日期：2026-10-24；Chrome 155.0.8059.86。全部 PNG 来自实际浏览器，不是 AI 生成图。

- `production/`：已发布 `3696e37` 的基线，包含仍存在的刷新定位偏移与侧栏 404。
- `local/`：发布前的本地修复版，现已随 `7ea9ced` 发布。页面、样式与 Logo 保留，仅修改图表深链接定位和侧栏 alias。
- `release/`：修复 `7ea9ced` 上线后的实际正式站结果，包含版本比对、严格模式矩阵、独立侧栏网络记录与章节刷新截图；不覆盖旧生产基线。
- `brand/`：最终代码的 16–64px / 1x/2x 标识、完整字标及页头记录。
- `anchors/`：主动延迟图表加载、读者滚动取消补定位的专项。
- `details/`：3x 手机页头、技术图片、完整长文、文末导航、实际字体、SEO 与触控手势。
- `regression/`：修复后旧路由与全部无 JavaScript 静态文章回归记录。
- `version-comparison.json`：源码摘要与生成差异范围，确认 109 篇静态正文未变。

生产与本地分别执行 6 个精确视口 × 2 个主题 × 14 个页面，完整数据在各自 `matrix.json` 中。这里保留用于审查的全页和组件截图，不重复纳入所有几乎相同的视口快照；其余本机快照归档在 `/tmp/howto-v22-final-full-captures/`，不依赖它们才能阅读报告。

## 主要截图

| 场景 | 截图 |
| --- | --- |
| 桌面首页全页 | [亮色](local/home-1440x900-light.png) · [暗色](local/home-1440x900-dark.png) |
| 手机首页全页 | [亮色](local/home-390x844-light.png) · [暗色](local/home-390x844-dark.png) |
| 360px 首页 | [亮色](local/home-360x800-light.png) · [暗色](local/home-360x800-dark.png) |
| Header / Logo | [1x 尺寸](brand/logo-sizes-1x.png) · [2x 尺寸](brand/logo-sizes-2x.png) · [完整字标](brand/logo-lockups.png) · [3x 手机暗色](details/header-390-dark.png) |
| 专题全页 | [亮色](local/topics-1440x900-light.png) · [暗色](local/topics-1440x900-dark.png) |
| 学习路径全页 | [亮色](local/paths-1440x900-light.png) · [暗色](local/paths-1440x900-dark.png) |
| 搜索 | [桌面全页](local/search-1440x900-light.png) · [360px 暗色](local/search-360x800-dark.png) |
| 普通文章 | [亮色](local/ordinary-1440x900-light.png) · [暗色](local/ordinary-1440x900-dark.png) |
| 长篇文章 | [完整亮色](details/long-full-light.png) · [完整暗色](details/long-full-dark.png) · [1280px 暗色首屏](local/long-1280x800-dark.png) |
| SQL / EXPLAIN | [桌面亮色](local/sql-1440x900-light.png) · [桌面暗色](local/sql-1440x900-dark.png) · [手机暗色](local/sql-390x844-dark.png) |
| 手机表格 | [暗色左侧内容](local/table-390x844-dark.png) · [真实触控滑动后的右侧内容](details/touch-table-390-dark.png) |
| 技术图片与文末 | [手机图片](details/technical-image-390-dark.png) · [暗色文末](details/article-footer-1440-dark.png) |
| 移动交互 | [侧栏](local/sidebar-390x844-dark.png) · [目录](local/toc-390x844-dark.png) · [360px 弹窗](local/communityModal-360x800-dark.png) |
| 关于项目 / Footer | [关于全页](local/about-1440x900-light.png) · [手机 Footer](local/footer-390x844-dark.png) |
| 定位修复前后 | [线上刷新后](production/anchor-refresh-1440x900-light.png) · [本地修复后](local/anchor-refresh-1440x900-light.png)；[手机修改前](production/anchor-refresh-390x844-dark.png) · [手机修改后](local/anchor-refresh-390x844-dark.png) |
| 发布后的正式站 | [首页](release/home-1440x900-light.png) · [搜索](release/search-1440x900-light.png) · [桌面章节刷新](release/anchor-refresh-1440x900-light.png) · [手机暗色章节刷新](release/anchor-refresh-390x844-dark.png) |

手机宽表和执行计划的横向截断是局部滚动窗口，不表示丢失内容。手势专项在真实浏览器发送 touchStart/touchMove/touchEnd 后读取实际位移；仍是 Chrome 模拟，不是真机 Safari。

## 复跑

使用已有 Playwright/Chrome，无需引入网站运行时依赖。配置 `PLAYWRIGHT_PACKAGE` 为已有 Playwright 安装路径，`CHROME_PATH` 为 Chrome 可执行文件，`HOWTO_URL` 为待测站点；`HOWTO_SCREENSHOTS` 指定独立输出目录，避免覆盖已归档证据。

```sh
node maintenance/test-v2.2-final.cjs
node maintenance/test-anchor-stability.cjs
node maintenance/test-v2.2-details.cjs
node maintenance/test-v2.2-touch.cjs
```

最终矩阵的 `--http-only` 只做响应内容与本地 SHA-256 比对，`--matrix-only` 只跑浏览器。未修复的正式站使用 `HOWTO_BASELINE=1` 记录已知缺陷：此模式不是“忽略错误宣布通过”，需要阅读 `tocRefresh` 与 `httpErrors`；其他断言仍执行。正常本地验收不设置它。

`production/` 与 `local/` 是发布前的不同状态；`release/` 是已上线修复版。正式站 168 个页面、12 组组件和 16 组延迟图表场景均通过，侧栏相关 404 为 0。准确结论见 [最终验收报告](../v2.2-final-qa-report.md)与[视觉审计](../v2.2-final-visual-audit.md)。
