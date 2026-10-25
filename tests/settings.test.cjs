"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {launch,open} = require("./harness.cjs");
const {listPage,postPage,spaceTopicsPage,fansPage} = require("./fixtures/pages.cjs");
const KEY = "nspp:settings:www.nodeseek.com";
let browser;
test.before(async()=>{browser=await launch();});
test.after(async()=>{await browser?.close();});
const ready = page => page.waitForFunction(()=>document.documentElement.hasAttribute("data-nsmax-theme")&&!document.documentElement.hasAttribute("data-nsmax-mounting")&&performance.getEntriesByName("nsmax:deferred-start").length);
const settings = async page => {await page.getByRole("button",{name:"NodeSeek Max 设置",exact:true}).click();return page.locator("#nspp-settings");};

test("设置真实生效：个人主页主题帖计数只在开启时读取，关闭后不请求帖子",async()=>{
 for(const enabled of [true,false]) {
  const calls=[];
  const {context,page,errors}=await open(browser,"https://www.nodeseek.com/space/10#/discussions",{
   html:spaceTopicsPage(),seed:{[KEY]:{"discussion-stats":{enabled}}},
   beforeNavigate:p=>p.route(/\/post-\d+-1$/,async route=>{
    calls.push(route.request().url());
    const id=Number(new URL(route.request().url()).pathname.match(/post-(\d+)/)[1]);
    const data={postData:{postId:id,postPage:1,postPageCount:1,views:123,comments:[{floorIndex:3}]}};
    await route.fulfill({status:200,contentType:"text/html",body:`<!doctype html><script id="temp-script" type="application/json">${Buffer.from(JSON.stringify(data)).toString("base64")}</script>`});
   })
  });
  try {
   await ready(page);
   if(enabled) {
    await page.waitForSelector(".nspp-discussion-stats:not([hidden])");
    assert.match(await page.locator(".nspp-discussion-stats").first().innerText(),/123/);
    assert.ok(calls.length>0);
   } else {await page.waitForTimeout(800);assert.equal(calls.length,0);assert.equal(await page.locator(".nspp-discussion-stats").count(),0);}
   assert.deepEqual(errors,[]);
  } finally {await context.close();}
 }
});

test("设置真实生效：粉丝页悬停资料卡开关控制卡片和资料请求",async()=>{
 for(const enabled of [true,false]) {
  const {context,page,errors,calls}=await open(browser,"https://www.nodeseek.com/fans?type=fans",{html:fansPage(),seed:{[KEY]:{"sb-person-hover":{enabled}}}});
  try {
   await ready(page);
   const before=Object.entries(calls).filter(([k])=>k.startsWith("/api/account/getInfo/")).reduce((s,[,n])=>s+n,0);
   await page.locator(".nsmax-member a[href*='/space/']").first().hover();
   if(enabled) await page.waitForSelector(".nsmax-person-pop");
   else {await page.waitForTimeout(400);assert.equal(await page.locator(".nsmax-person-pop").count(),0);assert.equal(Object.entries(calls).filter(([k])=>k.startsWith("/api/account/getInfo/")).reduce((s,[,n])=>s+n,0),before);}
   assert.deepEqual(errors,[]);
  } finally {await context.close();}
 }
});

test("设置真实生效：关闭中文时间后，列表时间刷新不再把英文改回中文；重复的旧开关移除",async()=>{
 const html=listPage().replace(/(<time\b[^>]*>)[^<]*(<\/time>)/g,"$13 days ago$2");
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html,seed:{[KEY]:{"reading-content":{enabled:true,chineseTime:false}}}});
 try {
  await ready(page);
  assert.match(await page.locator(".info-last-comment-time").first().innerText(),/days ago/);
  const host=await settings(page);
  assert.equal(await host.locator('.module[data-feature="list-interactions"]').count(),0);
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("设置输入有效：热榜条数保存为 5–50 的整数，空输入不保存为零",async()=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage()});
 try {
  const host=await settings(page),input=host.locator('[data-feature="hot-rankings"][data-key="sidebarCount"]');
  for(const [value,want] of [["52",50],["2",5],["12.8",12]]) {
   await input.fill(value);await input.press("Tab");
   assert.equal(await input.inputValue(),String(want));
   assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem("__gm__:"+key))["hot-rankings"].sidebarCount,KEY),want);
  }
  await input.fill("");await input.press("Tab");
  assert.equal(await input.inputValue(),"12");
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("设置键盘可用：分段选项和分类标签支持 Home、End，刷新后保持选择",async()=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage()});
 try {
  let host=await settings(page);
  const group=host.getByRole("radiogroup",{name:"列表标题字号",exact:true});
  await group.getByRole("radio",{name:"大",exact:true}).focus();
  await page.keyboard.press("End");
  assert.equal(await group.getByRole("radio",{name:"特大",exact:true}).getAttribute("aria-checked"),"true");
  await host.getByRole("tab",{name:"外观",exact:true}).focus();await page.keyboard.press("End");
  assert.equal(await host.getByRole("tab",{name:"关于",exact:true}).getAttribute("aria-selected"),"true");
  await page.keyboard.press("Home");
  assert.equal(await host.getByRole("tab",{name:"外观",exact:true}).getAttribute("aria-selected"),"true");
  await page.reload();host=await settings(page);
  assert.equal(await host.getByRole("radiogroup",{name:"列表标题字号",exact:true}).getByRole("radio",{name:"特大",exact:true}).getAttribute("aria-checked"),"true");
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("设置保存少做重复工作：选中同一选项和重复 change 不再写油猴存储",async()=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage()});
 try {
  const host=await settings(page);
  await page.evaluate(key=>{const set=Storage.prototype.setItem;window.__settingWrites=0;Storage.prototype.setItem=function(k,v){if(k==="__gm__:"+key)window.__settingWrites++;return set.call(this,k,v);};},KEY);
  const radio=host.getByRole("radiogroup",{name:"列表标题字号",exact:true}).getByRole("radio",{name:"特大",exact:true});
  await radio.click();await radio.click();
  await host.locator('select[data-feature="modern-theme"][data-key="fontSize"]').dispatchEvent("change");
  assert.equal(await page.evaluate(()=>window.__settingWrites),1);
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("清空缓存：删除现用资料、字体和预取诊断缓存，保留设置、备注和阅读记录",async()=>{
 const init=`(()=>{if(window.top!==window||sessionStorage.getItem("__cacheSeeded"))return;sessionStorage.setItem("__cacheSeeded","1");localStorage.setItem("nsmax:font:unused","cached-font");sessionStorage.setItem("nsmax:person:999999",JSON.stringify({at:Date.now(),data:{member_id:999999}}));localStorage.setItem("nsmax:prefetch-stats",JSON.stringify({recent:[0,1]}));localStorage.setItem("nsmax:recent:keep",JSON.stringify([{path:"/post-1234-1",title:"保留阅读记录"}]));})();`;
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage(),init,seed:{[KEY]:{"modern-theme":{font:"system"},"user-notes":{notes:"user0=保留备注"}}}});
 try {
  const host=await settings(page);
  await Promise.all([page.waitForEvent("domcontentloaded"),host.getByRole("button",{name:"清空缓存",exact:true}).click()]);
  const state=await page.evaluate(key=>({font:localStorage.getItem("nsmax:font:unused"),person:sessionStorage.getItem("nsmax:person:999999"),stats:localStorage.getItem("nsmax:prefetch-stats"),record:localStorage.getItem("nsmax:recent:keep"),settings:JSON.parse(localStorage.getItem("__gm__:"+key))}),KEY);
  assert.equal(state.font,null);assert.equal(state.person,null);assert.equal(state.stats,null);
  assert.match(state.record,/保留阅读记录/);assert.equal(state.settings["user-notes"].notes,"user0=保留备注");
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("全部设置可保存：逐个操作所有可见字段和开关，重新加载后逐项保持一致",async(t)=>{
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage(),viewport:{width:1440,height:900}});
 try {
  let host=await settings(page);
  const fields=await host.locator(".module input[data-key],.module select[data-key],.module textarea[data-key]").evaluateAll(nodes=>nodes.map(n=>({feature:n.dataset.feature,key:n.dataset.key,type:n.type,tab:n.closest(".page").dataset.tab,value:n.type==="checkbox"?n.checked:n.value,options:n.tagName==="SELECT"?[...n.options].map(o=>o.value):null})));
  const names={appearance:"外观",reading:"浏览",people:"用户",tools:"工具",network:"网络"};
  const modules=new Set(fields.map(f=>f.feature));
  assert.equal(modules.size,21,"仅保留实际有作用的设置组");
  assert.ok(fields.length>=40,"遍历全部可见配置字段");
  t.diagnostic(`逐项核对 ${modules.size} 组设置、${fields.length} 个字段与开关`);
  const expected=[];
  for(const tab of Object.keys(names)) {
   await host.getByRole("tab",{name:names[tab],exact:true}).click();
   // 子选项先改，最后再关总开关，验证不会因 inert 把子项操作漏掉。
   const inTab=fields.filter(f=>f.tab===tab).sort((a,b)=>Number(a.key==="enabled")-Number(b.key==="enabled"));
   for(const f of inTab) {
    const selector=`[data-feature="${f.feature}"][data-key="${f.key}"]`;
    const control=host.locator(selector);
    let value;
    if(f.type==="checkbox") {value=!f.value;await control.setChecked(value);}
    else if(f.options) {value=f.options.findLast(o=>o!==f.value);await control.locator("..").locator(`[role=radio][data-value="${value}"]`).click();}
    else {value=f.type==="number"?12:f.key==="notes"?"user0=测试备注":f.key==="hidden"?"生活\nDev":"__settings_audit__";await control.fill(String(value));await control.press("Tab");}
    expected.push({...f,value});
   }
  }
  assert.equal(await host.getByRole("button",{name:"刷新应用设置",exact:true}).count(),1,"明确说明改动已保存、刷新应用");
  await page.reload();host=await settings(page);
  for(const f of expected) {
   const control=host.locator(`[data-feature="${f.feature}"][data-key="${f.key}"]`);
   if(f.type==="checkbox") assert.equal(await control.isChecked(),f.value,`${f.feature}.${f.key}`);
   else assert.equal(await control.inputValue(),String(f.value),`${f.feature}.${f.key}`);
  }
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("旧配置与导入仍可用：无总开关的功能不会被旧 disabled 卡住；导入校验范围，导出和重置均生效",async()=>{
 const seed={[KEY]:{"modern-theme":{enabled:false,font:"system"},"sidebar-nav":{enabled:false,hidden:"技术"},"request-settings":{enabled:false,pace:"slow"}}};
 const {context,page,errors}=await open(browser,"https://www.nodeseek.com/",{html:listPage(),seed});
 try {
  await ready(page);
  assert.equal(await page.locator('#nsk-head ul.nav-menu a[href="/categories/tech"]').isVisible(),false,"旧 disabled 不再阻止顶栏配置");
  const host=await settings(page);
  const imported={format:"nodeseek-plus-plus",schema:1,settings:{"hot-rankings":{enabled:true,sidebar:true,sidebarCount:999},"modern-theme":{enabled:false,font:"system",fontSize:"not-a-choice"},"user-notes":{enabled:true,notes:"user0=导入测试"}}};
  await host.locator('input[type=file]').setInputFiles({name:"settings.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(imported))});
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem("__gm__:"+key))["user-notes"]?.notes==="user0=导入测试",KEY);
  const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem("__gm__:"+key)),KEY);
  assert.equal(stored["hot-rankings"].sidebarCount,50);assert.equal(stored["modern-theme"].fontSize,"large");assert.equal(stored["modern-theme"].enabled,true);
  const downloadEvent=page.waitForEvent("download");
  await host.getByRole("button",{name:"导出配置",exact:true}).click();
  const download=await downloadEvent;
  const stream=await download.createReadStream();let text="";for await(const chunk of stream)text+=chunk.toString();
  const exported=JSON.parse(text);assert.equal(exported.schema,1);assert.equal(exported.settings["user-notes"].notes,"user0=导入测试");assert.equal(exported.settings["hot-rankings"].sidebarCount,50);
  await host.getByRole("button",{name:"恢复默认",exact:true}).click();
  const reset=await page.evaluate(key=>JSON.parse(localStorage.getItem("__gm__:"+key)),KEY);
  assert.equal(reset["user-notes"].notes,"");assert.equal(reset["hot-rankings"].sidebarCount,10);
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});

test("关闭增强真实生效：图片、复制、高亮、Callout、备注、折叠、签到、热榜和预取均不再启动",async()=>{
 const ids=["infinite-scroll","reading-content","reading-focus","content-filter","user-notes","attendance","compose","image-upload","hot-rankings","notification-categories","instant-pages","official-blocklist","code-highlight","post-preview","sb-recent-visits","sb-my-replies","sb-person-hover"];
 const config=Object.fromEntries(ids.map(id=>[id,{enabled:false}]));
 config["user-notes"].notes="seller=不应出现";config["content-filter"].keywords="线路";
 const html=postPage().replace("</article>",'<blockquote><p>[!NOTE] 标记</p><p>内容</p></blockquote><pre><code class="language-javascript">const value = 1;</code></pre><img src="/avatar/10.png" alt="开关验证图片"></article>');
 const {context,page,errors,calls}=await open(browser,"https://www.nodeseek.com/post-1000-1",{html,seed:{[KEY]:config}});
 try {
  await ready(page);
  for(const selector of ["[data-nsmax-copy]",".hljs",".nspp-callout",".nspp-user-note",".nsmax-fold-toggle",".nsmax-hot-panel",".nsmax-recent-panel",".nsmax-my-replies","script[type=speculationrules]",".nspp-upload"]) assert.equal(await page.locator(selector).count(),0,selector);
  assert.equal(calls["/api/attendance"]||0,0);
  assert.equal(await page.evaluate(()=>window.__gmRequests.some(url=>url.includes("api.bimg.eu.org"))),false);
  await page.getByAltText("开关验证图片").click();
  assert.equal(await page.locator(".viewer-container").count(),0,"不拦截打开脚本图片查看器");
  assert.deepEqual(errors,[]);
 } finally {await context.close();}
});
