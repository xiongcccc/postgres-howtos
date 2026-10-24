# PostgreSQL Howto 标识

原创“折页 H”是本站的独立标识，不是 PostgreSQL 官方大象或其变体。

| 文件 | 用途 |
| --- | --- |
| `logo.svg` / `logo-dark.svg` | 完整标识：符号与字标；SVG 文本便于继续编辑，不下载外部字体 |
| `symbol.svg` / `symbol-dark.svg` | 单路径符号；同时作为移动端的紧凑版本，不另造图案 |
| `favicon.svg` | 标签页符号，按浏览器系统明暗偏好调整颜色 |
| `favicon-32.png` | 不支持 SVG favicon 的浏览器回退 |
| `touch-180.png` | Apple 主屏幕图标 |
| `social.svg` / `social.png` | 1200×630 分享预览源文件与位图导出 |

核心符号的画板为 32×32，几何范围 x=4–28、y=5–27。无位图嵌入、细线或字体依赖。深浅版本只换颜色，不改变路径。页头使用同一符号与可访问的 HTML 字标；阅读主题切换不依赖操作系统切换。

完整标识和分享图使用可编辑的文本字标，字体优先 Inter / Noto Sans SC，缺失时使用系统字体；不向外部字体服务请求文件。符号本身不依赖字体，跨平台不会因字体缺失变形。

修改源 SVG 后，使用现有 Playwright / Chrome 导出兼容位图，再构建目录：

```sh
node maintenance/render-brand.cjs
node maintenance/build-catalog.mjs
node --test maintenance/test-catalog.cjs
```

Playwright 与 Chrome 路径的环境变量见 `maintenance/CATALOG.md`。导出工具同时更新 `raster-manifest.json`，测试会核对 SVG 来源和 PNG 的摘要及尺寸。普通文章更新不需要重新导出品牌图片。

SVG、PNG、Apple 图标与社交图的引用都由现有构建添加内容哈希。旧插画文件保留供历史引用，但不再用于当前页头、favicon 或分享元数据。
