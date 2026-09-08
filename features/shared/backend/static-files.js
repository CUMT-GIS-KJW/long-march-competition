const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream");
const { acceptedEncoding } = require("./content-encoding");
const { PROJECT_ROOT, ASSETS_ROOT, DATA_ROOT } = require("./data-store");

const FEATURES_ROOT = path.join(PROJECT_ROOT, "features");
const MIN_COMPRESS_BYTES = 1024;

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

function isCompressible(contentType) {
  return /^(application\/(json|javascript)|text\/|application\/geo\+json|image\/svg\+xml)/i.test(
    contentType,
  );
}

function cacheControlFor(pathname, extension) {
  if (extension === ".html") {
    return "no-cache";
  }

  if (pathname.startsWith("/assets/")) {
    return "public, max-age=604800";
  }

  return "public, max-age=0, must-revalidate";
}

function createEtag(stat) {
  return `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
}

function isNotModified(request, stat, etag) {
  const ifNoneMatch = request.headers["if-none-match"];
  if (ifNoneMatch !== undefined) {
    return ifNoneMatch.split(",").some((value) => {
      const candidate = value.trim();
      return candidate === "*" || candidate.replace(/^W\//, "") === etag.replace(/^W\//, "");
    });
  }

  const modifiedSince = request.headers["if-modified-since"];
  if (!modifiedSince) {
    return false;
  }

  const timestamp = Date.parse(modifiedSince);
  return Number.isFinite(timestamp) && stat.mtimeMs <= timestamp + 999;
}

function pipeStaticFile(request, response, filePath, stat, pathname) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || "application/octet-stream";
  const etag = createEtag(stat);
  const headers = {
    "Content-Type": contentType,
    "Cache-Control": cacheControlFor(pathname, extension),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  };

  if (stat.size >= MIN_COMPRESS_BYTES && isCompressible(contentType)) {
    headers.Vary = "Accept-Encoding";
  }

  if (isNotModified(request, stat, etag)) {
    response.writeHead(304, headers);
    response.end();
    return;
  }

  const encoding =
    stat.size >= MIN_COMPRESS_BYTES && isCompressible(contentType)
      ? acceptedEncoding(request.headers["accept-encoding"])
      : "";

  if (encoding) {
    headers["Content-Encoding"] = encoding;
    headers.Vary = "Accept-Encoding";
  } else {
    headers["Content-Length"] = stat.size;
  }

  response.writeHead(200, headers);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const source = fs.createReadStream(filePath);

  if (encoding === "br") {
    const compressor = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    pipeline(source, compressor, response, () => {});
    return;
  }

  if (encoding === "gzip") {
    pipeline(source, zlib.createGzip({ level: 6 }), response, () => {});
    return;
  }

  pipeline(source, response, () => {});
}

function serveStatic(request, response, pathname, send) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method Not Allowed", "text/plain; charset=utf-8", { Allow: "GET, HEAD, OPTIONS" });
    return;
  }
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

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      send(response, 404, "Page or resource not found", "text/plain; charset=utf-8");
      return;
    }

    pipeStaticFile(request, response, filePath, stat, pathname);
  });
}

module.exports = {
  serveStatic,
};
