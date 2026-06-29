const { readDataFile } = require("../../shared/backend/data-store");
const { URL } = require("url");

const analysisFiles = {
  "/api/analysis/summary": "analysis-summary.json",
  "/api/analysis/province": "analysis-province.json",
  "/api/analysis/elevation": "analysis-elevation.json",
  "/api/analysis/buffer": "analysis-buffer.json",
  "/api/analysis/stage": "analysis-stage.json",
  "/api/analysis/node-types": "analysis-node-types.json",
  "/api/analysis/routes": "analysis-routes.json",
  "/api/analysis/difficulty": "analysis-difficulty.json",
  "/api/analysis/route-compare": "analysis-route-compare.json",
};

const bufferLayerInterfaces = {
  "/api/analysis/buffer/layers/core-5km": {
    id: "core-5km",
    name: "5km 核心步行研学圈",
    status: "reserved",
    source: "ArcGIS Pro 待生成",
    display: "用于识别路线两侧可步行到达的纪念点、会址与渡口遗址。",
  },
  "/api/analysis/buffer/layers/traffic-10km": {
    id: "traffic-10km",
    name: "10km 短驳可达圈",
    status: "reserved",
    source: "ArcGIS Pro 待生成",
    display: "用于组织大巴短驳、县域研学和资源串联展示。",
  },
  "/api/analysis/buffer/layers/region-20km": {
    id: "region-20km",
    name: "20km 县域联动圈",
    status: "reserved",
    source: "ArcGIS Pro 待生成",
    display: "用于分析路线周边红色资源集群和旅游服务支撑。",
  },
};

function buildInsight(request) {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  );
  const tool = url.searchParams.get("tool") || "route";
  const route = url.searchParams.get("route") || "central";
  const routeNames = {
    central: "中央红军路线",
    second: "红二方面军路线",
    fourth: "红四方面军路线",
    route_zhongyang_zongdui: "中央纵队路线图",
    route_hongyi_juntuan: "红一军团路线图",
    route_hongsan_juntuan: "红三军团路线图",
    route_hongwu_juntuan: "红五军团路线图",
    route_hongjiu_juntuan: "红九军团路线图",
    route_honger_fangmianjun: "红二方面军路线图",
    route_hongsi_fangmianjun: "红四方面军路线图",
    route_hongershiwu_jun: "红二十五军路线图",
  };
  const common = {
    routeName: routeNames[route] || "当前路线",
    route,
    tool,
  };

  const content = {
    route: {
      title: "路线选择与行军组织分析",
      why: "选择该路线，是因为它串联了长征转折、渡江突破、雪山草地和会师等关键空间节点，能够完整体现战略转移的时空逻辑。",
      difficulty: "难点在于路线跨越省域多、地形差异大、节点密集且历史事件类型复杂，需要同时表达路线、事件和资源三类空间对象。",
      spirit: "重点学习坚定理想信念、顾全大局、严密组织和依靠群众的长征精神。",
      image: "/assets/img/red-army-march.jpg",
    },
    compare: {
      title: "多路线空间对比分析",
      why: "多路线对比用于识别不同红军路线在里程、节点密度、资源密度和地形阻力上的差异。",
      difficulty: "难点在于各路线长度和数据密度不同，需要使用密度、占比和综合指标进行横向比较。",
      spirit: "重点学习统筹全局、协同推进和因地制宜的战略组织能力。",
      image: "/assets/img/red-army-march.jpg",
    },
    difficulty: {
      title: "地形难度指数分析",
      why: "地形难度指数把 DEM 高程、坡度、高差和特殊地形节点转化为可视化分段等级。",
      difficulty: "难点是将连续路线切分为可解释路段，并让每一段同时具备分数、等级和历史语义。",
      spirit: "重点学习不畏艰险、百折不挠、依靠科学判断突破困难的精神。",
      image: "/assets/img/xueshan.jpg",
    },
    terrain: {
      title: "地形起伏与行军阻力分析",
      why: "地形分析用于解释为什么雪山、草地、河谷和高原段成为长征行军的关键难点。",
      difficulty: "高程变化剧烈会带来体能消耗、补给困难和行军速度下降，空间表达上需要进行多路线结构对比。",
      spirit: "重点学习不畏艰险、百折不挠、敢于胜利的精神。",
      image: "/assets/img/xueshan.jpg",
    },
    buffer: {
      title: "多尺度缓冲分析方法说明",
      why: "缓冲分析先不直接给结论，而是先确定 5km、10km、20km 三个圈层分别代表步行、短驳和县域联动范围。",
      difficulty: "难点是缓冲区会跨越多个行政区和复杂地形，后续应在 ArcGIS Pro 中叠加道路、DEM、资源点后生成正式结果。",
      spirit: "重点学习实事求是、调查研究、因地制宜组织路线的精神。",
      image: "/assets/img/zunyi.jpg",
    },
    node: {
      title: "重要节点类型统计分析",
      why: "节点类型统计用于识别战斗、会议、渡江、雪山草地、会师等事件在长征路线上的空间分布特征。",
      difficulty: "难点是事件类型存在交叉，例如‘会师’不能误归入会议，渡江事件又可能同时具有战斗属性。",
      spirit: "重点学习善于总结经验、把握关键节点、在转折中开创新局面的精神。",
      image: "/assets/img/red-army-march.jpg",
    },
    resource: {
      title: "红色资源关联与热点分析",
      why: "红色资源关联用于识别路线周边纪念馆、旧址、景区和遗址的空间集聚区，为研学路线提供支撑。",
      difficulty: "热点分析需要后续在 ArcGIS Pro 中叠加核密度、行政区和交通服务能力，当前页面预留热点图层接口。",
      spirit: "重点学习传承红色基因、保护革命遗址、讲好长征故事的精神。",
      image: "/assets/img/zunyi.jpg",
    },
  };

  return {
    ...common,
    ...(content[tool] || content.route),
  };
}

function handleApi({ request, pathname, response, sendSuccess, sendError }) {
  if (pathname.startsWith("/api/analysis/insight")) {
    sendSuccess(response, buildInsight(request));
    return true;
  }

  if (bufferLayerInterfaces[pathname]) {
    sendSuccess(response, bufferLayerInterfaces[pathname]);
    return true;
  }

  const filename = analysisFiles[pathname];

  if (!filename) {
    return false;
  }

  try {
    sendSuccess(response, readDataFile(filename));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Analysis data load failed");
  }

  return true;
}

module.exports = {
  handleApi,
};

