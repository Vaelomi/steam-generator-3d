const task = await taskSpace(7);
const page = task.page("p1");
await page.reload();
await page.waitForFunction(()=>window.CAP_SG?.ready,undefined,{timeout:30000});
await page.evaluate(()=>{
  window.__sgErrors=[];
  addEventListener("error",e=>window.__sgErrors.push(e.message));
  addEventListener("unhandledrejection",e=>window.__sgErrors.push(String(e.reason)));
});
const results = [];
const settle = () => page.waitForFunction(()=>window.CAP_SG?.ready&&!CAP_SG.animating,undefined,{timeout:15000});
const record = async name => results.push({name,...await page.evaluate(()=>({state:CAP_SG.state,diagnostics:CAP_SG.diagnostics()}))});
await page.click("#sectionView");
await settle();
await record("CAP1400 section");
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/03-cap1400-section.png"})});
await page.click("#assembly");
await settle();
await record("CAP1400 assembly");
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/04-cap1400-assembly.png"})});
await page.selectOption("#modelSelect","CAP1000");
await page.waitForFunction(()=>CAP_SG.state.modelId==="CAP1000"&&document.querySelector("#loading").hidden,undefined,{timeout:30000});
await page.click("#exploded");
await settle();
await record("CAP1000 exploded");
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/05-cap1000-exploded.png"})});
for(const key of ["bundle","separation","primary","interfaces"]){
  await page.click(`[data-inspect="${key}"]`);
  await settle();
  await record(`inspection ${key}`);
  if(key==="bundle"||key==="primary")console.log({screenshot:await page.screenshot({path:`D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/06-cap1000-${key}.png`})});
}
await page.click("#exitInspection");
await settle();
await page.click("label[for='flow']");
await settle();
await page.waitForFunction(()=>CAP_SG.state.flow&&CAP_SG.state.explosion<.001);
await record("flow assembled");
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/07-flow.png"})});
await page.click("label[for='flow']");
await page.click("button[data-theme='dark']");
await page.click("#sectionView");
await settle();
await record("dark section");
console.log({screenshot:await page.screenshot({path:"D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/08-dark.png"})});
console.log({results,errors:await page.evaluate(()=>window.__sgErrors),geometryAudit:await page.evaluate(()=>{
  const bad=[];let meshCount=0;
  CAP_SG.model.root.traverse(o=>{
    if(!o.geometry)return;meshCount++;
    const a=o.geometry.getAttribute("position");if(!a)return;
    for(let i=0;i<a.array.length;i++)if(!Number.isFinite(a.array[i])){bad.push(o.userData.part?.id||o.name);break;}
  });
  return {meshes:meshCount,nonFinite:bad};
})});
console.log(await page.snapshot());
