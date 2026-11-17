const task = await taskSpace("检查蒸汽发生器默认夜间模式");
const page = task.page("p1");
console.log({ taskSpaceId: task.spaceId });
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await page.goto("file:///D:/DataTop/Desktop/%E6%88%91%E7%9A%84%E9%A1%B9%E7%9B%AE/%E4%B8%BB%E8%AE%BE%E5%A4%87%E7%88%86%E7%82%B8%E5%9B%BE/%E8%92%B8%E6%B1%BD%E5%8F%91%E7%94%9F%E5%99%A8/index.html", { timeout: 30000 });
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
const inspect = () => page.evaluate(() => {
  const canvas = CAP_SG.renderer.domElement, copy = document.createElement("canvas");
  copy.width = canvas.width; copy.height = canvas.height;
  const context = copy.getContext("2d"); context.drawImage(canvas, 0, 0);
  const pixels = context.getImageData(0, 0, copy.width, copy.height).data, colors = new Set();
  for (let y = 0; y < copy.height; y += 12) for (let x = 0; x < copy.width; x += 12) {
    const i = (y * copy.width + x) * 4;
    colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
  }
  return {
    theme: document.documentElement.dataset.theme,
    preference: document.documentElement.dataset.appearance,
    saved: localStorage.getItem("sg-appearance-v2"),
    oldPreference: localStorage.getItem("sg-appearance"),
    activeNight: document.querySelector("button[data-theme=dark]").getAttribute("aria-pressed"),
    mode: CAP_SG.state.mode,
    colors: colors.size
  };
});
const initial = await inspect();
if (initial.theme !== "dark" || initial.preference !== "dark" || initial.activeNight !== "true" || initial.mode !== "assembly" || initial.colors < 15) {
  throw new Error(`Unexpected default: ${JSON.stringify(initial)}`);
}
const desktop = await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/default-night-desktop.png" });
await page.click("button[data-theme=light]");
await page.reload();
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
const savedLight = await inspect();
if (savedLight.theme !== "light" || savedLight.saved !== "light") throw new Error(`Light preference not restored: ${JSON.stringify(savedLight)}`);
await page.click("button[data-theme=auto]");
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" && document.documentElement.dataset.appearance === "auto");
await page.click("button[data-theme=dark]");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 390 && document.querySelector("#viewport").clientWidth < 390);
const mobile = await inspect();
if (mobile.theme !== "dark" || mobile.colors < 15) throw new Error(`Unexpected mobile view: ${JSON.stringify(mobile)}`);
const mobileScreenshot = await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/default-night-mobile.png" });
console.log({ initial, savedLight, mobile, desktop, mobileScreenshot });
