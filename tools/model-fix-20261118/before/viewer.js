(function () {
  'use strict';
  const $ = id=>document.getElementById(id);
  const T = window.THREE;
  const state = {
    modelId:'CAP1400', explosion:0, cutaway:false, selected:null, hovered:null,
    inspection:null, beforeInspection:null, cad:false, wireframe:false, labels:true,
    flow:false, rotate:false, playing:false, mode:'assembly', tab:'details'
  };
  const INSPECTIONS = {
    bundle:{ title:'U 形管束与支撑', part:'tubeBundle', ids:['tubeBundle','tubeSupports','tubeRetainers','antiVibration','tubesheet'], dir:[.8,.27,1.6] },
    assemblyBundle:{ title:'管束—管板—水室封头组件', part:'tubeBundle', ids:['lowerShellAB','tubesheet','tubeBundle','tubeSupports','tubeRetainers','antiVibration','wrapper','channelHead','divider','dividerRibs','primaryInlet','pumpOutlets','pumpCasings','residualHeatNozzle','mimsMounts','handholes','supports'], dir:[.85,.20,1.6] },
    lower:{ title:'下筒体 C 段与锥体', part:'lowerShell', ids:['lowerShell','transition','sleevePins'], dir:[.95,.20,1.6] },
    separation:{ title:'上筒体与汽水分离组件', part:'separators', ids:['upperShell','upperSupportRing','separatorDeck','separators','feedRing','feedElbow','feedNozzle','auxNozzle','levelNozzles','damperPads'], dir:[.9,.38,1.5] },
    dryer:{ title:'蒸汽干燥器', part:'dryer', ids:['dryer'], dir:[.8,.65,1.5] },
    head:{ title:'上封头与主蒸汽出口', part:'upperHead', ids:['upperHead','steamOutlet','restrictorHole','venturiTubes'], dir:[.8,.48,1.5] },
    primary:{ title:'一次侧水室与主泵接口', part:'channelHead', ids:['tubesheet','channelHead','divider','dividerRibs','primaryInlet','pumpOutlets','pumpCasings','residualHeatNozzle','mimsMounts'], dir:[1.3,-.28,1.4] },
    interfaces:{ title:'一次侧与二次侧接口', part:'primaryInlet', ids:['steamOutlet','upperHead','restrictorHole','venturiTubes','upperShell','upperSupportRing','transition','lowerShell','lowerShellAB','tubesheet','channelHead','divider','dividerRibs','feedRing','feedElbow','feedNozzle','auxNozzle','levelNozzles','damperPads','primaryInlet','pumpOutlets','pumpCasings','residualHeatNozzle','mimsMounts','blowdown','handholes'], dir:[1.15,.2,1.7] }
  };
  const LABEL_SIDES = {steamOutlet:'right',upperShell:'right',lowerShell:'left',lowerShellAB:'left',tubesheet:'right',channelHead:'left',tubeBundle:'right',separators:'right',dryer:'left'};
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const systemAppearance=window.matchMedia('(prefers-color-scheme: dark)');
  let scene,camera,renderer,controls,model,grid,baseRings,shadow,environment;
  let frameId=0,dirtyFrames=3,explosionTween=null,cameraTween=null,playStart=0,previousTime=0;
  let labels=[],pointerDown=null,toastTimeout=0,globalToastTimeout=0,resizeObserver=null;
  let profile=SG_DATA.profiles.CAP1400;
  const viewport=$('viewport');
  const raycaster=T?new T.Raycaster():null;
  const pointer=T?new T.Vector2():null;
  const number = n=>Number(n).toLocaleString('en-US');
  const requestRender = (frames=3)=>{
    dirtyFrames=Math.max(dirtyFrames,frames);
    if(!frameId)frameId=requestAnimationFrame(tick);
  };
  function toast(text,global=false) {
    const box=$(global?'globalToast':'sceneToast');box.textContent=text;box.hidden=false;
    if(global){clearTimeout(globalToastTimeout);globalToastTimeout=setTimeout(()=>box.hidden=true,4300);}
    else{clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>box.hidden=true,3800);}
  }
  function environmentMap() {
    const room=new T.Scene();room.background=new T.Color(0x505d63);
    const panels=[
      {size:[12,16,1],pos:[-9,4,0],color:0xffffff},
      {size:[8,20,1],pos:[10,3,-7],color:0xe4e9e7},
      {size:[20,2,14],pos:[0,10,0],color:0xffffff},
      {size:[10,12,1],pos:[-3,3,10],color:0xc9d5d6},
      {size:[9,16,1],pos:[4,1,-12],color:0x677277}
    ];
    for(const d of panels){const m=new T.Mesh(new T.BoxGeometry(...d.size),new T.MeshBasicMaterial({color:d.color}));m.position.set(...d.pos);if(d.pos[0])m.lookAt(0,0,0);room.add(m);}
    const generator=new T.PMREMGenerator(renderer);
    const result=generator.fromScene(room,.04,.1,100);
    room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});generator.dispose();
    return result;
  }
  function init() {
    if(!T||!T.OrbitControls||!window.SG_Model)throw new Error('本地三维依赖缺失，请保持 lib 文件夹与网页在同一目录。');
    if(T.ColorManagement)T.ColorManagement.legacyMode=false;
    scene=new T.Scene();camera=new T.PerspectiveCamera(35,1,.08,300);
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputEncoding=T.sRGBEncoding;
    renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','CAP 系列蒸汽发生器交互式三维模型，拖动旋转，滚轮缩放');
    viewport.prepend(renderer.domElement);
    controls=new T.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=2.5;controls.maxDistance=140;controls.maxPolarAngle=Math.PI*.92;controls.autoRotateSpeed=.65;
    controls.addEventListener('change',()=>requestRender(3));
    controls.addEventListener('start',()=>{cameraTween=null;requestRender(24);$('tooltip').hidden=true;});
    controls.addEventListener('end',()=>requestRender(30));
    const hemi=new T.HemisphereLight(0xf2f6f5,0x454f48,.70);scene.add(hemi);
    const key=new T.DirectionalLight(0xfff7e8,1.5);key.position.set(-14,28,18);scene.add(key);
    const rim=new T.DirectionalLight(0xe1f0f5,1.1);rim.position.set(15,16,-12);scene.add(rim);
    const front=new T.DirectionalLight(0xffffff,.36);front.position.set(2,6,18);scene.add(front);
    environment=environmentMap();scene.environment=environment.texture;
    grid=new T.GridHelper(64,32);
    grid.material.dispose();
    grid.material=new T.ShaderMaterial({
      uniforms:{uColor:{value:new T.Color(0xaaa797)},uOpacity:{value:.16}},
      vertexShader:'varying vec3 vGrid;void main(){vGrid=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'uniform vec3 uColor;uniform float uOpacity;varying vec3 vGrid;void main(){float fade=1.0-smoothstep(4.0,30.0,length(vGrid.xz));gl_FragColor=vec4(uColor,uOpacity*fade);}',
      transparent:true,depthWrite:false
    });
    grid.position.y=-3.85;scene.add(grid);
    baseRings=new T.Group();scene.add(baseRings);
    for(const r of [3.5,6]){
      const pts=[];for(let i=0;i<=160;i++){const a=i/160*Math.PI*2;pts.push(new T.Vector3(Math.sin(a)*r,-3.82,Math.cos(a)*r));}
      const line=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineDashedMaterial({color:0xa69a83,dashSize:.15,gapSize:.15,transparent:true,opacity:.24,depthWrite:false}));
      line.computeLineDistances();baseRings.add(line);
    }
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    const gradient=ctx.createRadialGradient(64,64,3,64,64,64);gradient.addColorStop(0,'rgba(52,54,41,.24)');gradient.addColorStop(.4,'rgba(52,54,41,.10)');gradient.addColorStop(1,'rgba(52,54,41,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    shadow=new T.Mesh(new T.PlaneGeometry(14,14),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),transparent:true,depthWrite:false,opacity:.65}));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=-3.80;scene.add(shadow);
    model=new SG_Model(profile,{cutaway:state.cutaway});scene.add(model.root);
    model.guideGroup.visible=$('guides').checked;model.setExplosion(state.explosion);model.updateGuides();
    makeLabels();renderCatalog();renderCompare();updateProfileUI();renderInfo();bindEvents();
    setTheme(document.documentElement.dataset.appearance||'auto',false);
    resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);
    resize();fitView(null,false);$('loading').hidden=true;
    window.CAP_SG={
      get model(){return model;},get profile(){return profile;},get state(){return {...state};},
      get camera(){return camera;},get renderer(){return renderer;},get controls(){return controls;},
      selectPart, switchModel, setMode, setExplosion, inspect, exitInspection, fitView,
      showAll, setCutaway, requestRender,
      diagnostics:()=>({...model.diagnostics(),visibleParts:model.parts.filter(p=>p.root.visible).length,renderCalls:renderer.info.render.calls,geometryCount:renderer.info.memory.geometries,textureCount:renderer.info.memory.textures}),
      get animating(){return !!(explosionTween||cameraTween||state.playing);},
      ready:true
    };
    document.dispatchEvent(new CustomEvent('sg-ready'));requestRender(15);
  }
  function resize() {
    const w=viewport.clientWidth,h=viewport.clientHeight;
    if(!w||!h)return;
    const oldAspect=camera.aspect;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
    $('leaders').setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(Math.abs(oldAspect-camera.aspect)>.03)fitView(null,false);
    requestRender(4);
  }
  function fitParameters(ids=null, direction=null) {
    const box=model.bounds(ids);
    if(box.isEmpty())return null;
    const center=box.getCenter(new T.Vector3());
    const dir=direction?new T.Vector3(...direction).normalize():camera.position.clone().sub(controls.target).normalize();
    if(dir.length()<.1)dir.set(.85,.30,1.5).normalize();
    const up=new T.Vector3(0,1,0);
    if(Math.abs(dir.dot(up))>.99)up.set(0,0,-1);
    const right=new T.Vector3().crossVectors(up,dir).normalize(),vertical=new T.Vector3().crossVectors(dir,right).normalize();
    let halfW=0,halfH=0,depth=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const d=new T.Vector3(x,y,z).sub(center);
      halfW=Math.max(halfW,Math.abs(d.dot(right)));halfH=Math.max(halfH,Math.abs(d.dot(vertical)));depth=Math.max(depth,Math.abs(d.dot(dir)));
    }
    const tan=Math.tan(T.MathUtils.degToRad(camera.fov)/2),aspect=camera.aspect;
    const hPadding=state.inspection?1.35:model.explosion>.035?1.35:1.13,wPadding=aspect<.8?1.22:1.14;
    const distance=Math.max(halfH/tan*hPadding,halfW/(tan*aspect)*wPadding)+depth*.75;
    return {target:center,position:center.clone().add(dir.multiplyScalar(Math.max(3.4,distance)))};
  }
  function applyCamera(destination,animate=true) {
    if(!destination)return;
    if(animate&&!reducedMotion){
      cameraTween={from:camera.position.clone(),fromTarget:controls.target.clone(),to:destination.position,toTarget:destination.target,start:performance.now(),duration:650};
    }else{cameraTween=null;camera.position.copy(destination.position);controls.target.copy(destination.target);controls.update();}
    requestRender(30);
  }
  function fitView(ids=null,animate=true,direction=null) {
    applyCamera(fitParameters(ids,direction||(!state.inspection?[.92,.30,1.62]:null)),animate);
  }
  function fitForExplosion(t,animate=true) {
    const old=state.explosion;model.setExplosion(t);
    const dest=fitParameters(null,[.92,.30,1.62]);model.setExplosion(old);applyCamera(dest,animate);
  }
  function updateModeUI() {
    const mode=state.inspection?'局部检视':state.explosion>.005?'结构分解':state.cutaway?'剖视总装':'总装视图';
    $('sceneMode').textContent=mode;
    $('headerMode').textContent=mode;
    const active=state.explosion>.005?'exploded':state.cutaway?'section':'assembly';
    state.mode=active;
    document.querySelectorAll('[data-mode]').forEach(b=>{
      const on=b.dataset.mode===active;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));
    });
    $('explodeValue').innerHTML=`${Math.round(state.explosion*100)}<span>%</span>`;
    $('explodeRange').value=String(Math.round(state.explosion*100));
    $('explodeRange').style.setProperty('--progress',`${state.explosion*100}%`);
    $('cutaway').checked=state.cutaway;$('cutBadge').hidden=!state.cutaway;
    $('assemblyOrder').hidden=!!state.inspection||state.explosion<.035;
    $('sceneNote').textContent=state.inspection?'结构局部 · 原位装配关系':state.explosion>.01?'管束水室同组 · 下筒体 C 段侧移':'立式 · U 形管 · 自然循环';
  }
  function setExplosion(value,{animate=false,fit=true,duration=1500}={}) {
    const t=Math.max(0,Math.min(1,Number(value)));
    if(!Number.isFinite(t))return;
    if(state.flow&&t>.01)disableFlow();
    if(fit)fitForExplosion(t,animate);
    if(animate&&!reducedMotion){
      explosionTween={from:state.explosion,to:t,start:performance.now(),duration};
    }else{explosionTween=null;state.explosion=t;model.setExplosion(t);updateModeUI();}
    requestRender(10);
  }
  function setCutaway(on,render=true) {
    state.cutaway=!!on;model.setCutaway(state.cutaway);updateModeUI();if(render)requestRender(4);
  }
  function setMode(mode) {
    stopPlayback();if(state.inspection)exitInspection({restore:false,fit:false});
    disableFlow();state.mode=mode;
    if(mode==='assembly'){setCutaway(false);setExplosion(0,{animate:true});}
    else if(mode==='section'){setCutaway(true);setExplosion(0,{animate:true});}
    else{setCutaway(true);setExplosion(1,{animate:true});}
  }
  function stopPlayback() {
    if(!state.playing)return;
    state.playing=false;updatePlayButton();requestRender();
  }
  function updatePlayButton() {
    const button=$('playExplosion');button.setAttribute('aria-pressed',String(state.playing));
    button.querySelector('use').setAttribute('href',state.playing?'#i-pause':'#i-play');
    button.querySelector('span').textContent=state.playing?'暂停分解动画':'播放分解动画';
  }
  function togglePlayback() {
    if(state.playing){stopPlayback();return;}
    if(state.inspection)exitInspection({restore:false,fit:false});
    disableFlow();setCutaway(true);explosionTween=null;fitForExplosion(1,true);
    state.playing=true;playStart=performance.now();updatePlayButton();requestRender();
  }
  function disableFlow() {
    state.flow=false;$('flow').checked=false;$('flowLegend').hidden=true;if(model)model.flowGroup.visible=false;
  }
  function toggleFlow(on) {
    if(!on){disableFlow();requestRender();return;}
    stopPlayback();if(state.inspection)exitInspection({restore:false,fit:false});
    setCutaway(true);setExplosion(0,{animate:true,duration:900});state.flow=true;
    model.flowGroup.visible=true;$('flow').checked=true;$('flowLegend').hidden=false;
    toast('已回到总装剖视，展示一次侧管内与二次侧管外流路。');requestRender();
  }
  function updateProfileUI() {
    $('modelSelect').value=state.modelId;
    $('sceneModel').textContent=state.modelId;
    $('partCount').textContent=String(model.parts.length);
    $('footerStatus').textContent=`${model.parts.length} 个结构组件 · ${model.sampleLayout.length} 根抽样 U 形管`;
    document.querySelectorAll('[data-model]').forEach(b=>b.classList.toggle('active',b.dataset.model===state.modelId));
    renderer.domElement.setAttribute('aria-label',`${state.modelId} 蒸汽发生器交互式三维模型，拖动旋转，滚轮缩放`);
    document.title=`${state.modelId} 蒸汽发生器 · 三维结构图谱`;
    updateModeUI();
  }
  function renderInfo() {
    const p=state.selected?model.getPart(state.selected):null;
    $('infoKicker').textContent=p?`${state.modelId} / ${p.category}`:`${state.modelId} / ${profile.subtitle}`;
    $('partTitle').textContent=p?p.cn:'蒸汽发生器';
    $('partEnglish').textContent=p?p.en:`Steam Generator · ${profile.type}`;
    $('partCode').textContent=p?`SG / ${p.number}`:'SG / OVERVIEW';
    const evidenced=!p&&profile.verified;
    $('evidenceBadge').textContent=evidenced?'公开设计资料':p?'结构参考 · 细部示意':'AP1000 体系参考';
    $('evidenceBadge').classList.toggle('reference',!evidenced);
    $('partDescription').textContent=p?p.description:'在一次侧与二次侧之间传递热量。管内冷却剂经 U 形传热管完成换热，管外二次侧产生的蒸汽依次经过分离、干燥，再从顶部主蒸汽接口送出。';
    $('overviewMetrics').hidden=!!p;$('structureDiagram').hidden=!!p;$('selectionActions').hidden=!p;
    if(!p){
      const d=profile.public;
      const metrics=[
        [profile.verified?'传热管数量':'参考传热管数量',number(d.tubes),'根',profile.verified?'公开设计值 · 抽样显示':'AP1000 公开参考，CAP1000 待核'],
        ['传热面积',number(d.heatArea),'m²',profile.verified?'SNPTC 公开设计值':'AP1000 体系参考'],
        ['传热管外径',d.tubeOD.toFixed(2),'mm','实际外径 · 视图管径放大'],
        [d.heightLabel,d.height.toFixed(2),'m',profile.verified?'总高口径按公开表列':'壳体总长口径，非实机总高']
      ];
      $('overviewMetrics').replaceChildren(...metrics.map(([label,val,unit,note])=>{
        const card=document.createElement('div');card.className='metric-card';
        const l=document.createElement('span');l.textContent=label;
        const v=document.createElement('strong');v.append(document.createTextNode(val));
        const u=document.createElement('small');u.textContent=unit;v.append(u);
        const n=document.createElement('small');n.textContent=note;card.append(l,v,n);return card;
      }));
    }
    const d=profile.public;
    let props=p?[
      ['所属分区',p.category],['数量 / 表达',p.count],['材料参考',p.material]
    ]:[
      ['设备型式','立式 U 形管 · 自然循环'],
      ['上 / 下内径',`${d.upperID.toFixed(3)} / ${d.lowerID.toFixed(3)} m${profile.verified?'':' · AP1000 参考'}`],
      ['一次侧接口','1 个热管段进口 / 2 个主泵出口'],
      ['三维表达',`${model.sampleLayout.length} 根抽样 U 形管 / ${model.parts.length} 个结构组`]
    ];
    if(p?.id==='tubeBundle')props=[
      ['公开基线',`${number(d.tubes)} 根${profile.verified?'':' · AP1000 体系参考'}`],
      ['管外径',`${d.tubeOD} mm · 视图放大至 ${(profile.geometry.sampleTubeR*2000).toFixed(0)} mm`],
      ['抽样显示',`${model.sampleLayout.length} 根 U 形管 / ${model.sampleLayout.length*2} 个对应管板孔`],
      ['材料参考',p.material]
    ];
    if(p?.id==='separators')props.push(['抽样阵列',`${model.separatorLayout.length} 个 / 数量仅为示意`]);
    if(p?.id==='upperShell')props.push(['公开内径',`${d.upperID.toFixed(3)} m${profile.verified?'':' · AP1000 参考'}`]);
    if(p?.id==='lowerShell')props.push(['公开内径',`${d.lowerID.toFixed(3)} m${profile.verified?'':' · AP1000 参考'}`]);
    const fragment=document.createDocumentFragment();
    props.forEach(([name,val])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=val;fragment.append(dt,dd);});
    $('partProperties').replaceChildren(fragment);
    $('basisTitle').textContent=p?'结构与依据边界':'模型与数据口径';
    $('basisNote').textContent=p?`${p.basis}${!profile.verified?' 当前为 CAP1000 体系参考配置。':''}`:profile.note;
    $('hidePart').textContent=p&&!p.enabled?'显示':'隐藏';
  }
  function renderCatalog() {
    const q=$('partSearch').value.trim().toLowerCase(),fragment=document.createDocumentFragment();
    let category='',count=0;
    for(const p of model.parts){
      if(q&&![p.cn,p.en,p.category,p.number].some(s=>s.toLowerCase().includes(q)))continue;
      if(category!==p.category){category=p.category;const h=document.createElement('h3');h.className='catalog-category';h.textContent=category;fragment.append(h);}
      const row=document.createElement('div');row.className=`part-row${p.id===state.selected?' selected':''}${p.enabled?'':' is-hidden'}`;row.dataset.partId=p.id;
      const select=document.createElement('button');select.type='button';select.dataset.select=p.id;
      const code=document.createElement('span');code.textContent=p.number;select.append(code,document.createTextNode(p.cn));
      const eye=document.createElement('button');eye.type='button';eye.dataset.visibility=p.id;eye.title=p.enabled?'隐藏部件':'显示部件';eye.setAttribute('aria-label',`${p.enabled?'隐藏':'显示'}${p.cn}`);
      eye.innerHTML='<svg><use href="#i-eye"/></svg>';eye.setAttribute('aria-pressed',String(p.enabled));
      row.append(select,eye);fragment.append(row);count++;
    }
    $('partList').replaceChildren(fragment);$('emptySearch').hidden=count!==0;
    $('catalogSummary').textContent=`${count} / ${model.parts.length} 个结构组件`;
  }
  function renderCompare() {
    const a=SG_DATA.profiles.CAP1000.public,b=SG_DATA.profiles.CAP1400.public;
    const rows=[
      ['传热管 / 根',number(a.tubes),number(b.tubes)],
      ['传热面积 / m²',number(a.heatArea),number(b.heatArea)],
      ['管外径 / mm',a.tubeOD.toFixed(2),b.tubeOD.toFixed(2)],
      ['表列长度¹ / m',a.height.toFixed(2),b.height.toFixed(2)],
      ['上筒体内径 / m',a.upperID.toFixed(3),b.upperID.toFixed(3)],
      ['下筒体内径 / m',a.lowerID.toFixed(3),b.lowerID.toFixed(3)],
      ['一次侧进口 / 出口','1 / 2','1 / 2']
    ];
    const fragment=document.createDocumentFragment();
    for(const row of rows){const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}fragment.append(tr);}
    $('compareTable').replaceChildren(fragment);
    const pct=(b.heatArea/a.heatArea-1)*100;
    document.querySelector('.comparison-callout>span').innerHTML=`+${pct.toFixed(1)}<small>%</small>`;
    document.querySelector('.comparison-note').textContent='¹ AP1000 表列为壳体总长，CAP1400 表列为总高，两者口径不同。此表比较公开设计基线，不代表 CAP1000 建成机组竣工参数；结构细部仍为比例示意。';
  }
  function setTab(tab) {
    state.tab=tab;
    document.querySelectorAll('[data-tab]').forEach(b=>{
      const on=b.dataset.tab===tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;
      $(`panel-${b.dataset.tab}`).hidden=!on;
    });
  }
  function selectPart(id,{focus=false,keepTab=false}={}) {
    const p=id?model.getPart(id):null;
    if(p&&!p.inspectionVisible)exitInspection({restore:false,fit:false});
    if(p&&!p.enabled)model.setVisible(p.id,true);
    state.selected=p?p.id:null;
    model.highlight(state.selected,state.hovered);renderInfo();renderCatalog();
    if(!keepTab)setTab('details');
    document.querySelectorAll('.part-label').forEach(el=>el.classList.toggle('active',el.dataset.part===state.selected));
    if(focus&&p){model.setVisible(p.id,true);fitView([p.id],true);}
    requestRender(5);
  }
  function inspect(key) {
    const config=INSPECTIONS[key];if(!config)return;
    if(!state.beforeInspection)state.beforeInspection={explosion:state.explosion,cutaway:state.cutaway,mode:state.mode};
    stopPlayback();disableFlow();explosionTween=null;
    state.inspection=key;state.explosion=0;model.setExplosion(0);setCutaway(true,false);
    model.setInspection(config.ids);
    for(const id of config.ids)model.setVisible(id,true);
    $('inspectionBanner').hidden=false;$('inspectionTitle').textContent=config.title;
    document.querySelectorAll('[data-inspect]').forEach(b=>{const active=b.dataset.inspect===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    selectPart(config.part);fitView(config.ids,true,config.dir);updateModeUI();requestRender(30);
  }
  function isolateSelected() {
    if(!state.selected)return;
    if(!state.beforeInspection)state.beforeInspection={explosion:state.explosion,cutaway:state.cutaway,mode:state.mode};
    stopPlayback();disableFlow();explosionTween=null;
    state.inspection='isolate';state.explosion=0;model.setExplosion(0);
    model.setInspection([state.selected]);model.setVisible(state.selected,true);
    $('inspectionBanner').hidden=false;$('inspectionTitle').textContent=model.getPart(state.selected).cn;
    document.querySelectorAll('[data-inspect]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
    fitView([state.selected],true,[.9,.35,1.6]);updateModeUI();renderCatalog();
  }
  function exitInspection({restore=true,fit=true}={}) {
    if(!state.inspection)return;
    model.setInspection(null);state.inspection=null;$('inspectionBanner').hidden=true;
    document.querySelectorAll('[data-inspect]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
    if(restore&&state.beforeInspection){
      state.explosion=state.beforeInspection.explosion;state.mode=state.beforeInspection.mode;
      setCutaway(state.beforeInspection.cutaway,false);model.setExplosion(state.explosion);
    }
    state.beforeInspection=null;updateModeUI();renderCatalog();if(fit)fitView(null,true);requestRender(5);
  }
  function showAll() {
    if(state.inspection)exitInspection({restore:true,fit:false});
    model.showAll();renderCatalog();renderInfo();fitView();requestRender();
  }
  async function switchModel(id) {
    if(!SG_DATA.profiles[id]||id===state.modelId)return;
    stopPlayback();disableFlow();explosionTween=null;
    if(state.inspection)exitInspection({restore:true,fit:false});
    $('loading').hidden=false;$('modelSelect').disabled=true;
    await new Promise(resolve=>setTimeout(resolve,24));
    try{
      const nextProfile=SG_DATA.profiles[id];
      const nextModel=new SG_Model(nextProfile,{cutaway:state.cutaway,cad:state.cad});
      nextModel.setExplosion(state.explosion);nextModel.setWireframe(state.wireframe);
      nextModel.guideGroup.visible=$('guides').checked;nextModel.updateGuides();
      scene.remove(model.root);model.dispose();model=nextModel;profile=nextProfile;
      state.modelId=id;state.selected=null;state.hovered=null;scene.add(model.root);
      makeLabels();updateProfileUI();renderCatalog();renderInfo();setTab('details');fitView(null,false);
      try{localStorage.setItem('sg-last-model',id);}catch(_){}
      if(!profile.verified)toast('CAP1000：采用 AP1000 体系参考配置，实机参数待项目图纸确认。');
    }catch(error){console.error(error);toast(`型号创建失败：${error.message}`,true);}
    finally{$('loading').hidden=true;$('modelSelect').disabled=false;$('modelSelect').value=state.modelId;requestRender(12);}
  }
  function makeLabels() {
    const fragment=document.createDocumentFragment();
    labels=[];
    for(const p of model.parts)if(p.label){
      const button=document.createElement('button');button.className='part-label';button.dataset.part=p.id;button.type='button';
      const n=document.createElement('span');n.textContent=p.number;button.append(n,document.createTextNode(p.cn));
      button.setAttribute('aria-label',`选择${p.cn}`);fragment.append(button);
      labels.push({part:p,element:button,side:LABEL_SIDES[p.id]||'right',screen:new T.Vector3(),visible:false,x:0,y:0});
    }
    $('labelLayer').replaceChildren(fragment);$('leaders').replaceChildren();
  }
  function layoutLabels() {
    const w=viewport.clientWidth,h=viewport.clientHeight,top=state.inspection?160:$('assemblyOrder').hidden?110:150,bottom=h-80;
    const allowedCompact=['tubeBundle','lowerShell','lowerShellAB','channelHead','separators','dryer'];
    const left=[],right=[];
    for(const l of labels){
      const p=l.part;
      let visible=state.labels&&p.root.visible;
      if(w<480&&!allowedCompact.includes(p.id))visible=false;
      if(!state.cutaway&&state.explosion<.12&&['tubeBundle','separators','dryer'].includes(p.id))visible=false;
      l.screen.copy(p.anchor).applyMatrix4(p.root.matrixWorld).project(camera);
      if(l.screen.z>1||l.screen.z<-1)visible=false;
      l.visible=visible;l.element.hidden=!visible;
      if(!visible)continue;
      l.anchorX=(l.screen.x*.5+.5)*w;l.anchorY=(-l.screen.y*.5+.5)*h;
      if(l.anchorX<-10||l.anchorX>w+10||l.anchorY<-10||l.anchorY>h+10){l.visible=false;l.element.hidden=true;continue;}
      (l.side==='left'?left:right).push(l);
    }
    const paths=[];
    for(const list of [left,right]){
      list.sort((a,b)=>a.anchorY-b.anchorY);
      let last=top-33;
      for(const l of list){l.y=Math.max(top,Math.min(bottom,l.anchorY-12),last+34);last=l.y;}
      let shift=list.length?Math.max(0,list[list.length-1].y-bottom):0;
      for(let i=list.length-1;i>=0;i--){const l=list[i];l.y-=shift;
        const width=l.element.offsetWidth||120;
        l.x=l.side==='left'?16:w-width-16;
        l.element.style.transform=`translate(${Math.round(l.x)}px,${Math.round(l.y)}px)`;
        const endX=l.side==='left'?l.x+width:l.x,endY=l.y+13;
        const elbow=l.side==='left'?Math.min(endX+17,l.anchorX-9):Math.max(endX-17,l.anchorX+9);
        const lineColor=l.part.id===state.selected?'var(--accent)':'var(--quiet)';
        paths.push(`<path d="M${l.anchorX.toFixed(1)},${l.anchorY.toFixed(1)} L${elbow.toFixed(1)},${endY.toFixed(1)} L${endX.toFixed(1)},${endY.toFixed(1)}" style="stroke:${lineColor}"/><circle cx="${l.anchorX.toFixed(1)}" cy="${l.anchorY.toFixed(1)}" r="2"/>`);
      }
    }
    $('leaders').innerHTML=paths.join('');
  }
  function updateAxis() {
    const q=camera.quaternion.clone().invert(),axes=[['X',new T.Vector3(1,0,0),'#ad7c65'],['Y',new T.Vector3(0,1,0),'#809b75'],['Z',new T.Vector3(0,0,1),'#7392a3']];
    const bg=getComputedStyle(document.documentElement).getPropertyValue('--panel').trim();
    const projected=axes.map(([name,dir,color])=>{dir.applyQuaternion(q);return {name,x:42+dir.x*23,y:42-dir.y*23,z:dir.z,color};}).sort((a,b)=>a.z-b.z);
    $('axisWidget').innerHTML=`<circle cx="42" cy="42" r="3" fill="${bg}"/>`+projected.map(a=>`<path d="M42 42 ${a.x.toFixed(1)} ${a.y.toFixed(1)}" stroke="${a.color}" stroke-width="1.4"/><circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="3.1" fill="${a.color}"/><text x="${(a.x+(a.x<42?-10:5)).toFixed(1)}" y="${(a.y+3).toFixed(1)}" fill="${a.color}">${a.name}</text>`).join('');
  }
  function pick(event) {
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.x=(event.clientX-rect.left)/rect.width*2-1;pointer.y=-(event.clientY-rect.top)/rect.height*2+1;
    raycaster.setFromCamera(pointer,camera);
    return raycaster.intersectObjects(model.pickables,false).find(h=>{
      const p=h.object.userData.part;return p&&p.root.visible&&p.enabled;
    })?.object.userData.part||null;
  }
  function setTheme(preference,persist=true) {
    if(!['light','dark','auto'].includes(preference))preference='auto';
    const theme=preference==='auto'?(systemAppearance.matches?'dark':'light'):preference;
    document.documentElement.dataset.appearance=preference;
    document.documentElement.dataset.theme=theme;
    const dark=theme==='dark';
    const styles=getComputedStyle(document.documentElement);
    scene.background=new T.Color(styles.getPropertyValue('--scene').trim());
    grid.material.uniforms.uColor.value.set(styles.getPropertyValue('--scene-grid').trim());grid.material.uniforms.uOpacity.value=dark?.24:.2;
    baseRings.children.forEach(l=>{l.material.color.set(styles.getPropertyValue('--scene-grid').trim());l.material.opacity=dark?.24:.2;});
    shadow.material.opacity=dark?.6:.65;
    renderer.toneMappingExposure=dark?1.10:1.05;
    document.querySelectorAll('button[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===preference)));
    document.querySelector('meta[name=theme-color]').content=dark?'#13110e':'#faf8f4';
    if(persist)try{localStorage.setItem('sg-appearance',preference);}catch(_){}
    requestRender(5);
  }
  function downloadBlob(blob,filename) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function exportView() {
    renderer.render(scene,camera);
    const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;
    const ctx=canvas.getContext('2d'),w=viewport.clientWidth,h=viewport.clientHeight,scale=canvas.width/w;
    ctx.drawImage(renderer.domElement,0,0);ctx.scale(scale,scale);
    const styles=getComputedStyle(document.documentElement);
    const text=styles.getPropertyValue('--text').trim(),muted=styles.getPropertyValue('--quiet').trim(),surface=styles.getPropertyValue('--float').trim();
    ctx.fillStyle=surface;ctx.fillRect(0,0,w,78);ctx.fillStyle=styles.getPropertyValue('--accent').trim();ctx.font='9px Consolas,monospace';ctx.fillText('CAP SERIES / ENGINEERING ATLAS',22,22);
    ctx.fillStyle=text;ctx.font='500 19px "Microsoft YaHei",sans-serif';ctx.fillText(`${state.modelId} 蒸汽发生器`,22,51);
    ctx.fillStyle=muted;ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='right';ctx.fillText(`${$('sceneMode').textContent} · ${Math.round(state.explosion*100)}%`,w-22,48);ctx.textAlign='left';
    for(const l of labels.filter(l=>l.visible)){
      const ew=l.element.offsetWidth,eh=26,endX=l.side==='left'?l.x+ew:l.x,endY=l.y+13;
      ctx.strokeStyle=muted;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(l.anchorX,l.anchorY);ctx.lineTo(l.side==='left'?endX+14:endX-14,endY);ctx.lineTo(endX,endY);ctx.stroke();
      ctx.fillStyle=surface;ctx.fillRect(l.x,l.y,ew,eh);ctx.strokeStyle=styles.getPropertyValue('--strong').trim();ctx.strokeRect(l.x,l.y,ew,eh);
      ctx.fillStyle=text;ctx.font='9px "Microsoft YaHei",sans-serif';ctx.fillText(`${l.part.number}  ${l.part.cn}`,l.x+7,l.y+17);
    }
    ctx.fillStyle=surface;ctx.fillRect(0,h-42,w,42);ctx.fillStyle=muted;ctx.font='9px "Microsoft YaHei",sans-serif';
    ctx.fillText('公开设计参考 · 管束抽样显示 · 结构分解示意，非制造图',22,h-17);
    canvas.toBlob(blob=>{if(blob){downloadBlob(blob,`${state.modelId}_蒸汽发生器_${Math.round(state.explosion*100)}pct.png`);toast('当前三维视图已保存为 PNG。');}},'image/png');
  }
  function exportData() {
    const data={
      document:'CAP1000 / CAP1400 蒸汽发生器三维结构图谱',version:SG_DATA.version,reviewed:SG_DATA.reviewed,
      currentModel:state.modelId,profiles:SG_DATA.profiles,sources:SG_DATA.sources,
      illustrativeGeometry:'所有 geometry 字段均为显示几何，不作为制造尺寸。CAP1000 的 public 字段来自 AP1000 体系参考，尚未核实 CAP1000 实机参数。',
      display:model.diagnostics(),parts:SG_DATA.parts
    };
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),'CAP1000_CAP1400_蒸汽发生器_参数与资料.json');
    toast('已导出两型号参数、部件说明及资料依据。',true);
  }
  function bindEvents() {
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
    $('modelSelect').addEventListener('change',e=>switchModel(e.target.value));
    document.querySelectorAll('[data-model]').forEach(b=>b.addEventListener('click',()=>switchModel(b.dataset.model)));
    $('explodeRange').addEventListener('input',e=>{
      stopPlayback();if(state.inspection)exitInspection({restore:false,fit:false});
      setExplosion(Number(e.target.value)/100,{fit:true});
    });
    $('playExplosion').addEventListener('click',togglePlayback);
    $('cutaway').addEventListener('change',e=>{if(state.flow&&!e.target.checked)disableFlow();setCutaway(e.target.checked);});
    $('labels').addEventListener('change',e=>{state.labels=e.target.checked;requestRender();});
    $('flow').addEventListener('change',e=>toggleFlow(e.target.checked));
    $('rotate').addEventListener('change',e=>{state.rotate=e.target.checked;controls.autoRotate=state.rotate;requestRender(30);});
    $('guides').addEventListener('change',e=>{model.guideGroup.visible=e.target.checked;model.updateGuides();requestRender();});
    $('wireframe').addEventListener('change',e=>{state.wireframe=e.target.checked;model.setWireframe(state.wireframe);requestRender();});
    $('materialSelect').addEventListener('change',e=>{state.cad=e.target.value==='cad';model.setCad(state.cad);requestRender();});
    $('resetView').addEventListener('click',()=>fitView(null,true));
    $('showAll').addEventListener('click',showAll);$('catalogShowAll').addEventListener('click',showAll);
    document.querySelectorAll('[data-inspect]').forEach(b=>b.addEventListener('click',()=>inspect(b.dataset.inspect)));
    document.querySelectorAll('[data-assembly]').forEach(b=>b.addEventListener('click',()=>inspect(b.dataset.assembly==='bundle'?'assemblyBundle':b.dataset.assembly)));
    $('exitInspection').addEventListener('click',()=>exitInspection());
    $('clearSelection').addEventListener('click',()=>{if(state.inspection)exitInspection();selectPart(null);});
    document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    document.querySelector('.info-tabs').addEventListener('keydown',e=>{
      const tabs=[...document.querySelectorAll('[data-tab]')],i=tabs.indexOf(document.activeElement);
      if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      setTab(tabs[next].dataset.tab);tabs[next].focus();
    });
    $('partSearch').addEventListener('input',renderCatalog);
    $('partList').addEventListener('click',e=>{
      const select=e.target.closest('[data-select]'),eye=e.target.closest('[data-visibility]');
      if(select)selectPart(select.dataset.select,{keepTab:true});
      if(eye){const p=model.getPart(eye.dataset.visibility);model.setVisible(p.id,!p.enabled);renderCatalog();renderInfo();requestRender();}
    });
    $('labelLayer').addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(b)selectPart(b.dataset.part);});
    $('structureDiagram').addEventListener('click',e=>{const g=e.target.closest('[data-part]');if(g)selectPart(g.dataset.part,{focus:true});});
    $('structureDiagram').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const g=e.target.closest('[data-part]');if(g){e.preventDefault();selectPart(g.dataset.part,{focus:true});}}});
    $('focusPart').addEventListener('click',()=>{if(state.selected){model.setVisible(state.selected,true);fitView([state.selected]);renderCatalog();}});
    $('isolatePart').addEventListener('click',isolateSelected);
    $('hidePart').addEventListener('click',()=>{if(!state.selected)return;const p=model.getPart(state.selected);model.setVisible(p.id,!p.enabled);renderCatalog();renderInfo();requestRender();});
    document.querySelectorAll('button[data-theme]').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
    systemAppearance.addEventListener('change',()=>{if(document.documentElement.dataset.appearance==='auto')setTheme('auto',false);});
    window.addEventListener('storage',event=>{if(event.key==='sg-appearance'||event.key===null)setTheme(event.newValue||'auto',false);});
    document.querySelectorAll('.source-trigger').forEach(b=>b.addEventListener('click',()=>{if(!$('sourcesDialog').open)$('sourcesDialog').showModal();}));
    $('closeSources').addEventListener('click',()=>$('sourcesDialog').close());$('closeSourcesBottom').addEventListener('click',()=>$('sourcesDialog').close());
    $('sourcesDialog').addEventListener('click',e=>{const r=$('sourcesDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('sourcesDialog').close();});
    $('exportData').addEventListener('click',exportData);$('screenshot').addEventListener('click',exportView);
    $('fullscreen').addEventListener('click',async()=>{
      try{if(document.fullscreenElement)await document.exitFullscreen();else await viewport.requestFullscreen();}
      catch(_){toast('当前浏览器未开放全屏，可按 F11 放大查看。');}
    });
    document.addEventListener('fullscreenchange',()=>{resize();setTimeout(()=>fitView(null,false),100);});
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
      const dirs={front:[0,.06,1],side:[1,.06,0],top:[.001,1,.001]};applyCamera(fitParameters(null,dirs[b.dataset.view]),true);
    }));
    const canvas=renderer.domElement;
    canvas.addEventListener('pointerdown',e=>{pointerDown={x:e.clientX,y:e.clientY,button:e.button};});
    canvas.addEventListener('pointerup',e=>{
      if(!pointerDown||pointerDown.button!==0)return;
      const distance=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);pointerDown=null;
      if(distance<5)selectPart(pick(e)?.id||null);
    });
    canvas.addEventListener('pointermove',e=>{
      if(e.buttons||e.pointerType==='touch'){if(state.hovered){state.hovered=null;model.highlight(state.selected);requestRender();}$('tooltip').hidden=true;return;}
      const p=pick(e);
      if(state.hovered!==(p?.id||null)){state.hovered=p?.id||null;model.highlight(state.selected,state.hovered);canvas.style.cursor=p?'pointer':'grab';requestRender();}
      const tip=$('tooltip');tip.hidden=!p;
      if(p){
        tip.replaceChildren(document.createTextNode(p.cn));const small=document.createElement('small');small.textContent=`SG / ${p.number} · 点击查看结构信息`;tip.append(small);
        const r=viewport.getBoundingClientRect();tip.style.left=`${Math.min(viewport.clientWidth-205,Math.max(10,e.clientX-r.left+15))}px`;tip.style.top=`${Math.min(viewport.clientHeight-65,e.clientY-r.top+15)}px`;
      }
    });
    canvas.addEventListener('pointerleave',()=>{pointerDown=null;$('tooltip').hidden=true;if(state.hovered){state.hovered=null;model.highlight(state.selected);requestRender();}});
    document.addEventListener('keydown',e=>{
      if($('sourcesDialog').open)return;
      if(e.target.closest('input,select,textarea,[contenteditable=true]'))return;
      if(e.key.toLowerCase()==='r'){e.preventDefault();fitView(null,true);}
      else if(e.key.toLowerCase()==='p'){e.preventDefault();togglePlayback();}
      else if(e.key==='/'){e.preventDefault();setTab('catalog');$('partSearch').focus();}
      else if(e.key==='Escape'){if(state.inspection)exitInspection();else selectPart(null);}
    });
    window.addEventListener('pagehide',()=>{if(frameId)cancelAnimationFrame(frameId);});
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('三维显示连接已中断，请刷新页面恢复。',true);});
  }
  function tick(now) {
    frameId=0;
    const delta=Math.min((now-previousTime)/1000||.016,.1);previousTime=now;
    let moving=false;
    if(state.playing) {
      const phase=((now-playStart)%10000)/10000;
      let value=phase<.10?0:phase<.45?(phase-.10)/.35:phase<.60?1:1-(phase-.60)/.4;
      value=Math.max(0,Math.min(1,value));state.explosion=value*value*(3-2*value);model.setExplosion(state.explosion);updateModeUI();moving=true;
    }else if(explosionTween){
      const u=Math.min(1,(now-explosionTween.start)/explosionTween.duration),e=u*u*(3-2*u);
      state.explosion=T.MathUtils.lerp(explosionTween.from,explosionTween.to,e);model.setExplosion(state.explosion);updateModeUI();
      if(u===1)explosionTween=null;moving=true;
    }
    if(cameraTween) {
      const u=Math.min(1,(now-cameraTween.start)/cameraTween.duration),e=1-Math.pow(1-u,3);
      camera.position.lerpVectors(cameraTween.from,cameraTween.to,e);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,e);
      if(u===1)cameraTween=null;moving=true;
    }
    controls.update(delta);
    if(state.flow){model.flowGroup.visible=state.explosion<.015;model.animateFlow(now);moving=true;}
    if(state.rotate)moving=true;
    renderer.render(scene,camera);layoutLabels();updateAxis();
    dirtyFrames=Math.max(0,dirtyFrames-1);
    if((moving||dirtyFrames>0)&&!frameId)frameId=requestAnimationFrame(tick);
  }
  try{init();}
  catch(error){
    console.error(error);
    const loading=$('loading');loading.hidden=false;
    loading.replaceChildren();
    const title=document.createElement('span');title.textContent='三维场景未能初始化';
    const detail=document.createElement('small');detail.textContent=`${error.message} 请使用支持 WebGL 的现代浏览器。`;detail.style.maxWidth='80%';detail.style.lineHeight='1.9';detail.style.textAlign='center';
    loading.append(title,detail);
  }
})();
