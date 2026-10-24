# V2.2.1 浏览器证据

本目录是 2026-10-24 本轮实际运行的截图与数据，不沿用上一轮截图。Chrome 155.0.8059.86；基线提交 `c9e4e9c2b5e2a1b758d7745dedb6711f13f35f8b`；本地地址 `http://127.0.0.1:4176/`。深浅主题通过独立上下文中的本地设置确定，统计请求在测试中屏蔽。

## 目录

- `before/`：修改前完整 168 次页面检查的数据、首页全页截图，以及实际发现的图片预览和焦点问题。
- `production-baseline/version.json`：修改前生产域名 138 项 HTTP 资源与基线工作区的 SHA-256 对比。不是 V2.2.1 发布记录。
- `brand/`：修改前新拍的 Header、16–64px 的 1x / 2x Logo 尺寸图、组合标识和像素数据。现有脚本的 `phase:after` 是 V2.2 工具命名，不表示本轮改了 Logo。
- `reading/`：修改后的原始尺寸 / 适应窗口、复制按钮焦点截图与 24 组专项检查结果。主要截图来自真实 `docs/42` 锁树图片。
- `after/`：修改后六尺寸双主题的完整矩阵数据及保留的代表截图，包括全页首页、专题、路径、搜索、长文、SQL、表格、目录、侧栏与页脚。
- `regression/`：原有回归脚本的运行结果、日志和测量数据。

每份矩阵 JSON 都保留实际检查尺寸、路由与指标。只保留代表截图，避免将每次重复的全部长页面图片都纳入仓库。其余本轮原始截图位于本机 `/tmp/howto-v221-before` 与 `/tmp/howto-v221-regression`，可用下列命令重新生成。

## 看什么

1. 比较 `before/image-viewer-390-dark.png` 和 `reading/image-original-390x844-dark.png`：原先小字缩在 324px 图片里；现在可用 1409px 原始宽度局部平移。
2. 比较 `before/code-focus.png` 和 `reading/code-focus-1440x900-light.png`：复制按钮焦点轮廓从外侧被截断改为完整内框。早期探针截图为 2x，后者为 CSS 像素截图，不用于逐像素差分。
3. `before/home-*` 与 `after/home-*`：首页架构和视觉布局保留。
4. `after/table-390x844-dark.png`：表格内部横向滚动，不挤压或隐藏列。
5. `after/toc-1440x900-light.png` 和 `after/anchor-refresh-390x844-dark.png`：目录高亮、长标题、刷新后的 Header 避让。
6. `after/long-full-light.png` / `after/long-full-dark.png`：逻辑复制整篇文章的排版节奏，不只验收首屏。

## 复现

复用本机已有 Node、Playwright 和 Chrome，不需要为网站安装新依赖。设置 `HOWTO_URL`、`PLAYWRIGHT_PACKAGE`、`CHROME_PATH` 和每次独立的 `HOWTO_SCREENSHOTS` 输出目录；变量的含义见 `maintenance/CATALOG.md`。

```sh
node maintenance/build-catalog.mjs
node --test maintenance/test-catalog.cjs
node maintenance/build-catalog.mjs --check
node maintenance/test-site.cjs
node maintenance/test-v2.1.cjs
node maintenance/test-v2.2.cjs
node maintenance/test-v2.2-final.cjs
node maintenance/test-anchor-stability.cjs
node maintenance/test-v2.2-touch.cjs
node maintenance/test-v2.2-details.cjs
node maintenance/test-v2.2.1.cjs
git diff --check
```

Logo 尺寸图为真实浏览器中的组件测试板，不是假造的产品截图。专项测试还临时注入已有小 SVG 和竖图作为尺寸边界夹具，`reading.json` 的 `fixtures` 与真实文章截图分开记录；未修改文章或发布这些夹具。

Chromium 的 CDP `touchStart / touchMove / touchEnd` 验证了实际滚动偏移，不只是设置 `scrollLeft`。这仍是模拟触摸，不能代替真机 Safari / 微信测试。本地性能数值只描述本机条件，不是线上或弱网承诺。
