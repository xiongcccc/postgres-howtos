# 最新提交验收证据

本轮检查日期：2026-10-25（Asia/Shanghai）；JSON 里的 ISO 时间为 UTC。审查基线为 `5e6ec69844ed42b420310a4d27a917e5fedfb6d4`。原审查阶段没有提交、推送或部署；随后用户授权发布 `f0ea4c4`，新生产数据另存 `release/`。

## 数据分层

- `before/`：本轮修改前、干净 HEAD 的真实本地矩阵及缺陷复现。普通 192 页矩阵通过，但 20 个边界用例失败，不能把基线模式的正常退出误读为通过。
- `after/`：本轮未提交修复的本地验收。最终矩阵扩展到 204 页，包含要求中准确的 #97 bpftrace 文章，另保留 #98 的横向表格样本。`runs.json` 记录首轮整套退出码；`logs/matrix-initial-192.log` 是扩展前日志，最终扩展重跑以 `matrix.json` 的 204 条通过记录为准。
- `online/`：修改前已发布版本 `5e6ec69` 的只读证据。不是本轮修复的生产验收。包括 140 个文件指纹、GitHub Actions、UA 对照、36 组原始 HTTP/产物/DOM 对照及 52 次检索。
- `release/`：用户授权发布后的正式站 `f0ea4c4` 证据，重点记录快速点击搜索结果、旧 `.md` 入口高亮，以及首页、搜索、文章与精确尺寸矩阵；不覆盖前面的历史数据。
- `manifest.json`：从本轮临时验收目录复制的文件、来源时间、字节数与 SHA-256。原始 JSON 保留原字段，不将未提交版本伪造成新 Commit。
- `after/integrity.json`：确认编号正文、元数据、README、CSS、品牌资源等未改；生成 HTML 只更新了三个运行时脚本的内容哈希。
- `after/catalog-summary.json`：由实际元数据计算文章、专题主归属/跨专题与学习路径数量。

报告入口：[Code Review](../../review/latest-commit-review.md)、[SEO 核验](../../review/seo-verification.md)、[综合验收](../../review/production-qa.md)、[正式站发布验收](../../review/release-verification.md)。

## 前后对比

| 场景 | 修改前 | 修改后 |
| --- | --- | --- |
| 旧专题 `.md` 导航状态 | [桌面浅色](before/alias-topics-1440-light.png) | [桌面浅色](after/alias-topics-1440-light.png) |
| 旧路径 `.md` 抽屉状态 | `before/boundaries.json` 中导航状态为空 | [移动深色](after/alias-paths-390-dark.png) |
| 输入后立即点击 #92 | [文章截图](before/search-leave-fast-1440-light.png) | [文章截图](after/navigated-fast-1440-light.png) |

搜索竞态主要表现为地址与正文不一致，截图本身不足以证明修复；应同时查看 `before/boundaries.json` 中的 `afterNavigation`、错误信息，和 `after/boundaries.json` 中的正确 URL、标题及 `refreshAndBack`。清空搜索的忙碌状态同样以 `busy` 属性记录为准。移动端旧路径的基线截图截于抽屉展开过渡，不作为其高亮证据；修改后专项会等待抽屉实际进入视口再截图。

## 阅读截图

- [首页 1440 浅色](after/home-1440x900-light.png)、[首页 390 深色](after/home-390x844-dark.png)。
- [1280 深色](after/home-1280x800-dark.png)、[1024 深色](after/ordinary-1024x768-dark.png)、[768 浅色](after/autovacuum-768x1024-light.png)、[360 深色执行计划](after/sql-360x800-dark.png)。
- [pg_stat_statements](after/ordinary-1440x900-dark.png)、[深入浅出 bpftrace](after/bpftrace-in-depth-390x844-dark.png)、[可横滑表格](after/table-390x844-dark.png)。
- [目录](after/toc-1440x900-light.png)、[章节刷新](after/anchor-refresh-390x844-dark.png)、[移动抽屉](after/sidebar-390x844-dark.png)。
- [原图查看](after/image-original-390x844-dark.png)、[适应窗口](after/image-fit-1440x900-light.png)、[复制焦点](after/code-focus-390x844-dark.png)。
- [静态专题](after/static-topics-390x844-dark.png)、[静态路径](after/static-paths-1440x900-light.png)、[无 JS 首页](after/no-js-home-390.png)。

只保存必要截图，完整条件与测量结果在 JSON 中。所有 PNG 均来自真实 Chrome，不是生成图或拼接效果图。移动条件使用 Chromium 触摸模拟，不冒充实体 Safari/微信测试。
