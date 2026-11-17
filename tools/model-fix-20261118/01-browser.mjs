const entry=(await listTaskSpaces()).find(s=>s.id===26);
const task=!entry?await taskSpace("蒸汽发生器建模修正验证"):
  entry.ownership==="user"?await claimTaskSpace(26):await taskSpace(26);
const page=(await task.pages())[0]??await task.adopt((await task.tabs())[0].page);
await page.cdp("Emulation.setDeviceMetricsOverride",{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
await page.goto("file:///D:/DataTop/Desktop/%E6%88%91%E7%9A%84%E9%A1%B9%E7%9B%AE/%E4%B8%BB%E8%AE%BE%E5%A4%87%E7%88%86%E7%82%B8%E5%9B%BE/%E8%92%B8%E6%B1%BD%E5%8F%91%E7%94%9F%E5%99%A8/index.html");
await page.waitForFunction(()=>window.CAP_SG?.ready,undefined,{timeout:45000});
console.log({taskSpaceId:task.spaceId,page:page.label});
console.log(await page.snapshot());
console.log(await page.evaluate(()=>({diagnostics:CAP_SG.diagnostics(),cachedShells:Object.keys(SG_SHELL_CACHE||{}).length,readyAt:performance.now()})));
console.log({assembly:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/fixed-assembly-20261118.png"})});
await page.evaluate(()=>CAP_SG.inspect("primary"));
await page.waitForFunction(()=>!CAP_SG.animating);
console.log({primary:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/fixed-primary-20261118.png"})});
