# 112：来源与技术校订记录

核对日期：2026-11-03。中文解读与技术校订：xiongcc。

## 来源与定位

- 用户提供 `Caching in the Storage Path - How To Gain Performance Without Loosing Data.pdf`，52 页。全文文字已提取；查看第 35–37 页断电测试与第 52 页会议标识。作者 Werner Fischer，来自 Thomas-Krenn，姓名与材料图片署名一致。
- PDF 使用 Open Source Summit / Embedded Linux Conference Europe 标识。会议官方主页给出 2026 年 10 月 7–9 日会期，PDF 元数据创建于 2026-10-08；两者均不当作具体场次日期。官方 Sched 页面返回 403，未确认准确场次日期，source.date 留空，保留官方日程入口。正文不编造会议日期。
- 归入专题解读，主主题存储，交叉运维。主读者为使用虚拟机部署 PostgreSQL、了解基本事务与 WAL 的 DBA 和后端工程师。
- 主线是写入确认在多层缓存中的含义，重点讲同步提交、页缓存回写、设备掉电保护、FLUSH/FUA 和 QEMU 模式。PG 专属写入与恢复解释是本站补充，不声称来自原 PDF 的数据库实验。

## 技术核对

- PostgreSQL 18 WAL 配置、可靠性与 WAL 原理：普通持久表同步提交等待本地 WAL flush；同步复制可能增加备库等待；表页可后台写出，对应 WAL 必须先持久化。没有将 WAL 缓冲与 shared_buffers 画成同一缓存，也没有称 COMMIT 必须同步所有数据文件。
- Linux dirty_* 文档：比例对应内核可用于脏页限制的内存范围，非物理总内存；bytes 与 ratio 为对应选项；expire 是回写候选条件，不是事务持久化期限。10%/20% 不作为通用默认值。
- Linux 块层缓存文档：REQ_PREFLUSH 约束先前已完成写入，REQ_FUA 约束当前请求的完成；可组合使用，不要求所有 I/O 串行。未将文件系统屏障与 CPU 内存屏障混用。
- 原第 31 页对文件系统日志次序的简化，没有写成所有文件系统统一的“先数据、再日志、再标记”顺序。正文采用日志相关内容与提交记录的依赖关系。
- QEMU 官方 invocation 文档逐项核对五种模式。none 仍暴露 writeback，绕过 host page cache，继续处理 flush；direct 不等于 durable；unsafe 设置 no-flush。writethrough/directsync 解释为同步语义，不照搬 PDF 第 49 页“每次都调用 fsync”这一实现概括。
- PLP/BBU 按覆盖范围解释，未承诺所有企业 SSD 都保护相同内容。设备 PLP 不保护尚未到达设备的宿主机页缓存，不据单个组件建议关闭 barrier。
- diskchecker 的 0/0/0/0/2786 数字来自 PDF 第 48 页。第 37 页的 545 属另一个 ext4 barrier 实验，没有混入 QEMU 对照。未把原测试零错误写成所有配置、故障类型的安全认证。
- 区分进程崩溃、客户机关闭与宿主机掉电。正文保留独立可丢弃环境要求，不给生产机器断电命令。
- pg_test_fsync 用于同步方式成本比较，未声称它能验证硬件断电安全。
- synchronous_commit=off 与 fsync=off/忽略 flush 的故障后果分开，不建议以 unsafe 获取数据库性能。

## 验证范围与读者复核

- 本文为材料、官方文档与机制核对，没有运行 QEMU 或硬件断电实验，validation 为 not-recorded。未为实验数量额外构建 SQL 测试表或伪造输出。
- 原材料按作者归属，公开参考集中在文末；原始 PDF 不复制到仓库。
- 读者应能解释：WAL 与数据页何时分别需要持久化、普通写入和同步完成的差别、none 绕过哪层缓存、PLP 保护到哪里，以及故障测试为何需要外部参照。
- 读者可据此检查虚拟磁盘的实际缓存组合，判断性能改善是否改变提交保证；回写停顿按 WAL 同步、检查点与设备延迟联合观察，不给脱离设备能力的 dirty_ratio 配方。
- 正文没有安装环境、无关样例确认、测试清理、连续免责声明；图仅用于解释真实存储路径，表格用于比较参数语义和外部实验结果。

## 页面与目录检查

- 新增第 112 篇，首页最近收录日期为 2026-11-03，专题、侧栏、系列、会议入口和全文索引均由元数据生成。此前第 106 篇退出系列最近六篇、第 107 篇退出首页最近五篇，调整相应过时断言，保留完整目录与检索检查。
- 来源日期为空时，会议页生成器省略日期分隔符，避免尾部空格和空日期展示；不以 PDF 创建日期补作演讲日期。
- `node --test maintenance/test-catalog.cjs maintenance/test-seo.cjs`：30 项通过；`git diff --check` 通过。
- 独立 Chrome 检查 `/articles/112/` 与 `#/docs/112`，390、768、1440 宽度及深浅主题共 12 组：中文标题、静态 canonical、流程图绘制、四张表格和页面宽度正常，长表可局部横向滚动，无页面脚本异常。关闭 JavaScript 后，静态正文与四张表格仍存在。
- 组合筛选“存储 / 专题解读 / 会议材料”，以“虚拟机磁盘缓存”“cache.no-flush”“掉电安全”“diskchecker.pl”检索，第一项均为第 112 篇。
- 人工查看桌面浅色首屏、移动暗色缓存模式表与路径图。截图位于 `/tmp/howto112-qa`，未加入仓库。此为独立 Chromium 的视口检查，未执行真机 Safari 测试。
- 本地预览 `http://127.0.0.1:4177/articles/112/`。尚未提交或推送。
