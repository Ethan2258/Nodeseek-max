# 上游脚本

[返回首页](../README.md) · [开发与发布](../docs/development.md)

NodeSeek Max 合并了下面四个脚本。这里保存的是**已合并版本**的原始源码（基线），上游更新时用来对比改动。

| 上游 | 已合并版本 | 发布地址 | 在 nodeseek-max.user.js 中的位置 |
| --- | --- | --- | --- |
| NodeSeek++ | 见 `sources.json` | [Greasy Fork 595488](https://greasyfork.org/scripts/595488) | Part 2（论坛增强），其中加了 NodeSeek Max 的改动 |
| redirect 外链跳转 | 见 `sources.json` | [Greasy Fork 416338](https://greasyfork.org/scripts/416338) | Part 1（外链跳转），NodeSeek / DeepFlood 的 `/jump` 规则为 NodeSeek Max 改写 |
| NodeSeek 热榜插件 | 见 `sources.json` | [Greasy Fork 560065](https://greasyfork.org/scripts/560065) | 改写为 Part 2 的侧栏热榜（`mountHotSidebar`）与工具栏热榜弹窗，共用一份缓存 |
| NodeSeek 自动屏蔽黑名单用户通知 | 2.0 | 无（本地脚本） | 改写为 Part 2 的 `official-blocklist`（`blockedMembers`） |

## 检查与合并

```bash
npm run upstream                       # 对比已合并版本与上游最新版本
node scripts/upstream.mjs --fetch      # 下载有更新的上游到 upstream/incoming/
git diff --no-index upstream/<id>.user.js upstream/incoming/<id>.user.js   # 查看上游改了什么
```

退出码：0 表示检查成功且没有更新，10 表示发现更新，1 表示至少一个来源检查失败。失败不表示上游没有更新。工作流报告检查结果，有更新时创建 issue；网络失败会让任务明确失败。

1. 按上面的位置，把 diff 里的改动移植进 `nodeseek-max.user.js`。NodeSeek++ 是打包后的代码，按函数和字符串定位对应段落；NodeSeek Max 自己加的改动（主题、导航、图床、黑名单、热榜、去掉的快速回复与 AI 写作等）要保留。
2. `node scripts/upstream.mjs --accept <id>`：用新源码替换基线，并更新 `sources.json` 里的已合并版本。
3. 同步脚本、package.json 与锁文件版本号，在 CHANGELOG.md 写明合并来源与版本；运行 `npm run build`、`npm run check`、`npm test`。
4. 开 PR，CI 通过后合并，Release 工作流会自动发布。

GitHub Actions 的 `Upstream` 工作流每天检查一次，有新版本时开一个带 `upstream` 标签的 issue。
