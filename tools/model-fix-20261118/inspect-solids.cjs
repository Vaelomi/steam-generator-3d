const ctx=require("./load-model.cjs")(),T=ctx.THREE;
const points=[[2,0],[2,3],[1,3],[1,0],[2,0]].map(p=>new T.Vector2(...p));
for(const [name,g] of [
  ["three full",new T.LatheGeometry(points,160)],
  ["helper full",ctx.SG_GEOMETRY.lathe(points.map(p=>[p.x,p.y]))],
  ["helper with hole",ctx.SG_GEOMETRY.lathe(points.map(p=>[p.x,p.y]),{holes:[{origin:new T.Vector3(1.8,1.5,0),direction:new T.Vector3(1,0,0),radius:.3,min:-.9,max:1.4}]})]
]){
  let volume=0,inward=0;
  const p=g.attributes.position,n=g.attributes.normal,idx=g.index;
  for(let i=0;i<(idx?idx.count:p.count);i+=3){
    const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),v=ids.map(j=>new T.Vector3().fromBufferAttribute(p,j));
    const cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
    if(cross.dot(new T.Vector3().fromBufferAttribute(n,ids[0]))<0)inward++;
    volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  }
  g.computeBoundingBox();console.log({name,volume,inward,triangles:(idx?idx.count:p.count)/3,bounds:g.boundingBox});
}
console.log(Object.values(ctx.SG_SHELL_CACHE).map(e=>({source:JSON.parse(e.signature)[1].length,triangles:e.groups.reduce((n,g)=>n+g.count,0)/3,bytes:e.vertices.length+e.indices.length})));
