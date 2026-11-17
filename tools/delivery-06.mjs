const task=await taskSpace(7),page=task.page("p1");
await page.reload();
await page.waitForFunction(()=>window.CAP_SG?.ready&&!CAP_SG.animating,undefined,{timeout:30000});
await page.evaluate(()=>{
  document.querySelector(".control-panel").scrollTop=0;
  document.querySelector(".info-scroll").scrollTop=0;
  scrollTo(0,0);
});
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/12-delivery.png"})});
console.log(await page.evaluate(()=>({title:document.title,state:CAP_SG.state,ready:CAP_SG.ready,diagnostics:CAP_SG.diagnostics()})));
