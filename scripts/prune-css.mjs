// 构建时去掉「永远轮不到」的声明（2026-11-27）：主题是一层层叠出来的（旧主题 → 适配层 → 设计层 → 手机层），
// 后面的层经常对同一个选择器把同一个属性再写一遍。前面那条在任何页面、任何元素上都赢不了，却照样要解析、
// 每次重算样式都要参与层叠。这里只删能证明永远不生效的那些，判定（全部满足才删）：
//   1. 这条声明所在规则里的每一个选择器 s，都有另一条声明 D 写着同一属性、所在规则里有选择器 t 和 s 匹配同一批元素
//      （同一个选择器；或者只差 :is(#x, *)、:root 这类只加特异度的垫片，见 matchKey），而且 t 的特异度比 s 高（先后不论），
//      或者一样高、D 写在后面（同一条规则里靠后的重复声明也算）。选择器列表里一个元素同时命中几条时，
//      取它命中的特异度最高的那条比，结论不变。:-webkit-any() / :matches() / :nth-child(… of S) 的特异度
//      nsmaxSpecificity 算得和浏览器不一样，带着它们的只和一模一样的选择器比（见 keyOf）；
//      D 所在规则的选择器列表里别的选择器也得各家都认识：顶层选择器列表不宽容，有一条不认识整条规则作废（见 safeSelector）；
//   2. 优先级不低于它：它带 !important 时 D 也得带；
//   3. 条件不比它窄：后面那条所在的 @media / @supports / @container 条件是它的条件的子集（顶层没有条件，算任何条件的子集），
//      其它 @ 规则（@layer、@starting-style 之类）要完全相同；@keyframes / @font-face 之类里面的一律不动；
//      不带名字的 @layer {} 每一块是单独一层（带 !important 时前面那层反而赢），里面的一律不比；
//   4. 它在的时候 D 一定也注入了：D 在同一段、base 段，或者它在「X+touch」这种组合段、D 在 X 或 touch 段
//      （组合段注入时这两段一定在，见 nsmaxThemeChunkKeys）。特异度一样高、靠先后定输赢时还要在同一张样式表里：
//      浮层段（overlay、overlay+touch）是另一张晚注入的样式表，只和同一段比；
//   5. D 在所有浏览器里都解析得了（不然前面那条是兼容写法、留着兜底）：值完全相同；或者是自定义属性、值里有 var()
//      （属性认识就一定接受；自定义属性的值不能是空的）；或者不含新近才有的函数、关键字、厂商前缀和不认识的单位
//      （下面的 risky / knownUnit，宁可多列：沾上就不删）。值写错了（color: rde）这里看不出来，源文件里别写错。
// 删完空掉的规则、空掉的 @media 一并去掉。返回删了多少，供构建输出用。一次判定完再删：D 自己也被盖住时，
// 盖住 D 的那条同样盖住它（特异度、先后、条件、段的关系都能传递）

const conditional = new Set(["media", "supports", "container"]);
const skipped = /^(?:-[a-z]+-)?(?:keyframes|font-face|font-feature-values|counter-style|property|page|font-palette-values|view-transition)$/;
// 新近才有（Safari 16.0 / Chrome 110 / Firefox 115 里不一定有）或者各家支持不齐的写法：D 的值沾上这些，前面那条当兜底留着
const riskyFunction = /(?:^|[^\w-])(?:color-mix|light-dark|round|mod|rem|abs|sign|sin|cos|tan|asin|acos|atan2?|pow|sqrt|hypot|log|exp|anchor|anchor-size|calc-size|if|progress|random|sibling-index|sibling-count|attr|image-set|cross-fade|element|paint|env|lab|lch|oklab|oklch|hwb|color|contrast-color|xywh|rect|shape|ray)\(/i;
// 各家早就都有的单位：别的（dvh、cqw、vi、lh、q、x……还有写错的 10pxx）都当拿不准
const knownUnit = /^(?:px|em|rem|ex|ch|vw|vh|vmin|vmax|cm|mm|in|pt|pc|deg|grad|rad|turn|s|ms|hz|khz|dpi|dpcm|dppx|fr)$/i;
const numberUnit = /(?:^|[^\w#.-])[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?([a-z]+)/gi;
const riskyKeyword = /(?:^|[^\w-])(?:stretch|fill-available|available|allow-discrete|anchor-center|subgrid|masonry|balance|pretty|stable|both-edges|auto-phrase|safe|unsafe|last\s+baseline|first\s+baseline|text-box|trim-both|cap|alphabetic|ideographic|from-font|match-parent|fit-content|max-content|min-content|start|end|self-start|self-end|smooth|overlay|contain|clip|plus-lighter|display-p3|srgb|rec2020|light|dark|normal\s+dark|anywhere|collapse|math|revert-layer)(?![\w-])/i;
export function safeValue(prop, value) {
	// 空的自定义属性（--x:;）老一点的浏览器不认
	if (prop.startsWith("--")) return value.trim() !== "";
	if (value.includes("var(")) return true;
	// 字符串、url() 里的内容不算
	const bare = value.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/gi, "url()").replace(/"[^"]*"|'[^']*'/g, '""');
	if (/\\/.test(bare)) return false;
	if (/(?:^|[^\w])-(?:webkit|moz|ms|o)-/i.test(bare)) return false;
	// 两个关键字的 display（inline flex，Chrome 115 起）、带替代文字的 content（"x" / ""，Safari 17.4 起）、
	// 渐变里指定插值色彩空间（linear-gradient(in oklab, …)，Safari 16.2 起）
	if (prop === "display" && /\S\s+\S/.test(bare.trim())) return false;
	if (prop === "content" && bare.includes("/")) return false;
	if (/(?:^|[\s(,])in\s+[a-z]/i.test(bare)) return false;
	for (const [, unit] of bare.matchAll(numberUnit)) if (!knownUnit.test(unit)) return false;
	return !riskyFunction.test(bare) && !riskyKeyword.test(bare);
}
// 各家早就都认识的伪类 / 伪元素：选择器里有别的（厂商前缀、:focus-visible、::picker()、:nth-child(… of S)……）就算拿不准
const knownPseudo = new Set(["is", "where", "not", "root", "hover", "active", "focus", "focus-within", "visited", "link", "any-link", "target", "first-child", "last-child", "only-child", "nth-child", "nth-last-child", "first-of-type", "last-of-type", "only-of-type", "nth-of-type", "nth-last-of-type", "empty", "checked", "disabled", "enabled", "required", "optional", "valid", "invalid", "in-range", "out-of-range", "read-only", "read-write", "placeholder-shown", "indeterminate", "default", "lang", "defined", "before", "after", "first-line", "first-letter", "placeholder", "selection"]);
export function safeSelector(selector) {
	// 字符串、属性选择器里的冒号不算
	const bare = selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""').replace(/\[[^\]]*\]/g, "[]");
	if (/:nth-(?:last-)?child\([^)]*\bof\b/i.test(bare)) return false;
	for (const [, name] of bare.matchAll(/::?([\w-]+)/g)) if (!knownPseudo.has(name.toLowerCase())) return false;
	return true;
}

const contextOf = (rule) => {
	const chain = [];
	for (let node = rule.parent; node && node.type !== "root"; node = node.parent) {
		if (node.type !== "atrule") return null;
		if (skipped.test(node.name)) return null;
		chain.unshift({ name: node.name, params: node.params, conditional: conditional.has(node.name) });
	}
	return chain;
};
// 后面那条的条件是不是前面那条的子集：带条件的 @ 规则每一个都要在前面那条里出现；不带条件的（@layer 之类）两边要一模一样
const anonymousLayer = (item) => item.name === "layer" && !item.params.trim();
const contextCovers = (later, earlier) => {
	if (later.some(anonymousLayer) || earlier.some(anonymousLayer)) return false;
	const strictLater = later.filter((item) => !item.conditional).map((item) => item.name + " " + item.params);
	const strictEarlier = earlier.filter((item) => !item.conditional).map((item) => item.name + " " + item.params);
	if (strictLater.join("\n") !== strictEarlier.join("\n")) return false;
	const earlierSet = new Set(earlier.filter((item) => item.conditional).map((item) => item.name + " " + item.params));
	return later.every((item) => !item.conditional || earlierSet.has(item.name + " " + item.params));
};
const isOverlay = (chunk) => chunk === "overlay" || chunk.startsWith("overlay+") || chunk.endsWith("+overlay");
// earlier 段里的规则被 later 段里的规则盖住时，两段是不是一定同时注入、同一张样式表、later 在后
export const chunkCovers = (earlierChunk, laterChunk) => {
	if (earlierChunk === laterChunk) return true;
	if (isOverlay(earlierChunk) || isOverlay(laterChunk)) return false;
	if (laterChunk === "base") return true;
	return earlierChunk.includes("+") && earlierChunk.split("+").includes(laterChunk);
};

// 只加特异度的垫片去掉以后的样子：匹配的元素完全一样（:is(#x, *) 这类垫片什么都匹配；开头 html 那一段里的 :root、
// :is(:root,#x#x#x) 只匹配根元素，html 本来就是根元素）
const padPattern = /:is\((?:x|#x|\.x)+, ?\*\)/g;
export function matchKey(selector) {
	const key = selector.replace(padPattern, "");
	const head = key.match(/^html(?:\[[^\]]*\]|:root|:is\(:root, ?(?:#x)+\))*/);
	return head ? head[0].replace(/:root|:is\(:root, ?(?:#x)+\)/g, "") + key.slice(head[0].length) : key;
}
// nsmaxSpecificity 和浏览器算得不一样的几种（:-webkit-any() / :matches() 浏览器只算一个伪类，:nth-child(… of S) 还要加上 S 的）：
// 带着它们的选择器不去垫片，只和一模一样的选择器比（一模一样时特异度怎么算都相等）
const exoticSpecificity = /:(?:-webkit-any|-moz-any|matches)\(|:nth-(?:last-)?child\([^)]*\bof\b/i;
const keyOf = (selector, wide) => wide && !exoticSpecificity.test(selector) ? matchKey(selector) : selector;
// earlier 段的规则在的时候 later 段一定也在（不管哪张样式表）
const chunkPresent = (earlierChunk, laterChunk) => laterChunk === "base" || laterChunk === earlierChunk || earlierChunk.includes("+") && earlierChunk.split("+").includes(laterChunk);
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// root：postcss 的根节点（会被直接改）；chunksOf(rule)：Map<选择器, 段名>；
// specificity(selector)：[id, class, type]。给了 specificity 时，只差特异度垫片的选择器也算同一批元素：
// 特异度更高的那条不管先后都赢（两段同时注入即可），一样高的要排在后面
export function pruneOverridden(root, chunksOf, specificity = null) {
	const rules = [];
	let seq = 0;
	root.walk((node) => {
		if (node.type === "decl") { node.__seq = seq++; return; }
		if (node.type !== "rule") return;
		const context = contextOf(node);
		if (!context) return;
		rules.push({ rule: node, context, chunks: chunksOf(node), index: rules.length });
	});
	// 选择器 → 写着它的规则（按出现顺序）
	const bySelector = new Map();
	for (const entry of rules) {
		entry.decls = new Map();
		for (const decl of entry.rule.nodes) {
			if (decl.type !== "decl") continue;
			const prop = decl.prop.startsWith("--") ? decl.prop : decl.prop.toLowerCase();
			if (!entry.decls.has(prop)) entry.decls.set(prop, []);
			entry.decls.get(prop).push(decl);
		}
		entry.specs = new Map();
		// 选择器列表里拿不准的那几条（某个浏览器不认识时整条规则作废）
		entry.risky = [...new Set(entry.rule.selectors)].filter((selector) => !safeSelector(selector)).map((selector) => keyOf(selector, !!specificity));
		for (const selector of new Set(entry.rule.selectors)) {
			const key = keyOf(selector, !!specificity);
			if (specificity) entry.specs.set(selector, specificity(selector));
			if (!bySelector.has(key)) bySelector.set(key, []);
			bySelector.get(key).push({ entry, selector });
		}
	}
	const covered = (entry, selector, decl, prop) => {
		const earlierChunk = entry.chunks.get(selector);
		const ownSpec = entry.specs.get(selector);
		const key = keyOf(selector, !!specificity);
		for (const { entry: other, selector: otherSelector } of bySelector.get(key)) {
			const otherChunk = other.chunks.get(otherSelector);
			// 特异度：没给就是同一个选择器，一样高
			const order = specificity ? compare(other.specs.get(otherSelector), ownSpec) : 0;
			if (order < 0) continue;
			if (other !== entry && !contextCovers(other.context, entry.context)) continue;
			// D 所在规则里有别的拿不准的选择器：那个浏览器里整条规则作废，D 不在。和 s 一样的那条不算（s 自己也就不在）
			if (other !== entry && other.risky.some((riskyKey) => riskyKey !== key)) continue;
			if (order > 0 ? !chunkPresent(earlierChunk, otherChunk) : other.index < entry.index || !chunkCovers(earlierChunk, otherChunk)) continue;
			for (const candidate of other.decls.get(prop) || []) {
				if (order === 0 && candidate.__seq <= decl.__seq) continue;
				if (candidate === decl) continue;
				if (decl.important && !candidate.important) continue;
				if (candidate.value === decl.value || safeValue(prop, candidate.value)) return true;
			}
		}
		return false;
	};
	const dead = [];
	for (const entry of rules) {
		const selectors = [...new Set(entry.rule.selectors)];
		for (const [prop, decls] of entry.decls) for (const decl of decls) {
			if (selectors.every((selector) => covered(entry, selector, decl, prop))) dead.push({ entry, decl });
		}
	}
	let bytes = 0, rulesRemoved = 0, atRulesRemoved = 0;
	for (const { decl } of dead) { bytes += decl.toString().length + 1; decl.remove(); }
	for (const entry of rules) {
		// 只去掉删空了的规则（本来就没有声明、或者里面还嵌着别的规则的不动）
		if (entry.rule.nodes.length || !entry.decls.size) continue;
		bytes += entry.rule.toString().length;
		let parent = entry.rule.parent;
		entry.rule.remove();
		rulesRemoved++;
		while (parent && parent.type === "atrule" && conditional.has(parent.name) && !parent.nodes.length) {
			const up = parent.parent;
			bytes += parent.toString().length;
			parent.remove();
			atRulesRemoved++;
			parent = up;
		}
	}
	root.walk((node) => { delete node.__seq; });
	return { declarations: dead.length, rules: rulesRemoved, atRules: atRulesRemoved, bytes, total: seq };
}
