# 111：来源与技术校订记录

核对日期：2026-10-26。中文解读与技术校订：xiongcc。

## 来源与定位

- 用户提供 54 页 PDF，Sergey Dudoladov，Into the Woods: Finding Your Way with B-Trees in PostgreSQL。用 pypdf 提取全部页文字，渲染查看 31–42 页，重点检查二维键值、PG17/18 转折和空间邻近示意。PDF 不复制到仓库。
- 官方场次确认会议为 PostgreSQL Conference Germany 2026，Essen，2026-04-22 09:00–09:45，作者来自 Zalando。来源日期取场次时间，不取 PDF 文件创建或下载时间。
- 归入专题解读，主主题索引治理，交叉查询性能。面向熟悉基本 SQL、能阅读简单计划的后端工程师与 DBA。
- 主线：页级导航为何浅、确定顺序怎样支持排序与查找、复合顺序如何限制查询，以及距离顺序为何需要其他访问方式。没有加入会议介绍中提及但 PDF 未展开的并发建索引、膨胀与删索引教程。

## 核对与取舍

- 根/内部/叶页、相邻叶页与范围扫描按 PG18 B-tree 文档核对。图是简化的键区间导航示意，不描绘 high key、并发分裂等细节。
- 14GB、675549000 条目、四层来自 PDF 第 20 页。保留出处，不把这组规模写成本地复现结果。页宽、条目长度与页面利用率影响扇出，不以树高代替查询总体成本。
- NULL 比较的 unknown 与索引排序位置区分；正向 ASC NULLS LAST、反向 DESC NULLS FIRST，以及混合方向多列排序按官方索引排序文档核对。
- 复合索引条件可以使用非前导列。解释扫描区间与索引内过滤的差别，不写成“没有最左列就完全不能用索引”。
- skip scan 在 PG18 引入。PDF 第 34 页是 PG17.9 顺序扫描，第 37 页才揭示版本，第 39 页为 PG18 多次索引搜索。正文明确这组比较，不误称 PG18 无法利用后列条件。
- Index Searches 也用于其他多次搜索场景；不能仅凭计数大于一判定 skip scan。本例结合第二列点查、无数组条件和低前导列基数分析。
- Index Only Scan 的 Heap Fetches 取决于可见性映射；VACUUM 用于使本例获得 all-visible 状态，避免将回表差别误归因于索引排序。
- 向量部分只保留距离关系与字典序的区别。HNSW 为近似最近邻，按 pgvector 官方说明核对；未本地安装扩展或复现其百万向量性能。自行举出的二维点距离可直接计算，不扩展为向量检索教程。
- 全文 6 个 SQL 块，仅展示 3 组与判断直接相关的输出。辅助断言、pageinspect 与实例清理仅在维护脚本；正文没有样例确认、收尾清理或免责式重复声明。

## 本地核验

```sh
python3 maintenance/111-verify.py \
  --pg-bin /opt/homebrew/opt/postgresql@18/bin \
  --check-output
```

- 使用现有 Homebrew PostgreSQL 18.4，在 /tmp 创建独立 UTF8 实例，私有 Unix socket、禁用 TCP，shared_buffers=32MB，不访问已有数据库。异常和成功路径均停止自己的实例、删除临时目录。
- 从正文提取建表与五条查询直接运行。单表 300000 行，60000 个 NULL，x 十种取值，y 唯一递增；不用原分享的随机数据。
- NULLS LAST：Index Only Scan，实际交出 10 行，Heap Fetches=0。NULLS FIRST：Seq Scan 交出 300000 行，top-N heapsort 输出 10 行。
- DESC NULLS FIRST：Index Only Scan Backward。x=3 ORDER BY y LIMIT 10：items_xy Index Only Scan，无 Sort。
- 仅查 y=123453：items_xy Index Only Scan，返回 3|123453，Index Searches=12。完整三组正文输出以 --check-output 逐字核对。
- 维护侧用 pageinspect 的 bt_metap 核对 items_xy 层数为 3；不为展示这个额外观察在正文增加一套插件准备步骤。
- 未进行跨版本性能排名、并发写入、HNSW 或高维负载测试。

## 读者视角复核

- 读者应能解释：导航为何便宜却不保证整条查询便宜；NULL 位置为何影响免排序；x 等值后 y 为何有序；skip scan 为何依赖前导列取值数量；向量距离为何不等于复合键顺序。
- 一个数据集服务排序与复合查找，代码不承担“凑齐完整实验报告”的任务。正文无清理、核验脚本命令与环境安装过程。
- 保留原作者与场次归属，官方核对链接集中在参考资料，本站补充例子不冒充作者的线上案例。

## 页面与目录

- 构建覆盖 111 篇文章、129 个生成产物。首页最近收录、侧栏、专题、系列、会议页与全文索引均由元数据生成，没有手工编辑生成页；旧文 Markdown 与网站样式未改。
- `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs`：30 项通过。原第 103 篇退出系列最近六篇、第 106 篇退出首页最近五篇，相关测试改为检查完整专题与会议入口，原搜索与来源检查继续保留。
- `maintenance/test-site.cjs`：111 篇旧路由、中文标题、目录与已有图表、搜索与筛选、复制、六种屏宽和两种主题全部通过。
- 专项检查新静态与旧入口，390、768、1440 宽度及深浅主题共十二种组合；无页面横向溢出，长执行计划能局部滚动，三片叶页图形保持同层。
- 按主题、系列、会议来源组合搜索“复合索引列顺序”，结果为第 111 篇，刷新后保留条件与结果。关闭 JavaScript 后，静态中文标题与全部 11 个代码块原文一致。
- 人工查看桌面标题、手机暗色树图和排序计划截图；树的叶页标签改为两行，避免手机宽度下过度缩小文字。截图仅存 `/tmp/howto111-qa` 与 `/tmp/howto111-focused`。
- 本地入口 `http://127.0.0.1:4177/articles/111/`，旧入口 `http://127.0.0.1:4177/#/docs/111`。未提交、推送或部署。
