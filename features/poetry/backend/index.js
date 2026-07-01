const {
  getRouteLayerConfigs,
  getRouteFeatureCollection,
  readDataFile,
  sortEventTimeline,
  sortRouteAnimation,
} = require("../../shared/backend/data-store");

// 诗歌图片映射（保留备用）
const cornerImages = {
  shiliuzi: "/assets/images/poetry/VCG211611345420.jpg",
  loushanguan: "/assets/images/poetry/VCG211620090490.png",
  changzheng: "/assets/images/poetry/VCG211634570806.jpg",
  kunlun: "/assets/images/poetry/VCG211643672387.jpg",
  liupanshan: "/assets/images/poetry/OIP.webp",
  pengdehuai: "/assets/images/poetry/O1CN01a4fN2C1f43yrCr9ya_!!533673952.jpg_q90.webp",
  xue: "/assets/images/poetry/VCG211444428325.jpg",
};
const defaultBackground = "/assets/images/poetry/source-bg.jpg";

// ★ 备用：硬编码诗歌数据（如果 poem.json 加载失败时使用）
const fallbackPoems = [
  {
    id: "poem_001",
    title: "七律·长征",
    author: "毛泽东",
    year: "1935年10月",
    places: ["五岭", "乌蒙山", "金沙江", "大渡河", "岷山"],
    provinces: ["江西", "湖南", "广东", "广西", "贵州", "云南", "四川", "甘肃", "陕西"],
    stage: "长征全程",
    text: "红军不怕远征难，万水千山只等闲。五岭逶迤腾细浪，乌蒙磅礴走泥丸。金沙水拍云崖暖，大渡桥横铁索寒。更喜岷山千里雪，三军过后尽开颜。",
    description: "高度概括长征全程的经典诗作"
  },
  {
    id: "poem_002",
    title: "忆秦娥·娄山关",
    author: "毛泽东",
    year: "1935年2月",
    places: ["娄山关"],
    provinces: ["贵州"],
    stage: "遵义会议后",
    text: "西风烈，长空雁叫霜晨月。霜晨月，马蹄声碎，喇叭声咽。雄关漫道真如铁，而今迈步从头越。从头越，苍山如海，残阳如血。",
    description: "娄山关大捷后所作，悲壮豪迈"
  },
  {
    id: "poem_003",
    title: "十六字令三首",
    author: "毛泽东",
    year: "1934年末至1935年初",
    places: ["湘桂黔山区"],
    provinces: ["湖南", "广西", "贵州"],
    stage: "长征初期",
    text: "其一：山，快马加鞭未下鞍。惊回首，离天三尺三。其二：山，倒海翻江卷巨澜。奔腾急，万马战犹酣。其三：山，刺破青天锷未残。天欲堕，赖以拄其间。",
    description: "写于长征初期，歌颂红军穿越山区的英勇气概"
  },
  {
    id: "poem_004",
    title: "清平乐·六盘山",
    author: "毛泽东",
    year: "1935年10月",
    places: ["六盘山"],
    provinces: ["宁夏"],
    stage: "长征末期",
    text: "天高云淡，望断南飞雁。不到长城非好汉，屈指行程二万。六盘山上高峰，红旗漫卷西风。今日长缨在手，何时缚住苍龙？",
    description: "越过六盘山后所作，标志长征即将胜利"
  },
  {
    id: "poem_005",
    title: "念奴娇·昆仑",
    author: "毛泽东",
    year: "1935年10月",
    places: ["昆仑山"],
    provinces: ["青海", "西藏", "新疆"],
    stage: "长征末期",
    text: "横空出世，莽昆仑，阅尽人间春色。飞起玉龙三百万，搅得周天寒彻。夏日消溶，江河横溢，人或为鱼鳖。千秋功罪，谁人曾与评说？而今我谓昆仑：不要这高，不要这多雪。安得倚天抽宝剑，把汝裁为三截？一截遗欧，一截赠美，一截还东国。太平世界，环球同此凉热。",
    description: "即将到达陕北时，远望昆仑山脉生发感慨"
  },
  {
    id: "poem_006",
    title: "六言诗·给彭德怀同志",
    author: "毛泽东",
    year: "1935年10月",
    places: ["吴起镇"],
    provinces: ["陕西"],
    stage: "长征终点",
    text: "山高路远坑深，大军纵横驰奔。谁敢横刀立马？唯我彭大将军！",
    description: "到达吴起镇后赠彭德怀"
  },
  {
    id: "poem_007",
    title: "沁园春·雪",
    author: "毛泽东",
    year: "1936年2月",
    places: ["陕北", "黄河", "长城"],
    provinces: ["陕西"],
    stage: "长征后",
    text: "北国风光，千里冰封，万里雪飘。望长城内外，惟余莽莽；大河上下，顿失滔滔。山舞银蛇，原驰蜡象，欲与天公试比高。须晴日，看红装素裹，分外妖娆。江山如此多娇，引无数英雄竞折腰。惜秦皇汉武，略输文采；唐宗宋祖，稍逊风骚。一代天骄，成吉思汗，只识弯弓射大雕。俱往矣，数风流人物，还看今朝。",
    description: "东征途中作于陕北"
  },
  {
    id: "poem_008",
    title: "清平乐·会昌",
    author: "毛泽东",
    year: "1934年夏",
    places: ["会昌"],
    provinces: ["江西"],
    stage: "长征前",
    text: "东方欲晓，莫道君行早。踏遍青山人未老，风景这边独好。会昌城外高峰，颠连直接东溟。战士指看南粤，更加郁郁葱葱。",
    description: "1934年夏，毛泽东在会昌养病期间所作"
  },
  {
    id: "poem_009",
    title: "西江月·井冈山",
    author: "毛泽东",
    year: "1928年秋",
    places: ["井冈山", "黄洋界"],
    provinces: ["江西"],
    stage: "井冈山时期",
    text: "山下旌旗在望，山头鼓角相闻。敌军围困万千重，我自岿然不动。早已森严壁垒，更加众志成城。黄洋界上炮声隆，报道敌军宵遁。",
    description: "黄洋界保卫战胜利后所作"
  },
  {
    id: "poem_010",
    title: "突破镇石封锁线（二首）",
    author: "萧克",
    year: "1934年10月",
    places: ["镇石封锁线"],
    provinces: ["贵州"],
    stage: "长征初期",
    text: "其一：后追前堵路岖崎，又见恶鸢来去飞。转战三无不毛地，兵饥弹少更艰危。其二：封锁重重似壁坚，兵阵狭道九回旋。通宵苦战出深谷，百战老兵为一叹！",
    description: "萧克将军突破镇石封锁线时所作"
  }
];

// ★ 加载诗歌数据的函数
function getPoemsData() {
  try {
    const data = readDataFile("poem.json");
    if (data && data.poems && data.poems.length) {
      return data.poems;
    }
  } catch (error) {
    console.warn('加载 poem.json 失败，使用备用数据:', error);
  }
  return fallbackPoems;
}

// ============ 路由处理函数 ============

function handleRouteApi(pathname, sendSuccess, sendError, response) {
  if (pathname === "/api/route-layers") {
    try {
      sendSuccess(response, getRouteLayerConfigs());
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Route layer config load failed");
    }
    return true;
  }

  const match = pathname.match(/^\/api\/route-layers\/([^/]+)\/(features|animation)$/);
  if (!match) return false;

  const layerKey = decodeURIComponent(match[1]);
  const mode = match[2];
  const collection = getRouteFeatureCollection(layerKey);

  if (!collection) {
    sendError(response, 404, `Route layer not found: ${layerKey}`);
    return true;
  }

  if (mode === "animation") {
    sendSuccess(response, sortRouteAnimation(collection));
    return true;
  }

  sendSuccess(response, collection);
  return true;
}

function handleEventApi(pathname, sendSuccess, sendError, response) {
  if (pathname !== "/api/events" && pathname !== "/api/events/timeline") {
    return false;
  }

  try {
    const collection = readDataFile("events-important.json");
    if (pathname === "/api/events/timeline") {
      sendSuccess(response, sortEventTimeline(collection));
      return true;
    }
    sendSuccess(response, collection);
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Event data load failed");
  }
  return true;
}

function handleResourceApi(pathname, sendSuccess, sendError, response) {
  const resourceEndpoints = new Set([
    "/api/routes",
    "/api/resources",
    "/api/red-tourism/resources",
  ]);

  if (!resourceEndpoints.has(pathname)) return false;

  const files = {
    "/api/routes": "routes.json",
    "/api/resources": "resources.json",
    "/api/red-tourism/resources": "resources.json",
  };

  try {
    sendSuccess(response, readDataFile(files[pathname]));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Resource data load failed");
  }
  return true;
}

// ★★★★★ 核心：诗歌API处理 ★★★★★
function handlePoetryApi(pathname, sendSuccess, sendError, response) {
  // 1. 获取诗歌点位数据
  if (pathname === "/api/poetry-points") {
    try {
      const data = readDataFile("poetry-points.json");
      sendSuccess(response, data);
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Poetry points load failed");
    }
    return true;
  }

  // 2. 获取所有诗歌内容（home-poetry.js 使用）
  if (pathname === "/api/poetry-content") {
    try {
      const poems = getPoemsData();
      sendSuccess(response, { poems });
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Poetry content load failed");
    }
    return true;
  }

  // 3. ★★★ 关键：通过ID获取单首诗歌 ★★★
  const match = pathname.match(/^\/api\/poetry\/([^/]+)$/);
  if (match) {
    try {
      const poemId = match[1];
      console.log('🔍 查找诗歌ID:', poemId);
      
      const poems = getPoemsData();
      const poem = poems.find(p => p.id === poemId);
      
      if (poem) {
        console.log('✅ 找到诗歌:', poem.title);
        sendSuccess(response, poem);
      } else {
        console.log('❌ 未找到诗歌:', poemId);
        sendError(response, 404, `Poem not found: ${poemId}`);
      }
    } catch (error) {
      console.error('❌ 加载诗歌失败:', error);
      sendError(response, 500, "Poetry load failed");
    }
    return true;
  }

  // 4. 兼容旧的 /api/poetry/long-march 接口
  if (pathname === "/api/poetry/long-march") {
    try {
      const poems = getPoemsData();
      // 生成 wallLines
      const wallLines = poems.map((p, index) => ({
        id: `line-${index + 1}`,
        poemId: p.id,
        text: p.text.split('\n')[0]?.replace(/^[其一、二、三、四、五、六、七、八、九、十]+[：:]/g, '').trim() || p.title,
      }));
      sendSuccess(response, { poems, wallLines });
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Poetry data load failed");
    }
    return true;
  }

  return false;
}

// ============ 主路由入口 ============
function handleApi({ pathname, response, sendSuccess, sendError }) {
  // ★ 优先处理诗歌API
  if (handlePoetryApi(pathname, sendSuccess, sendError, response)) {
    return true;
  }

  return (
    handleRouteApi(pathname, sendSuccess, sendError, response) ||
    handleEventApi(pathname, sendSuccess, sendError, response) ||
    handleResourceApi(pathname, sendSuccess, sendError, response)
  );
}

module.exports = {
  handleApi,
};