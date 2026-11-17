const task = await taskSpace(22);
const page = task.page("p1");
const fs = await import("node:fs/promises");
const checks = [];
const assert = (name, ok, detail = null) => {
  checks.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`);
};
const settle = () => page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
await page.reload();
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
assert("default full assembly", await page.evaluate(() =>
  CAP_SG.state.explosion === 0 && !CAP_SG.state.cutaway &&
  CAP_SG.state.mode === "assembly" && document.querySelector("#assemblyOrder").hidden
));
const cameraBefore = await page.evaluate(() => CAP_SG.camera.position.toArray());
const canvasBox = await page.evaluate(() => {
  const rect = document.querySelector("#viewport canvas").getBoundingClientRect();
  return { x: rect.left + rect.width * .48, y: rect.top + rect.height * .48 };
});
await page.mouse.move(canvasBox.x, canvasBox.y);
await page.mouse.down();
await page.mouse.move(canvasBox.x + 75, canvasBox.y + 25);
await page.mouse.up();
await page.waitForFunction(before => CAP_SG.camera.position.distanceTo(new THREE.Vector3(...before)) > .1, cameraBefore, { timeout: 10000 });
assert("canvas drag rotates the model", true);
await page.click("#resetView");
await settle();
await page.evaluate(() => {
  window.__currentErrors = [];
  addEventListener("error", event => window.__currentErrors.push(event.message));
  addEventListener("unhandledrejection", event => window.__currentErrors.push(String(event.reason)));
});

await page.click("#exploded");
await settle();
let state = await page.evaluate(() => ({ ...CAP_SG.state, orderVisible: !document.querySelector("#assemblyOrder").hidden }));
assert("CAP1400 exploded view", state.explosion === 1 && state.cutaway && state.orderVisible, state);
console.log({ exploded: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/14-exploded-current.png" }) });

const motionAudit = await page.evaluate(() => {
  const app = CAP_SG;
  const groups = [
    ["tubeBundle", "tubesheet", "tubeSupports", "tubeRetainers", "wrapper", "channelHead", "pumpCasings", "pumpOutlets", "dividerRibs", "mimsMounts"],
    ["lowerShell", "transition", "sleevePins"],
    ["upperShell", "upperSupportRing", "separatorDeck", "separators", "feedRing", "feedElbow", "feedNozzle"],
    ["upperHead", "steamOutlet", "restrictorHole", "venturiTubes"]
  ];
  return [0, .25, .6, 1].map(value => {
    app.setExplosion(value, { animate: false, fit: false });
    const errors = groups.map(group => Math.max(...group.map(id =>
      app.model.getPart(id).root.position.distanceTo(app.model.getPart(group[0]).root.position)
    )));
    const manways = app.model.getPart("manways").attachedGroups;
    const upperManway = manways.find(group => group.assembly === "upper").root.position;
    const channelManway = manways.find(group => group.assembly === "channel").root.position;
    errors.push(upperManway.distanceTo(app.model.getPart("upperShell").root.position));
    errors.push(channelManway.distanceTo(app.model.getPart("channelHead").root.position));
    return { value, errors };
  });
});
assert("components retain their group positions", motionAudit.every(row => row.errors.every(v => v < 1e-8)), motionAudit);
await page.evaluate(() => CAP_SG.setExplosion(.6, { animate: false, fit: true }));
await settle();
console.log({ exploded60: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/15-exploded-60-current.png" }) });

await page.click("[data-assembly='head']");
await settle();
state = await page.evaluate(() => ({
  inspection: CAP_SG.state.inspection,
  venturiVisible: CAP_SG.model.getPart("venturiTubes").root.visible,
  openingsVisible: CAP_SG.model.getPart("restrictorHole").root.visible
}));
assert("upper head inspection", state.inspection === "head" && state.venturiVisible && state.openingsVisible, state);
console.log({ head: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/16-head-current.png" }) });
await page.click("#exitInspection");
await settle();

await page.selectOption("#modelSelect", "CAP1000");
await page.waitForFunction(() => CAP_SG.state.modelId === "CAP1000", undefined, { timeout: 30000 });
state = await page.evaluate(() => ({ diagnostics: CAP_SG.diagnostics(), note: CAP_SG.profile.note }));
assert("CAP1000 profile and model", state.diagnostics.parts === 37 && state.diagnostics.sampleTubes === 81 && state.note.includes("参考"), state);
await page.click("#assembly");
await settle();
assert("return to full assembly", await page.evaluate(() => CAP_SG.state.explosion === 0 && !CAP_SG.state.cutaway));

await page.click("label[for='flow']");
await settle();
assert("flow returns to assembled cutaway", await page.evaluate(() =>
  CAP_SG.state.flow && CAP_SG.state.explosion === 0 && CAP_SG.state.cutaway && CAP_SG.model.flowGroup.visible
));
await page.click("label[for='flow']");
await page.click("#assembly");
await settle();

await page.click("#tab-catalog");
await page.fill("#partSearch", "保持环");
assert("new part search", await page.evaluate(() => document.querySelector("[data-select='tubeRetainers']") !== null));
await page.fill("#partSearch", "");
await page.click("#tab-compare");
const jsonWait = page.waitForEvent("download", { timeout: 15000 });
await page.click("#exportData");
const jsonDownload = await jsonWait;
const data = JSON.parse(await fs.readFile(await jsonDownload.path(), "utf8"));
assert("JSON includes both user sources", !!data.sources.hy5Daily && !!data.sources.hy6Plan && data.parts.length === 37);

const pngWait = page.waitForEvent("download", { timeout: 15000 });
await page.click("#screenshot");
const pngDownload = await pngWait;
const png = await fs.readFile(await pngDownload.path());
assert("PNG export", png.readUInt32BE(0) === 0x89504e47 && png.length > 15000, { bytes: png.length });

const geometry = await page.evaluate(() => {
  const invalid = [];
  CAP_SG.model.root.traverse(object => {
    const positions = object.geometry?.getAttribute("position");
    if (positions && !positions.array.every(Number.isFinite)) invalid.push(object.userData.part?.id || object.name);
  });
  const ids = CAP_SG.model.parts.map(part => part.id);
  return { invalid, unique: new Set(ids).size, count: ids.length };
});
assert("finite geometry and unique parts", !geometry.invalid.length && geometry.unique === geometry.count, geometry);
assert("no page errors", (await page.evaluate(() => window.__currentErrors)).length === 0);

await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 390 && document.querySelector("#viewport").clientWidth < 390);
await settle();
const mobile = await page.evaluate(() => {
  const scene = document.querySelector("#viewport").getBoundingClientRect();
  const canvas = CAP_SG.renderer.domElement;
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const context = copy.getContext("2d"); context.drawImage(canvas, 0, 0);
  const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
  const colors = new Set();
  for (let y = 0; y < copy.height; y += 10) for (let x = 0; x < copy.width; x += 10) {
    const i = (y * copy.width + x) * 4;
    colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
  }
  const labels = [...document.querySelectorAll(".part-label")].filter(el => !el.hidden)
    .map(el => ({ text: el.textContent, rect: el.getBoundingClientRect() }));
  const overlaps = [];
  labels.forEach((a, i) => labels.slice(i + 1).forEach(b => {
    if (a.rect.left < b.rect.right && b.rect.left < a.rect.right && a.rect.top < b.rect.bottom && b.rect.top < a.rect.bottom) overlaps.push([a.text, b.text]);
  }));
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scene: { width: scene.width, height: scene.height }, sampledColors: colors.size, overlaps };
});
assert("mobile layout and labels", mobile.scrollWidth <= mobile.width && !mobile.overlaps.length && mobile.sampledColors > 15, mobile);
console.log({ mobile: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/17-mobile-current.png" }) });
await page.cdp("Emulation.clearDeviceMetricsOverride");
console.log({ checks, finalErrors: await page.evaluate(() => window.__currentErrors) });
