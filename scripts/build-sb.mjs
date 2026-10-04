import { readFileSync, writeFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const root = new URL("../", import.meta.url);
const scriptPath = new URL("nodeseek-max.user.js", root);
let source = readFileSync(scriptPath, "utf8").replace(/\r\n?/g, "\n");
const original = source;
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
  const suite = css.toString();
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
    const variables = rule.nodes.some(node => node.type === "decl" && node.prop.startsWith("--nsmax-"));
    const bindings = /(?:md-editor|comment-menu|nsk-pager|data-nsmax-pg|data-nsmax-pm|data-nsmax-sort|data-nsmax-md-hint|data-nsmax-ed|data-nsmax-icon|\.nsmax-icon|data-nsmax-header-hide|data-nsmax-own-hide|data-nsmax-hidden|data-nsmax-dup|nspp-confirm)/.test(rule.selector);
    if (!variables && !bindings) { rule.remove(); return; }
  }
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
ast.walkComments(comment => comment.remove());
const optimize = {};
vm.runInNewContext(source.slice(source.indexOf("\tfunction nsmaxSplitTop"), source.indexOf("\tvar __create")), optimize);
ast.walkRules(rule => {
  if (!rule.selector.includes(":is(")) return;
  rule.selector = optimize.nsmaxSplitTop(rule.selector, c=>c===",").flatMap(part=>optimize.nsmaxExpandSelector(part.trim()) || [part.trim()]).join(",");
});
const compiled = ast.toString();
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
