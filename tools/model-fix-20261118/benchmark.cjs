const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.resolve(__dirname,"../.."),ctx=vm.createContext({console});
ctx.window=ctx;
for(const f of ["lib/three/three.min.js","lib/three/csg.js","lib/solid-geometry.js","lib/profiles.js","lib/model.js"])
  vm.runInContext(fs.readFileSync(path.join(root,f),"utf8"),ctx,{filename:f});
console.time("build");
const model=new ctx.SG_Model(ctx.SG_DATA.profiles.CAP1400,{cutaway:false});
console.timeEnd("build");
console.log(model.diagnostics());
console.time("cut");model.setCutaway(true);console.timeEnd("cut");
console.log(model.diagnostics());
