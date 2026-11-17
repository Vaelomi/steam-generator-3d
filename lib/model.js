/* Parametric, offline geometry. Dimensions not in SG_DATA.public are illustrative. */
(function () {
  'use strict';
  const T = THREE, TAU = Math.PI * 2, UP = new T.Vector3(0,1,0);
  const palette = {
    shell:0x899ca7, plate:0x6d8691, tube:0xb38a45, support:0x759590,
    wrapper:0x7b9193, separator:0x4d8b7e, feed:0x65939f,
    nozzle:0x6287a3, hotNozzle:0xa38166, divider:0xaa8a57
  };
  const cadPalette = { tube:0xc1c3bf, separator:0x9caeb2, feed:0xa8b8bb, nozzle:0x9faeb8, hotNozzle:0xb2ada6, divider:0xb1ada7 };
  const v3 = (a) => new T.Vector3(...(a || [0,0,0]));
  const closed = (points) => {
    const out = points.map(p=>new T.Vector2(p[0],p[1]));
    if (!out[0].equals(out[out.length-1])) out.push(out[0].clone());
    return out;
  };
  // Internal components only read as structure when the pressure boundary is opened.
  // They are hidden in the closed assembly view so nothing shows through open nozzles.
  const INTERIOR_PARTS = new Set([
    'venturiTubes','tubeBundle','tubeSupports','tubeRetainers','antiVibration','wrapper',
    'sleevePins','separatorDeck','separators','dryer','feedRing','feedElbow','divider','dividerRibs'
  ]);

  class SteamGenerator {
    constructor(profile, options={}) {
      this.profile = profile;
      this.g = profile.geometry;
      this.cutaway = options.cutaway !== false;
      this.cad = options.cad === true;
      this.root = new T.Group();
      this.root.name = profile.id;
      this.parts = [];
      this.pickables = [];
      this.geometries = new Set();
      this.materials = new Set();
      this.shellRecords = [];
      this.extraMaterials = new Map();
      // Offsets describe display groups; each group preserves its internal connections.
      this.assemblyMotion = {
        fixed:      { offset:[0,0,0],      range:[0,1] },
        shell:      { offset:[-8,0,4.55],  range:[0,.50] },
        upper:      { offset:[0,3.1,0],    range:[.13,.75] },
        dryer:      { offset:[0,5.2,0],    range:[.18,.82] },
        head:       { offset:[0,7.4,0],    range:[.05,.65] },
        channel:    { offset:[0,0,0],      range:[0,1] }
      };
      this.flowGroup = new T.Group();
      this.guideGroup = new T.Group();
      this.flowGroup.visible = false;
      this.guideGroup.visible = false;
      this.root.add(this.flowGroup,this.guideGroup);
      this.explosion = 0;
      this.sampleLayout = this.makeTubeLayout();
      this.ports = this.makePorts();
      this.build();
      this.buildGuides();
      this.buildFlow();
    }
    keep(g) { this.geometries.add(g); return g; }
    material(color, extra={}) {
      const m = new T.MeshStandardMaterial({ color, metalness:.72, roughness:.30, side:T.DoubleSide, envMapIntensity:.78, ...extra });
      this.materials.add(m);
      return m;
    }
    accentMaterial(key, color, extra={}) {
      if (!this.extraMaterials.has(key)) this.extraMaterials.set(key,this.material(color,extra));
      return this.extraMaterials.get(key);
    }
    part(id, assembly, anchor, options={}) {
      const spec = SG_DATA.parts.find(p=>p.id===id);
      const motion = this.assemblyMotion[assembly];
      if(!spec||!motion)throw new Error(`Unknown assembly group: ${id} / ${assembly}`);
      const mat = this.material(palette[spec.color],{roughness:spec.color==='tube'?.3:.37});
      const group = new T.Group();
      group.name = id;
      const p = { ...spec, root:group, mat, baseColor:palette[spec.color], assembly, explode:v3(motion.offset), anchor:v3(anchor), enabled:true, inspectionVisible:true, interior:INTERIOR_PARTS.has(spec.id), attachedGroups:[], ...options };
      group.userData.part = p;
      this.parts.push(p);
      this.root.add(group);
      return p;
    }
    mesh(p, geometry, position=[0,0,0], mat=p.mat, parent=p.root) {
      const m = new T.Mesh(this.keep(geometry),mat);
      m.position.set(...position);
      m.userData.part = p;
      m.castShadow = false;
      m.receiveShadow = false;
      parent.add(m);
      this.pickables.push(m);
      return m;
    }
    box(p, size, position, mat=p.mat, parent=p.root) { return this.mesh(p,new T.BoxGeometry(...size),position,mat,parent); }
    instance(p, geometry, transforms, mat=p.mat) {
      if (!transforms.length) return null;
      const inst = new T.InstancedMesh(this.keep(geometry),mat,transforms.length);
      const object = new T.Object3D();
      transforms.forEach((a,i)=>{
        object.position.copy(a.position || new T.Vector3());
        object.quaternion.copy(a.quaternion || new T.Quaternion());
        object.scale.copy(a.scale || new T.Vector3(1,1,1));
        object.updateMatrix(); inst.setMatrixAt(i,object.matrix);
      });
      inst.instanceMatrix.needsUpdate=true;
      inst.userData.part=p;
      p.root.add(inst); this.pickables.push(inst);
      return inst;
    }
    ring(p, ri, ro, y, thickness, options={}) {
      return this.lathe(p,[[ro,y],[ro,y+thickness],[ri,y+thickness],[ri,y],[ro,y]],options);
    }
    lathe(p, points, {cuttable=false, holes=[], parent=p.root, rim=true}={}) {
      const holder = new T.Group(); parent.add(holder);
      const record={p,points,cuttable,holes,holder,rim,cache:new Map()};
      this.shellRecords.push(record); this.updateLathe(record);
      return holder;
    }
    updateLathe(record) {
      const {p,points,holder,holes,rim,cuttable} = record;
      while(holder.children.length) {
        const old = holder.children.pop();
        old.parent=null;
        const at=this.pickables.indexOf(old); if(at!==-1) this.pickables.splice(at,1);
      }
      const start = cuttable&&this.cutaway?this.g.cutStart:0;
      const arc = cuttable&&this.cutaway?this.g.cutLength:TAU;
      const key=cuttable&&this.cutaway?'section':'whole';
      if(!record.cache.has(key))record.cache.set(key,this.keep(SG_GEOMETRY.lathe(points,{start,arc,holes,rim})));
      const cutMat=this.accentMaterial('cut-face',0xd4c4a2,{metalness:.25,roughness:.6,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
      this.mesh(p,record.cache.get(key),[0,0,0],[p.mat,cutMat],holder);
    }
    nozzle(p, origin, direction, bore, length, {collar=1.23, parent=p.root, bolts=0}={}) {
      const holder=new T.Group();holder.position.set(...origin);
      holder.quaternion.setFromUnitVectors(UP,v3(direction).normalize());parent.add(holder);
      const ro=bore+.12*this.g.nozzleScale;
      const profile=[[ro*1.16,-.12],[ro*1.16,.16],[ro,.33],[ro,length-.20],[ro*collar,length-.20],[ro*collar,length],[bore,length],[bore,-.12],[ro*1.16,-.12]];
      this.lathe(p,profile,{parent:holder});
      const weldMat=this.accentMaterial('weld',0x7c8e95,{roughness:.47});
      this.mesh(p,new T.TorusGeometry(ro*1.15,.025,6,48),[0,.11,0],weldMat,holder).rotation.x=Math.PI/2;
      if(bolts){
        const bm=this.accentMaterial('bolt',0xb8b0a0,{roughness:.32,metalness:.75});
        for(let i=0;i<bolts;i++){
          const a=i*TAU/bolts;
          this.mesh(p,new T.CylinderGeometry(.045,.045,.08,6),[Math.cos(a)*ro*collar*.86,length+.035,Math.sin(a)*ro*collar*.86],bm,holder);
        }
      }
      return holder;
    }
    cover(p, origin, direction, r, {bolts=12,parent=p.root}={}) {
      const holder=new T.Group();holder.position.set(...origin);holder.quaternion.setFromUnitVectors(UP,v3(direction).normalize());parent.add(holder);
      this.lathe(p,[[r+.12,-.12],[r+.12,.28],[r+.22,.28],[r+.22,.44],[0,.44],[0,.36],[r,.36],[r,-.12],[r+.12,-.12]],{parent:holder});
      const boltMat=this.accentMaterial('cover-bolt',0xb8b0a0,{roughness:.4});
      for(let i=0;i<bolts;i++){
        const a=i*TAU/bolts;
        this.mesh(p,new T.CylinderGeometry(.04,.04,.07,6),[(r+.15)*Math.sin(a),.475,(r+.15)*Math.cos(a)],boltMat,holder);
      }
      return holder;
    }
    // Saddle collar that blends a straight nozzle into the curved channel head. Without it the
    // straight nozzle wall leaves open wedges between the nozzle and the slanted surface.
    saddle(p, point, axis, innerR, {depth=.05,reach=.30,parent=p.root,segments=40}={}) {
      const g=this.g,R=g.lowerR+g.shellWall,h=g.sheetY-.27,center=v3([0,g.sheetY,0]);
      const n=v3(axis).normalize();
      const u=Math.atan2(point.z,point.x);
      const cosV=Math.min(1,Math.hypot(point.x,point.z)/R),sinV=Math.max(0,Math.min(1,(g.sheetY-point.y)/h));
      const eAz=v3([-Math.sin(u),0,Math.cos(u)]);
      const eMer=v3([-R*sinV*Math.cos(u),-h*cosV,-R*sinV*Math.sin(u)]).normalize();
      const project=(x)=>{
        const y=x.clone().sub(center);
        const k=1/Math.sqrt((y.x/R)**2+(y.y/h)**2+(y.z/R)**2);
        return center.clone().addScaledVector(y,k);
      };
      const L=innerR+reach,ringB=[];
      for(let i=0;i<segments;i++){
        const a=i/segments*TAU,d=eAz.clone().multiplyScalar(Math.cos(a)).addScaledVector(eMer,Math.sin(a));
        let lo=.05*L,hi=3*L;
        for(let it=0;it<34;it++){
          const mid=(lo+hi)/2;
          if(project(point.clone().addScaledVector(d,mid)).distanceTo(point)<L)lo=mid;else hi=mid;
        }
        ringB.push(project(point.clone().addScaledVector(d,(lo+hi)/2)).addScaledVector(n,-.02));
      }
      let e1=v3([0,0,1]).cross(n);
      if(e1.lengthSq()<1e-6)e1=v3([1,0,0]).cross(n);
      e1.normalize();
      const e2=n.clone().cross(e1).normalize();
      const planeCenter=point.clone().addScaledVector(n,-depth);
      const positions=[],indices=[];
      for(let i=0;i<segments;i++){
        const a=i/segments*TAU;
        const A=planeCenter.clone().addScaledVector(e1,Math.cos(a)*innerR).addScaledVector(e2,Math.sin(a)*innerR);
        positions.push(A.x,A.y,A.z,ringB[i].x,ringB[i].y,ringB[i].z);
      }
      for(let i=0;i<segments;i++){
        const j=(i+1)%segments;
        indices.push(i*2,j*2,j*2+1,i*2,j*2+1,i*2+1);
      }
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.mesh(p,geo,[0,0,0],p.mat,parent);
      return geo;
    }
    makeTubeLayout() {
      const g=this.g,limit=g.lowerR-.33,step=g.sampleStep,out=[];
      for(let z=-Math.floor(limit/step)*step;z<=limit;z+=step) {
        const max=Math.sqrt(Math.max(0,limit*limit-z*z))-.05;
        for(let r=.17;r<max;r+=step)out.push({r,z:Number(z.toFixed(6))});
      }
      return out;
    }
    makePorts() {
      const g=this.g,lr=g.lowerR,ur=g.upperR,s=g.nozzleScale,ports=[];
      this.feedY=g.transitionTop+.95*s;
      const add=(id,part,shell,origin,direction,bore,length,extra={})=>{
        const port={id,part,shell,origin,direction:v3(direction).normalize().toArray(),bore,length,...extra};
        ports.push(port);return port;
      };
      add('feed','feedNozzle','upperShell',[ur-.2,this.feedY,.1],[1,0,0],.25*s,1.6*s,{collar:1.12});
      add('startup','auxNozzle','upperShell',[ur-.1,g.transitionTop+1.75*s,-.6],[1,0,0],.13*s,1.25*s,{collar:1.12});
      const angle=4.70,dir=[Math.sin(angle),0,Math.cos(angle)];
      [g.transitionTop+1.35,g.upperTop-1.2].forEach((y,i)=>
        add(`level${i}`,'levelNozzles','upperShell',[(ur-.12)*dir[0],y,(ur-.12)*dir[2]],dir,.09*s,.75*s));
      const h=g.sheetY-.27,R=lr+g.shellWall;
      // Points on the ellipsoidal channel head together with its true outward normal. Nozzles
      // welded to a curved shell must follow that normal: a straight stub cuts an elliptical
      // opening that the round nozzle wall cannot cover, and open slots appear on both sides.
      const dome=(angle,radius)=>{
        const ax=radius*Math.cos(angle),az=radius*Math.sin(angle);
        const ay=g.sheetY-h*Math.sqrt(Math.max(0,1-(radius/R)**2));
        return {point:v3([ax,ay,az]),normal:v3([ax/(R*R),(ay-g.sheetY)/(h*h),az/(R*R)]).normalize()};
      };
      const domeY=(angle,y)=>dome(angle,R*Math.sqrt(Math.max(0,1-((g.sheetY-y)/h)**2)));
      for(const sign of [-1,1]){
        add(`upperManway${sign}`,'manways','upperShell',[0,g.transitionTop+2.55,sign*(ur-.1)],[0,0,sign],.43*s,0,{cover:true});
        const man=domeY(sign>0?-1.266:1.876,g.sheetY-1.0*s);
        add(`channelManway${sign}`,'manways','channelHead',man.point.clone().addScaledVector(man.normal,-.02*s).toArray(),man.normal.toArray(),.33*s,0,{cover:true});
        add(`handhole${sign}`,'handholes','lowerShellAB',[sign*(lr-.02),g.tubeBase+.6,0],[sign,0,0],.25*s,0,{cover:true,bolts:8});
        const pump=dome(sign>0?.8413:-.8413,1.67*s);
        add(`pump${sign}`,'pumpOutlets','channelHead',pump.point.clone().addScaledVector(pump.normal,-.02*s).toArray(),pump.normal.toArray(),.4*s,.58*s,{collar:1.2,bolts:12});
      }
      const hot=domeY(Math.PI,g.sheetY-1.26*s);
      add('hotLeg','primaryInlet','channelHead',hot.point.clone().addScaledVector(hot.normal,-.02*s).toArray(),hot.normal.toArray(),.5*s,1.15*s,{collar:1.1});
      const res=domeY(2.66,g.sheetY-.72*s);
      add('residual','residualHeatNozzle','channelHead',res.point.clone().addScaledVector(res.normal,-.02*s).toArray(),res.normal.toArray(),.13*s,.95*s);
      add('blowdown0','blowdown','lowerShellAB',[-lr,g.tubeBase+.27,-.40],[-1,0,0],.075*s,.85*s);
      add('blowdown1','blowdown','lowerShellAB',[-lr,g.tubeBase+.26,.42],[-1,-.1,0],.075*s,.85*s);
      return ports;
    }
    portHole(port) {
      // Slightly wider than the bore so the nozzle wall always overlaps the shell edge.
      return {origin:v3(port.origin),direction:v3(port.direction),radius:port.bore*1.06,min:-.9*this.g.nozzleScale,max:1.4*this.g.nozzleScale};
    }
    drawPorts(p,ports,parent=p.root) {
      for(const port of ports){
        if(port.cover)this.cover(p,port.origin,port.direction,port.bore,{bolts:port.bolts||12,parent});
        else this.nozzle(p,port.origin,port.direction,port.bore,port.length,{collar:port.collar||1.15,bolts:port.bolts||0,parent});
      }
    }
    perforated(radius, height, holeRadius, {separator=false,retainers=false}={}) {
      const shape=new T.Shape();shape.moveTo(radius,0);
      for(let i=1;i<=128;i++){const a=i/128*TAU;shape.lineTo(radius*Math.cos(a),radius*Math.sin(a));}
      if(separator) {
        for(const pos of this.separatorLayout) {
          const h=new T.Path();h.absarc(pos.x,pos.z,holeRadius,0,TAU,true);shape.holes.push(h);
        }
      } else {
        for(const tube of this.sampleLayout) {
          for(const x of [-tube.r,tube.r]){
            const h=new T.Path();h.absarc(x,tube.z,holeRadius,0,TAU,true);shape.holes.push(h);
          }
        }
      }
      if(retainers)for(let i=0;i<6;i++){
        const a=i*TAU/6,hole=new T.Path();
        hole.absarc(Math.sin(a)*(this.g.lowerR-.24),Math.cos(a)*(this.g.lowerR-.24),.05,0,TAU,true);
        shape.holes.push(hole);
      }
      const geom=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:6,steps:1});
      geom.rotateX(-Math.PI/2); // shape y becomes -world z; layout is symmetric in z.
      return geom;
    }
    build() {
      const g=this.g,s=g.nozzleScale,lr=g.lowerR,ur=g.upperR,w=g.shellWall;
      const splitY=g.tubeBase+(g.lowerTop-g.tubeBase)*.42;
      const ringY=this.feedY,ringR=ur-.40;
      const portsFor=id=>this.ports.filter(port=>port.part===id);
      const shellHoles=id=>this.ports.filter(port=>port.shell===id).map(port=>this.portHole(port));
      let p;
      p=this.part('steamOutlet','head',[0,g.domeTop+.38,0]);
      this.nozzle(p,[0,g.domeTop-.17,0],[0,1,0],.38*s,g.height-g.domeTop+.17,{collar:1.14});
      p=this.part('upperHead','head',[ur*.55,g.upperTop+.8,ur*.42]);
      const outer=[],inner=[],domeH=g.domeTop-g.upperTop;
      const maxAngle=Math.acos(.38*s/(ur+w));
      for(let j=0;j<=36;j++){const a=maxAngle*j/36;outer.push([(ur+w)*Math.cos(a),g.upperTop+domeH*Math.sin(a)]);}
      for(let j=36;j>=0;j--){const a=maxAngle*j/36;inner.push([Math.max(.38*s,ur*Math.cos(a)),g.upperTop+(domeH-w)*Math.sin(a)]);}
      this.lathe(p,outer.concat(inner),{cuttable:true});
      const venturiPositions=[{x:0,z:0}];
      for(let i=0;i<6;i++){
        const a=i*TAU/6;venturiPositions.push({x:Math.sin(a)*.19*s,z:Math.cos(a)*.19*s});
      }
      p=this.part('restrictorHole','head',[.18*s,g.domeTop+.40*s,.18*s]);
      const restrictor=new T.Shape();restrictor.absarc(0,0,.38*s,0,TAU,false);
      for(const pos of venturiPositions){
        const hole=new T.Path();hole.absarc(pos.x,pos.z,.072*s,0,TAU,true);restrictor.holes.push(hole);
      }
      const restrictorGeo=new T.ExtrudeGeometry(restrictor,{depth:.07*s,bevelEnabled:false,curveSegments:16});
      restrictorGeo.rotateX(-Math.PI/2);
      this.mesh(p,restrictorGeo,[0,g.domeTop+.35*s,0]);
      p=this.part('venturiTubes','head',[.15*s,g.domeTop+.10*s,0]);
      const venturiGeo=new T.LatheGeometry(closed([
        [.092*s,0],[.092*s,.43*s],[.072*s,.43*s],
        [.050*s,.24*s],[.073*s,0]
      ]),24);
      this.instance(p,venturiGeo,venturiPositions.map(pos=>({position:v3([pos.x,g.domeTop-.08*s,pos.z])})));
      p=this.part('upperShell','upper',[ur,g.upperTop-2.1,0]);
      this.lathe(p,[[ur+w,g.transitionTop],[ur+w,g.upperTop],[ur,g.upperTop],[ur,g.transitionTop]],{cuttable:true,holes:shellHoles('upperShell')});
      for(const y of [g.transitionTop+.06,g.upperTop-.08])this.ring(p,ur+w-.005,ur+w+.035,y,.055,{cuttable:true});
      p=this.part('upperSupportRing','upper',[ur+w+.15,g.transitionTop+.34,0]);
      this.ring(p,ur+w-.02,ur+w+.25,g.transitionTop+.30,.12,{cuttable:true});
      this.ring(p,ur-.13,ur+w+.12,g.transitionTop+.10,.12,{cuttable:true});
      p=this.part('transition','shell',[lr+.45,g.lowerTop+.7,0]);
      this.lathe(p,[[lr+w,g.lowerTop],[ur+w,g.transitionTop],[ur,g.transitionTop],[lr,g.lowerTop]],{cuttable:true});
      p=this.part('lowerShell','shell',[-lr,(splitY+g.lowerTop)/2,0]);
      this.lathe(p,[[lr+w,splitY],[lr+w,g.lowerTop],[lr,g.lowerTop],[lr,splitY]],{cuttable:true});
      this.ring(p,lr+w-.005,lr+w+.025,g.lowerTop-.08,.055,{cuttable:true});
      p=this.part('lowerShellAB','fixed',[-lr,g.tubeBase+1.4,0]);
      this.lathe(p,[[lr+w,g.tubeBase],[lr+w,splitY],[lr,splitY],[lr,g.tubeBase]],{cuttable:true,holes:shellHoles('lowerShellAB')});
      for(const y of [g.tubeBase+.08,splitY-.06])this.ring(p,lr+w-.005,lr+w+.025,y,.055,{cuttable:true});
      p=this.part('tubesheet','fixed',[lr*.8,g.sheetY+.3,lr*.3]);
      this.mesh(p,this.perforated(lr+w+.12,g.sheetT,g.sampleTubeR),[0,g.sheetY,0]);
      this.ring(p,lr+w,lr+w+.18,g.sheetY+.13,g.sheetT-.26);
      p=this.part('channelHead','channel',[-lr*.8,g.sheetY-1.1,0]);
      const bottomOuter=[],bottomInner=[],h=g.sheetY-.27;
      for(let j=0;j<=40;j++){const a=(Math.PI/2)*j/40;bottomOuter.push([(lr+w)*Math.cos(a),g.sheetY-h*Math.sin(a)]);}
      for(let j=40;j>=0;j--){const a=(Math.PI/2)*j/40;bottomInner.push([lr*Math.cos(a),g.sheetY-(h-.22)*Math.sin(a)]);}
      this.lathe(p,bottomOuter.concat(bottomInner),{cuttable:true,holes:shellHoles('channelHead')});
      p=this.part('tubeBundle','fixed',[0,g.straightTop+.7,lr*.56]);
      p.actualCount=this.profile.public.tubes;p.sampleCount=this.sampleLayout.length;
      const legBottom=g.sheetY,legTransforms=[],straightH=g.straightTop-legBottom;
      for(const t of this.sampleLayout){
        legTransforms.push({position:v3([-t.r,legBottom+straightH/2,t.z])},{position:v3([t.r,legBottom+straightH/2,t.z])});
      }
      this.instance(p,SG_GEOMETRY.pipe(g.sampleTubeR,g.sampleTubeR*.70,straightH,12),legTransforms);
      const arches=new Map();
      for(const t of this.sampleLayout){
        const key=t.r.toFixed(5);if(!arches.has(key))arches.set(key,{r:t.r,transforms:[]});
        arches.get(key).transforms.push({position:v3([0,g.straightTop,t.z])});
      }
      for(const row of arches.values())this.instance(p,SG_GEOMETRY.bend(row.r,g.sampleTubeR,g.sampleTubeR*.70),row.transforms);
      p=this.part('tubeSupports','fixed',[lr*.84,g.supportLevels[3],0]);
      const plateGeometry=this.keep(this.perforated(lr-.13,.115,g.sampleTubeR+.025,{retainers:true}));
      for(const y of g.supportLevels){
        this.mesh(p,plateGeometry,[0,y,0]);
        this.ring(p,lr-.17,lr-.13,y-.018,.15);
      }
      p=this.part('tubeRetainers','fixed',[lr-.24,g.straightTop-.25,0]);
      const retainR=lr-.24,retainLow=g.tubeBase+.8,retainHigh=g.straightTop-.25;
      for(const y of [retainLow,retainHigh])this.mesh(p,new T.TorusGeometry(retainR,.035,6,96),[0,y,0]).rotation.x=Math.PI/2;
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        this.mesh(p,new T.CylinderGeometry(.035,.035,retainHigh-retainLow,6),[Math.sin(a)*retainR,(retainLow+retainHigh)/2,Math.cos(a)*retainR]);
      }
      p=this.part('antiVibration','fixed',[0,g.straightTop+1.9,0]);
      const barMat=this.accentMaterial('avb',0xb5bdb9,{roughness:.4});
      for(let i=-3;i<=3;i++){
        const z=i*.47,reach=Math.sqrt(Math.max(.04,(lr-.31)**2-z*z));
        const pts=[];
        for(let n=0;n<=28;n++){const a=Math.PI*n/28;pts.push(new T.Vector3(Math.cos(a)*reach,g.straightTop+Math.sin(a)*reach+.07,z));}
        this.mesh(p,new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.033,5,false),[0,0,0],barMat);
      }
      p=this.part('wrapper','fixed',[-lr*.7,g.straightTop-1,-lr*.5]);
      const wrapR=lr-.075;
      this.lathe(p,[[wrapR,g.tubeBase+.42],[wrapR,g.lowerTop-.13],[wrapR-.045,g.lowerTop-.13],[wrapR-.045,g.tubeBase+.42]],{cuttable:true});
      for(const y of [g.tubeBase+.45,g.lowerTop-.21])this.ring(p,wrapR-.05,wrapR+.025,y,.085,{cuttable:true});
      p=this.part('sleevePins','shell',[lr-.15,splitY+.72,0]);
      for(let i=0;i<4;i++){
        const a=Math.PI/4+i*TAU/4,dir=new T.Vector3(Math.sin(a),0,Math.cos(a));
        const pin=this.mesh(p,new T.CylinderGeometry(.075,.075,.42,10),[dir.x*(lr-.16),splitY+.72,dir.z*(lr-.16)]);
        pin.quaternion.setFromUnitVectors(UP,dir);
      }
      this.separatorLayout=[];
      const pitch=this.profile.id==='CAP1400'?.83:.86;
      for(let i=-g.separatorRows;i<=g.separatorRows;i++)for(let j=-g.separatorRows;j<=g.separatorRows;j++){
        const x=i*pitch,z=j*pitch;
        if(Math.hypot(x,z)<ur-.46)this.separatorLayout.push({x,z});
      }
      p=this.part('separatorDeck','upper',[ur*.8,g.separatorBase-.25,0]);
      this.mesh(p,this.perforated(ur-.12,.2,.265*s,{separator:true}),[0,g.separatorBase-.22,0]);
      this.ring(p,ur-.19,ur-.08,g.separatorBase-.27,.27);
      p=this.part('separators','upper',[ur*.2,(g.separatorBase+g.separatorTop)/2,ur*.5]);
      p.sampleCount=this.separatorLayout.length;
      const sepH=g.separatorTop-g.separatorBase;
      const sepBody=[],sepTop=[],sepBase=[];
      for(const pos of this.separatorLayout){
        sepBody.push({position:v3([pos.x,g.separatorBase,pos.z])});
        sepTop.push({position:v3([pos.x,g.separatorTop-.04*s,pos.z]),quaternion:new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2)});
        sepBase.push({position:v3([pos.x,g.separatorBase+.03,pos.z])});
      }
      const sepProfile=[
        [.255*s,-.22],[.255*s,.10*s],[.235*s,.28*s],[.235*s,sepH-.65*s],
        [.31*s,sepH-.44*s],[.31*s,sepH-.12*s],[.265*s,sepH],
        [.235*s,sepH],[.278*s,sepH-.15*s],[.278*s,sepH-.40*s],
        [.21*s,sepH-.64*s],[.21*s,.28*s],[.225*s,.10*s],[.225*s,-.22]
      ];
      this.instance(p,new T.LatheGeometry(closed(sepProfile),32),sepBody);
      this.instance(p,new T.TorusGeometry(.27*s,.022*s,8,32),sepTop,this.accentMaterial('sep-rim',0xa8beb7,{metalness:.65,roughness:.28}));
      this.instance(p,SG_GEOMETRY.pipe(.31*s,.225*s,.12,32),sepBase);
      const vaneTransforms=[];
      for(const pos of this.separatorLayout)for(let i=0;i<3;i++){
        const a=i*TAU/3;
        vaneTransforms.push({position:v3([pos.x+Math.cos(a)*.16*s,g.separatorTop-.26*s,pos.z+Math.sin(a)*.16*s]),quaternion:new T.Quaternion().setFromEuler(new T.Euler(.35,a,.15))});
      }
      this.instance(p,new T.BoxGeometry(.16*s,.28*s,.025*s),vaneTransforms);
      p=this.part('dryer','dryer',[ur*.4,(g.dryerBottom+g.dryerTop)/2,ur*.35]);
      this.ring(p,ur-.37,ur-.13,g.dryerBottom,.16);
      this.ring(p,ur-.37,ur-.13,g.dryerTop-.07,.07);
      const dryerH=g.dryerTop-g.dryerBottom;
      const dryerTransforms=[],dryerR=ur-.39;
      for(let z=-dryerR+.2;z<dryerR;z+=.54){
        const span=2*Math.sqrt(Math.max(0,dryerR*dryerR-z*z))-.15;
        if(span<.3)continue;
        this.box(p,[span,.035,.035],[0,g.dryerTop,z]);
        this.box(p,[span,.07,.04],[0,g.dryerBottom+.1,z]);
        for(let x=-span/2+.1;x<span/2-.05;x+=.19){
          dryerTransforms.push({position:v3([x,g.dryerBottom+dryerH/2,z]),quaternion:new T.Quaternion().setFromAxisAngle(UP,.33)});
          dryerTransforms.push({position:v3([x+.067,g.dryerBottom+dryerH/2,z+.22]),quaternion:new T.Quaternion().setFromAxisAngle(UP,-.33)});
        }
      }
      this.instance(p,new T.BoxGeometry(.022,dryerH-.12,.32),dryerTransforms);
      for(let a=0;a<TAU;a+=Math.PI/3)this.box(p,[.08,dryerH,.08],[Math.sin(a)*(ur-.24),g.dryerBottom+dryerH/2,Math.cos(a)*(ur-.24)]);
      p=this.part('feedRing','upper',[ur-.42,ringY,0]);
      const feedRingGeo=SG_GEOMETRY.combine([new T.TorusGeometry(ringR,.105*s,10,100),SG_GEOMETRY.invert(new T.TorusGeometry(ringR,.075*s,10,100))]);
      this.mesh(p,feedRingGeo,[0,ringY,0]).rotation.x=Math.PI/2;
      for(let i=0;i<18;i++){
        const a=i*TAU/18;
        this.mesh(p,SG_GEOMETRY.pipe(.041,.028,.25,10),[Math.sin(a)*ringR,ringY-.14,Math.cos(a)*ringR]);
      }
      p=this.part('feedElbow','upper',[ringR+.20,ringY,.06]);
      const elbowPath=new T.CatmullRomCurve3([
        v3([ringR-.08,ringY,0]),v3([ringR+.08,ringY,.01]),
        v3([ur-.24,ringY,.07]),v3([ur-.07,ringY,.1])
      ],false,'centripetal');
      this.mesh(p,SG_GEOMETRY.combine([new T.TubeGeometry(elbowPath,24,.13*s,10,false),SG_GEOMETRY.invert(new T.TubeGeometry(elbowPath,24,.10*s,10,false))]));
      p=this.part('feedNozzle','upper',[ur+1.2,ringY,.15]);
      this.drawPorts(p,portsFor('feedNozzle'));
      p=this.part('auxNozzle','upper',[ur+1,g.transitionTop+1.75*s,-.5]);
      this.drawPorts(p,portsFor('auxNozzle'));
      p=this.part('levelNozzles','upper',portsFor('levelNozzles')[0].origin);
      this.drawPorts(p,portsFor('levelNozzles'));
      p=this.part('blowdown','fixed',[-lr-.8,g.tubeBase+.25,-.5]);
      this.drawPorts(p,portsFor('blowdown'));
      p=this.part('divider','channel',[0,g.sheetY-1.05,lr*.6]);
      const div=new T.Shape();
      div.moveTo(-lr,g.sheetY);div.lineTo(lr,g.sheetY);
      for(let j=0;j<=40;j++){const a=Math.PI*j/40;div.lineTo(lr*Math.cos(a),g.sheetY-(h-.22)*Math.sin(a));}
      const divGeo=new T.ExtrudeGeometry(div,{depth:.075,bevelEnabled:false,curveSegments:1});
      divGeo.rotateY(Math.PI/2);divGeo.translate(-.0375,0,0);
      this.mesh(p,divGeo);
      p=this.part('dividerRibs','channel',[.12,g.sheetY-.75,lr*.45]);
      for(const sign of [-1,1]){
        this.box(p,[.32,.48,.09],[.14,g.sheetY-.67,sign*.55]);
        this.box(p,[.32,.10,.30],[.14,g.sheetY-.95,sign*.55]);
      }
      p=this.part('primaryInlet','channel',[-lr-1,1.1,0]);
      this.drawPorts(p,portsFor('primaryInlet'));
      p=this.part('pumpOutlets','channel',[lr*.85,.1,lr*.7]);
      this.drawPorts(p,portsFor('pumpOutlets'));
      p=this.part('pumpCasings','channel',[lr+1,-.35,lr]);
      this.pumpLayout=[];
      for(const port of portsFor('pumpOutlets')){
        // The nozzle leaves the head along the local surface normal, then a smooth elbow turns
        // the flow down into the vertically mounted casing.
        const n=v3(port.direction).normalize();
        const exit=v3(port.origin).addScaledVector(n,port.length);
        const down=v3([0,-1,0]);
        const cosT=Math.max(-1,Math.min(1,n.dot(down)));
        const sinT=Math.sqrt(Math.max(0,1-cosT*cosT));
        const m=sinT>1e-4?v3().copy(down).addScaledVector(n,-cosT).divideScalar(sinT):v3([1,0,0]);
        const Rb=.70*s,theta=Math.acos(cosT),arc=[];
        for(let i=0;i<=12;i++){
          const phi=theta*i/12;
          arc.push(exit.clone().addScaledVector(m,Rb*(1-Math.cos(phi))).addScaledVector(n,Rb*Math.sin(phi)));
        }
        const bendEnd=arc[arc.length-1],runLen=.34*s,cs=.9;
        const center=v3([bendEnd.x,bendEnd.y-runLen-.52*s,bendEnd.z]);
        const holder=new T.Group();holder.position.copy(center);p.root.add(holder);
        const horizontal=v3([center.x,0,center.z]).normalize();
        const discharge=horizontal.clone().multiplyScalar(1.00*cs*s);discharge.y=.02*s;
        // Squat hollow volute casing: open axial inlet, side discharge, closed service cover.
        const body=[
          [.52,.52],[.56,.42],[.95,.22],[1.06,.02],[1.04,-.20],[.90,-.40],[.58,-.50],
          [0,-.50],[0,-.38],[.52,-.36],[.72,-.28],[.82,-.10],[.80,.10],[.60,.28],[.42,.42],[.42,.52]
        ].map(([r,y])=>[r*cs*s,y*s]);
        const hole=(origin,direction,radius,min,max)=>({origin,direction,radius,min,max});
        this.lathe(p,body,{parent:holder,holes:[
          hole(discharge,horizontal,.36*s,-.85*s,1.2*s)
        ]});
        const pathPts=[exit.clone().addScaledVector(n,-.05*s),...arc,
          v3([bendEnd.x,bendEnd.y-runLen*.4,bendEnd.z]),
          v3([bendEnd.x,bendEnd.y-runLen*.8,bendEnd.z]),
          v3([center.x,center.y+.52*s,center.z])];
        const elbowPath=new T.CatmullRomCurve3(pathPts,false,'centripetal');
        this.mesh(p,SG_GEOMETRY.combine([
          new T.TubeGeometry(elbowPath,44,.53*s,14,false),
          SG_GEOMETRY.invert(new T.TubeGeometry(elbowPath,44,.405*s,14,false))
        ]));
        this.ring(p,.42*s,.70*s,.44*s,.12*s,{parent:holder});
        this.nozzle(p,discharge.toArray(),horizontal.toArray(),.34*s,.95*s,{parent:holder,collar:1.22,bolts:12});
        this.lathe(p,[[1.13*s,-.08*s],[1.13*s,.02*s],[.98*s,.02*s],[.98*s,-.08*s],[1.13*s,-.08*s]],{parent:holder,holes:[
          hole(discharge,horizontal,.36*s,-.85*s,1.2*s)
        ]});
        this.ring(p,.45*s,.68*s,-.56*s,.10*s,{parent:holder});
        const boltGeo=new T.CylinderGeometry(.035*s,.035*s,.07*s,6);
        for(let i=0;i<12;i++){
          const a=i*TAU/12,x=Math.sin(a),z=Math.cos(a);
          this.mesh(p,boltGeo,[x*1.065*cs*s,-.015*s,z*1.065*cs*s],p.mat,holder);
          this.mesh(p,boltGeo,[x*.60*cs*s,.58*s,z*.60*cs*s],p.mat,holder);
          this.mesh(p,boltGeo,[x*.57*cs*s,-.60*s,z*.57*cs*s],p.mat,holder);
        }
        const outletAngle=Math.atan2(horizontal.x,horizontal.z);
        for(let i=0;i<8;i++){
          const a=i*TAU/8,delta=Math.atan2(Math.sin(a-outletAngle),Math.cos(a-outletAngle));
          if(Math.abs(delta)<.30)continue;
          const rib=this.box(p,[.09*cs*s,.40*s,.30*cs*s],[Math.sin(a)*1.00*cs*s,-.05*s,Math.cos(a)*1.00*cs*s],p.mat,holder);
          rib.rotation.y=a;
        }
        this.pumpLayout.push({port:port.id,center:center.toArray(),
          inlet:v3([center.x,center.y+.52*s,center.z]).toArray(),inletDirection:[0,-1,0],
          exit:exit.toArray(),direction:n.toArray(),elbow:pathPts.map(pt=>pt.toArray()),
          discharge:center.clone().add(discharge).toArray(),
          dischargeDirection:horizontal.toArray(),dischargeLength:.95*s});
      }
      p=this.part('residualHeatNozzle','channel',[-lr*.9,g.sheetY*.4,lr*.55]);
      this.drawPorts(p,portsFor('residualHeatNozzle'));
      p=this.part('mimsMounts','channel',[lr*.8,g.sheetY-.75,lr*.4]);
      const mountAngle=1.1,mountY=g.sheetY-.75;
      const mountR=(lr+w)*Math.sqrt(1-((g.sheetY-mountY)/h)**2);
      const mount=new T.Group();mount.rotation.y=mountAngle;
      mount.position.set(Math.sin(mountAngle)*mountR,mountY,Math.cos(mountAngle)*mountR);p.root.add(mount);
      this.box(p,[.34,.36,.15],[0,0,.04],p.mat,mount);
      this.box(p,[.20,.20,.10],[0,0,.16],p.mat,mount);
      p=this.part('manways','fixed',[1,g.transitionTop+2.6,ur]);
      const upperManways=new T.Group(),channelManways=new T.Group();
      p.root.add(upperManways,channelManways);
      p.attachedGroups.push({root:upperManways,assembly:'upper'},{root:channelManways,assembly:'channel'});
      this.drawPorts(p,portsFor('manways').filter(port=>port.shell==='upperShell'),upperManways);
      this.drawPorts(p,portsFor('manways').filter(port=>port.shell==='channelHead'),channelManways);
      p=this.part('handholes','fixed',[-lr-.2,g.tubeBase+.6,0]);
      this.drawPorts(p,portsFor('handholes'));
      p=this.part('damperPads','upper',[-ur,g.transitionTop+2.5,0]);
      for(const a of [2.05,4.55]){
        const holder=new T.Group();holder.rotation.y=a;holder.position.y=g.transitionTop+2.55;p.root.add(holder);
        this.box(p,[.52,.68,.13],[0,0,ur+w+.055],p.mat,holder);
        this.box(p,[.34,.42,.14],[0,0,ur+w+.18],p.mat,holder);
        this.box(p,[.62,.08,.24],[0,-.37,ur+w+.11],p.mat,holder);
      }
      p=this.part('supports','fixed',[0,g.tubeBase+.2,-lr-.5]);
      for(let i=0;i<4;i++){
        const a=Math.PI/4+i*Math.PI/2,holder=new T.Group();holder.rotation.y=a;holder.position.y=g.tubeBase+.12;p.root.add(holder);
        this.box(p,[.65,.30,.74],[0,.05,lr+.27],p.mat,holder);
        this.box(p,[.09,.68,.43],[-.24,.28,lr+.11],p.mat,holder);
        this.box(p,[.09,.68,.43],[.24,.28,lr+.11],p.mat,holder);
        this.box(p,[.75,.12,.84],[0,-.12,lr+.27],p.mat,holder);
      }
      this.parts.sort((a,b)=>Number(a.number)-Number(b.number));
      this.setCad(this.cad);
      this.applyVisibility();
      this.root.updateMatrixWorld(true);
    }
    setCutaway(on) {
      if(this.cutaway===on)return;
      this.cutaway=on;
      for(const r of this.shellRecords)if(r.cuttable)this.updateLathe(r);
      this.applyVisibility();
      this.root.updateMatrixWorld(true);
    }
    setCad(on) {
      this.cad=on;
      for(const p of this.parts)p.mat.color.setHex(on?(cadPalette[p.color]||palette[p.color]):palette[p.color]);
    }
    setWireframe(on) { for(const mat of this.materials)if(mat.isMeshStandardMaterial)mat.wireframe=on; }
    groupProgress(assembly,t=this.explosion) {
      const [start,end]=this.assemblyMotion[assembly].range;
      const u=Math.max(0,Math.min(1,(t-start)/(end-start)));
      return u*u*(3-2*u);
    }
    setExplosion(t) {
      this.explosion=Math.max(0,Math.min(1,t));
      for(const p of this.parts){
        p.root.position.copy(p.explode).multiplyScalar(this.groupProgress(p.assembly));
        for(const child of p.attachedGroups){
          child.root.position.fromArray(this.assemblyMotion[child.assembly].offset).multiplyScalar(this.groupProgress(child.assembly));
        }
      }
      this.applyVisibility();
      this.root.updateMatrixWorld(true);
      if(this.guideGroup.visible)this.updateGuides();
    }
    // Interior parts stay hidden while the shell is closed, so the assembly view
    // never shows internals through open nozzles or manways.
    interiorHidden() { return !this.cutaway && this.explosion<=0.005; }
    applyVisibility() {
      const hide=this.interiorHidden();
      for(const p of this.parts)p.root.visible=p.enabled&&p.inspectionVisible&&!(hide&&p.interior);
    }
    setVisible(id,on) {
      const p=this.parts.find(p=>p.id===id);if(!p)return;
      p.enabled=on;this.applyVisibility();this.updateGuides();
    }
    setInspection(ids) {
      for(const p of this.parts)p.inspectionVisible=!ids||ids.includes(p.id);
      this.applyVisibility();this.updateGuides();
    }
    showAll() { for(const p of this.parts){p.enabled=true;p.inspectionVisible=true;}this.applyVisibility();this.updateGuides(); }
    highlight(id,hoverId=null) {
      for(const p of this.parts){
        p.mat.emissive.setHex(p.id===id?0x8b6329:p.id===hoverId?0x3d685e:0);
        p.mat.emissiveIntensity=p.id===id?.27:.15;
      }
    }
    buildGuides() {
      const mat=new T.LineDashedMaterial({color:0x9c8c6f,dashSize:.22,gapSize:.16,transparent:true,opacity:.62,depthTest:true,depthWrite:false});
      this.materials.add(mat);
      for(const name of ['axis','lowerShell']) {
        const line=new T.Line(this.keep(new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()])),mat);
        line.userData.guide=name;line.renderOrder=8;this.guideGroup.add(line);
      }
    }
    updateGuides() {
      for(const line of this.guideGroup.children){
        const name=line.userData.guide;
        if(name==='axis'){
          const bottom=this.g.sheetY-2.4+this.assemblyMotion.channel.offset[1]*this.groupProgress('channel');
          const top=this.g.domeTop+.8+this.assemblyMotion.head.offset[1]*this.groupProgress('head');
          line.geometry.setFromPoints([v3([0,bottom,0]),v3([0,top,0])]);
          line.visible=this.explosion>.03;
        }else{
          const splitY=this.g.tubeBase+(this.g.lowerTop-this.g.tubeBase)*.42;
          const y=(splitY+this.g.lowerTop)/2;
          const shellOffset=v3(this.assemblyMotion.shell.offset).multiplyScalar(this.groupProgress('shell'));
          const a=v3([0,y,0]),b=a.clone().add(shellOffset);
          line.geometry.setFromPoints([a,b]);
          line.visible=this.explosion>.03&&this.getPart(name).root.visible;
        }
        line.computeLineDistances();
      }
    }
    buildFlow() {
      const g=this.g,lr=g.lowerR;
      const primaryPaths=[],hot=this.ports.find(port=>port.id==='hotLeg');
      for(const targetZ of [-.7,0,.7]){
        const tube=this.sampleLayout.reduce((best,t)=>
          Math.hypot(t.r-1.2,t.z-targetZ)<Math.hypot(best.r-1.2,best.z-targetZ)?t:best,this.sampleLayout[0]);
        const {r,z}=tube,pump=this.pumpLayout[z<0?0:1],outlet=this.ports.find(port=>port.id===pump.port);
        const curve=new T.CurvePath();
        const line=(from,to)=>curve.add(new T.LineCurve3(from,to));
        const hotInner=v3(hot.origin).addScaledVector(v3(hot.direction),-.65*g.nozzleScale);
        line(v3(hot.origin).addScaledVector(v3(hot.direction),hot.length),hotInner);
        line(hotInner,v3([-r,g.sheetY,z]));
        line(v3([-r,g.sheetY,z]),v3([-r,g.straightTop,z]));
        const bend=new T.Curve();
        bend.getPoint=(t,out=new T.Vector3())=>{
          const angle=Math.PI*(1-t);
          return out.set(Math.cos(angle)*r,g.straightTop+Math.sin(angle)*r,z);
        };
        curve.add(bend);
        line(v3([r,g.straightTop,z]),v3([r,g.sheetY,z]));
        const coldInner=v3(outlet.origin).addScaledVector(v3(outlet.direction),-.5*g.nozzleScale);
        line(v3([r,g.sheetY,z]),coldInner);
        line(coldInner,v3(pump.inlet));
        line(v3(pump.inlet),v3(pump.center));
        const discharge=v3(pump.discharge);
        line(v3(pump.center),discharge);
        line(discharge,discharge.clone().addScaledVector(v3(pump.dischargeDirection),pump.dischargeLength));
        primaryPaths.push({curve,tube});
      }
      const secondaryPaths=[];
      for(const sign of [-1,1])secondaryPaths.push([
        [g.upperR+1.3,this.feedY,.1],
        [sign*(lr+.1),g.lowerTop+.4,0],
        [sign*(lr-.035),g.tubeBase+1,0],
        [sign*(lr-.5),g.tubeBase+.65,.6],
        [sign*.7,g.straightTop-.4,.8],
        [sign*.9,g.separatorBase+.15,.6],
        [sign*.9,g.separatorTop,.6],
        [sign*.8,g.dryerTop+.35,.45],
        [0,g.height+.15,0]
      ]);
      this.flowPaths=[];
      const specs=[...primaryPaths.map(path=>({...path,color:0xd07851,kind:'primary'})),...secondaryPaths.map(points=>({points,color:0x4e9eae,kind:'secondary'}))];
      for(const spec of specs) {
        const curve=spec.curve||new T.CatmullRomCurve3(spec.points.map(v3),false,'centripetal');
        const geometry=this.keep(new T.BufferGeometry().setFromPoints(curve.getPoints(180)));
        const mat=new T.LineBasicMaterial({color:spec.color,transparent:true,opacity:.72,depthTest:false});
        this.materials.add(mat);const line=new T.Line(geometry,mat);line.renderOrder=40;this.flowGroup.add(line);
        const particleMaterial=new T.MeshBasicMaterial({color:spec.color,depthTest:false});
        this.materials.add(particleMaterial);
        const count=14,mesh=new T.InstancedMesh(this.keep(new T.SphereGeometry(spec.kind==='primary'?.018:.075,6,5)),particleMaterial,count);
        mesh.renderOrder=42;mesh.frustumCulled=false;this.flowGroup.add(mesh);
        const arrows=[];
        for(const at of [.13,.4,.68,.87]){
          const pt=curve.getPoint(at),dir=curve.getTangent(at).normalize();
          const cone=new T.Mesh(this.keep(new T.ConeGeometry(spec.kind==='primary'?.055:.12,spec.kind==='primary'?.16:.36,6)),particleMaterial);
          cone.position.copy(pt);cone.quaternion.setFromUnitVectors(UP,dir);cone.renderOrder=41;this.flowGroup.add(cone);arrows.push(cone);
        }
        this.flowPaths.push({curve,mesh,count,kind:spec.kind,tube:spec.tube||null});
      }
    }
    animateFlow(time) {
      if(!this.flowGroup.visible)return;
      const dummy=new T.Object3D();
      for(const path of this.flowPaths) {
        for(let i=0;i<path.count;i++){
          const t=(i/path.count+time*(path.kind==='primary'?.00007:.000045))%1;
          dummy.position.copy(path.curve.getPointAt(t));dummy.updateMatrix();path.mesh.setMatrixAt(i,dummy.matrix);
        }
        path.mesh.instanceMatrix.needsUpdate=true;
      }
    }
    bounds(ids=null) {
      const bounds=new T.Box3();this.root.updateMatrixWorld(true);
      const instanceMatrix=new T.Matrix4(),worldMatrix=new T.Matrix4(),box=new T.Box3();
      for(const p of this.parts)if(p.root.visible&&(!ids||ids.includes(p.id)))p.root.traverseVisible(object=>{
        const geometry=object.geometry;
        if(!geometry)return;
        if(!geometry.boundingBox)geometry.computeBoundingBox();
        if(!geometry.boundingBox)return;
        if(object.isInstancedMesh){
          for(let i=0;i<object.count;i++){
            object.getMatrixAt(i,instanceMatrix);
            worldMatrix.multiplyMatrices(object.matrixWorld,instanceMatrix);
            bounds.union(box.copy(geometry.boundingBox).applyMatrix4(worldMatrix));
          }
        }else bounds.union(box.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld));
      });
      return bounds;
    }
    getPart(id) { return this.parts.find(p=>p.id===id); }
    dispose() {
      this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose?.();});
      for(const g of this.geometries)g.dispose();
      for(const m of this.materials)m.dispose();
      this.geometries.clear();this.materials.clear();
      this.root.clear();this.pickables.length=0;
    }
    diagnostics() {
      let triangles=0,instances=0;
      this.root.traverse(o=>{
        if(o.geometry){const n=(o.geometry.index?.count||o.geometry.getAttribute('position')?.count||0)/3;triangles+=n*(o.isInstancedMesh?o.count:1);}
        if(o.isInstancedMesh)instances+=o.count;
      });
      return {model:this.profile.id,parts:this.parts.length,sampleTubes:this.sampleLayout.length,actualTubes:this.profile.public.tubes,displaySeparators:this.separatorLayout.length,triangles:Math.round(triangles),instances,cutaway:this.cutaway,explosion:this.explosion};
    }
  }
  window.SG_Model = SteamGenerator;
})();
