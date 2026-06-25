const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { chatWithAgent } = require("./services/deepseekAgent");

const PUBLIC_ROOT = path.join(__dirname, "..", "public");
const DATA_ROOT = path.join(PUBLIC_ROOT, "assets", "data");
const ROUTE_LAYER_ROOT = path.join(DATA_ROOT, "route-layers");
const PORT = Number(process.env.PORT || 8096);

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const index = trimmed.indexOf("=");

    if (index < 1) {
      return;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".splat": "application/octet-stream",
  ".ksplat": "application/octet-stream",
};

const apiFiles = {
  "/api/routes": "routes.json",
  "/api/resources": "resources.json",
  "/api/red-tourism/resources": "resources.json",
  "/api/analysis/summary": "analysis-summary.json",
  "/api/analysis/province": "analysis-province.json",
  "/api/analysis/elevation": "analysis-elevation.json",
  "/api/analysis/buffer": "analysis-buffer.json",
  "/api/analysis/stage": "analysis-stage.json",
  "/api/scene3d/focus": "scene3d-focus.json",
};

function send(
  response,
  status,
  body,
  contentType = "application/json; charset=utf-8",
) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });

  if (Buffer.isBuffer(body) || typeof body === "string") {
    response.end(body);
    return;
  }

  response.end(JSON.stringify(body));
}

function sendSuccess(response, data) {
  send(response, 200, {
    code: 200,
    message: "success",
    data,
  });
}

function sendError(response, status, message) {
  send(response, status, {
    code: status,
    message,
    data: null,
  });
}

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error("请求体过大"));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("请求 JSON 格式不正确"));
      }
    });

    request.on("error", reject);
  });
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");

  return JSON.parse(text);
}

function getRouteLayerConfigs() {
  const filePath = path.join(DATA_ROOT, "route-layer-config.json");
  const configs = readJsonFile(filePath);

  return configs.sort((left, right) => {
    return Number(left.display_order || 0) - Number(right.display_order || 0);
  });
}

function getRouteLayerConfig(layerKey) {
  return getRouteLayerConfigs().find((item) => {
    return item.layer_key === layerKey;
  });
}

function getRouteFeatureCollection(layerKey) {
  const config = getRouteLayerConfig(layerKey);

  if (!config) {
    return null;
  }

  const filePath = path.join(ROUTE_LAYER_ROOT, `${config.table_name}.json`);

  if (!filePath.startsWith(ROUTE_LAYER_ROOT)) {
    return null;
  }

  return readJsonFile(filePath);
}

function sortRouteAnimation(collection) {
  const cloned = {
    ...collection,
    features: [...collection.features],
  };

  cloned.features.sort((left, right) => {
    const leftOrder = Number(left.properties?._order ?? 999999);
    const rightOrder = Number(right.properties?._order ?? 999999);

    return leftOrder - rightOrder;
  });

  return cloned;
}

function sortEventTimeline(collection) {
  const cloned = {
    ...collection,
    features: [...collection.features],
  };

  cloned.features.sort((left, right) => {
    const leftDate = String(left.properties?.["\u4e8b\u4ef6\u65e5"] || "");
    const rightDate = String(right.properties?.["\u4e8b\u4ef6\u65e5"] || "");
    const leftId = Number(left.properties?.["\u4e8b\u4ef6\u7f16"] || 0);
    const rightId = Number(right.properties?.["\u4e8b\u4ef6\u7f16"] || 0);

    if (leftDate === rightDate) {
      return leftId - rightId;
    }

    return leftDate.localeCompare(rightDate);
  });

  return cloned;
}

function serveStaticApi(response, pathname) {
  const filename = apiFiles[pathname];

  if (!filename) {
    return false;
  }

  try {
    sendSuccess(response, readJsonFile(path.join(DATA_ROOT, filename)));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "数据读取失败");
  }

  return true;
}

function serveRouteApi(response, pathname) {
  if (pathname === "/api/route-layers") {
    try {
      sendSuccess(response, getRouteLayerConfigs());
    } catch (error) {
      console.error(error);
      sendError(response, 500, "路线图层配置读取失败");
    }

    return true;
  }

  const match = pathname.match(/^\/api\/route-layers\/([^/]+)\/(features|animation)$/);

  if (!match) {
    return false;
  }

  const layerKey = decodeURIComponent(match[1]);
  const mode = match[2];
  const collection = getRouteFeatureCollection(layerKey);

  if (!collection) {
    sendError(response, 404, `路线图层不存在：${layerKey}`);
    return true;
  }

  if (mode === "animation") {
    sendSuccess(response, sortRouteAnimation(collection));
    return true;
  }

  sendSuccess(response, collection);
  return true;
}

function serveEventApi(response, pathname) {
  if (pathname !== "/api/events" && pathname !== "/api/events/timeline") {
    return false;
  }

  try {
    const collection = readJsonFile(path.join(DATA_ROOT, "events-important.json"));

    if (pathname === "/api/events/timeline") {
      sendSuccess(response, sortEventTimeline(collection));
      return true;
    }

    sendSuccess(response, collection);
  } catch (error) {
    console.error(error);
    sendError(response, 500, "事件点数据读取失败");
  }

  return true;
}

async function serveAgentApi(request, response, pathname) {
  if (pathname !== "/api/agent/chat") {
    return false;
  }

  if (request.method !== "POST") {
    sendError(response, 405, "Method Not Allowed");
    return true;
  }

  try {
    const payload = await readRequestJson(request);
    const result = await chatWithAgent(payload);
    sendSuccess(response, result);
  } catch (error) {
    console.error(error);
    sendError(response, error.statusCode || 500, error.message || "智能助手请求失败");
  }

  return true;
}

function serveStatic(response, pathname) {
  const requestedPath =
    pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(PUBLIC_ROOT, requestedPath));
  const relativePath = path.relative(PUBLIC_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, "页面或资源不存在", "text/plain; charset=utf-8");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    send(response, 200, data, contentType);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  );

  if (request.method === "OPTIONS") {
    send(response, 204, "");
    return;
  }

  if (url.pathname === "/api/health") {
    sendSuccess(response, {
      service: "红图绘长征 WebGIS",
      dataMode: "static-shp-adapter",
    });
    return;
  }

  if (await serveAgentApi(request, response, url.pathname)) {
    return;
  }

  if (serveRouteApi(response, url.pathname)) {
    return;
  }

  if (serveEventApi(response, url.pathname)) {
    return;
  }

  if (serveStaticApi(response, url.pathname)) {
    return;
  }

  serveStatic(response, url.pathname);
});

server.listen(PORT, () => {
  console.log(`红图绘长征 WebGIS：http://localhost:${PORT}`);
});
