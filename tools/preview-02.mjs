const task = await taskSpace(7);
const page = task.page("p1");
await page.reload();
await page.waitForFunction(()=>window.CAP_SG?.ready,undefined,{timeout:30000});
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/02-refined.png"})});
console.log(await page.evaluate(()=>({diagnostics:CAP_SG.diagnostics(),state:CAP_SG.state})));
