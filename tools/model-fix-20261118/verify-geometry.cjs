const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const ctx=require("./load-model.cjs")(),T=ctx.THREE,reports=[];
const v=a=>new T.Vector3(...a);
function hits(root,origin,direction,far) {
  return new T.Raycaster(origin,direction,0,far).intersectObject(root,true);
}
for(const profile of Object.values(ctx.SG_DATA.profiles)){
  console.time(profile.id);
  const model=new ctx.SG_Model(profile,{cutaway:false}),g=model.g,s=g.nozzleScale;
  const report={model:profile.id,ports:[],tubeLegsChecked:0,separatorEntrancesChecked:0,cacheEntries:Object.keys(ctx.SG_SHELL_CACHE).length};
  for(const cutaway of [false,true]){
    model.setCutaway(cutaway);
    for(const port of model.ports){
      const axis=v(port.direction),origin=v(port.origin),u=new T.Vector3(0,1,0).cross(axis).normalize(),w=axis.clone().cross(u).normalize();
      let checked=0;
      for(const radius of [0,.8])for(let i=0;i<(radius?12:1);i++){
        const offset=u.clone().multiplyScalar(Math.cos(i*Math.PI/6)*radius*port.bore).addScaledVector(w,Math.sin(i*Math.PI/6)*radius*port.bore);
        const start=origin.clone().add(offset).addScaledVector(axis,2*s);
        const found=hits(model.getPart(port.shell).root,start,axis.clone().negate(),2.8*s);
        assert.equal(found.length,0,`${profile.id}: blocked ${port.id}, cut=${cutaway}, radius=${radius}, sample=${i}, hit=${found[0]?.point.toArray()}`);
        checked++;
      }
      report.ports.push({id:port.id,cutaway,openSamples:checked});
    }
    const feed=model.ports.find(p=>p.id==="feed");
    assert.equal(hits(model.getPart("upperSupportRing").root,v(feed.origin).addScaledVector(v(feed.direction),2*s),v(feed.direction).negate(),3*s).length,0,"Feedwater support-ring interference");
  }
  model.setCutaway(true); // Interior parts are hidden in the closed assembly, so structural checks run in section.
  const tubeBox=model.bounds(["tubeBundle"]);
  assert.ok(Math.abs(tubeBox.min.y-g.sheetY)<1e-5,"Tubes must reach the primary face of the tubesheet");
  for(const tube of model.sampleLayout)for(const sign of [-1,1]){
    const origin=new T.Vector3(sign*tube.r,g.sheetY-.05,tube.z);
    const found=hits(model.getPart("tubeBundle").root,origin,new T.Vector3(0,1,0),g.straightTop-g.sheetY-.01);
    assert.equal(found.length,0,`Tube bore capped at ${JSON.stringify(tube)}`);
    assert.equal(hits(model.getPart("tubesheet").root,origin,new T.Vector3(0,1,0),g.sheetT+.10).length,0,"Tubesheet hole must align with tube");
    report.tubeLegsChecked++;
  }
  assert.ok(Math.abs(model.bounds(["divider"]).max.y-g.sheetY)<1e-5,"Divider must meet tubesheet");
  for(const point of model.separatorLayout){
    const origin=new T.Vector3(point.x,g.separatorBase-.30,point.z);
    assert.equal(hits(model.getPart("separators").root,origin,new T.Vector3(0,1,0),.7).length,0,"Separator entrance blocked");
    assert.equal(hits(model.getPart("separatorDeck").root,origin,new T.Vector3(0,1,0),.7).length,0,"Separator deck hole blocked");
    report.separatorEntrancesChecked++;
  }
  const wrapper=model.shellRecords.find(r=>r.p.id==="wrapper");
  const support=model.shellRecords.find(r=>r.p.id==="tubeSupports");
  assert.ok(Math.max(...support.points.map(p=>p[0]))<=Math.min(...wrapper.points.map(p=>p[0])),"Tube support penetrates wrapper");
  for(const pump of model.pumpLayout){
    const inlet=v(pump.inlet),axis=v(pump.direction);
    assert.equal(hits(model.getPart("pumpCasings").root,inlet.clone().addScaledVector(axis,-.05*s),axis,.85*s).length,0,"Pump inlet blocked");
    const outlet=v(pump.discharge),dir=v(pump.dischargeDirection);
    assert.equal(hits(model.getPart("pumpCasings").root,outlet.clone().addScaledVector(dir,1.05*s),dir.negate(),1.75*s).length,0,"Pump discharge blocked");
  }
  for(const flow of model.flowPaths.filter(p=>p.kind==="primary")){
    assert.ok(model.sampleLayout.some(t=>t.r===flow.tube.r&&t.z===flow.tube.z),"Flow must follow an existing tube");
    const {r,z}=flow.tube;
    for(const t of [.05,.25,.5,.75,.95]){
      const point=flow.curve.curves[3].getPoint(t);
      assert.ok(Math.abs(Math.hypot(point.x,point.y-g.straightTop)-r)<1e-8&&point.z===z,"Flow U-bend departs tube axis");
    }
  }
  const groups=[["tubeBundle","tubesheet","divider","pumpCasings"],["upperShell","separators","feedRing"],["lowerShell","transition","sleevePins"],["upperHead","steamOutlet","venturiTubes"]];
  for(const t of [0,.25,.6,1]){
    model.setExplosion(t);
    for(const ids of groups){
      const origin=model.getPart(ids[0]).root.position;
      for(const id of ids)assert.ok(model.getPart(id).root.position.distanceTo(origin)<1e-10,"Assembly connection shifted");
    }
  }
  let vertices=0;
  for(const geom of model.geometries)for(const attr of Object.values(geom.attributes)){
    for(const number of attr.array)assert.ok(Number.isFinite(number),"Non-finite geometry");
    vertices+=attr.count;
  }
  const warmCount=model.geometries.size;
  for(let i=0;i<6;i++)model.setCutaway(i%2===0);
  assert.equal(model.geometries.size,warmCount,"Cutaway cache grows on repeated toggles");
  model.setExplosion(0);model.setCutaway(false);
  report.geometryAttributesChecked=vertices;
  report.geometryCount=warmCount;report.diagnostics=model.diagnostics();
  report.displayEnvelopeHeight=model.bounds().getSize(new T.Vector3()).y;
  reports.push(report);model.dispose();console.timeEnd(profile.id);
}
fs.writeFileSync(path.resolve(__dirname,"../../docs/model-fix-verification-20261118.json"),JSON.stringify(reports,null,2)+"\n");
console.log(reports.map(r=>({model:r.model,openPortSamples:r.ports.reduce((n,p)=>n+p.openSamples,0),tubeLegs:r.tubeLegsChecked,separatorEntrances:r.separatorEntrancesChecked,geometryCount:r.geometryCount})));
