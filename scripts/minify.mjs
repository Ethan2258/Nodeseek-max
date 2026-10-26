// 发布用压缩：去掉注释 / 空白 / 换行，让每页注入时少解析几百 KB。
// 源码（nodeseek-max.user.js）保持可读，只有 Release 附带的文件是压缩版；
// 压缩后必须过：语法检查、完整测试套件（CI 会拿压缩产物再跑一遍）。
// 用户脚本头部（// ==UserScript== … // ==/UserScript==）原样保留，Tampermonkey 靠它识别脚本。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { minify } from "terser";

const repo = path.join(import.meta.dirname, "..");
const sourcePath = path.join(repo, "nodeseek-max.user.js");
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n?/g, "\n");
const headerEnd = source.indexOf("// ==/UserScript==");
if (headerEnd < 0) throw new Error("用户脚本头部缺失");
const headerNewline = source.indexOf("\n", headerEnd);
const header = source.slice(0, headerNewline + 1);
const body = source.slice(headerNewline + 1);

const result = await minify(body, {
	// 求稳：保留所有变量名和表达式结构，只压注释 / 空白 / 换行；
	// 压缩后 CI 会用这份产物跑完整测试套件，样式与行为必须和源码一致。
	compress: false,
	mangle: false,
	format: { comments: false, beautify: false, max_line_len: 1000000 }
});
if (!result.code) throw new Error("terser 没有输出");
const minified = header + result.code + "\n";

// 自检：语法合法、头部和关键标识都在、体积确实变小
try { new vm.Script(minified); } catch (error) { throw new Error(`压缩结果不是合法 JS：${error.message}`); }
for (const must of ["// ==UserScript==", "// @version", "// @name", "// ==/UserScript==", "GM_addStyle", "unsafeWindow", "data-nsmax-theme", "nsmax_theme_segments"]) {
	if (!minified.includes(must)) throw new Error(`压缩后缺少 ${must}`);
}
if (minified.length >= source.length) throw new Error("压缩后反而更大");

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && (!process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith("--"))) throw new Error("--out 后需要输出文件路径");
const target = outIndex >= 0 ? process.argv[outIndex + 1] : path.join(repo, "nodeseek-max.min.user.js");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, minified);
const before = Buffer.byteLength(source), after = Buffer.byteLength(minified), saved = before - after;
console.log(`minified: ${before} -> ${after} bytes (-${Math.round(saved / 1024)}KB, -${(100 * saved / before).toFixed(1)}%) -> ${path.relative(repo, target)}`);
