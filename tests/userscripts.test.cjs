"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {webkit,devices}=require("playwright");const {launch,open,ROOT}=require("./harness.cjs");const P=require("./fixtures/pages.cjs");
const KEY="nspp:settings:www.nodeseek.com";
let browser,chromium;
test.before(async()=>{browser=await webkit.launch();chromium=await launch();});
test.after(async()=>{await browser?.close();await chromium?.close();});
const mobile={device:{...devices["iPhone 13"],viewport:{width:390,height:844}},manager:{type:"userscripts",delay:20,legacyXhr:false}};
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const settings=async page=>{await page.getByRole("button",{name:"NodeSeek Max 设置",exact:true}).tap();return page.locator("#nspp-settings");};

test("Userscripts / WebKit：只有异步 GM API 也能读取设置、保存并在刷新后保持",async()=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...mobile,html:P.postPage({mobile:true}),seed:{[KEY]:{"attendance":{enabled:false},"user-notes":{enabled:true,notes:"seller=手机备注"}}}});
 try {
  await ready(page);assert.ok((await page.locator(".nspp-user-note").allTextContents()).some(s=>s.includes("手机备注")));
  const host=await settings(page),large=host.getByRole("radiogroup",{name:"列表标题字号",exact:true}).getByRole("radio",{name:"特大",exact:true});
  assert.equal(await host.getByRole("button",{name:"刷新应用设置",exact:true}).isEnabled(),true);
  await large.tap();await page.waitForFunction(key=>JSON.parse(localStorage.getItem("__gm__:"+key))["modern-theme"]?.fontSize==="xlarge",KEY);
  await page.waitForFunction(()=>document.getElementById("nspp-settings").shadowRoot.querySelector("button.primary").textContent==="刷新应用设置");
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),null,"偏好留在管理器存储，不复制到网站的 localStorage");
  await Promise.all([page.waitForEvent("domcontentloaded"),host.getByRole("button",{name:"刷新应用设置",exact:true}).tap()]);await ready(page);
  assert.equal(await page.locator("html").getAttribute("data-nsmax-size"),"xlarge");
  const again=await settings(page);await again.getByRole("tab",{name:"关于",exact:true}).tap();
  assert.match(await again.locator(".about-features").innerText(),/Safari Userscripts/);assert.doesNotMatch(await again.locator(".about-features").innerText(),/UserScripts API Dynamic/);
  await again.getByRole("button",{name:"检查更新",exact:true}).first().tap();await page.waitForFunction(()=>document.querySelector(".nsmax-toast")?.textContent.includes("最新版本"));
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("Userscripts：异步保存失败不会刷新丢失改动，重试成功后才重新加载",async()=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile,html:P.listPage({mobile:true})});
 try {
  await ready(page);const host=await settings(page);let navigations=0;page.on("framenavigated",frame=>{if(frame===page.mainFrame())navigations++;});
  await page.evaluate(()=>{window.__userscriptsFailSettings=true;});
  await host.getByRole("radiogroup",{name:"列表标题字号",exact:true}).getByRole("radio",{name:"特大",exact:true}).tap();
  await page.waitForFunction(()=>document.getElementById("nspp-settings").shadowRoot.querySelector("button.primary").textContent.includes("重试"));
  await host.getByRole("button",{name:"重试保存并刷新",exact:true}).tap();
  await page.waitForFunction(()=>document.getElementById("nspp-settings").shadowRoot.querySelector("button.primary").textContent==="重试保存并刷新");assert.equal(navigations,0);
  await page.evaluate(()=>{window.__userscriptsFailSettings=false;});
  await Promise.all([page.waitForEvent("domcontentloaded"),host.getByRole("button",{name:"重试保存并刷新",exact:true}).tap()]);await ready(page);
  assert.equal(await page.locator("html").getAttribute("data-nsmax-size"),"xlarge");assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("Userscripts：存储读取失败保留原数据并明确禁用保存，不用默认值覆盖",async()=>{
 const original={"modern-theme":{fontSize:"xlarge"}};
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{...mobile,manager:{type:"userscripts",failRead:true},html:P.listPage({mobile:true}),seed:{[KEY]:original}});
 try {await ready(page);const host=await settings(page);assert.equal(await host.getByRole("button",{name:"刷新应用设置",exact:true}).isDisabled(),true);assert.match(await host.locator(".status").innerText(),/Userscripts 存储未就绪/);assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem("__gm__:"+key)),KEY),original);assert.deepEqual(await page.evaluate(()=>window.__userscriptsWrites),[]);assert.deepEqual(errors,[]);}finally{await context.close();}
});

test("Userscripts：站内外链直达开关在异步存储模式下同样生效",async()=>{
 for(const enabled of [false,true]) {
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/jump?to=https%3A%2F%2Fexample.org%2Ftarget",{...mobile,html:"<!doctype html><p>外链跳转</p>",seed:{[KEY]:{"reading-content":{enabled:true,cleanLinks:enabled}}}});
  try {if(enabled)await page.waitForURL("https://example.org/target");else{await ready(page);assert.match(page.url(),/\/jump\?/);}assert.deepEqual(errors,[]);}finally{await context.close();}
 }
});

test("Userscripts 隔离世界：原生 CodeMirror 可通过工具栏编辑，GM API 没有暴露给页面",async()=>{
 const {context,page,errors}=await open(chromium,"https://www.nodeseek.com/post-1000-1",{html:P.postPage(),script:false});
 try {
  await page.evaluate(()=>{
   const original=document.querySelector(".md-editor textarea");original.style.display="none";
   const wrapper=document.createElement("div");wrapper.className="CodeMirror";wrapper.innerHTML='<div class="CodeMirror-scroll"><div class="CodeMirror-code"><pre>原生内容</pre></div></div><textarea aria-label="原生编辑输入"></textarea>';original.after(wrapper);
   let value="原生内容";const events=new Map(),options={};
   const emit=type=>{for(const fn of events.get(type)||[])fn(api,{from:{line:0,ch:0},to:{line:0,ch:value.length},text:[value],origin:"test"});};
   const api={getValue:()=>value,setValue(v){value=v;emit("change");},getSelection:()=>value,getCursor:()=>({line:0,ch:0}),setSelection(){},replaceSelection(v){value=v;emit("change");},replaceRange(v){value+=v;emit("change");},getOption:key=>options[key],setOption(key,v){options[key]=v;},refresh(){},focus(){wrapper.querySelector("textarea").focus();emit("focus");},lineCount:()=>1,setCursor(){},on(type,fn){let set=events.get(type);if(!set)events.set(type,set=new Set());set.add(fn);},off(type,fn){events.get(type)?.delete(fn);}};
   wrapper.CodeMirror=api;window.__nativeCM=api;
  });
  const client=await context.newCDPSession(page);const tree=await client.send("Page.getFrameTree");const world=await client.send("Page.createIsolatedWorld",{frameId:tree.frameTree.frame.id,worldName:"userscripts-test"});
  const before=await client.send("Runtime.evaluate",{contextId:world.executionContextId,expression:'({config:typeof window.__config__,cm:typeof document.querySelector(".CodeMirror").CodeMirror})',returnByValue:true});assert.deepEqual(before.result.value,{config:"undefined",cm:"undefined"});
  const shim=`window.GM_info={scriptHandler:"Userscripts"};const store=new Map([[${JSON.stringify(KEY)},{"attendance":{enabled:false}}]]);window.GM={info:GM_info,async getValue(k,f){return store.has(k)?structuredClone(store.get(k)):f;},async setValue(k,v){store.set(k,structuredClone(v));},async listValues(){return [...store.keys()];}};window.GM_xmlhttpRequest=d=>{setTimeout(()=>d.onload?.({status:200,responseText:"// @version 1.0.0"}),20);return{abort(){}};};`;
  const source=fs.readFileSync(process.env.NSMAX_SCRIPT_PATH||path.join(ROOT,"nodeseek-max.user.js"),"utf8");await client.send("Runtime.evaluate",{contextId:world.executionContextId,expression:shim+"\n"+source});
  await page.waitForSelector(".nsmax-editor-controls");await page.locator(".nsmax-editor-controls").getByRole("button",{name:"Markdown",exact:true}).click();
  await page.locator(".nsmax-custom-mde-toolbar").getByRole("button",{name:"粗体",exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__nativeCM.getValue()),"**原生内容**");assert.equal(await page.evaluate(()=>typeof window.GM),"undefined");
  const editorPane=page.locator(".nsmax-editor-surface > [data-nsmax-editor-pane]");assert.equal(await editorPane.evaluate(e=>getComputedStyle(e).borderTopLeftRadius),"6px");
  const selection=await page.evaluate(()=>{const cm=document.querySelector(".CodeMirror"),selected=document.createElement("div");selected.className="CodeMirror-selected";selected.style.borderRadius="9px";cm.append(selected);const radius=getComputedStyle(selected).borderTopLeftRadius;selected.remove();return radius;});assert.equal(selection,"0px","文字选中层保持直角，外框仍为圆角");
  await page.locator(".nsmax-editor-controls").getByRole("button",{name:"预览",exact:true}).click();assert.match(await page.locator(".nsmax-editor-preview").innerText(),/原生内容/);assert.deepEqual(errors,[]);
  await client.detach();
 } finally {await context.close();}
});

test("Userscripts：页面禁止桥接时保留可用的原生编辑器与设置",async()=>{
 const {context,page,errors}=await open(chromium,"https://www.nodeseek.com/post-1000-1",{html:P.postPage(),script:false});
 try {
  await page.evaluate(()=>{const meta=document.createElement("meta");meta.httpEquiv="Content-Security-Policy";meta.content="script-src 'none'";document.head.append(meta);});
  const client=await context.newCDPSession(page),tree=await client.send("Page.getFrameTree");
  const world=await client.send("Page.createIsolatedWorld",{frameId:tree.frameTree.frame.id,worldName:"userscripts-csp-test"});
  const shim='const GM_info={scriptHandler:"Userscripts"},store=new Map();const GM={info:GM_info,async getValue(k,f){return store.has(k)?store.get(k):f;},async setValue(k,v){store.set(k,v);},async listValues(){return [...store.keys()];}};';
  const source=fs.readFileSync(process.env.NSMAX_SCRIPT_PATH||path.join(ROOT,"nodeseek-max.user.js"),"utf8");
  await client.send("Runtime.evaluate",{contextId:world.executionContextId,expression:shim+"\n"+source});await ready(page);
  const native=page.locator('.md-editor[data-nsmax-native-editor]');
  assert.equal(await native.locator('.mde-toolbar').isVisible(),true);assert.equal(await native.locator('textarea').isVisible(),true);
  assert.equal(await page.locator('.nsmax-editor-controls').count(),0);
  await native.locator('textarea').fill('原生编辑仍然可用');assert.equal(await native.locator('textarea').inputValue(),'原生编辑仍然可用');
  await page.getByRole('button',{name:'NodeSeek Max 设置',exact:true}).click();
  assert.match(await page.locator('#nspp-settings').locator('.status').innerText(),/原生编辑器/);
  assert.equal(await page.locator('#nspp-settings').getByRole('button',{name:'刷新应用设置',exact:true}).isEnabled(),true);
  assert.deepEqual(errors.filter(e=>!/Content Security Policy|violates.*directive|Executing inline script/i.test(e)),[]);
  await client.detach();
 }finally{await context.close();}
});
