const task = await taskSpace("蒸汽发生器总装与部件检查");
const page = task.page("p1");
console.log({ taskSpaceId: task.spaceId, page: page.label });
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});
await page.goto("file:///D:/DataTop/Desktop/%E6%88%91%E7%9A%84%E9%A1%B9%E7%9B%AE/%E4%B8%BB%E8%AE%BE%E5%A4%87%E7%88%86%E7%82%B8%E5%9B%BE/%E8%92%B8%E6%B1%BD%E5%8F%91%E7%94%9F%E5%99%A8/index.html", { timeout: 30000 });
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
const initial = await page.evaluate(() => {
  const app = window.CAP_SG;
  const canvas = app.renderer.domElement;
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext("2d");
  context.drawImage(canvas, 0, 0);
  const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
  const colors = new Set();
  for (let y = 0; y < copy.height; y += 12) {
    for (let x = 0; x < copy.width; x += 12) {
      const i = (y * copy.width + x) * 4;
      colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
    }
  }
  return {
    state: app.state,
    diagnostics: app.diagnostics(),
    activeMode: document.querySelector("[data-mode].active")?.id,
    cutaway: document.querySelector("#cutaway").checked,
    orderHidden: document.querySelector("#assemblyOrder").hidden,
    sceneMode: document.querySelector("#sceneMode").textContent,
    canvas: { width: canvas.width, height: canvas.height, sampledColors: colors.size },
    newParts: ["tubeRetainers", "sleevePins", "venturiTubes", "upperSupportRing", "feedElbow", "dividerRibs", "pumpCasings", "mimsMounts"]
      .map(id => ({ id, present: !!app.model.getPart(id) }))
  };
});
console.log({ initial });
console.log({ screenshot: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/13-assembly-current.png" }) });
