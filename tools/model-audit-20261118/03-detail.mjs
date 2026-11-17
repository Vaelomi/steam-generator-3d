const task = await taskSpace(26);
const page = task.page("p1");
await page.evaluate(() => {
  CAP_SG.inspect("separation");
  CAP_SG.setCutaway(false);
  for (const p of CAP_SG.model.parts) CAP_SG.model.setVisible(p.id, ["upperShell", "feedNozzle"].includes(p.id));
  CAP_SG.fitView(["upperShell", "feedNozzle"], false, [1, .03, .12]);
  const target = new THREE.Vector3(CAP_SG.profile.geometry.upperR+.1, CAP_SG.profile.geometry.transitionTop+.18, .1);
  CAP_SG.camera.position.copy(target).add(new THREE.Vector3(4.1, .16, .55));
  CAP_SG.controls.target.copy(target);
  CAP_SG.controls.update();
  CAP_SG.requestRender();
});
await page.waitForFunction(() => !CAP_SG.animating);
console.log({ feedwater: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/audit-feedwater-blocked.png" }) });
await page.evaluate(() => {
  CAP_SG.showAll();
  CAP_SG.setMode("assembly");
  CAP_SG.selectPart(null);
});
await page.waitForFunction(() => !CAP_SG.animating);
console.log({ restored: await page.evaluate(() => CAP_SG.diagnostics()) });
