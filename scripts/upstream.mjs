// 检查合并进 NodeSeek Max 的上游脚本是否发布了新版本（数据见 upstream/sources.json）。
// 用法：
//   node scripts/upstream.mjs              对比已合并版本与上游最新版本；有更新时退出码为 10
//   node scripts/upstream.mjs --markdown   输出 Markdown 报告（供 GitHub Actions 建 issue），退出码始终为 0
//   node scripts/upstream.mjs --fetch      把有更新的上游新源码下载到 upstream/incoming/<id>.user.js，便于与基线对比
//   node scripts/upstream.mjs --accept <id>   改动移植完成后：用 incoming 替换基线 upstream/<id>.user.js，并更新已合并版本号
// 没有发布地址的上游（meta 为 null）只列出，不检查。
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, appendFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const sourcesPath = new URL("upstream/sources.json", root);
const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
const args = process.argv.slice(2);
const versionOf = (text) => text.match(/^\/\/\s*@version\s+(\S+)\s*$/m)?.[1];

async function get(url) {
	const response = await fetch(url, { headers: { "user-agent": "NodeSeek-Max-upstream-check" }, signal: AbortSignal.timeout(3e4) });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.text();
}

if (args[0] === "--accept") {
	const id = args[1];
	const source = sources.find((item) => item.id === id);
	const incoming = new URL(`upstream/incoming/${id}.user.js`, root);
	if (!source || !existsSync(incoming)) throw new Error(`没有 ${id} 的新源码，请先运行 --fetch`);
	const version = versionOf(readFileSync(incoming, "utf8"));
	if (!version) throw new Error("新源码缺少 @version");
	renameSync(incoming, new URL(`upstream/${id}.user.js`, root));
	source.version = version;
	writeFileSync(sourcesPath, `${JSON.stringify(sources, null, "\t")}\n`);
	console.log(`${source.name} 基线已更新为 ${version}`);
	process.exit(0);
}

const results = [];
for (const source of sources) {
	if (!source.meta) {
		results.push({ source, status: "untracked" });
		continue;
	}
	try {
		const latest = versionOf(await get(source.meta));
		if (!latest) throw new Error("meta 中没有 @version");
		results.push({ source, latest, status: latest === source.version ? "current" : "outdated" });
	} catch (error) {
		results.push({ source, status: "error", error: error.message });
	}
}
const outdated = results.filter((result) => result.status === "outdated");

if (args.includes("--fetch")) {
	mkdirSync(new URL("upstream/incoming/", root), { recursive: true });
	for (const { source, latest } of outdated) {
		const code = await get(source.code);
		if (versionOf(code) !== latest) throw new Error(`${source.name}：下载到的源码版本与 meta 不一致`);
		writeFileSync(new URL(`upstream/incoming/${source.id}.user.js`, root), code);
		console.log(`已下载 ${source.name} ${latest} → upstream/incoming/${source.id}.user.js（对比：git diff --no-index upstream/${source.id}.user.js upstream/incoming/${source.id}.user.js）`);
	}
}

if (args.includes("--markdown")) {
	const lines = ["| 上游 | 已合并 | 最新 | 状态 |", "| --- | --- | --- | --- |"];
	for (const { source, latest, status, error } of results) {
		const name = source.page ? `[${source.name}](${source.page})` : source.name;
		const label = { current: "已是最新", outdated: "**有更新**", untracked: "无发布地址，不检查", error: `检查失败：${error}` }[status];
		lines.push(`| ${name} | ${source.version} | ${latest ?? "—"} | ${label} |`);
	}
	console.log(lines.join("\n"));
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `updates=${outdated.length}\n`);
		appendFileSync(process.env.GITHUB_OUTPUT, `title=上游更新：${outdated.map(({ source, latest }) => `${source.name} ${source.version} → ${latest}`).join("，")}\n`);
	}
	process.exit(0);
}

for (const { source, latest, status, error } of results) {
	const text = { current: `已是最新（${source.version}）`, outdated: `有更新：${source.version} → ${latest}`, untracked: `${source.version}，无发布地址，不检查`, error: `检查失败：${error}` }[status];
	console.log(`${source.name}：${text}`);
}
process.exit(outdated.length ? 10 : 0);
