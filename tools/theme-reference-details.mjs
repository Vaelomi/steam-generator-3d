const task = await taskSpace(24);
const page = task.page("p1");
await page.waitForFunction(() => document.readyState === "complete" && !!document.querySelector("#viewport canvas"), undefined, { timeout: 30000 });
const previous = await page.evaluate(() => localStorage.getItem("rpv-appearance-v1"));
await page.evaluate(() => window.RPVAppearance.set("dark"));
await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" && document.querySelector("[data-appearance-choice=dark]").getAttribute("aria-pressed") === "true");
const result = await page.evaluate(() => {
  const styles = selector => {
    const element = document.querySelector(selector), style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { background: style.backgroundColor, color: style.color, border: style.borderColor, fontSize: style.fontSize, radius: style.borderRadius, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  return Object.fromEntries(["header", ".brand-mark", ".device-nav", ".appearance-switch", "[data-appearance-choice=dark]", ".controls", ".inspection-actions button", "#viewport", ".info", ".slider-head output", ".model-badge"].map(selector => [selector, styles(selector)]));
});
console.log({ result, screenshot: await page.screenshot({ path: "D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/tools/reference-theme-dark-active.png" }) });
await page.evaluate(previous => {
  window.RPVAppearance.set(previous || "auto");
  if (previous === null) localStorage.removeItem("rpv-appearance-v1");
}, previous);
