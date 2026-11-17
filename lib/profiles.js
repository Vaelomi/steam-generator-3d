/* Public data is deliberately kept separate from illustrative geometry. */
(function () {
  'use strict';
  const sources = {
    snptc: { title: 'Introduction of CAP1400', author: 'Xujia Wang / SNERDI / SNPTC', year: 2015, pages: '12–13', url: 'https://www.aben.com.br/Arquivos/406/406.pdf' },
    ap1000: { title: 'AP1000 Pre-Construction Safety Report', author: 'Westinghouse', year: 2017, document: 'UKP-GW-GL-793NP Rev. 1', table: '20C-1', url: 'https://westinghousenuclear.com/media/qzol2ioy/ukp-gw-gl-793np-sm_compressed.pdf' },
    structure: { title: 'CAP1400 的总体设计和技术创新', author: '郑明光等 / 上海核工程研究设计院', year: 2016, url: 'https://www.engineering.org.cn/engi/CN/1159828145555694488' },
    dryer: { title: 'CAP1000、CAP1400 核电蒸汽发生器用干燥器波形板组件', document: 'CN205079214U', url: 'https://patents.google.com/patent/CN205079214U/zh' },
    projectList: { title: '海阳6号SG专项跟踪表', author: '用户提供的截图', basis: '部件名称和制造分组；未给出结构尺寸、方位或完整图纸' },
    hy5Daily: { title: 'HY5 MB01蒸汽发生器日报', section: '设备周报', basis: '部件名称及制造工序；具体几何和型号适用性待核' },
    hy6Plan: { title: 'HY6 MB01蒸汽发生器设备制造进度计划', section: 'CAP1000 海阳6号机组蒸汽发生器制造计划', basis: '从计划任务文本提取部件名称及工序；不包含完整图纸或尺寸' }
  };
  const profiles = {
    CAP1400: {
      id: 'CAP1400', subtitle: '国和一号', type: 'Vertical U-tube', basis: 'SNPTC 2015 公开设计值',
      verified: true, source: 'snptc',
      public: { tubes: 12606, heatArea: 14666, tubeOD: 17.48, height: 24, heightLabel: '公开总高', upperID: 6.120, lowerID: 4.655, weight: 807 },
      geometry: {
        height: 24, upperR: 3.060, lowerR: 2.3275, shellWall: .145,
        sheetY: 2.80, sheetT: .85, tubeBase: 3.65, straightTop: 11.68,
        lowerTop: 14.05, transitionTop: 15.58, upperTop: 21.72, domeTop: 23.36,
        separatorBase: 16.0, separatorTop: 20.52, dryerBottom: 20.98, dryerTop: 21.68,
        sampleStep: .235, sampleTubeR: .035, supportLevels: [4.25, 5.25, 6.25, 7.25, 8.25, 9.25, 10.25, 11.25],
        separatorRows: 5, nozzleScale: 1, cutStart: 1.55, cutLength: Math.PI * 1.37
      },
      note: 'CAP1400 主参数采用 SNPTC 2015 设计介绍。管束抽样、分段高度、孔位、壁厚、支撑和接口方位为示意，须按项目图纸核准。'
    },
    CAP1000: {
      id: 'CAP1000', subtitle: 'AP1000 体系参考', type: 'Vertical U-tube · Reference', basis: 'AP1000 体系参考，CAP1000 实机待核',
      verified: false, source: 'ap1000',
      public: { tubes: 10025, heatArea: 11477, tubeOD: 17.48, height: 22.45, heightLabel: '参考壳体总长', upperID: 5.330, lowerID: 4.190, weight: null },
      geometry: {
        height: 22.45, upperR: 2.665, lowerR: 2.095, shellWall: .135,
        sheetY: 2.60, sheetT: .7914, tubeBase: 3.3914, straightTop: 10.91,
        lowerTop: 12.95, transitionTop: 14.35, upperTop: 20.39, domeTop: 21.86,
        separatorBase: 14.83, separatorTop: 19.26, dryerBottom: 19.70, dryerTop: 20.35,
        sampleStep: .235, sampleTubeR: .035, supportLevels: [4.02, 4.92, 5.82, 6.72, 7.62, 8.52, 9.42, 10.32],
        separatorRows: 4, nozzleScale: .9, cutStart: 1.55, cutLength: Math.PI * 1.37
      },
      note: '本 CAP1000 配置使用西屋 AP1000 表 20C-1 作为体系参考，并非 CAP1000 实机确认参数；结构细部及全部安装尺寸待该项目图纸核准。'
    }
  };
  const parts = [
    { id:'steamOutlet', cn:'主蒸汽出口接管', en:'Main steam outlet', category:'承压边界', color:'nozzle', count:'1 个 · 形态示意', material:'承压锻钢 · 牌号待核', description:'汇集上部经分离和干燥后的蒸汽，经顶部接管送往主蒸汽系统。', basis:'出口位于上封头；孔径、连接形式和端部尺寸为比例示意。', label:true },
    { id:'upperHead', cn:'椭圆上封头', en:'Ellipsoidal upper head', category:'承压边界', color:'shell', count:'1 件', material:'低合金钢 · 牌号待核', description:'封闭二次侧上部蒸汽空间，与上筒体焊接并承载主蒸汽出口接管。', basis:'CAP1400 总体结构参照 SNPTC 2015 第 12–13 页；封头壁厚和局部剖面为示意。' },
    { id:'restrictorHole', cn:'上封头限流器孔', en:'Upper-head flow-restrictor openings', category:'承压边界', color:'plate', count:'7 孔 · AP1000 参考示意', material:'上封头出口相关加工孔 · 细节待核', description:'主蒸汽出口处的限流器孔口，与文丘里限流管同组显示。', basis:'海阳6号计划列有上封头限流器孔；孔数参考 AP1000 公开资料，CAP1400 实际孔数、形状及尺寸须按项目图纸确认。' },
    { id:'venturiTubes', cn:'蒸汽出口文丘里限流管', en:'Steam-outlet flow-limiting venturi', category:'承压边界', color:'separator', count:'7 根 · AP1000 参考示意', material:'限流构件 · 牌号待核', description:'在主蒸汽出口通道内示意限流文丘里管，与上封头和出口接管一起移动。', basis:'HY5 日报、HY6 计划列有文丘里管；7 个出口限流文丘里参照 AP1000 公开安全报告。CAP1400 配置及各管形状、尺寸须以项目图纸确认。' },
    { id:'upperShell', cn:'上部扩径筒体', en:'Upper cylindrical shell', category:'承压边界', color:'shell', count:'1 组', material:'低合金钢 · 牌号待核', description:'容纳汽水分离与干燥装置，较大的直径为汽水分离和蒸汽空间提供包络。', basis:'上筒体内径来自当前型号公开基线；壁厚、分段及实际焊缝位置待核。', label:true },
    { id:'upperSupportRing', cn:'外接盘与下部支撑环', en:'External flange and lower support ring', category:'承压边界', color:'support', count:'1 组 · 位置示意', material:'焊接支承件 · 牌号待核', description:'上筒体组件的外接盘与下部支撑环，随上部组件一起移动。', basis:'HY5 日报列有外部法兰和下支撑环，HY6 计划列有外接盘与下部支撑环；具体连接形式、标高和尺寸待图纸确认。' },
    { id:'transition', cn:'下筒体锥体', en:'Conical transition shell', category:'承压边界', color:'shell', count:'1 组', material:'低合金钢 · 牌号待核', description:'连接下部换热段和上部扩径筒体。展示时与下筒体 C 段作为一组侧移。', basis:'用户提供的跟踪表列有“下筒体C+锥体”；锥角、厚度和焊接分界为示意。' },
    { id:'lowerShell', cn:'下筒体 C 段', en:'Lower shell section C', category:'承压边界', color:'shell', count:'1 组 · 分段示意', material:'低合金钢 · 牌号待核', description:'下筒体上部的 C 段，与锥体共同形成下筒体 C 段及锥体组件；侧移后可观察管束与套筒。', basis:'分组名称参考用户提供的海阳6号 SG 跟踪表；A/B/C 实际分界和筒节长度须以图纸核实。', label:true },
    { id:'lowerShellAB', cn:'下筒体 AB 段', en:'Lower shell sections A and B', category:'承压边界', color:'shell', count:'1 组 · 分段示意', material:'低合金钢 · 牌号待核', description:'下部筒节与管板相接，展示时与管板、管束和水室封头保持同轴。', basis:'用户提供的跟踪表列有“下筒体AB+管板”；本图将 AB 合并为一段显示，实际分段高度与焊缝位置未知。', label:true },
    { id:'tubesheet', cn:'厚壁管板', en:'Forged tubesheet', category:'承压边界', color:'plate', count:'1 件', material:'低合金钢 + 表面堆焊层 · 牌号待核', description:'固定 U 形传热管的两端，分隔管内一次侧与管外二次侧。抽样孔阵列与本模型管腿位置对应。', basis:'AP1000 参考厚度 791.4 mm 仅用于 CAP1000 体系配置；CAP1400 厚度 850 mm 为示意。', label:true },
    { id:'channelHead', cn:'一次侧下封头 / 水室', en:'Primary-side channel head', category:'承压边界', color:'shell', count:'1 件', material:'低合金钢 + 内表面堆焊层 · 牌号待核', description:'位于管板下方，内部隔板将热端进口腔和冷端出口腔分开，一次侧冷却剂在此进入或离开管束。', basis:'下封头和接口构型采用 CAP 系列公开总体结构；精确曲率、开孔和堆焊层待核。', label:true },
    { id:'tubeBundle', cn:'U 形传热管束', en:'U-tube heat-transfer bundle', category:'换热组件', color:'tube', count:'按型号公开基线', material:'镍基合金传热管 · 具体牌号按项目确认', description:'高温一次侧冷却剂在 U 形管内流动，把热量传给管外二次侧水。两端均固定于管板，U 形弯段位于换热段顶部。', basis:'管数与管外径采用公开基线；抽样阵列和放大管径仅便于三维识别，金色为功能配色。', label:true },
    { id:'tubeSupports', cn:'管束支撑板', en:'Tube support plates', category:'换热组件', color:'support', count:'8 层 · 抽样示意', material:'不锈钢 / 合金钢 · 牌号待核', description:'沿传热管直段设置支撑与约束，兼顾二次侧轴向流通。模型的孔位与抽样管束对应。', basis:'8 层仅为显示抽样，不宣称实机层数；真实孔型、材料及管板间距待核。' },
    { id:'tubeRetainers', cn:'管束保持环与保持条', en:'Tube-bundle retaining rings and bars', category:'换热组件', color:'support', count:'1 组 · 形态示意', material:'保持件 · 牌号待核', description:'管束装配中的保持环和保持条，随管束、管板及支撑板保持同组。', basis:'HY5 日报和 HY6 计划均列有保持环、保持条的装焊；图中环数、条数及布置仅为识别示意。' },
    { id:'antiVibration', cn:'U 弯区防振组件', en:'Anti-vibration bar assembly', category:'换热组件', color:'support', count:'1 组 · 形态示意', material:'耐蚀合金 / 不锈钢 · 牌号待核', description:'在 U 形弯管区提供侧向约束，减轻流动诱发振动。以弯管上方的径向条带示意。', basis:'防振条插入位置、接触关系和数量须由制造图核实；当前不表达实际约束间隙。' },
    { id:'wrapper', cn:'管束套筒 / 导流筒', en:'Tube bundle wrapper', category:'换热组件', color:'wrapper', count:'1 组', material:'钢板组件 · 牌号待核', description:'包围换热管束，将内部上升流道与外侧下降通道分隔；下部入口留有二次侧回流空间。', basis:'总体结构为自然循环 U 形管蒸汽发生器常见构型；套筒厚度、支撑和开孔为示意。' },
    { id:'sleevePins', cn:'套筒支撑销钉', en:'Wrapper support pins', category:'换热组件', color:'support', count:'4 个 · 形态示意', material:'焊接支撑件 · 牌号待核', description:'下筒体内部支承套筒的销钉，随下筒体 C 段展示。', basis:'HY6 计划列有套筒支撑销钉及支撑套管；数量、分布、具体接触和连接形式均待图纸核准。' },
    { id:'separatorDeck', cn:'分离器支承板', en:'Separator support deck', category:'汽水分离', color:'support', count:'1 组', material:'钢板组件 · 牌号待核', description:'支承初级汽水分离器，组织管束上方汽水混合物进入分离器的入口。', basis:'板形、孔阵列、相对标高与连接细节为比例示意。' },
    { id:'separators', cn:'初级汽水分离器', en:'Primary steam-water separators', category:'汽水分离', color:'separator', count:'简化阵列 · 数量待核', material:'不锈钢 / 合金钢 · 牌号待核', description:'对管束上升的汽水混合物进行初级分离，分离出的水回流，蒸汽进入上部干燥装置。', basis:'按公开剖面作立式筒状阵列；旋流结构、真实型号与台数未由零件图核准。', label:true },
    { id:'dryer', cn:'蒸汽干燥器', en:'Steam dryer assembly', category:'汽水分离', color:'separator', count:'1 组 · 波形板示意', material:'不锈钢波形板组件 · 牌号待核', description:'通过波形板通道进一步去除蒸汽夹带的水滴，干燥后的蒸汽进入封头蒸汽空间。', basis:'参照公开专利 CN205079214U 的波形板功能；箱体排布、板距、数量与标高均为示意。', label:true },
    { id:'feedRing', cn:'给水分配环管', en:'Feedwater distribution ring', category:'二次侧接口', color:'feed', count:'1 组 · 配管示意', material:'耐蚀钢管组件 · 牌号待核', description:'把进入蒸汽发生器的给水分配到二次侧循环区域，配合外环下降通道向管束区补水。', basis:'环管结构与喷口方向为原理表达，未核对具体型号的制造配管图。' },
    { id:'feedElbow', cn:'给水肘管连接件', en:'Feedwater elbow connection', category:'二次侧接口', color:'feed', count:'1 组 · 配管示意', material:'给水配管组件 · 牌号待核', description:'连接主给水接口与给水环，随上筒体和给水环一起移动。', basis:'HY6 计划列有给水肘管与上部组件及给水环的焊接；本图弯管走向、口径和连接细节为示意。' },
    { id:'feedNozzle', cn:'主给水接管', en:'Main feedwater nozzle', category:'二次侧接口', color:'nozzle', count:'1 个 · 形态示意', material:'承压锻钢 / 钢管 · 牌号待核', description:'二次侧主给水进入蒸汽发生器的接口，与内部分配构件连接。', basis:'主给水位置参照公开总体剖面；孔径、标高、方位及热套结构为示意。' },
    { id:'auxNozzle', cn:'启动给水接口', en:'Startup feedwater connection', category:'二次侧接口', color:'nozzle', count:'1 个 · 接口示意', material:'承压钢管 · 牌号待核', description:'表达启动或辅助给水的功能接口，其具体系统归属和设计形式应按本型号 P&ID 确认。', basis:'接口方位、数量和尺寸尚未由项目图纸核准。' },
    { id:'levelNozzles', cn:'窄量程水位计接管', en:'Narrow-range level instrument connections', category:'二次侧接口', color:'nozzle', count:'2 个 · 显示示意', material:'承压接管 · 牌号待核', description:'上筒体的窄量程水位测量接口，在上筒体组件展开时与壳体一起移动。', basis:'用户提供的 SG 跟踪表列有窄量程水位计接管；模型用两个接管示意，实际数量、位置和尺寸未由该表给出。' },
    { id:'blowdown', cn:'排污 / 疏水接管', en:'Blowdown and drain connections', category:'二次侧接口', color:'nozzle', count:'2 个 · 接口示意', material:'承压钢管 · 牌号待核', description:'表达管板上方二次侧排污及设备低位疏水接口，便于识别流体边界。', basis:'孔径、数量、配管方向和系统归属均须按项目图纸确认。' },
    { id:'divider', cn:'水室分隔板', en:'Channel-head divider plate', category:'一次侧接口', color:'divider', count:'1 件', material:'堆焊复合钢板 / 不锈钢 · 牌号待核', description:'在管板下方把一次侧热端进口腔和冷端出口腔分开，迫使冷却剂完成 U 形管内的换热路径。', basis:'模型隔板与 U 形管两列管腿方向对应；具体密封、连接及补强结构待核。' },
    { id:'dividerRibs', cn:'水室隔板短筋及补板', en:'Channel-head divider ribs and patches', category:'一次侧接口', color:'divider', count:'1 组 · 形态示意', material:'焊接板件 · 牌号待核', description:'水室分隔板附近的短筋及局部补板，与水室封头和分隔板保持同组。', basis:'HY6 计划列有水室隔板短筋；HY5 日报列有短水室隔板与缺口补板。图中不表达实际板件数量、焊缝或尺寸。' },
    { id:'primaryInlet', cn:'热管段进口接管', en:'Primary hot-leg inlet nozzle', category:'一次侧接口', color:'hotNozzle', count:'1 个', material:'承压锻钢 + 内表面堆焊 · 牌号待核', description:'连接来自反应堆压力容器的热管段，使高温一次侧冷却剂进入下封头热端腔室。', basis:'每 SG 一个热管段进口按 CAP 系列回路结构；实际接口直径与接管轴线待核。' },
    { id:'pumpOutlets', cn:'主泵连接出口接管', en:'Reactor coolant pump outlet connections', category:'一次侧接口', color:'nozzle', count:'2 个', material:'承压锻钢 + 内表面堆焊 · 牌号待核', description:'管内换热后的冷却剂汇入冷端水室，经两个出口进入对应的两台主泵。此处只显示 SG 接口。', basis:'一个环路两台主泵的连接关系有公开设计依据；接管曲率、尺寸和方位为示意。' },
    { id:'pumpCasings', cn:'主泵连接泵壳', en:'Reactor coolant pump casings', category:'一次侧接口', color:'nozzle', count:'2 只 · 壳体及接口示意', material:'承压泵壳 · 牌号待核', description:'与两个冷却剂出口管嘴相接的空心蜗壳式泵壳，示意竖直进水、侧向排水、分体法兰、加强筋及底部检修盖，不包含主泵转子、电机及完整冷段管路。', basis:'HY5 日报列有 2 只泵壳，HY6 计划列有泵壳与出口管嘴的装焊；腔体、接管、法兰、加强筋及其尺寸和轴线仍为示意，不代表实机泵壳制造轮廓。' },
    { id:'residualHeatNozzle', cn:'余排管嘴（A 型参考）', en:'Residual-heat-removal nozzle', category:'一次侧接口', color:'nozzle', count:'1 个 · 海阳6号 A 型参考', material:'承压管嘴 / 隔离层 · 细节待核', description:'参照海阳6号 A 型水室计划示意的余排接口，与水室封头及其他一次侧管嘴保持同组。', basis:'海阳6号 A 型跟踪表及计划列有余排管嘴；不能据此认定所有设备均有该接口，直径、方位和连接形式待图纸确认。' },
    { id:'mimsMounts', cn:'MIMS 传感器安装块', en:'MIMS sensor mounting block', category:'支承与附件', color:'support', count:'1 组 · 位置示意', material:'传感器安装件 · 牌号待核', description:'水室封头组件上的 MIMS 传感器安装块，随水室封头一起移动。', basis:'HY5 日报中 A、B 两组水室工序均列有 MIMS 传感器安装块；本图仅示意安装附件，具体位置、数量和连接细节待图纸确认。' },
    { id:'manways', cn:'二次侧及水室人孔', en:'Secondary-side and channel-head manways', category:'支承与附件', color:'plate', count:'4 个 · 位置示意', material:'低合金钢 / 紧固件 · 牌号待核', description:'二次侧人孔座与水室人孔用于检修、检查；相应孔盖分别随上筒体或水室组件移动。', basis:'用户提供的跟踪表列有二次侧人孔座及水室人孔密封面；孔位、数量和密封结构待核。' },
    { id:'handholes', cn:'管板区手孔盖', en:'Tubesheet-region handhole covers', category:'支承与附件', color:'plate', count:'2 个 · 位置示意', material:'承压钢 / 紧固件 · 牌号待核', description:'示意管板上方二次侧的清理和检查入口。', basis:'接管和盖板分离仅为结构表达，真实孔位、数量与密封形式待核。' },
    { id:'damperPads', cn:'阻尼器支撑垫', en:'Damper support pads', category:'支承与附件', color:'support', count:'2 组 · 显示示意', material:'支承垫及焊接附件 · 牌号待核', description:'上筒体外壁的阻尼器支撑接口；本图仅表示垫板及局部加强，未包含阻尼器本体。', basis:'用户提供的 SG 跟踪表列有阻尼器支撑垫；形状、数量、标高和方位均为示意。' },
    { id:'supports', cn:'下筒体支撑组件', en:'Lower-shell support assemblies', category:'支承与附件', color:'support', count:'4 组 · 显示示意', material:'结构钢 / 承压附件 · 牌号待核', description:'下筒体外侧的支承接口，与下筒体 AB 段及管板保持同组。', basis:'用户提供的跟踪表列有下筒体支撑组件；当前形态与四组数量仅作示意，不代表实机受力构造。' }
  ];
  parts.forEach((p,i) => { p.number = String(i + 1).padStart(2, '0'); });
  window.SG_DATA = { profiles, sources, parts, version:'1.3.0', reviewed:'2026-11-18' };
})();
