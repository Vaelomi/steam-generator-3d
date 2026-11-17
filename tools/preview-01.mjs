const task = await taskSpace("CAP 蒸汽发生器三维图谱");
const page = task.page("p1");
await page.goto("http://127.0.0.1:8972/", { timeout: 30000 });
await page.waitForFunction(() => window.CAP_SG?.ready || document.querySelector("#loading")?.textContent.includes("未能初始化"), undefined, { timeout: 30000 });
console.log({taskSpaceId:task.spaceId,page:page.label,state:await page.evaluate(()=>({ready:!!window.CAP_SG?.ready,diagnostics:window.CAP_SG?.diagnostics(),viewport:[innerWidth,innerHeight],loading:document.querySelector("#loading").textContent,errors:window.__errors||[]}))});
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/01-initial.png"})});
console.log(await page.snapshot());
