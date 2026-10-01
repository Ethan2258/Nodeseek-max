// 生成 GitHub Release 的发布说明：取 CHANGELOG.md 中与脚本 @version 对应的一节，并附上安装方式。
// 用法：node scripts/release-notes.mjs            输出发布说明
//       node scripts/release-notes.mjs --version  只输出版本号
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const source = readFileSync(new URL("nodeseek-max.user.js", root), "utf8");
const version = source.match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
if (!version) throw new Error("未找到 @version");

if (process.argv.includes("--version")) {
	process.stdout.write(version);
	process.exit(0);
}

const lines = readFileSync(new URL("CHANGELOG.md", root), "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.trim() === `## ${version}`);
let section = [];
if (start >= 0) {
	const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
	section = lines.slice(start + 1, end < 0 ? void 0 : end);
}
const body = section.join("\n").trim() || "详见 [CHANGELOG.md](https://github.com/Ethan2258/Nodeseek-max/blob/main/CHANGELOG.md)。";

process.stdout.write(`${body}

## 安装 / 更新

- 安装：打开 [nodeseek-max.user.js](https://github.com/Ethan2258/Nodeseek-max/releases/download/v${version}/nodeseek-max.user.js)，在 Tampermonkey 等脚本管理器中确认安装。
- 已安装的用户：在脚本管理器中检查更新，或在 NodeSeek Max 设置顶部点「检查更新」。
- 安装后请停用原来的 NodeSeek++、redirect 外链跳转、NodeSeek 热榜插件、NodeSeek 自动屏蔽黑名单用户通知，避免功能重复。
`);
