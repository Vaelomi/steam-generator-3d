/* Offline shell booleans and hollow display pipes. CSG kernel: Evan Wallace (MIT). */
(function () {
  'use strict';
  const T=THREE,TAU=Math.PI*2;
  const cross=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
  function signature(points,{start=0,arc=TAU,holes=[],rim=true,segments=160}={}) {
    const text=JSON.stringify([4,points,start,arc,rim,segments,holes.map(h=>
      [h.origin.toArray(),h.direction.toArray(),h.radius,h.min,h.max])]);
    let hash=2166136261;
    for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
    return {key:(hash>>>0).toString(16),text};
  }
  function unpack(entry) {
    const bytes=base64=>Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
    const v=new Float32Array(bytes(entry.vertices).buffer),idx=new Uint32Array(bytes(entry.indices).buffer);
    const positions=new Float32Array(v.length/2),normals=new Float32Array(v.length/2);
    for(let i=0,j=0;i<v.length;i+=6,j+=3){
      positions.set(v.subarray(i,i+3),j);normals.set(v.subarray(i+3,i+6),j);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.BufferAttribute(positions,3));
    g.setAttribute('normal',new T.BufferAttribute(normals,3));
    g.setIndex(new T.BufferAttribute(idx,1));entry.groups.forEach(group=>g.addGroup(group.start,group.count,group.materialIndex));
    return g;
  }
  function polygons(geometry,shared=0,tagForTriangle=null) {
    const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index,out=[];
    for(let i=0;i<(index?index.count:p.count);i+=3){
      const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);
      a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);
      if(cross.subVectors(b,a).cross(c.clone().sub(a)).lengthSq()<1e-18)continue;
      out.push(new CSG.Polygon(ids.map(j=>new CSG.Vertex(
        [p.getX(j),p.getY(j),p.getZ(j)],[n.getX(j),n.getY(j),n.getZ(j)]
      )),tagForTriangle?tagForTriangle(i):shared));
    }
    return out;
  }
  function geometry(polys) {
    const positions=[],normals=[],groups=[[],[]];
    for(const p of polys){
      if(p.shared===2)continue; // Internal sector boundaries are not physical faces.
      groups[p.shared===1?1:0].push(p);
    }
    const result=new T.BufferGeometry();
    for(let material=0;material<2;material++){
      const first=positions.length/3;
      for(const poly of groups[material])for(let i=2;i<poly.vertices.length;i++){
        const tri=[poly.vertices[0],poly.vertices[i-1],poly.vertices[i]];
        const q=tri.map(v=>new T.Vector3(v.pos.x,v.pos.y,v.pos.z));
        if(b.subVectors(q[1],q[0]).cross(c.subVectors(q[2],q[0])).lengthSq()<1e-18)continue;
        for(const v of tri){
          positions.push(v.pos.x,v.pos.y,v.pos.z);
          const length=Math.hypot(v.normal.x,v.normal.y,v.normal.z)||1;
          normals.push(v.normal.x/length,v.normal.y/length,v.normal.z/length);
        }
      }
      const count=positions.length/3-first;
      if(count)result.addGroup(first,count,material);
    }
    result.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    result.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    return result;
  }
  function cap(shape,theta,outward,shared) {
    const g=new T.ShapeGeometry(shape),p=g.attributes.position,n=g.attributes.normal;
    const normal=new T.Vector3(Math.cos(theta)*outward,0,-Math.sin(theta)*outward);
    for(let i=0;i<p.count;i++){
      const r=p.getX(i);p.setXYZ(i,r*Math.sin(theta),p.getY(i),r*Math.cos(theta));
      n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    const idx=g.index;
    a.fromBufferAttribute(p,idx.getX(0));b.fromBufferAttribute(p,idx.getX(1));c.fromBufferAttribute(p,idx.getX(2));
    if(b.sub(a).cross(c.sub(a)).dot(normal)<0)for(let i=0;i<idx.count;i+=3){
      const j=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,j);
    }
    const out=polygons(g,shared);g.dispose();return out;
  }
  function clipProfile(points,height,keepAbove) {
    const inside=p=>keepAbove?p.y>=height-1e-9:p.y<=height+1e-9,out=[];
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length],pin=inside(p),qin=inside(q);
      if(pin)out.push(p);
      if(pin!==qin){
        const t=(height-p.y)/(q.y-p.y);
        out.push({x:p.x+(q.x-p.x)*t,y:height,nr:p.nr+(q.nr-p.nr)*t,ny:p.ny+(q.ny-p.ny)*t});
      }
    }
    return out.filter((p,i)=>!i||Math.hypot(p.x-out[i-1].x,p.y-out[i-1].y)>1e-9);
  }
  function lathe(points,{start=0,arc=TAU,holes=[],rim=true,segments=160}={}) {
    if(holes.length){
      const sig=signature(points,{start,arc,holes,rim,segments}),entry=window.SG_SHELL_CACHE?.[sig.key];
      if(entry&&entry.signature===sig.text)return unpack(entry);
    }
    const contour=points.map(p=>new T.Vector2(p[0],p[1]));
    if(!contour[0].equals(contour[contour.length-1]))contour.push(contour[0].clone());
    if(T.ShapeUtils.area(contour)<0)contour.reverse();
    const section=arc<TAU-1e-6;
    const steps=Math.max(8,Math.ceil(segments*arc/TAU)),chunk=holes.length?12:steps;
    const template=new T.LatheGeometry(contour,1,0,.01),normals=template.attributes.normal;
    const profile=contour.slice(0,-1).map((p,i)=>({x:p.x,y:p.y,nr:normals.getZ(i),ny:normals.getY(i)}));
    template.dispose();
    const low=Math.min(...profile.map(p=>p.y)),high=Math.max(...profile.map(p=>p.y));
    const bands=holes.length?Math.max(1,Math.ceil((high-low)/.6)):1;
    const cutters=holes.map(h=>{
      const from=h.origin.clone().addScaledVector(h.direction,h.min);
      const to=h.origin.clone().addScaledVector(h.direction,h.max);
      const box=new T.Box3().setFromPoints([from,to]).expandByScalar(h.radius);
      const solid=CSG.cylinder({start:from.toArray(),end:to.toArray(),radius:h.radius,slices:48});
      solid.polygons.forEach(p=>p.shared=0);
      return {box,solid};
    });
    const out=[];
    for(let band=0;band<bands;band++){
      const bottom=low+(high-low)*band/bands,top=low+(high-low)*(band+1)/bands;
      let sectionProfile=clipProfile(clipProfile(profile,bottom,true),top,false);
      if(sectionProfile.length<3)continue;
      sectionProfile=sectionProfile.concat(sectionProfile[0]);
      const contour=sectionProfile.map(p=>new T.Vector2(p.x,p.y)),shape=new T.Shape(contour);
      const edgeTags=sectionProfile.slice(0,-1).map((p,i)=>{
        const q=sectionProfile[i+1];
        return (band>0&&Math.abs(p.y-bottom)<1e-8&&Math.abs(q.y-bottom)<1e-8)||
          (band<bands-1&&Math.abs(p.y-top)<1e-8&&Math.abs(q.y-top)<1e-8)?2:0;
      });
      for(let first=0;first<steps;first+=chunk){
      const count=Math.min(chunk,steps-first),angle=start+arc*first/steps,span=arc*count/steps;
      const side=new T.LatheGeometry(contour,count,angle,span);
      for(let i=0;i<=count;i++)for(let j=0;j<sectionProfile.length;j++){
        const theta=angle+span*i/count,p=sectionProfile[j];
        side.attributes.normal.setXYZ(i*sectionProfile.length+j,p.nr*Math.sin(theta),p.ny,p.nr*Math.cos(theta));
      }
      side.computeBoundingBox();
      const localCutters=cutters.filter(cutter=>cutter.box.intersectsBox(side.boundingBox));
      let faces=polygons(side,0,i=>edgeTags[Math.floor(i/6)%edgeTags.length]);side.dispose();
      if(section||holes.length){
        const atStart=section&&first===0,atEnd=section&&first+count===steps;
        faces.push(...cap(shape,angle,-1,atStart&&rim?1:2),...cap(shape,angle+span,1,atEnd&&rim?1:2));
      }
      if(localCutters.length){
        let solid=CSG.fromPolygons(faces);
        for(const cutter of localCutters)solid=solid.subtract(cutter.solid);
        faces=solid.toPolygons();
      }
      out.push(...faces);
      }
    }
    return geometry(out);
  }
  function combine(geometries) {
    const p=[],n=[];
    for(const source of geometries){
      const g=source.index?source.toNonIndexed():source;
      p.push(...g.attributes.position.array);n.push(...g.attributes.normal.array);
      if(g!==source)g.dispose();source.dispose();
    }
    const out=new T.BufferGeometry();
    out.setAttribute('position',new T.Float32BufferAttribute(p,3));
    out.setAttribute('normal',new T.Float32BufferAttribute(n,3));
    return out;
  }
  function invert(g) {
    const index=g.index,p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<n.count;i++)n.setXYZ(i,-n.getX(i),-n.getY(i),-n.getZ(i));
    if(index)for(let i=0;i<index.count;i+=3){
      const j=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,j);
    }
    else for(let i=0;i<p.count;i+=3)for(const attr of [p,n]){
      const xyz=[attr.getX(i),attr.getY(i),attr.getZ(i)];
      attr.setXYZ(i,attr.getX(i+2),attr.getY(i+2),attr.getZ(i+2));attr.setXYZ(i+2,...xyz);
    }
    return g;
  }
  function pipe(outer,inner,height,segments=12) {
    const pts=[[outer,-height/2],[outer,height/2],[inner,height/2],[inner,-height/2],[outer,-height/2]];
    return new T.LatheGeometry(pts.map(p=>new T.Vector2(...p)),segments);
  }
  function bend(radius,outer,inner) {
    return combine([new T.TorusGeometry(radius,outer,12,48,Math.PI),invert(new T.TorusGeometry(radius,inner,12,48,Math.PI))]);
  }
  window.SG_GEOMETRY={lathe,pipe,bend,combine,invert,signature};
  window.SG_SHELL_CACHE_READY=(async()=>{
    if(!window.SG_SHELL_PACK||typeof DecompressionStream==='undefined'||window.SG_SHELL_CACHE)return;
    const bytes=Uint8Array.from(atob(window.SG_SHELL_PACK),char=>char.charCodeAt(0));
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    window.SG_SHELL_CACHE=JSON.parse(await new Response(stream).text());
    delete window.SG_SHELL_PACK;
  })();
})();
