const {
  getRouteLayerConfigs,
  getRouteFeatureCollection,
  readDataFile,
  sortEventTimeline,
  sortRouteAnimation,
} = require("../../shared/backend/data-store");

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

// ★ 诗歌API处理
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

  // 2. 获取所有诗歌内容
  if (pathname === "/api/poetry-content") {
    try {
      const data = readDataFile("poem.json");
      sendSuccess(response, data);
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Poetry content load failed");
    }
    return true;
  }

  // ★★★ 关键：通过ID获取单首诗歌 ★★★
  const match = pathname.match(/^\/api\/poetry\/([^/]+)$/);
  if (match) {
    try {
      const poemId = match[1];
      console.log('🔍 查找诗歌ID:', poemId);
      
      const data = readDataFile("poem.json");
      const poems = data.poems || [];
      const poem = poems.find(p => p.id === poemId);
      
      if (poem) {
        console.log('✅ 找到诗歌:', poem.title);
        sendSuccess(response, poem);
      } else {
        console.log('❌ 未找到诗歌:', poemId);
        console.log('📋 可用的诗歌ID:', poems.map(p => p.id).join(', '));
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
      const data = readDataFile("poem.json");
      const poems = data.poems || [];
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