const fs = require("fs");
const os = require("os");
const path = require("path");
const { PROJECT_ROOT, PUBLIC_ROOT } = require("./data-store");

const FEATURES_ROOT = path.join(PROJECT_ROOT, "features");

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

const pageAliases = {
  "/": "/features/home/frontend/index.html",
  "/index.html": "/features/home/frontend/index.html",
  "/zhuye.html": "/features/home/frontend/index.html",
  "/analysis.html": "/features/analysis/frontend/index.html",
  "/fenxi.html": "/features/analysis/frontend/index.html",
  "/tourism.html": "/features/tourism/frontend/index.html",
  "/red-tourism.html": "/features/tourism/frontend/index.html",
  "/scene3d.html": "/features/scene3d/frontend/index.html",
  "/sanwei-changjing.html": "/features/scene3d/frontend/index.html",
};

const externalAssetFallbacks = {
  "/assets/img/home-poster/logal.png": path.join(os.homedir(), "Downloads", "logal.png"),
};

function resolveStaticPath(pathname) {
  const requestedPath = pageAliases[pathname] || decodeURIComponent(pathname);

  if (requestedPath.startsWith("/features/")) {
    return {
      root: FEATURES_ROOT,
      filePath: path.normalize(path.join(PROJECT_ROOT, requestedPath)),
    };
  }

  return {
    root: PUBLIC_ROOT,
    filePath: path.normalize(path.join(PUBLIC_ROOT, requestedPath)),
  };
}

function isInside(root, filePath) {
  const relativePath = path.relative(root, filePath);

  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function serveStatic(response, pathname, send) {
  const { root, filePath } = resolveStaticPath(pathname);

  if (!isInside(root, filePath)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      const fallbackPath = externalAssetFallbacks[pathname];

      if (fallbackPath) {
        fs.readFile(fallbackPath, (fallbackError, fallbackData) => {
          if (fallbackError) {
            send(response, 404, "Page or resource not found", "text/plain; charset=utf-8");
            return;
          }

          const fallbackExtension = path.extname(fallbackPath).toLowerCase();
          const fallbackContentType = mimeTypes[fallbackExtension] || "application/octet-stream";
          send(response, 200, fallbackData, fallbackContentType);
        });
        return;
      }

      send(response, 404, "Page or resource not found", "text/plain; charset=utf-8");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    send(response, 200, data, contentType);
  });
}

module.exports = {
  serveStatic,
};
