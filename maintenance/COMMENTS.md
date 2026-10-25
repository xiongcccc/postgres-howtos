# 文章评论与安全

文章文末通过 [Utterances](https://utteranc.es/) 直接展示和提交评论，数据仍保存在 `xiongcccc/gitalk-comment` 的 GitHub Issues。首页、专题、路径、搜索、关于页和 404 页面不挂载评论，也不请求评论服务。阅读和评论仍依赖 GitHub / Utterances 可访问；发言需要读者授权 GitHub 登录。不需要自建后端，不在网页中配置 OAuth 应用密钥或个人访问令牌。

## 历史评论关联

`data/comment-threads.json` 是公开 Issue 编号映射，不含凭据。`scripts/comments.js` 与静态构建共用此映射：

- 已有讨论直接用 `issue-number`，不依赖文章改名、域名、Hash、`.md`、章节参数或静态入口。
- 原来 Gitalk 以完整 Hash 为标识，留下了同篇文章的多个 Issue。首次核对优先选择已有评论的讨论，其次选择无章节参数的讨论；其余保留在“其他历史讨论”中。不删除、关闭或复制评论。
- 后续核对保留已经选定的主 Issue，避免评论数量变化导致文章突然换讨论。
- `6532988` 将“后记”从第 94 篇移到第 95 篇。其旧 Issue #99 归入第 95 篇，并保留 #112；不把后记评论放到现在的 ANALYZE 文章中。
- 没有历史讨论的文章使用 `postgres-howto-article-编号` 作为稳定 `issue-term`。首次实际发言才由 Utterances 创建 Issue，单纯浏览不创建空讨论。新旧文章入口使用同一标识。

维护时可执行只读核对，然后重新生成网站：

```sh
node maintenance/sync-comment-threads.mjs
node maintenance/build-catalog.mjs
node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs maintenance/test-comments.cjs
```

核对脚本只读取公开 GitHub API，不需要令牌，不修改远端 Issues 或评论。API 失败或历史关联缺失时拒绝覆盖旧映射。不要手工编辑生成的静态 HTML 或 `scripts/catalog-data.js`。

## 前端生命周期

适配层使用 Utterances 上游 [client.ts](https://github.com/utterance/utterances/blob/master/src/client.ts) 的 iframe 参数和 [theme.ts](https://github.com/utterance/utterances/blob/master/src/theme.ts) 的主题消息协议。授权、评论查询、Markdown 渲染和提交由托管组件完成，不自行实现 OAuth 服务。

本站只管理框架外层：文末临近可见时加载、主题同步、超时重试和路由切换清理。高度消息同时校验来源域名与当前 iframe 身份；旧文章的延迟消息不能修改新文章。目录跳转及主题切换不重建组件、不清空输入草稿。切换到其他文章或离开页面则卸载组件，草稿不作跨页保存。

授权回跳遵循上游客户端约定：从查询参数移除托管会话标识，以免留在复制的地址中；本地存储不可用时仍可使用当前页面的会话。该会话不是 OAuth 应用密钥。统计脚本在地址仍带有授权回跳参数时不加载，避免评论脚本延迟时把回跳地址交给统计服务。登录回跳地址使用文章的生产 canonical，因此本地预览不作为完整登录回跳验收；发布后需再确认真实域名上的授权回跳，不在公开文章中发布测试评论。

## GitHub 侧设置

2026-10-25 已在 GitHub 安装页面确认 Utterances 安装完成，仅选择 `xiongcccc/gitalk-comment`，权限为读取元数据及读写 Issues，不包含代码写入权限。

旧 Gitalk OAuth 应用 `postgres-howto in chinese` 的密钥曾进入前端与 Git 历史。删除代码中的配置不能使旧密钥失效，发布前仍需账号所有者在 [旧应用设置](https://github.com/settings/applications/2762675) 撤销：

1. GitHub 不允许删除唯一的 client secret，可先由账号所有者生成一个新 secret，再删除旧 secret。新 secret 不需要复制、发送或填进本站。
2. 不要把新密钥或账号访问令牌写入源码、测试、截图、日志或聊天。
3. 本次没有改写 Git 历史，也没有删除 OAuth 应用或历史 Issues。是否进一步清理历史、撤销旧应用授权，应在旧密钥失效后另行评估。

**旧密钥撤销状态：待账号所有者完成并确认。** 该状态不能仅因已登录 GitHub 或代码扫描通过而改为完成。GitHub 官方建议发现泄露时[先撤销或轮换凭据](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)。

可选的来源限制：在评论仓库根目录添加 `utterances.json`，将允许发言的来源限制为本站。必须在 `gitalk-comment` 仓库中生效，放在网站仓库无效。此配置尚未写入远端，以免在没有提交授权时改动其他仓库：

```json
{"origins":["https://postgres-howto.cn"]}
```

## 验证

`node maintenance/test-comments-browser.cjs` 使用独立 Playwright 浏览器和模拟组件，覆盖桌面 / 移动、深浅色、首页及发现页隐藏、新旧入口一致、章节跳转草稿保留、主题消息、消息来源校验、文章切换、错误重试和登录参数清理。沿用项目的 `PLAYWRIGHT_PACKAGE`、`CHROME_PATH`、`HOWTO_URL` 环境变量；结果和截图默认输出 `/tmp/howto-comments-qa`。模拟输入不提交远端。

2026-10-25 本地验收通过：目录 / 静态构建 / 评论关联共 35 项测试、评论专项 22 项检查（其中 4 项为真实匿名深浅色与桌面 / 移动读取）、109 篇文章的通用阅读回归，以及搜索路由边界 20 项检查。真实读取验证了第 1 篇的两条、第 9 篇的五条历史评论。

匿名读取、模拟提交界面和 App 安装状态不等于完成真实登录发言验证；没有发布测试评论。上线后还需在真实域名验证授权回跳。
