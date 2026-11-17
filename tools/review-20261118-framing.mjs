const task = await taskSpace(22);
const page = task.page("p1");
await page.reload();
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
console.log({ defaultView: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/13-assembly-current.png" }) });
await page.click("#exploded");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
console.log({ exploded: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/14-exploded-current.png" }) });
await page.click("[data-assembly='head']");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
const head = await page.evaluate(() => {
  const ids = ["upperHead", "steamOutlet", "restrictorHole", "venturiTubes"];
  const bounds = CAP_SG.model.bounds(ids);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray() },
    camera: CAP_SG.camera.position.toArray(),
    target: CAP_SG.controls.target.toArray(),
    venturiCount: CAP_SG.model.getPart("venturiTubes").root.children.find(child => child.isInstancedMesh)?.count
  };
});
if (head.bounds.min[1] < 20 || head.bounds.size[1] > 4 || head.venturiCount !== 7) throw new Error(`Invalid head bounds: ${JSON.stringify(head)}`);
console.log({ head });
console.log({ headView: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/16-head-current.png" }) });
await page.click("#exitInspection");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
await page.click("[data-assembly='bundle']");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
const bundle = await page.evaluate(() => {
  const box = CAP_SG.model.bounds(["tubeBundle"]);
  return { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
});
if (bundle.min[1] < 3 || bundle.size[1] > 13) throw new Error(`Invalid tube bundle bounds: ${JSON.stringify(bundle)}`);
console.log({ bundle });
console.log({ bundleView: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/18-bundle-current.png" }) });
await page.click("#exitInspection");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
await page.click("#tab-catalog");
await page.fill("#partSearch", "文丘里");
await page.click("[data-select='venturiTubes']");
await page.click("#tab-details");
await page.click("#isolatePart");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
const isolated = await page.evaluate(() => ({
  inspection: CAP_SG.state.inspection,
  visible: CAP_SG.diagnostics().visibleParts,
  bounds: CAP_SG.model.bounds(["venturiTubes"]).getSize(new THREE.Vector3()).toArray()
}));
if (isolated.inspection !== "isolate" || isolated.visible !== 1 || isolated.bounds[1] > 1) throw new Error(`Venturi isolation failed: ${JSON.stringify(isolated)}`);
console.log({ isolated });
console.log({ venturiView: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/19-venturi-current.png" }) });
