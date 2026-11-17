const task = await taskSpace(24);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await page.reload();
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
const results = [];
for (const width of [1280, 1024, 768, 390, 320]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 390 });
  await page.waitForFunction(width => innerWidth === width, width);
  await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
  const report = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".theme-buttons button, .modes button, .inspection-grid button")]
      .filter(element => element.getClientRects().length)
      .map(element => ({
        text: element.textContent.trim(),
        clipped: element.scrollWidth > element.clientWidth + 1,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right
      }));
    return {
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      sceneWidth: document.querySelector("#viewport").clientWidth,
      outOfBounds: boxes.filter(box => box.clipped || box.left < -1 || box.right > innerWidth + 1)
    };
  });
  if (report.scrollWidth > report.width || report.outOfBounds.length) throw new Error(`Responsive layout: ${JSON.stringify(report)}`);
  results.push(report);
}
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 390);
await page.click("#exploded");
await page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
await page.evaluate(() => document.querySelector("#viewport").scrollIntoView({ block: "start" }));
const exploded = await page.evaluate(() => {
  const viewport = document.querySelector("#viewport").getBoundingClientRect();
  const menu = document.querySelector("#assemblyOrder").getBoundingClientRect();
  const badge = document.querySelector(".scene-state").getBoundingClientRect();
  const canvas = CAP_SG.renderer.domElement;
  const copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const context = copy.getContext("2d"); context.drawImage(canvas, 0, 0);
  const pixels = context.getImageData(0, 0, copy.width, copy.height).data, colors = new Set();
  for (let y = 0; y < copy.height; y += 10) for (let x = 0; x < copy.width; x += 10) {
    const i = (y * copy.width + x) * 4;
    colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
  }
  const order = document.querySelector("#assemblyOrder");
  return { sceneWidth: viewport.width, badgeBottom: badge.bottom, menuTop: menu.top, menuWidth: order.clientWidth, menuScrollWidth: order.scrollWidth, colors: colors.size, explosion: CAP_SG.state.explosion };
});
if (exploded.badgeBottom > exploded.menuTop || exploded.menuScrollWidth > exploded.menuWidth || exploded.colors < 15 || exploded.explosion !== 1) throw new Error(`Mobile exploded view: ${JSON.stringify(exploded)}`);
const screenshot = await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/theme-mobile-exploded-20261118.png" });
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 320);
const narrowMenu = await page.evaluate(() => {
  const order = document.querySelector("#assemblyOrder");
  return { width: order.clientWidth, scrollWidth: order.scrollWidth };
});
if (narrowMenu.scrollWidth > narrowMenu.width) throw new Error(`Narrow assembly menu: ${JSON.stringify(narrowMenu)}`);
console.log({ results, exploded, narrowMenu, screenshot });
