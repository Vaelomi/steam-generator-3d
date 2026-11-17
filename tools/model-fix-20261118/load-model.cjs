const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),zlib=require("node:zlib");
const root=path.resolve(__dirname,"../..");
module.exports=()=>{
  const ctx=vm.createContext({console,atob});
  ctx.window=ctx;
  const run=file=>vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),ctx,{filename:file});
  run("lib/three/three.min.js");run("lib/three/csg.js");run("lib/shell-cache.js");
  ctx.SG_SHELL_CACHE=JSON.parse(zlib.gunzipSync(Buffer.from(ctx.SG_SHELL_PACK,"base64")).toString("utf8"));
  run("lib/solid-geometry.js");run("lib/profiles.js");run("lib/model.js");
  return ctx;
};
