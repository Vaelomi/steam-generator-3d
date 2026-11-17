const task = await taskSpace("比较两个设备网页的昼夜样式");
const page = task.page("p1");
console.log({ taskSpaceId: task.spaceId, page: page.label });
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await page.goto("file:///D:/DataTop/Desktop/%E6%88%91%E7%9A%84%E9%A1%B9%E7%9B%AE/%E4%B8%BB%E8%AE%BE%E5%A4%87%E7%88%86%E7%82%B8%E5%9B%BE/CAP1400%E5%8F%8D%E5%BA%94%E5%A0%86%E5%8E%8B%E5%8A%9B%E5%AE%B9%E5%99%A8%E4%B8%89%E7%BB%B4%E7%88%86%E7%82%B8%E5%9B%BE/index.html", { timeout: 30000 });
await page.waitForFunction(() => !!document.querySelector("#viewport canvas") && !!window.RPVAppearance, undefined, { timeout: 45000 });
for (const theme of ["light", "dark"]) {
  await page.evaluate(theme => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appearance = theme;
    document.querySelectorAll("[data-appearance-choice]").forEach(button =>
      button.setAttribute("aria-pressed", String(button.dataset.appearanceChoice === theme))
    );
    window.dispatchEvent(new CustomEvent("rpv:appearance-change", { detail: { theme, preference: theme } }));
  }, theme);
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(["--bg", "--panel", "--sheet", "--field", "--line", "--line-strong", "--text", "--secondary", "--muted", "--quiet", "--accent", "--accent-ink", "--accent-surface", "--accent-line", "--scene-bg", "--scene-grid", "--floating"].map(key => [key, style.getPropertyValue(key).trim()]));
  });
  console.log({ theme, colors, screenshot: await page.screenshot({ path: `D:/DataTop/Desktop/我的项目/主设备爆炸图/蒸汽发生器/tools/reference-theme-${theme}.png` }) });
}
console.log(await page.snapshot());
