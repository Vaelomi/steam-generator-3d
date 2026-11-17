const task = await taskSpace(24);
const page = task.page("p1");
const fs = await import("node:fs/promises");
const checks = [];
const assert = (name, ok, detail = null) => {
  checks.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`);
};
const settle = () => page.waitForFunction(() => !CAP_SG.animating, undefined, { timeout: 15000 });
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await page.goto("file:///D:/DataTop/Desktop/%E6%88%91%E7%9A%84%E9%A1%B9%E7%9B%AE/%E4%B8%BB%E8%AE%BE%E5%A4%87%E7%88%86%E7%82%B8%E5%9B%BE/%E8%92%B8%E6%B1%BD%E5%8F%91%E7%94%9F%E5%99%A8/index.html", { timeout: 30000 });
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
const previous = await page.evaluate(() => localStorage.getItem("sg-appearance-v2"));
await page.evaluate(() => {
  window.__themeErrors = [];
  addEventListener("error", event => window.__themeErrors.push(event.message));
  addEventListener("unhandledrejection", event => window.__themeErrors.push(String(event.reason)));
});
const expected = {
  light: { bg: "#faf8f4", panel: "#fffefc", scene: "#f0ede6", accent: "#8a6729" },
  dark: { bg: "#13110e", panel: "#1b1915", scene: "#191713", accent: "#d8ad4e" }
};
for (const theme of ["light", "dark"]) {
  await page.click(`button[data-theme='${theme}']`);
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme &&
    document.querySelector(`button[data-theme="${theme}"]`).getAttribute("aria-pressed") === "true", theme);
  await page.waitForFunction(theme => getComputedStyle(document.querySelector(".inspection-grid button")).backgroundColor ===
    (theme === "dark" ? "rgb(27, 25, 21)" : "rgb(255, 254, 252)"), theme);
  const values = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const canvas = CAP_SG.renderer.domElement;
    const copy = document.createElement("canvas");
    copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext("2d"); ctx.drawImage(canvas, 0, 0);
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;
    const colors = new Set();
    for (let y = 0; y < copy.height; y += 12) for (let x = 0; x < copy.width; x += 12) {
      const i = (y * copy.width + x) * 4;
      colors.add(`${pixels[i] >> 3},${pixels[i + 1] >> 3},${pixels[i + 2] >> 3}`);
    }
    return {
      bg: style.getPropertyValue("--bg").trim(), panel: style.getPropertyValue("--panel").trim(),
      scene: style.getPropertyValue("--scene").trim(), accent: style.getPropertyValue("--accent").trim(),
      webglScene: `#${CAP_SG.model.root.parent.background.getHexString()}`,
      stored: localStorage.getItem("sg-appearance-v2"), sampledColors: colors.size,
      mode: CAP_SG.state.mode, explosion: CAP_SG.state.explosion
    };
  });
  assert(`${theme} palette and canvas`, Object.entries(expected[theme]).every(([key, value]) => values[key] === value) &&
    values.webglScene === expected[theme].scene && values.stored === theme && values.sampledColors > 15, values);
  assert(`${theme} initial assembly`, values.mode === "assembly" && values.explosion === 0, values);
  console.log({ theme, screenshot: await page.screenshot({ path: `D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/theme-${theme}-20261118.png` }) });
}
assert("no initial page errors", (await page.evaluate(() => window.__themeErrors)).length === 0);
await page.reload();
await page.waitForFunction(() => window.CAP_SG?.ready, undefined, { timeout: 45000 });
await page.evaluate(() => {
  window.__themeErrors = [];
  addEventListener("error", event => window.__themeErrors.push(event.message));
  addEventListener("unhandledrejection", event => window.__themeErrors.push(String(event.reason)));
});
assert("dark preference survives reload", await page.evaluate(() =>
  document.documentElement.dataset.theme === "dark" && document.querySelector("button[data-theme=dark]").getAttribute("aria-pressed") === "true"
));
await page.click("button[data-theme='auto']");
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] });
await page.waitForFunction(() => document.documentElement.dataset.appearance === "auto" && document.documentElement.dataset.theme === "light");
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await page.waitForFunction(() => document.documentElement.dataset.appearance === "auto" && document.documentElement.dataset.theme === "dark");
assert("automatic mode follows system changes", await page.evaluate(() =>
  document.querySelector("button[data-theme=auto]").getAttribute("aria-pressed") === "true" && localStorage.getItem("sg-appearance-v2") === "auto"
));
await page.cdp("Emulation.setEmulatedMedia", { features: [] });
await page.click("button[data-theme='dark']");
await page.click("#exploded");
await settle();
assert("exploded view and status", await page.evaluate(() =>
  CAP_SG.state.explosion === 1 && CAP_SG.state.cutaway && document.querySelector("#headerMode").textContent === "结构分解"
));
const clearance = await page.evaluate(() => {
  const viewport = document.querySelector("#viewport").getBoundingClientRect();
  const bar = document.querySelector("#assemblyOrder").getBoundingClientRect();
  const bounds = CAP_SG.model.bounds(["upperHead", "steamOutlet", "restrictorHole", "venturiTubes"]);
  let top = Infinity;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).project(CAP_SG.camera);
    top = Math.min(top, viewport.top + (1 - point.y) * viewport.height / 2);
  }
  return { modelTop: top, toolbarBottom: bar.bottom };
});
assert("exploded controls clear the model", clearance.modelTop >= clearance.toolbarBottom - 1, clearance);
console.log({ darkExploded: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/theme-dark-exploded-20261118.png" }) });
await page.click("[data-assembly='bundle']");
await settle();
assert("inspection still works", await page.evaluate(() => CAP_SG.state.inspection === "assemblyBundle"));
await page.click("#exitInspection");
await settle();
await page.click("#assembly");
await settle();
await page.selectOption("#modelSelect", "CAP1000");
await page.waitForFunction(() => CAP_SG.state.modelId === "CAP1000", undefined, { timeout: 30000 });
assert("model switching remains functional", await page.evaluate(() => CAP_SG.diagnostics().parts === 37 && CAP_SG.state.mode === "assembly"));
const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
await page.click("#screenshot");
const download = await downloadPromise;
const png = await fs.readFile(await download.path());
assert("themed PNG export", png.readUInt32BE(0) === 0x89504e47 && png.length > 15000, { bytes: png.length });
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await page.waitForFunction(() => innerWidth === 390 && document.querySelector("#viewport").clientWidth < 390);
await settle();
const mobile = await page.evaluate(() => {
  const rect = element => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  };
  const buttons = [...document.querySelectorAll(".theme-buttons button")].map(button => ({
    text: button.textContent.trim(), ...rect(button), clipped: button.scrollWidth > button.clientWidth + 1
  }));
  const scene = rect(document.querySelector("#viewport"));
  const header = rect(document.querySelector(".masthead"));
  return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, buttons, scene, header };
});
assert("mobile theme controls and layout", mobile.scrollWidth <= mobile.width &&
  mobile.buttons.length === 3 && mobile.buttons.every(button => button.left >= 0 && button.right <= mobile.width && !button.clipped) &&
  mobile.header.bottom <= mobile.scene.top, mobile);
await page.waitForFunction(() => document.querySelector("#sceneToast").hidden, undefined, { timeout: 8000 });
console.log({ mobileDark: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/theme-mobile-dark-20261118.png" }) });
await page.click("button[data-theme='light']");
await page.waitForFunction(() => getComputedStyle(document.querySelector(".theme-buttons button[data-theme=light]")).backgroundColor === "rgb(255, 254, 252)");
console.log({ mobileLight: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/docs/previews/theme-mobile-light-20261118.png" }) });
assert("no page errors", (await page.evaluate(() => window.__themeErrors)).length === 0);
await page.evaluate(previous => {
  if (previous === null) localStorage.removeItem("sg-appearance-v2");
  else localStorage.setItem("sg-appearance-v2", previous);
}, previous);
console.log({ checks });
