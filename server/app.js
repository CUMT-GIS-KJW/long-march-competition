const http = require("http");
const { URL } = require("url");
const { handleApi: handleAgentApi } = require("../features/agent/backend");
const { handleApi: handleAnalysisApi } = require("../features/analysis/backend");
const { handleApi: handleHomeApi } = require("../features/home/backend");
const { handleApi: handleLongmarchRouteApi } = require("../features/longmarch-route/backend");
const { handleApi: handlePoetryApi } = require("../features/poetry/backend");
const { handleApi: handleScene3dApi } = require("../features/scene3d/backend");
const { handleApi: handleTourismApi } = require("../features/tourism/backend");
const { loadEnvFile } = require("../features/shared/backend/env");
const { PROJECT_ROOT } = require("../features/shared/backend/data-store");
const { send, sendError, sendSuccess } = require("../features/shared/backend/http");
const { serveStatic } = require("../features/shared/backend/static-files");

const PORT = Number(process.env.PORT || 8096);
const apiHandlers = [
  handleAgentApi,
  handleHomeApi,
  handleLongmarchRouteApi,
  handlePoetryApi,
  handleTourismApi,
  handleAnalysisApi,
  handleScene3dApi,
];

loadEnvFile(PROJECT_ROOT);

async function serveApi(request, response, pathname) {
  const context = {
    request,
    pathname,
    response,
    sendError,
    sendSuccess,
  };

  for (const handler of apiHandlers) {
    if (await handler(context)) {
      return true;
    }
  }

  return false;
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
      service: "Long March WebGIS",
      dataMode: "static-shp-adapter",
      featureLayout: "features/{feature}/frontend + backend",
    });
    return;
  }

  if (await serveApi(request, response, url.pathname)) {
    return;
  }

  serveStatic(response, url.pathname, send);
});

server.listen(PORT, () => {
  console.log(`Long March WebGIS: http://localhost:${PORT}`);
});
