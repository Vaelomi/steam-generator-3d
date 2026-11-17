const { chromium } = require('C:/Users/23288/.workbuddy/skills/unslop/node_modules/playwright-core');
const path=require('path');
(async()=>{
 const b=await chromium.launch();
 for (const w of [1440,900,390]) {
  const p=await b.newPage({viewport:{width:w,height:w===390?844:900}});
  await p.goto('file:///'+path.resolve('index.html').replace(/\\/g,'/')); await p.waitForTimeout(2200);
  const box=await p.locator('.scene-toolbar').boundingBox();
  const vis=await p.evaluate(()=>[...document.querySelectorAll('.scene-toolbar .view-button')].map(b=>[b.textContent, getComputedStyle(b).display]));
  console.log(w, JSON.stringify(box), JSON.stringify(vis));
  await p.locator('.scene-toolbar').screenshot({path:`tools/toolbar-${w}.png`});
  await p.close();
 }
 await b.close();
})();
