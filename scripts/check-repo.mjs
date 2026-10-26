// 本地与 CI 共用的轻量检查：版本、锁文件、源码语法和文档中的本地文件链接。
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const pkg = JSON.parse(read("package.json")), lock = JSON.parse(read("package-lock.json"));
const version = read("nodeseek-max.user.js").match(/^\/\/ @version\s+(\S+)\s*$/m)?.[1];
const problems = [];
if (!version || pkg.version !== version || lock.version !== version || lock.packages?.[""]?.version !== version) problems.push("脚本、package.json 和 package-lock.json 的版本不一致");
if (read("CHANGELOG.md").match(/^## (\S+)\s*$/m)?.[1] !== version) problems.push("CHANGELOG.md 顶部缺少当前版本的发布说明");
for (const [name, value] of Object.entries(pkg.devDependencies || {})) {
	if (lock.packages?.[""]?.devDependencies?.[name] !== value) problems.push(`锁文件中的 ${name} 与 package.json 不一致，请运行 npm install --package-lock-only`);
}

const excluded = new Set(["node_modules", ".git", ".upload-css", ".fonts", "dist", "validation", "test-results", "incoming"]);
function* files(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (excluded.has(entry.name)) continue;
		const name = path.join(directory, entry.name);
		if (entry.isDirectory()) yield* files(name);
		else if (entry.isFile()) yield name;
	}
}
let scripts = 0, links = 0;
for (const file of files(root)) {
	const relative = path.relative(root, file);
	if (/\.(?:mjs|cjs)$/.test(file)) {
		const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
		if (result.status !== 0) problems.push(`${relative}: ${result.stderr || result.error?.message || "语法检查失败"}`);
		scripts++;
	}
	if (!file.endsWith(".md")) continue;
	const content = fs.readFileSync(file, "utf8").replace(/^\`\`\`[^\n]*\n[\s\S]*?^\`\`\`[^\n]*$/gm, "").replace(/\`+[^\`\n]*\`+/g, "");
	const destinations = [...content.matchAll(/!?\[[^\]\n]*\]\(<?([^\s)>]+)>?(?:\s+"[^"]*")?\)/g)].map(match => match[1]);
	destinations.push(...[...content.matchAll(/<(?:img|a)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(match => match[1]));
	for (const target of destinations) {
		if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
		let name;
		try { name = decodeURIComponent(target.split(/[?#]/)[0]); } catch { problems.push(`${relative}: 链接编码无效 ${target}`); continue; }
		const resolved = target.startsWith("/") ? path.resolve(root, "." + name) : path.resolve(path.dirname(file), name);
		if (!fs.existsSync(resolved)) problems.push(`${relative}: 文件链接不存在 ${target}`);
		links++;
	}
}
if (problems.length) { console.error(problems.map(item => `- ${item}`).join("\n")); process.exitCode = 1; }
else console.log(`仓库检查通过：v${version}，${scripts} 个脚本，${links} 个本地文档链接`);
