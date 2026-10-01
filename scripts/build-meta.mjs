// 从 nodeseek-max.user.js 提取 ==UserScript== 头部，生成更新检查用的 nodeseek-max.meta.js。
// 用法：node scripts/build-meta.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const source = readFileSync(new URL("nodeseek-max.user.js", root), "utf8");
const header = source.match(/^\/\/ ==UserScript==\r?\n[\s\S]*?^\/\/ ==\/UserScript==/m)?.[0];
if (!header) throw new Error("未找到 ==UserScript== 头部");

const version = header.match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
const constant = source.match(/var NSMAX_VERSION = "([^"]+)";/)?.[1];
if (!version || version !== constant) throw new Error(`版本不一致：@version ${version} / NSMAX_VERSION ${constant}`);

const target = new URL("nodeseek-max.meta.js", root);
const meta = `${header}\n`;
if (process.argv.includes("--check")) {
	if (readFileSync(target, "utf8") !== meta) {
		console.error(`${fileURLToPath(target)} 与脚本头部不一致，请运行 npm run meta`);
		process.exit(1);
	}
	console.log(`meta 已同步（v${version}）`);
} else {
	writeFileSync(target, meta);
	console.log(`已生成 nodeseek-max.meta.js（v${version}）`);
}
