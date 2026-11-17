const ctx=require("./load-model.cjs")(),T=ctx.THREE;
const model=new ctx.SG_Model(ctx.SG_DATA.profiles.CAP1400,{cutaway:false});
console.log(model.pumpLayout);
for(const p of model.parts){
  const box=model.bounds([p.id]);
  if(box.min.y<0)console.log(p.id,box);
}
for(const record of model.shellRecords.filter(r=>r.p.id==="pumpCasings")){
  const geometry=record.holder.children[0].geometry;
  geometry.computeBoundingBox();
  console.log("casing source",record.points.length,Math.min(...record.points.map(p=>p[1])),Math.max(...record.points.map(p=>p[1])),geometry.boundingBox);
}
