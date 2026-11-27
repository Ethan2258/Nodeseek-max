"use strict";
// 回复框打字（2026-11-27）：每按一个键都不该引起整页整理，长回复时页面也不该上下跳
const test=require("node:test"),assert=require("node:assert/strict");
const {webkit,devices}=require("playwright"),{launch,open}=require("./harness.cjs"),P=require("./fixtures/pages.cjs");
const seed={"nspp:settings:www.nodeseek.com":{"attendance":{enabled:false},"modern-theme":{font:"system"}}};
const engines=(process.env.NSMAX_MOBILE_ENGINES||"chromium,webkit").split(",");
const ready=p=>p.waitForFunction(()=>performance.getEntriesByName("nsmax:deferred-start").length&&!document.documentElement.hasAttribute("data-nsmax-mounting"));
const layouts=[["电脑",{viewport:{width:1440,height:900},seed},false],["手机",{viewport:{width:390,height:844},device:{...devices["iPhone 13"],viewport:{width:390,height:844}},seed},true]];
// 帖子页多几层楼：回复框在页面下半截，长高、缩回会牵动整页
const longPost=(mobile)=>{
 const html=P.postPage({mobile}),start=html.indexOf('<li class="content-item" id="3">'),end=html.indexOf("</ul>",start),one=html.slice(start,end);
 let extra="";
 for(let i=4;i<24;i++)extra+=one.replace(/id="3"/,`id="${i}"`).replace(/href="#3"/,`href="#${i}"`).replace(/>#3</,`>#${i}<`);
 return html.slice(0,end)+extra+html.slice(end);
};
const editorState=p=>p.evaluate(()=>{
 const input=document.querySelector("#nsk-body-left .md-editor textarea"),editor=input.closest(".md-editor"),status=editor.querySelector(".nsmax-editor-status");
 return{height:editor.style.getPropertyValue("--nsmax-editor-height"),status:status?.textContent,statusNodes:status?.childNodes.length,box:Math.round(input.getBoundingClientRect().height),fits:input.scrollHeight<=input.clientHeight+1};
});
for(const engine of engines){
 let browser;
 test.before(async()=>{browser=engine==="webkit"?await webkit.launch():await launch();});
 test.after(async()=>{await browser?.close();});
 test(`${engine} 回复框打字：标题栏「已写 N 字」照常跟着变，但不再每按一个键引起一轮整页整理`,async()=>{
  for(const [label,options] of layouts){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...options,html:P.postPage({mobile:label==="手机"})});
   try{
    await ready(page);
    const input=page.locator("#nsk-body-left .md-editor textarea").first();
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await page.waitForTimeout(700);
    const before=await page.evaluate(()=>performance.getEntriesByName("nsmax:batch").length);
    const text="晚高峰丢包吗 hello world 再问一句";
    await page.keyboard.type(text,{delay:30});
    await page.waitForTimeout(700);
    const batches=await page.evaluate(n=>performance.getEntriesByName("nsmax:batch").slice(n).map(e=>e.detail),before);
    // 以前状态字换一次就整页整理一轮（打这句话要十来轮）
    assert.ok(batches.length<=1,`${label}：打字期间整页整理了 ${batches.length} 轮（${batches.join(" / ")}）`);
    const state=await editorState(page);
    assert.equal(state.status,`已写 ${[...text.trim()].length} 字`,label);
    assert.equal(state.statusNodes,1,`${label}：状态字还是一个文字节点`);
    // 清空回到「说两句」
    await input.fill("");
    await page.waitForFunction(()=>document.querySelector("#nsk-body-left .md-editor .nsmax-editor-status")?.textContent==="说两句");
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
 test(`${engine} 长回复：回复框按内容长高（最多 800px）、删短了缩回；长到顶以后接着打字，页面不上下跳`,async()=>{
  for(const [label,options,mobile] of layouts){
   const {context,page,errors}=await open(browser,"https://www.nodeseek.com/post-1000-1",{...options,html:longPost(mobile)});
   try{
    await ready(page);
    const input=page.locator("#nsk-body-left .md-editor textarea").first();
    await input.scrollIntoViewIfNeeded();
    await input.click();
    // 一段比框高的草稿：框跟着长高
    await input.evaluate(t=>{t.value=Array.from({length:8},(_,i)=>`第 ${i+1} 行：这是一段比较长的回复内容`).join("\n")+"\n";t.dispatchEvent(new Event("input",{bubbles:true}));t.selectionStart=t.selectionEnd=t.value.length;});
    await page.waitForTimeout(200);
    const grown=await editorState(page);
    assert.ok(parseFloat(grown.height)>150&&parseFloat(grown.height)<800,`${label}：${JSON.stringify(grown)}`);
    assert.ok(grown.fits,`${label}：长高以后内容放得下 ${JSON.stringify(grown)}`);
    // 再加几行：接着长高
    await page.keyboard.type("再加一行\n再加一行\n再加一行\n",{delay:20});
    await page.waitForTimeout(200);
    const more=await editorState(page);
    assert.ok(parseFloat(more.height)>parseFloat(grown.height),`${label}：加了几行接着长高 ${grown.height} → ${more.height}`);
    assert.ok(more.fits,`${label}：${JSON.stringify(more)}`);
    // 长到顶（800px）以后在最后一行接着打字：页面停在原处（以前每按一个键框先缩回 150px 再长回来，页面跟着上下跳几十像素）
    await input.evaluate(t=>{t.value=Array.from({length:40},(_,i)=>`第 ${i+1} 行：这是一段比较长的回复内容，用来看回复框长到顶以后每按一个键的样子`).join("\n")+"\n";t.dispatchEvent(new Event("input",{bubbles:true}));t.selectionStart=t.selectionEnd=t.value.length;});
    // 一下长高好几百像素：光标所在的最后一行当场跟着留在窗口里、框里也滚到了最后一行。
    // 以前框底（光标）被推出窗口，下一键 Safari 把光标滚到窗口正中，页面一下跳 936px（Chromium 只滚一点，量不出来）
    const follow=await input.evaluate(t=>({bottom:Math.round(t.getBoundingClientRect().bottom),view:innerHeight,rest:Math.round(t.scrollHeight-t.clientHeight-t.scrollTop)}));
    assert.ok(follow.bottom<=follow.view+1&&follow.rest<=1,`${label}：长高以后光标被推出窗口 ${JSON.stringify(follow)}`);
    await page.keyboard.type("继");
    await page.waitForTimeout(200);
    assert.equal((await editorState(page)).height,"800px",label);
    await page.evaluate(()=>{window.__heightWrites=[];new MutationObserver(records=>{for(const record of records)window.__heightWrites.push(record.target.style.getPropertyValue("--nsmax-editor-height"));}).observe(document.querySelector("#nsk-body-left .md-editor"),{attributes:true,attributeFilter:["style"]});});
    const positions=[];
    for(const ch of "续写一点 hello"){
     await page.keyboard.type(ch);
     await page.waitForTimeout(30);
     positions.push(await page.evaluate(()=>Math.round(scrollY)));
    }
    // 字只多不少、高度已经到顶：一次都不用改高度
    assert.deepEqual(await page.evaluate(()=>window.__heightWrites),[],`${label}：打字时改了回复框高度`);
    // 光标那一行换行时浏览器自己会把它滚进来（几个像素到十几像素），以前手机上每按一个键页面要往上跳八十多像素再回来
    assert.ok(Math.max(...positions)-Math.min(...positions)<=40,`${label}：打字时页面跳动 ${positions.join(",")}`);
    // 删短：缩回去
    await input.fill("短");
    await page.waitForTimeout(200);
    assert.equal((await editorState(page)).height,"150px",`${label}：删短了缩回默认高度`);
    // 用户自己拖过高度以后不再自动改
    await page.evaluate(()=>document.querySelector("#nsk-body-left .md-editor").setAttribute("data-nsmax-resized",""));
    await page.keyboard.type(Array.from({length:10},()=>"\n多一行").join(""));
    await page.waitForTimeout(200);
    assert.equal((await editorState(page)).height,"150px",`${label}：手动调过高度就不再自动长高`);
    assert.deepEqual(errors,[]);
   }finally{await context.close();}
  }
 });
}
