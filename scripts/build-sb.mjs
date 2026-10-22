import { readFileSync, writeFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const root = new URL("../", import.meta.url);
const scriptPath = new URL("nodeseek-max.user.js", root);
let source = readFileSync(scriptPath, "utf8").replace(/\r\n?/g, "\n");
const original = source;
const runtime = readFileSync(new URL("theme/ui-runtime.js", root), "utf8").replace(/\r\n?/g, "\n").trimEnd();
const runtimeBlock = "\t// SB_RUNTIME_START\n" + runtime + "\n\t// SB_RUNTIME_END\n";
if (source.includes("\t// SB_RUNTIME_START")) source = source.replace(/\t\/\/ SB_RUNTIME_START[\s\S]*?\t\/\/ SB_RUNTIME_END\n/, runtimeBlock);
else source = source.replace("\tfunction main() {", runtimeBlock + "\tfunction main() {");
const messageCss = readFileSync(new URL("theme/messages.css", root), "utf8").replace(/\r\n?/g, "\n");
source = source.replace(/\tvar nsmax_messages_sb = .*;\n/, "");
source = source.replace("\tfunction mountChat(ctx, account) {", "\tvar nsmax_messages_sb = " + JSON.stringify(messageCss) + ";\n\tfunction mountChat(ctx, account) {");
const settingsCss = readFileSync(new URL("theme/settings.css", root), "utf8").replace(/\r\n?/g, "\n");
source = source.replace(/\tvar settings_sb_default = .*;\n/, "");
// 设置面板样式插在 loading_default 前面（以前插在已删掉的旧常量 style_default$1 前，锚点没了要跟着换）
const settingsAnchor = "\tvar loading_default = ";
if (!source.includes(settingsAnchor)) throw new Error("设置面板样式的注入锚点丢了");
source = source.replace(settingsAnchor, "\tvar settings_sb_default = " + JSON.stringify(settingsCss) + ";\n" + settingsAnchor);
const themePath = new URL("theme/source.js", root);
let themeSource;
if (existsSync(themePath)) themeSource = readFileSync(themePath, "utf8").replace(/\r\n?/g, "\n");
else {
  const begin = source.indexOf("\tvar sb_theme_ui_default = ");
  const end = source.indexOf("\t// 侧栏热榜面板样式", begin);
  if (begin < 0 || end < 0) throw new Error("Theme source missing");
  themeSource = source.slice(begin, end);
  source = source.slice(0, begin) + source.slice(end);
}
const originalTheme = themeSource;
const input = process.argv.find(arg => arg.startsWith("--source="))?.slice(9);
if (input) {
  const css = postcss.parse(readFileSync(input, "utf8").replace(/\r\n?/g, "\n"));
  css.walkAtRules("font-face", rule => rule.remove());
  css.walkComments(comment => comment.remove());
  css.walkRules(rule => {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = selectorParser(selectors => {
      selectors.each(selector => {
        selector.walkAttributes(attribute => {
          if (attribute.attribute === "data-theme") {
            if (attribute.value === "dark") attribute.replaceWith(selectorParser.attribute({ attribute: "data-nsmax-dark" }));
            else attribute.replaceWith(selectorParser.pseudo({ value: ":not", nodes: [selectorParser.selector({ nodes: [selectorParser.attribute({ attribute: "data-nsmax-dark" })] })] }));
          }
        });
        if (selector.first.type === "pseudo" && selector.first.value === ":root" || selector.first.type === "tag" && selector.first.value === "html") selector.first.replaceWith(selectorParser.tag({ value: "html" }), selectorParser.attribute({ attribute: "data-nsmax-theme" }));
        else if (selector.first.type === "attribute" && selector.first.attribute === "data-nsmax-dark") {
          selector.prepend(selectorParser.attribute({ attribute: "data-nsmax-theme" }));
          selector.prepend(selectorParser.tag({ value: "html" }));
        }
        else {
          selector.prepend(selectorParser.combinator({ value: " " }));
          selector.prepend(selectorParser.attribute({ attribute: "data-nsmax-theme" }));
          selector.prepend(selectorParser.tag({ value: "html" }));
        }
      });
    }).processSync(rule.selector, { lossless: false });
    rule.walkDecls("letter-spacing", decl => { decl.value = "0"; });
  });
  const suite = css.toString().trimEnd();
  writeFileSync(new URL("theme/sb-suite.css", root), suite + "\n");
  const begin = themeSource.indexOf("\tvar sb_theme_ui_default = ");
  const end = themeSource.indexOf("\n\tvar modern_theme_default =", begin);
  if (begin < 0 || end < 0) throw new Error("SB suite markers missing");
  themeSource = themeSource.slice(0, begin) + "\tvar sb_theme_ui_default = " + JSON.stringify(suite) + ";" + themeSource.slice(end);
}
const storedSuite = readFileSync(new URL("theme/sb-suite.css", root), "utf8").replace(/\r\n?/g, "\n").trimEnd();
themeSource = themeSource.replace(/\tvar sb_theme_ui_default = .*;\n/, "\tvar sb_theme_ui_default = " + JSON.stringify(storedSuite) + ";\n");

const adapter = readFileSync(new URL("theme/sb-adapter.css", root), "utf8").replace(/\r\n?/g, "\n")
  .replaceAll("html[data-nsmax-theme]", "html[data-nsmax-theme]:root:root:root");
const adapterLine = "\tvar nsmax_sb_adapter_default = " + JSON.stringify(adapter) + ";\n";
themeSource = themeSource.replace(/\tvar nsmax_sb_adapter_default = .*;\n/, "");
themeSource = themeSource.replace("\tvar modern_theme_default = `", adapterLine + "\tvar modern_theme_default = `");
const endMarker = "\n`;\n";
if (!themeSource.includes(endMarker)) throw new Error("Theme end marker missing");
themeSource = themeSource.replace("${nsmax_sb_adapter_default}\n", "");
themeSource = themeSource.replace(endMarker, "\n${nsmax_sb_adapter_default}" + endMarker);
// v1.8.0 设计层（theme/design.css，按 sb.sb 现版 1:1 复刻）：放在适配层之后，是最终外观。适配层里有带两三个 ID 的选择器（如
// section#nsk-frame>#nsk-body.nsk-container），只叠 :root 压不过；这里给开头的 html 叠三个 :is(:root,#nsmax-u)——
// 实际只匹配 :root，但特异度按参数里最大的 ID 计，相当于多了三个 ID。
const design = readFileSync(new URL("theme/design.css", root), "utf8").replace(/\r\n?/g, "\n")
  .replaceAll("html[data-nsmax-theme]", "html[data-nsmax-theme]:is(:root,#nsmax-u):is(:root,#nsmax-u):is(:root,#nsmax-u)");
const designLine = "\tvar nsmax_design_default = " + JSON.stringify(design) + ";\n";
themeSource = themeSource.replace(/\tvar nsmax_design_default = .*;\n/, "");
themeSource = themeSource.replace("\tvar modern_theme_default = `", designLine + "\tvar modern_theme_default = `");
themeSource = themeSource.replace("${nsmax_design_default}\n", "");
themeSource = themeSource.replace(endMarker, "\n${nsmax_design_default}" + endMarker);
// CSSOM selector optimization formerly ran during document-start. Compile it once at build time.
const context = {};
// 主题 CSS 变量现在叫 nsmax_theme_segments（分页面段），这里只需要它之前的那段脚本 + themeSource 来算出 legacy 主题
const themeCssStart = source.indexOf("\tvar nsmax_theme_segments = ");
vm.runInNewContext(source.slice(source.indexOf("\tvar NSMAX_ACCENTS = {"), themeCssStart < 0 ? source.length : themeCssStart) + themeSource, context);
const legacy = context.modern_theme_default.replace(/\r\n?/g, "\n");
const skinStart = legacy.indexOf("/* ==================== v1.7.0 全站重做");
if (skinStart < 0) throw new Error("Real DOM skin marker missing");
const ast = postcss.parse(legacy);
const retired = /^nspp-(?:monitor|history|footprint|user-hover|user-badges|trust|messages|message-editor|notice-|floating-reply|chat-|reply-actions)/;
ast.walkRules(rule => {
  if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
  if (rule.source.start.offset < skinStart) {
    const variables = rule.nodes.some(node => node.type === "decl" && node.prop.startsWith("--nsmax-icon-"));
    const bindings = /(?:comment-menu|nsk-pager|data-nsmax-pg|data-nsmax-sort|data-nsmax-md-hint|data-nsmax-ed|data-nsmax-icon|\.nsmax-icon|data-nsmax-header-hide|data-nsmax-own-hide|data-nsmax-hidden|data-nsmax-dup|nspp-confirm)/.test(rule.selector);
    if (!variables && !bindings) { rule.remove(); return; }
  }
  // Adapter rules explicitly bind live or retired native surfaces; preserve their hide/replace rules.
  // 设计层（design.css，带 :is(:root,#nsmax-u) 加权）同样是现行规则，NodeSeek++ 消息中心等元素在这里重新定样式，不能当退役规则删掉。
  if (rule.selector.includes("html[data-nsmax-theme]:root:root:root") || rule.selector.includes(":is(:root,#nsmax-u)")) return;
  const selectors = selectorParser().astSync(rule.selector);
  selectors.each(selector => {
    let unused = false;
    selector.walkClasses(node => {
      if (!retired.test(node.value)) return;
      for (let p = node.parent; p; p = p.parent) if (p.type === "pseudo" && p.value === ":not") return;
      unused = true;
    });
    if (unused) selector.remove();
  });
  if (!selectors.nodes.length) rule.remove();
  else rule.selector = selectors.toString();
});
// sb.sb 个人页布局（.forum-layout:has([data-profile-head])）在 NodeSeek 上永远不成立，直接去掉。
ast.walkRules(rule => {
  if (!rule.selector.includes(":has(")) return;
  const kept = rule.selectors.filter(selector => !/\.forum-layout:has\(/.test(selector));
  if (!kept.length) { rule.remove(); return; }
  if (kept.length !== rule.selectors.length) rule.selectors = kept;
});
// v1.8.1：主题里不再允许任何 :has()。哪怕参数只是子元素，帖子里有 NodeSeek 的 xterm 终端（测评帖）时，终端每画一批字符，
// 浏览器都要按 :has() 重新匹配祖先并整页重算样式，页面直接卡死（实测 300 行输出 1.2s → 0.15s）。
// 需要的结构信息改由 ui-runtime.js 的 nsmaxTagStructure() 在页面解析阶段打成属性；旧主题里保留下来的几条按下表改写，
// null 表示整条选择器删掉（已有别的选择器覆盖）。
const hasRewrites = [
  [".nsk-pager:not([data-nsmax-pager]) span:not(.pager-cur,[aria-current=page]):not(:has(*))", null],
  [">:not(.mde-toolbar,:has(.mde-toolbar))", ">:not(.mde-toolbar,[data-nsmax-ed-toolwrap])"],
  [">:has(.mde-toolbar)", ">[data-nsmax-ed-toolwrap]"],
  [".menu-item:has(>svg.iconpark-icon>use:is([href=\"#good-one\"],[href=\"#bad-one\"],[href=\"#chicken-leg\"]))", ".menu-item:is([data-nsmax-action=thumbup],[data-nsmax-action=thumbdown],[data-nsmax-action=drumstick])"],
  ["a:is([data-nsmax-icon-host=card],:has(>svg:only-child))", "a[data-nsmax-icon-host=card]"],
  ["body>header:has(>#nsk-head)", "body>header"],
  ["li:not(:has(>a:not([data-nsmax-header-hide],[data-nsmax-own-hide],[hidden])))", "li[data-nsmax-li-hidden]"],
  ["#nsk-head:has(.nsmax-header-action[data-nsmax-own-header=colors])", "#nsk-head[data-nsmax-own-colors]"],
  ["#nsk-body-left:not(:has(>:not(#nsk-body-left-block,script,style):not(:empty)),:has(>#nsk-body-left-block>*))", "#nsk-body-left[data-nsmax-empty]"],
  ["#nsk-body-left>div:has(>.nsk-pager.pager-bottom)", "#nsk-body-left>div[data-nsmax-pagerbox=bottom]"],
  ["span:not(:has(>svg.pined))", "span:not([data-nsmax-pinned])"],
  ["span:has(>svg.pined)", "span[data-nsmax-pinned]"],
  ["[data-nsmax-usercard]:has(+[data-nsmax-cta])", "[data-nsmax-usercard][data-nsmax-before-cta]"],
  [".nsk-panel:has(>.small-margin .btn)", ".nsk-panel[data-nsmax-btnpanel]"],
  [".small-margin:has(.btn)", ".small-margin[data-nsmax-btnrow]"],
  ["#nsk-body-left:has(>.nsk-post-wrapper)", "#nsk-body-left[data-nsmax-postbody]"],
  [".comment-container:not(:has(>ul.comments>li.content-item))", ".comment-container[data-nsmax-empty]"],
  [".nsk-post:has(>.nsmax-crumb)", ".nsk-post[data-nsmax-crumb]"],
  ["a:not(:has(img))", "a:not([data-nsmax-imglink])"],
  ["a:has(img)", "a[data-nsmax-imglink]"],
  ["div:has(>.post-bottom-pager)", "div[data-nsmax-pagerbox=bottom]"],
  ["div:has(>.nsk-pager)", "div[data-nsmax-pagerbox]"],
  ["fieldset>div:has(>button)", "fieldset>div[data-nsmax-btn-group]"],
  [".nsk-container:has(>.head-container)", ".nsk-container[data-nsmax-space-root]"],
  [":is(:target,:has(:target))", ":target"],
  ["li.content-item:has(:target)", "li.content-item:target"],
  [".nsk-notification:not(:has(.nspp-messages))", ".nsk-notification:not([data-nsmax-msgcenter])"],
];
ast.walkRules(rule => {
  if (!rule.selector.includes(":has(")) return;
  const kept = [];
  for (const original of rule.selectors) {
    let selector = original.replace(/\s+/g, " ").replace(/\s*([>+~,])\s*/g, "$1");
    let dropped = false;
    for (const [from, to] of hasRewrites) {
      if (!selector.includes(from)) continue;
      if (to === null) { dropped = true; break; }
      selector = selector.split(from).join(to);
    }
    if (!dropped) kept.push(selector);
  }
  if (!kept.length) rule.remove();
  else rule.selectors = kept;
});
ast.walkComments(comment => comment.remove());
const optimize = {};
vm.runInNewContext(source.slice(source.indexOf("\tfunction nsmaxSplitTop"), source.indexOf("\tvar __create")), optimize);
ast.walkRules(rule => {
  if (!rule.selector.includes(":is(")) return;
  rule.selector = optimize.nsmaxSplitTop(rule.selector, c=>c===",").flatMap(part=>optimize.nsmaxExpandSelector(part.trim()) || [part.trim()]).join(",");
});
// 三个相同的 :is() 合为一个，匹配范围仍为 :root 或同一 ID，
// 参数里重复三次 ID 保持原来的三份 ID 特异度；不改变层叠顺序。
ast.walkRules(rule => {
  rule.selector = rule.selector.replaceAll(
    ":is(:root,#nsmax-u):is(:root,#nsmax-u):is(:root,#nsmax-u)",
    ":is(:root,#nsmax-u#nsmax-u#nsmax-u)"
  );
});
// 只压缩 AST 的排版空白，不改声明值、calc() 空格、选择器组合符或规则顺序。
// 源 CSS 继续保留注释和缩进，浏览器少下载、解析重复格式字符。
ast.walk(node => {
  node.raws.before = "";
  if (node.type === "decl") {
    node.raws.between = ":";
    if (node.important) node.raws.important = "!important";
  } else if (node.type === "rule" || node.type === "atrule") {
    node.raws.between = "";
    node.raws.after = "";
    if (node.type === "atrule") node.raws.afterName = node.params ? " " : "";
  }
});
ast.raws.after = "";
const compiled = ast.toString();
// 诱饵 token 短名化（2026-10-21）：#nsmax-u / #nsmax-lv / #nsmax-b / #nsmax-c / #nsmax-d / #nsmax-s / #nsmax-a / #nsmax-e、
// .nsmax-s 和类型选择器 nsmax-s 都只是提特异度的垫片——每条都写成 :is(垫片, *)，永远由 * 兜底命中，名字本身没有语义。
// 换成 #x / .x / x 以后匹配范围不变、特异度的形状（ID / 类 / 类型各几份）不变，只是每条选择器短几个字节。
// [data-nsmax-palette=claude] 由脚本在根元素上写死（palette 设置已隐藏、恒为 claude），换成 :root 特异度同为 (0,1,0)。
let shipped = compiled;
// 只换完整的垫片名：`.nsmax-s` 后面不能再跟字母或连字符，否则会把 .nsmax-space-top、.nsmax-sb-account
// 这类真类名一起截断（第一次就是这么把个人空间、侧滑资料卡、快捷键的样式改没的）
shipped = shipped.replace(/#nsmax-(?:u|lv|b|c|d|s|a|e)(?![-\w])/g, "#x").replace(/#nsmax-s([12])(?![-\w])/g, "#x$1");
shipped = shipped.replace(/\.nsmax-s(?![-\w])/g, ".x").replace(/(?<![#.\w-])nsmax-s(?![-\w])/g, "x");
shipped = shipped.replaceAll("[data-nsmax-palette=claude]", ":root");
// 校验：垫片换干净了、其它类名和 ID 一个都没变、规则数量没变、仍然是合法 CSS
const tokenCounts = (css, pattern) => {
  const map = new Map();
  for (const match of css.matchAll(pattern)) map.set(match[0], (map.get(match[0]) ?? 0) + 1);
  return map;
};
const pads = new Set(["#nsmax-u", "#nsmax-lv", "#nsmax-b", "#nsmax-c", "#nsmax-d", "#nsmax-s", "#nsmax-a", "#nsmax-e", "#nsmax-s1", "#nsmax-s2"]);
const beforeClasses = tokenCounts(compiled, /\.nsmax-[a-z0-9_-]+/g);
const afterClasses = tokenCounts(shipped, /\.nsmax-[a-z0-9_-]+/g);
for (const [token, count] of beforeClasses) if (token !== ".nsmax-s" && afterClasses.get(token) !== count) throw new Error(`短名化改坏了类名 ${token}`);
for (const token of afterClasses.keys()) if (!beforeClasses.has(token) && token !== ".x") throw new Error(`短名化冒出了新类名 ${token}`);
const beforeIds = tokenCounts(compiled, /#nsmax-[a-z0-9_-]+/g);
const afterIds = tokenCounts(shipped, /#nsmax-[a-z0-9_-]+/g);
for (const [token, count] of beforeIds) if (!pads.has(token) && afterIds.get(token) !== count) throw new Error(`短名化改坏了 ID ${token}`);
for (const token of afterIds.keys()) if (!beforeIds.has(token) && !pads.has(token)) throw new Error(`短名化冒出了新 ID ${token}`);
if (/(?:#nsmax-(?:u|lv|b|c|d|s|a|e)(?![-\w]))|(?:\.nsmax-s(?![-\w]))/.test(shipped)) throw new Error("诱饵 token 没换干净");
if (shipped.includes("[data-nsmax-palette")) throw new Error("palette 门控没换干净");
if ((shipped.match(/\{/g) || []).length !== (compiled.match(/\{/g) || []).length) throw new Error("短名化改坏了规则数量");
postcss.parse(shipped);
const leftoverHas = [];
ast.walkRules(rule => {
  if (rule.selector.includes(":has(")) leftoverHas.push(...rule.selectors.filter(selector => selector.includes(":has(")));
});
if (leftoverHas.length) throw new Error("主题里不能再有 :has()（会让 NodeSeek 的终端渲染卡死整页），请在 nsmaxTagStructure() 里打属性，或加进 hasRewrites：\n" + leftoverHas.join("\n"));
// 按页面分块（2026-10-22）：整份主题 CSS 有 860KB+，但每个页面只用得到一部分。构建时把规则按「只在某个页面用得到」
// 拆成有序段：[base 段, 页面专属段, base 段, ……]。运行时按当前页面把需要的段拼起来再注入，规则顺序和整份 CSS 一致
// （层叠结果不变），别的页面的规则完全不参与解析：列表页 / 帖子页 / 通知页这类常用页面少解析 25%–50% 的 CSS。
// 判定保守：选择器里带 [data-nsmax-page=X]（页面明确标记）或括号外出现某个页面专属的类名前缀才算专属；
// 一条规则里只要有一个选择器拿不准、或者分属两个页面，整条留在 base（宁可多注入，不能少样式）。
const pageMarkers = [
	["post", /\.nsk-post\b|ul\.comments\b|\.content-item\b|\.nsmax-author-col\b|\.nsk-content-meta-info\b|\.nsmax-floor\b|\.nsmax-op-|\.nsmax-post-stats\b|\.nsmax-title-stats\b|\.comment-container\b|\.reply-panel\b|\.nsmax-nested\b|\.nsmax-reply\b|\.topic-warning\b|\.post-table\b/],
	["editor", /\.md-editor\b|\.nsmax-editor\b|\.nsmax-compose\b|\.CodeMirror\b/],
	["notification", /\.nspp-messages\b|\.nsmax-notice\b|\.nsmax-message\b|\.nspp-message\b|\.dm-/],
	["setting", /#user-setting-panel\b|\.nsmax-setting\b/],
	["auth", /\.nsmax-auth\b|\[data-nsmax-auth|\.nsmax-password-toggle\b/],
	["fans", /\.nsmax-member\b|\.user-card-wrapper\b|\.fans-switcher\b|\.nsmax-fans\b/],
	["board", /\.nsmax-board\b|\.rank-row\b|\.top-rank\b|\.nsmax-checkin\b/],
	["lucky", /\.sample-panel\b|\.nsmax-lucky\b|\.lucky-|\.nsmax-draw\b/],
	["space", /\.discussion-wrapper\b|\.nsmax-space\b|\.head-container\b|\.profile-head\b/],
	["search", /\.nsmax-search\b/],
	["credit", /\.credit-|\.nsmax-credit\b|\.points-/]
];
const anchoredPatternOf = (pattern) => new RegExp("^(?:" + pattern.source + ")");
const topLevelMatch = (selector, pattern) => {
	const anchoredPattern = anchoredPatternOf(pattern);
	let depth = 0;
	for (let index = 0; index < selector.length; index++) {
		const char = selector[index];
		if (char === "(") depth++;
		else if (char === ")") depth = Math.max(0, depth - 1);
		else if (depth === 0 && anchoredPattern.test(selector.slice(index))) return true;
	}
	return false;
};
const pageScopeOf = (selector) => {
	const scopes = new Set();
	let depth = 0;
	for (let index = 0; index < selector.length; index++) {
		const char = selector[index];
		if (char === "(") depth++;
		else if (char === ")") depth = Math.max(0, depth - 1);
		else if (depth === 0) {
			const match = selector.slice(index).match(/^\[data-nsmax-page=(?:"([a-z]+)"|([a-z]+))\]/);
			if (match) scopes.add(match[1] || match[2]);
		}
	}
	return scopes;
};
// 需要交互才出现的浮层（弹窗、用户卡、搜索面板、toast、图片预览、阅读进度条……）：首帧用不到，
// 单独放进 overlay 段。运行时先注入页面段，主内容就绪后的空闲时段再补 overlay；
// 用户在那之前就移动鼠标 / 按下键 / 打开弹窗时也会先补上（见 ui-runtime 的 nsmaxEnsureOverlayCss）。
// 顶栏的 ≡（.nsmax-mobile-menu）不是浮层：它在顶栏里，「版块放得下时藏起来」那条也在这些规则里。2026-10-23 以前它也算浮层，
// 首帧之后才补上样式，≡ 先露出来把搜索框往左挤 48px、过一会儿再藏回去（顶栏晃一下）；手机上顶栏按钮的样式也跟着晚到
const overlaySelector = /(^|[\s>+~,(])(?:dialog|\.nspp-post-preview|\.nspp-user-hover|\.hover-user-card|\.nsmax-person-pop|\.nsmax-pop|\.nsmax-toast|\.nsmax-picker|\.nsmax-shortcuts|\.nsmax-mobile-nav|\.nsmax-lightbox|\.nspp-image-preview|\.search-overlay|\.nsmax-progress|\.nsmax-ruling-dialog|\.nsmax-lucky-dialog)/;
// :not(浮层) 说的是「不是浮层的元素」，不能因为里面写了浮层的类名就把整条规则当浮层
const withoutNot = (selector) => selector.replace(/:not\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, "");
const chunkOfRule = (rule) => {
	// 所有选择器都是「交互才出现」的浮层时，整条规则进 overlay 段
	if (rule.selectors.every((selector) => overlaySelector.test(withoutNot(selector)))) return "overlay";
	const chunks = new Set();
	for (const selector of rule.selectors) {
		const scopes = pageScopeOf(selector);
		if (scopes.size > 1) return "base";
		if (scopes.size === 1) { chunks.add([...scopes][0]); continue; }
		const hits = new Set();
		for (const [name, pattern] of pageMarkers) if (topLevelMatch(selector, pattern)) hits.add(name);
		if (hits.size !== 1) return "base";
		chunks.add([...hits][0]);
	}
	return chunks.size === 1 ? [...chunks][0] : "base";
};
const segments = [];
const pushSegment = (chunk, text) => {
	const last = segments[segments.length - 1];
	if (last && last[0] === chunk) last[1] += text;
	else segments.push([chunk, text]);
};
const segmentRoot = postcss.parse(shipped);
for (const node of segmentRoot.nodes) {
	if (node.type === "rule") { pushSegment(chunkOfRule(node), node.toString()); continue; }
	if (node.type !== "atrule") continue;
	// @keyframes / @font-face 之类的整块放 base（各页面的动画都可能用到它）
	if (!["media", "supports"].includes(node.name)) { pushSegment("base", node.toString()); continue; }
	let run = null;
	let children = 0;
	const flush = () => {
		if (!run) return;
		pushSegment(run.chunk, `@${node.name} ${node.params}{${run.css}}`);
		run = null;
	};
	for (const child of node.nodes || []) {
		children++;
		if (child.type === "rule") {
			const chunk = chunkOfRule(child);
			if (run && run.chunk === chunk) run.css += child.toString();
			else { flush(); run = { chunk, css: child.toString() }; }
		} else {
			flush();
			pushSegment("base", `@${node.name} ${node.params}{${child.toString()}}`);
		}
	}
	flush();
	if (!children) pushSegment("base", node.toString());
}
// 校验：拆出来的段按顺序拼起来，规则（连同所在 @media 外壳）、顺序、选择器、声明必须和整份 CSS 完全一致
const flattenTheme = (css) => {
	const list = [];
	const walk = (node, context) => {
		for (const child of node.nodes || []) {
			if (child.type === "rule") list.push(JSON.stringify([context, child.selector, child.nodes.map((decl) => decl.prop + ":" + decl.value + (decl.important ? "!" : "")).join(";")]));
			else if (child.type === "atrule") {
				if (/keyframes/.test(child.name)) list.push(JSON.stringify([context, "@" + child.name + " " + child.params, child.toString().length]));
				else if (child.nodes) walk(child, context.concat("@" + child.name + " " + child.params));
				else list.push(JSON.stringify([context, "@" + child.name + " " + child.params, ""]));
			}
		}
	};
	walk(postcss.parse(css), []);
	return list;
};
const themeBefore = flattenTheme(shipped);
const themeAfter = flattenTheme(segments.map(([, css]) => css).join(""));
if (themeBefore.length !== themeAfter.length) throw new Error(`主题分块后规则数变了（${themeBefore.length} → ${themeAfter.length}）`);
for (let index = 0; index < themeBefore.length; index++) {
	if (themeBefore[index] !== themeAfter[index]) throw new Error(`主题分块后第 ${index} 条规则对不上：\n${themeBefore[index]}\n${themeAfter[index]}`);
}
source = source.replace(/\tvar (?:modern_theme_compiled|nsmax_theme_segments) = .*;\n/, "");
source = source.replace("\tvar hot_sidebar_default = `", "\tvar nsmax_theme_segments = " + JSON.stringify(segments) + ";\n\tvar hot_sidebar_default = `");
source = source.replace("_css(modern_theme_default);", "_css(nsmaxThemeCss(), true);");
if (process.argv.includes("--check")) {
  if (source !== original || themeSource !== originalTheme) throw new Error("SB suite or adapter is stale; run npm run sb");
} else {
  writeFileSync(themePath, themeSource);
  writeFileSync(scriptPath, source);
}
console.log(`SB suite compiled: ${shipped.length} characters (${compiled.length} before decoy short-names)`);
