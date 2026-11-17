const task = await taskSpace(29);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 390);
await page.waitForFunction(() =>
  document.documentElement.dataset.appearance === "dark" &&
  getComputedStyle(document.querySelector("button[data-theme=dark]")).backgroundColor === "rgb(27, 25, 21)"
);
console.log({ screenshot: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/default-night-mobile.png" }) });
