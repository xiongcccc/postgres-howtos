# 最新提交深度 Review

日期：2026-10-25（Asia/Shanghai）。下文保留以 `5e6ec69` 为基线的发布前审查快照，当时尚未提交、推送或部署；不是重新设计网站。修复已随后按用户授权发布为 `f0ea4c4`，发布结果另见 [正式站验收](release-verification.md)。

## 结论与问题

未发现部署错版、静态正文缺失、全站 canonical 指向首页或技术代码被损坏的 P0 问题。复现并修复 3 个交互缺陷；另外补齐 HTTP 错误验收断言。

### R1 · P1 · 离开搜索页后，延迟任务串改文章 URL

- 位置：基线 `scripts/finder.js:73` 的 `update()`、`:80` 的输入防抖；修复位于当前 `scripts/finder.js:46`、`:58`、`:79`、`:104`。
- 复现：打开 `#/docs/find?q=work_mem`，输入 `xmin` 后在 120ms 内点击仍显示的 #92 结果。文章响应正常和延迟 350ms 都能触发。
- 实际：快速响应下，正文已经是「work_mem 调优」，地址却被旧任务写成 `#/docs/find?q=xmin`，并抛出 `Cannot read properties of null (reading 'dataset')`。延迟响应下，也出现错误地址和未完成文章增强。
- 预期：地址、正文、复制链接及刷新结果始终属于 #92。
- 原因：`render()` 原来仅检查 DOM 是否连接，`update()` 在改写 history 前没有检查所属路由；Docsify 请求新文章时，旧搜索 DOM 可能暂时仍在页面上。
- 修复：用 DOM 连接状态和当前路由共同判断搜索实例是否仍有效；写 history、绘制异步结果前检查；路由恢复和同步更新时清除防抖任务。保留共享全文索引缓存，不增加新生命周期框架。
- 影响：桌面/移动、深浅色均可触发，损害结果导航、书签及刷新。是相关模块的既存缺陷，`finder.js` 未在 `36c598a` 中改动，不能归因于该提交引入。
- 证据：`../visual-qa/latest/before/boundaries.json` 与 `../visual-qa/latest/after/boundaries.json`。新增测试同时检查跳转后的 URL/H1、刷新和后退，不只看截图。
- 状态：已修复。

### R2 · P2 · 旧 `.md` 专题和路径入口缺少当前导航状态

- 位置：基线及当前 `scripts/site.js:67`；侧栏基线 `scripts/reading.js:32`，当前 `:32`–`:33`。
- 复现：直接访问 `#/docs/topics.md` 或 `#/docs/paths.md`，移动端打开抽屉。
- 实际：内容与 canonical 正确，但 Header、Sidebar 的 `aria-current="page"` 都为空。
- 预期：和无 `.md` 的同一页面保持相同高亮及辅助技术状态。
- 原因：当前路径直接和规范路径比较，没有消除可选扩展名。
- 修复：只在两处导航比较中去除末尾 `.md`；不改历史 URL、不重写全局路由及文章锚点。
- 影响：兼容入口的状态提示；链接和正文并未失效，因此不列为 P0/P1 路由故障。不能据现有证据断言仅本次提交引入。
- 证据：边界数据中的 8 个 `alias-*` 用例及对应修改前后截图。
- 状态：已修复。

### R3 · P2 · 清空正在加载的首页搜索后，忙碌状态未清除

- 位置：基线 `scripts/finder.js:58` 的首页空状态提前返回；当前 `scripts/finder.js:63`。
- 复现：延迟全文索引请求，在首页输入关键词，等待 `aria-busy="true"`，再清除筛选。
- 实际：结果已清空、状态提示已清除，但结果区域仍声明忙碌。
- 预期：没有关键词、没有结果任务时，`aria-busy="false"`。
- 修复：在空状态提前返回前统一设置忙碌属性。
- 影响：辅助技术反馈；不是可见文字或全文检索不可用。与 R1 属于同一相关模块的既存缺陷。
- 证据：边界数据中的 4 个 `clear-loading-search` 用例。
- 状态：已修复。

### 验收加固 · HTTP 错误不得漏检

`maintenance/test-v2.2-final.cjs:162` 原来只在普通模式断言控制台错误，收集到的 `httpErrors` 没有独立断言。并非已经发现线上资源 404，而是失败保护不充分。现增加 `httpErrors` 必须为空的断言；基线记录模式仍与正常通过模式明确区分。

## Git 与部署基线

| 项目 | 本轮核验结果 |
| --- | --- |
| 分支 | `codex/site-redesign` |
| 起始工作区 | 干净，无用户未提交修改 |
| HEAD | `5e6ec69844ed42b420310a4d27a917e5fedfb6d4` |
| `origin/master` | 获取后与 HEAD 相同 |
| 实现审查范围 | `eb067abd83f9b5f5efc25865c6618b4b9a98d3f5..36c598aaf8a7cca594b9efe8b073da08a0c6e2cf` |
| 后续文档范围 | `36c598a..5e6ec69`，只有验收报告及证据 |
| 本地验收版本 | 上述 HEAD 加本轮未提交修复；不是新的 Commit SHA |
| 线上可核实版本 | Actions 指向 `5e6ec69`，修改前 140 个线上文件逐一与该版本一致 |
| 本轮发布 | 未执行 |

已实际检查 `git status --short`、分支、最近提交、`git show` 和上述 Diff。最近 `5e6ec69` 是文档提交，不能把它当成本轮实现变更。主审查 `36c598a` 的静态发现入口、首页预渲染、HTML 文本提取、元数据、导航，以及直接关联的搜索生命周期。

GitHub Pages 的成功运行和文件哈希详见 [SEO 核验](seo-verification.md)。没有改动主检出目录、本地 master、部署流水线或域名。

## 修改范围

- 运行时：`scripts/finder.js`、`scripts/site.js`、`scripts/reading.js`。
- 回归：新增 `maintenance/test-latest.cjs`、`maintenance/test-seo-response.cjs`；补强 `maintenance/test-v2.2-final.cjs`；维护说明更新于 `maintenance/CATALOG.md`。
- 生成文件：运行目录生成器后，`index.html`、`articles/*/index.html`、`topics/index.html`、`paths/index.html` 更新脚本内容哈希。未手工编辑生成正文。
- 交付：本目录三份报告与 `docs/visual-qa/latest/` 的本轮真实数据、截图。
- 保留：所有编号 Markdown、文章元数据、README、首页文案、CSS、Logo、图片、技术 SQL 和验证说明均未修改。

没有进行与本轮无关的框架迁移、代码抽象或 CSS 重排。现有按需加载索引/Mermaid、固定第三方版本、来源和许可证声明维持不变。

## 回归与风险

新增边界用例修改前 20/20 失败（同 3 个缺陷在四种条件下的展开，不是 20 个不同问题），修改后全部通过。原有普通矩阵修改前也通过，说明仅测正常流程不足以覆盖快速输入后离开的异步竞争。

完整运行清单、尺寸矩阵、正文/代码保真及截图见 [综合验收](production-qa.md)；静态 HTML、HTTP 与 DOM 的分层证据见 [SEO 核验](seo-verification.md)。

遗留边界：未获取 Search Console/Bing 收录数据；未在实体 iPhone Safari、微信内置浏览器、Android 或 Windows 上运行；没有用本轮前端检查代替 PostgreSQL 实验复验；未逐条做全站外部来源链接的可用性巡检，也未声称完成第三方依赖的漏洞审计。本地修复需用户另行授权发布，线上当前仍是原始 `5e6ec69`。
