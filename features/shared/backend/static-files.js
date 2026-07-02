const fs = require("fs");
const path = require("path");
const { PROJECT_ROOT, ASSETS_ROOT, DATA_ROOT } = require("./data-store");

const FEATURES_ROOT = path.join(PROJECT_ROOT, "features");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".splat": "application/octet-stream",
  ".ksplat": "application/octet-stream",
};

const pageAliases = {
  "/": "/features/login/frontend/index.html",
  "/login.html": "/features/login/frontend/index.html",
  "/index.html": "/features/home/frontend/index.html",
  "/zhuye.html": "/features/home/frontend/index.html",
  "/analysis.html": "/features/analysis/frontend/index.html",
  "/fenxi.html": "/features/analysis/frontend/index.html",
  "/tourism.html": "/features/tourism/frontend/index.html",
  "/red-tourism.html": "/features/tourism/frontend/index.html",
  "/scene3d.html": "/features/scene3d/frontend/index.html",
  "/sanwei-changjing.html": "/features/scene3d/frontend/index.html",
};

function resolveMountedPath(root, requestedPath, prefix) {
  const relativePath = requestedPath.slice(prefix.length);

  return {
    root,
    filePath: path.normalize(path.join(root, relativePath)),
  };
}

function resolveStaticPath(pathname) {
  const requestedPath = pageAliases[pathname] || decodeURIComponent(pathname);

  if (requestedPath.startsWith("/features/")) {
    return resolveMountedPath(FEATURES_ROOT, requestedPath, "/features/");
  }

  if (requestedPath.startsWith("/assets/")) {
    return resolveMountedPath(ASSETS_ROOT, requestedPath, "/assets/");
  }

  if (requestedPath.startsWith("/data/")) {
    return resolveMountedPath(DATA_ROOT, requestedPath, "/data/");
  }

  return null;
}

function isInside(root, filePath) {
  const relativePath = path.relative(root, filePath);

  return !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function serveStatic(response, pathname, send) {
  const resolvedPath = resolveStaticPath(pathname);

  if (!resolvedPath) {
    send(response, 404, "Page or resource not found", "text/plain; charset=utf-8");
    return;
  }

  const { root, filePath } = resolvedPath;

  if (!isInside(root, filePath)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
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
