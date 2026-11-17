const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const context = vm.createContext({ console });
context.window = context;
for (const file of ["lib/three/three.min.js", "lib/profiles.js", "lib/model.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
const result = vm.runInContext(`(() => {
  const reports = [];
  for (const profile of Object.values(SG_DATA.profiles)) {
    const model = new SG_Model(profile, { cutaway: false });
    const g = profile.geometry, lr = g.lowerR, s = g.nozzleScale;
    const box = id => {
      const b = model.bounds([id]);
      return { min: b.min.toArray(), max: b.max.toArray() };
    };
    const trace = (id, origin, direction, approach = 2) => {
      const axis = new THREE.Vector3(...direction).normalize();
      const start = new THREE.Vector3(...origin).addScaledVector(axis, approach);
      const ray = new THREE.Raycaster(start, axis.clone().negate(), 0, approach + .8);
      return ray.intersectObject(model.getPart(id).root, true).map(hit => ({
        distance: +hit.distance.toFixed(5),
        axisCoordinate: +(approach - hit.distance).toFixed(5),
        point: hit.point.toArray().map(n => +n.toFixed(5))
      })).filter((hit, i, hits) => !i || Math.abs(hit.distance - hits[i - 1].distance) > 1e-4);
    };
    const tubeBounds = box("tubeBundle");
    const sheetBounds = box("tubesheet");
    const ports = [
      ["hotLeg", "channelHead", [-lr*.84, 1.54, 0], [-.96, -.16, 0]],
      ["pumpOutlet", "channelHead", [lr*.5, 1.12, lr*.56], [.45, -.55, .53]],
      ["channelManway", "channelHead", [-lr*.42, 1.8, lr*.7], [-.3, 0, .95]],
      ["blowdown", "lowerShellAB", [-lr, g.tubeBase+.27, -.40], [-1, 0, 0]],
      ["handhole", "lowerShellAB", [-lr+.02, g.tubeBase+.6, 0], [-1, 0, 0]],
      ["feedwater", "upperShell", [g.upperR-.2, g.transitionTop+.18, .1], [1, 0, 0]],
      ["startupFeed", "upperShell", [g.upperR-.1, g.transitionTop+1.05, -.6], [1, 0, 0]],
      ["secondaryManway", "upperShell", [0, g.transitionTop+2.55, g.upperR-.1], [0, 0, 1]],
      ["levelLower", "upperShell", [(g.upperR-.12)*Math.sin(4.70), g.transitionTop+1.35, (g.upperR-.12)*Math.cos(4.70)], [Math.sin(4.70), 0, Math.cos(4.70)]]
    ];
    const report = {
      model: profile.id,
      diagnostics: model.diagnostics(),
      bounds: Object.fromEntries(["tubeBundle", "tubesheet", "channelHead", "pumpCasings", "separators"].map(id => [id, box(id)])),
      tubeToSheet: {
        sheetBottom: g.sheetY, sheetTop: g.sheetY + g.sheetT,
        tubeBottom: tubeBounds.min[1],
        unmodelledPenetration: tubeBounds.min[1] - g.sheetY
      },
      shellCenterlineHits: Object.fromEntries(ports.map(([name, id, origin, direction]) => [name, trace(id, origin, direction)])),
      feedwaterSupportRingHits: trace("upperSupportRing", [g.upperR-.2, g.transitionTop+.18, .1], [1, 0, 0]),
      separatorBottomCenterlineHits: trace("separators", [0, g.separatorBase-.3, 0], [0, -1, 0], .5),
      venturiBypassRadialGap: .38*s - .35*s,
      secondaryDowncomer: { gap: .075, wrapperWall: .045 },
      tubeSupportWrapperInterference: (lr-.105) - (lr-.075-.045),
      dividerToTubesheetGap: g.sheetY - box("divider").max[1],
      assembledHeight: model.bounds().getSize(new THREE.Vector3()).y,
      publicHeight: profile.public.height
    };
    const leg = model.sampleLayout[0];
    const towardTube = new THREE.Raycaster(
      new THREE.Vector3(-leg.r, g.sheetY-.1, leg.z),
      new THREE.Vector3(0, 1, 0), 0, g.sheetT+.2
    );
    report.primaryTubeBoreHits = towardTube.intersectObject(model.getPart("tubeBundle").root, true)
      .map(hit => ({ distance: hit.distance, y: hit.point.y }));
    const dir = new THREE.Vector3(.45, -.55, .53).normalize();
    const end = new THREE.Vector3(lr*.5, 1.12, lr*.56).addScaledVector(dir, 1.36*s);
    const pumpRay = new THREE.Raycaster(end.clone().addScaledVector(dir, -.4), dir, 0, 3);
    report.pumpConnectionCenterlineHits = pumpRay.intersectObject(model.getPart("pumpCasings").root, true)
      .map(hit => ({ distance: hit.distance, point: hit.point.toArray() }));
    reports.push(report);
    model.dispose();
  }
  return reports;
})()`, context);
fs.writeFileSync(path.join(root, "docs/model-audit-20261118.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
