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
source = source.replace("\tvar style_default$1 = ", "\tvar settings_sb_default = " + JSON.stringify(settingsCss) + ";\n\tvar style_default$1 = ");
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
vm.runInNewContext(source.slice(source.indexOf("\tvar NSMAX_ACCENTS = {"), source.indexOf("\tvar modern_theme_compiled = ")) + themeSource, context);
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
const compiled = ast.toString();
const leftoverHas = [];
ast.walkRules(rule => {
  if (rule.selector.includes(":has(")) leftoverHas.push(...rule.selectors.filter(selector => selector.includes(":has(")));
});
if (leftoverHas.length) throw new Error("主题里不能再有 :has()（会让 NodeSeek 的终端渲染卡死整页），请在 nsmaxTagStructure() 里打属性，或加进 hasRewrites：\n" + leftoverHas.join("\n"));
source = source.replace(/\tvar modern_theme_compiled = .*;\n/, "");
source = source.replace("\tvar hot_sidebar_default = `", "\tvar modern_theme_compiled = " + JSON.stringify(compiled) + ";\n\tvar hot_sidebar_default = `");
source = source.replace("_css(modern_theme_default);", "_css(modern_theme_compiled, true);");
if (process.argv.includes("--check")) {
  if (source !== original || themeSource !== originalTheme) throw new Error("SB suite or adapter is stale; run npm run sb");
} else {
  writeFileSync(themePath, themeSource);
  writeFileSync(scriptPath, source);
}
console.log(`SB suite compiled: ${compiled.length} characters`);
