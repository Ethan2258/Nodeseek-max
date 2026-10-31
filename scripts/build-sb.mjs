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
// 手机层单独加权，源文件保持简洁；只在 data-nsmax-touch 生效，避免与历次桌面适配互相叠加。
const mobile = readFileSync(new URL("theme/mobile.css", root), "utf8").replace(/\r\n?/g, "\n")
  .replaceAll("html[data-nsmax-theme][data-nsmax-touch]", "html[data-nsmax-theme][data-nsmax-touch]:is(#nsmax-a,*):is(#nsmax-b,*):is(#nsmax-c,*):is(#nsmax-d,*):is(#nsmax-e,*)");
const design = [readFileSync(new URL("theme/design.css", root), "utf8").replace(/\r\n?/g, "\n"), mobile].join("\n")
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
// 祖先位置的多参数 :is() 拆开（2026-10-24）：浏览器给每个元素配规则时，先用「祖先里有没有这些类名 / ID / 标签」的布隆过滤器快速排除，
// 写在祖先位置的 :is(A, B, C) 它不认识，只能每个元素都往上一层层对（真站首页 192 条这样的规则占了选择器匹配时间的四分之一）。
// 拆成 A…、B…、C… 几条以后每条都能被快速排除。只在完全等价时拆：
//   - 这一段（两个组合符之间）整个就是 :is(…)：选项是复合选择器时直接替换；选项带组合符（#nsk-body-left article.post-content）时
//     只有前面就是开头的 html… 一段加后代空格才等价（html 是所有元素的祖先）；
//   - 拆出来的每一条都补回原来的特异度（:is 取选项里最大的；垫片 :is(…, *) 接在最右边一段、伪元素前面，什么都匹配、只加特异度），
//     补不平（某一项得减）就整条不拆；第一段（html… 和特异度垫片）、带 * 的 :is（垫片）、:where 都不动；拆出来超过 8 条不拆
function selectorTokens(selector) {
  const parts = [];
  let depth = 0, quote = "", buf = "";
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (quote) { buf += c; if (c === "\\") buf += selector[++i] ?? ""; else if (c === quote) quote = ""; continue; }
    if (c === "\"" || c === "'") { quote = c; buf += c; continue; }
    if (c === "\\") { buf += c + (selector[++i] ?? ""); continue; }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) {
      let j = i, comb = " ";
      while (j < selector.length && /\s/.test(selector[j])) j++;
      if (/[>+~]/.test(selector[j])) { comb = selector[j]; j++; while (j < selector.length && /\s/.test(selector[j])) j++; }
      if (buf) { parts.push(buf, comb); buf = ""; }
      else if (parts.length && comb !== " ") parts[parts.length - 1] = comb;
      i = j - 1;
      continue;
    }
    buf += c;
  }
  if (buf) parts.push(buf);
  return parts;
}
const joinSelectorTokens = (parts) => parts.map((part, i) => i % 2 ? (part === " " ? " " : part) : part).join("");
function wholeIsArgs(compound) {
  if (!compound.startsWith(":is(")) return null;
  let depth = 0;
  for (let i = 3; i < compound.length; i++) {
    if (compound[i] === "(") depth++;
    else if (compound[i] === ")" && --depth === 0) return i === compound.length - 1 ? compound.slice(4, i) : null;
  }
  return null;
}
function expandAncestorIs(selector) {
  const parts = selectorTokens(selector);
  if (parts.length < 3) return null;
  // 最右边一段带类名 / ID / 属性的：浏览器本来就只拿带这个类名（ID、属性）的少数元素来试，拆了几乎没用，只多出规则；
  // 只拆最右边是标签（a、svg、li…）或通配的——这些要拿页面上每个同名标签（或每个元素）试一遍
  if (/[.#[]/.test(optimize.nsmaxStripParens(parts[parts.length - 1]))) return null;
  const total = optimize.nsmaxSpecificity(selector);
  let variants = [parts];
  let changed = false;
  for (let k = 2; k < parts.length - 1; k += 2) {
    const inner = wholeIsArgs(parts[k]);
    if (inner === null) continue;
    const args = optimize.nsmaxSplitTop(inner, c => c === ",").map(arg => arg.trim());
    if (args.length < 2 || args.some(arg => !arg || arg === "*" || /^[>+~]/.test(arg) || arg.includes("&") || /nsmax-(?:s|u|lv|b|c|a)\b/.test(arg))) continue;
    const complex = args.some(arg => selectorTokens(arg).length > 1);
    if (complex && !(k === 2 && /^html(?=[[:.#]|$)/.test(parts[0]) && parts[1] === " ")) continue;
    const next = [];
    for (const variant of variants) for (const arg of args) {
      const copy = variant.slice();
      copy[k] = arg;
      next.push(copy);
    }
    if (next.length > 8) return null;
    variants = next;
    changed = true;
  }
  if (!changed) return null;
  const out = [];
  for (const variant of variants) {
    const spec = optimize.nsmaxSpecificity(joinSelectorTokens(variant));
    const pad = [total[0] - spec[0], total[1] - spec[1], total[2] - spec[2]];
    if (pad.some(n => n < 0)) return null;
    if (pad.some(n => n > 0)) {
      const last = variant.length - 1;
      const at = variant[last].search(/::|:(?:before|after|first-line|first-letter)(?![\w-])/);
      const padText = optimize.nsmaxSpecificityPad(pad);
      variant[last] = at >= 0 ? variant[last].slice(0, at) + padText + variant[last].slice(at) : variant[last] + padText;
    }
    const text = joinSelectorTokens(variant);
    if (optimize.nsmaxSpecificity(text).join() !== total.join()) return null;
    out.push(text);
  }
  return out;
}
ast.walkRules(rule => {
  if (!rule.selector.includes(":is(")) return;
  rule.selector = optimize.nsmaxSplitTop(rule.selector, c => c === ",").flatMap(part => expandAncestorIs(part.trim()) || [part.trim()]).join(",");
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
// 只换完整的垫片名：`.nsmax-s` 后面不能再跟字母或连字符，否则会把 .nsmax-space-top、.nsmax-sb-account
// 这类真类名一起截断（第一次就是这么把个人空间、侧滑资料卡、快捷键的样式改没的）
const shortenPads = (css) => css
  .replace(/#nsmax-(?:u|lv|b|c|d|s|a|e)(?![-\w])/g, "#x").replace(/#nsmax-s([12])(?![-\w])/g, "#x$1")
  .replace(/\.nsmax-s(?![-\w])/g, ".x").replace(/(?<![#.\w-])nsmax-s(?![-\w])/g, "x");
let shipped = shortenPads(compiled);
shipped = shipped.replaceAll("[data-nsmax-palette=claude]", ":root");
// 工具条、精简顶栏两段样式也在构建时拆好 :is()：以前页面每次打开都要在运行时逐条读规则再改回去（CPU 4 倍降速下约 80ms）
const bootSheet = (name) => {
  const sheet = postcss.parse(readFileSync(new URL(`theme/${name}.css`, root), "utf8").replace(/\r\n?/g, "\n"));
  sheet.walkComments((comment) => comment.remove());
  sheet.walkRules((rule) => {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    rule.selector = optimize.nsmaxSplitTop(rule.selector, (c) => c === ",").flatMap((part) => optimize.nsmaxExpandSelector(part.trim()) || [part.trim()]).join(",");
  });
  sheet.walk((node) => {
    node.raws.before = "";
    if (node.type === "decl") node.raws.between = ":";
    else if (node.type === "rule" || node.type === "atrule") {
      node.raws.between = "";
      node.raws.after = "";
      node.raws.semicolon = false;
    }
  });
  sheet.raws.after = "";
  return shortenPads(sheet.toString());
};
for (const [variable, name] of [["nsmax_tools_css", "tools"], ["nsmax_header_css", "header"]]) {
  const compiledSheet = bootSheet(name);
  source = source.replace(new RegExp(`\\tvar ${variable} = .*;\\n`), () => `\tvar ${variable} = ${JSON.stringify(compiledSheet)};\n`);
}
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
	["notification", /\.nspp-messages\b|\.nsmax-notice\b|\.nsmax-message\b|\.nspp-message\b|\.dm-|\.nsk-notification\b|\.app-switch\b|\.talk-list\b|\.talk-item\b|\.message-wrapper\b|\.message-item\b|\.message-input\b/],
	["setting", /#user-setting-panel\b|\.nsmax-setting\b/],
	["auth", /\.nsmax-auth\b|\[data-nsmax-auth|\.nsmax-password-toggle\b/],
	["fans", /\.nsmax-member\b|\.user-card-wrapper\b|\.fans-switcher\b|\.nsmax-fans\b/],
	["board", /\.nsmax-board\b|\.rank-row\b|\.top-rank\b|\.nsmax-checkin\b|\.board-container\b|\.board-list\b|\.board-item\b/],
	// 帖子列表（首页、版块、精华、搜索……都算 list 页）：这些结构只在列表页出现（帖子页、个人主页、通知页的网页里都没有，脚本也不在别处造），
	// 2026-10-23 起单独一段，别的页面不再解析这近 40KB
	["list", /ul\.post-list\b|\.post-list-item\b|\.post-list-controler\b|\.post-list-content\b|\.info-author\b|\.info-views\b|\.info-comments-count\b|\.info-last-commenter\b|\.info-last-comment-time\b|\.topic-carousel|\.nsmax-kind-tab|\.nsmax-inline-category\b|\.nsmax-meta-icon\b|\.post-category\b|\[data-nsmax-lottery-view\]/],
	["ruling", /\.ruling-log\b|\.nsmax-ruling\b/],
	["lucky", /\.sample-panel\b|\.nsmax-lucky\b|\.lucky-|\.nsmax-draw\b/],
	["space", /\.discussion-wrapper\b|\.nsmax-space\b|\.head-container\b|\.profile-head\b/],
	// 手机顶栏的 .nsmax-search-close 每一页都有，不是搜索页专属
	["search", /\.nsmax-search(?!-close)\b/],
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
// 上面留在 base 的规则再按设备和列表页筛一遍（2026-10-30）：手机首页 47 万字符的样式里，一半的选择器在这一页根本匹配不上。
// 这几段不改变别的页面看到的规则集合，只有下面说的情况才少注入，所以可以按选择器拆（同一条规则的选择器之间没有先后，声明也一样，拆开层叠结果不变），
// 类名在 :is() / :where() 里也算数（构建早先拆出来的 :where(.post-content table):is(.x, *) 就是这样）：
//   body：帖子页、发帖页的结构（页面专属段的 post、editor 标记，加上帖子正文、提醒卡片、楼层操作），首页、版块、搜索这几种纯列表页的网页里都没有，
//         脚本也不在那里造（悬停预览的正文在 overlay 段）。只有纯列表页不注入，见 nsmaxThemeChunkKeys；
//   side：右栏，手机版网页（服务器按手机 UA 输出）没有；touch：手机布局，只有粗指针设备用得上。这两段看设备，判断错了运行时能补（nsmaxThemeRequire）
const wideMarkers = [
	["body", new RegExp(`${pageMarkers[0][1].source}|${pageMarkers[1][1].source}|\\.post-content(?![\\w-])|\\.comment-content(?![\\w-])|\\.markdown-body(?![\\w-])|\\.nsk-content(?![\\w-])|\\.important-note(?![\\w-])|\\.important-reminder(?![\\w-])|\\.new-discussion-notes(?![\\w-])|\\.warning-block(?![\\w-])|\\.post-bottom-pager(?![\\w-])|\\.comment-menu(?![\\w-])|\\.vote-panel(?![\\w-])|\\.vote-stat(?![\\w-])|\\.nsk-post-wrapper(?![\\w-])|\\.nsmax-lottery-table(?![\\w-])|\\.nsmax-lottery-actions(?![\\w-])|\\.nsmax-lucky-side(?![\\w-])|#login-panel(?![\\w-])|#register-panel(?![\\w-])`)],
	["side", /#nsk-right-panel-container(?![\w-])/],
	["touch", /\[data-nsmax-touch\]/]
];
// 一个选择器必须匹配的位置上命中了哪些宽段：括号外的类名，加上 :is() / :where()——单个参数就当括号外看，多个参数时每个参数都有的才算
const wideHits = (selector) => {
	const hits = new Set();
	let compound = "";
	const flush = () => {
		for (const [name, pattern] of wideMarkers) if (topLevelMatch(compound, pattern)) hits.add(name);
		compound = "";
	};
	for (const node of selector.nodes) {
		if (node.type === "combinator") flush();
		else if (node.type === "pseudo" && (node.value === ":is" || node.value === ":where") && node.nodes.length) {
			const args = node.nodes.map(wideHits);
			for (const name of args[0]) if (args.every((set) => set.has(name))) hits.add(name);
		}
		else compound += node.toString();
	}
	flush();
	return hits;
};
const wideChunkOf = (selector) => {
	if (overlaySelector.test(withoutNot(selector)) || pageScopeOf(selector).size) return "base";
	const hits = wideHits(selectorParser().astSync(selector).nodes[0]);
	return wideMarkers.find(([name]) => hits.has(name))?.[0] ?? "base";
};
// 一条规则放进哪些段：[[段, 规则文本], …]
const piecesOfRule = (rule) => {
	const chunk = chunkOfRule(rule);
	if (chunk !== "base") return [[chunk, rule.toString()]];
	const groups = new Map();
	for (const selector of rule.selectors) {
		const wide = wideChunkOf(selector);
		if (!groups.has(wide)) groups.set(wide, []);
		groups.get(wide).push(selector);
	}
	return [...groups].map(([name, selectors]) => {
		if (groups.size === 1) return [name, rule.toString()];
		const piece = rule.clone();
		piece.selector = selectors.join(",");
		return [name, piece.toString()];
	});
};
const segments = [];
const pushSegment = (chunk, text) => {
	const last = segments[segments.length - 1];
	if (last && last[0] === chunk) last[1] += text;
	else segments.push([chunk, text]);
};
const segmentRoot = postcss.parse(shipped);
for (const node of segmentRoot.nodes) {
	if (node.type === "rule") { for (const [chunk, text] of piecesOfRule(node)) pushSegment(chunk, text); continue; }
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
			for (const [chunk, text] of piecesOfRule(child)) {
				if (run && run.chunk === chunk) run.css += text;
				else { flush(); run = { chunk, css: text }; }
			}
		} else {
			flush();
			pushSegment("base", `@${node.name} ${node.params}{${child.toString()}}`);
		}
	}
	flush();
	if (!children) pushSegment("base", node.toString());
}
// 校验：拆出来的段按顺序拼起来，规则（连同所在 @media 外壳）、顺序、选择器、声明必须和整份 CSS 完全一致；
// 一条规则拆成的几段紧挨着，选择器合起来正好是原来那些
const flattenTheme = (css) => {
	const list = [];
	const walk = (node, context) => {
		for (const child of node.nodes || []) {
			if (child.type === "rule") list.push({ key: JSON.stringify([context, child.nodes.map((decl) => decl.prop + ":" + decl.value + (decl.important ? "!" : "")).join(";")]), selectors: child.selectors });
			else if (child.type === "atrule") {
				if (/keyframes/.test(child.name)) list.push({ key: JSON.stringify([context, "@" + child.name + " " + child.params, child.toString().length]), selectors: [] });
				else if (child.nodes) walk(child, context.concat("@" + child.name + " " + child.params));
				else list.push({ key: JSON.stringify([context, "@" + child.name + " " + child.params, ""]), selectors: [] });
			}
		}
	};
	walk(postcss.parse(css), []);
	return list;
};
const themeBefore = flattenTheme(shipped);
const themeAfter = flattenTheme(segments.map(([, css]) => css).join(""));
let themeCursor = 0;
for (const [index, rule] of themeBefore.entries()) {
	// 选择器列表里偶尔有重复的，按个数比
	const left = rule.selectors.slice();
	do {
		const piece = themeAfter[themeCursor++];
		const taken = piece?.key === rule.key && piece.selectors.every((selector) => {
			const at = left.indexOf(selector);
			if (at >= 0) left.splice(at, 1);
			return at >= 0;
		});
		if (!taken) throw new Error(`主题分块后第 ${index} 条规则对不上：\n${JSON.stringify(rule)}\n${JSON.stringify(piece)}`);
	} while (left.length);
}
if (themeCursor !== themeAfter.length) throw new Error(`主题分块后规则数变了（${themeBefore.length} → ${themeAfter.length}）`);
// 高频长串换成单个字符（2026-10-30）：这几串占了段文本的三成多。油猴注入脚本要等的时间跟着体积走，少几十万字符比注入前多花几毫秒还原划算。
// 选的都是主题里没出现过的字符，注入前由 nsmaxThemeUnpack 还原
const themeTokens = [["`", "!important"], ["$", "html[data-nsmax-theme]"], ["|", ":is(:root,#x#x#x)"], ["&", ":is(#x, *)"], ["§", "data-nsmax-"], ["¶", ":root:root:root"], ["¤", "#nsk-body-left"]];
const packTheme = (css) => {
  for (const [token] of themeTokens) if (css.includes(token)) throw new Error(`主题里出现了压缩用的字符 ${token}`);
  return themeTokens.reduce((packed, [token, text]) => packed.replaceAll(text, () => token), css);
};
const unpackPattern = `/[${themeTokens.map(([token]) => token).join("")}]/g`;
if (!source.includes(`css.replace(${unpackPattern},`)) throw new Error(`nsmaxThemeUnpack 的字符集要和 themeTokens 一致：${unpackPattern}`);
const packedSegments = segments.map(([chunk, css]) => [chunk, packTheme(css)]);
const unpackTheme = (css) => css.replace(new RegExp(`[${themeTokens.map(([token]) => token).join("")}]`, "g"), (token) => themeTokens.find(([key]) => key === token)[1]);
for (const [index, [, css]] of packedSegments.entries()) if (unpackTheme(css) !== segments[index][1]) throw new Error(`主题第 ${index} 段压缩后还原不回来`);
source = source.replace(/\tvar nsmax_theme_tokens = .*;\n/, "");
source = source.replace(/\tvar (?:modern_theme_compiled|nsmax_theme_segments) = .*;\n/, "");
source = source.replace("\tvar hot_sidebar_default = `", () => "\tvar nsmax_theme_tokens = " + JSON.stringify(Object.fromEntries(themeTokens)) + ";\n\tvar nsmax_theme_segments = " + JSON.stringify(packedSegments) + ";\n\tvar hot_sidebar_default = `");
source = source.replace("_css(modern_theme_default);", "_css(nsmaxThemeCss(), true);");
if (process.argv.includes("--check")) {
  if (source !== original || themeSource !== originalTheme) throw new Error("SB suite or adapter is stale; run npm run sb");
} else {
  writeFileSync(themePath, themeSource);
  writeFileSync(scriptPath, source);
}
console.log(`SB suite compiled: ${shipped.length} characters (${compiled.length} before decoy short-names)`);
