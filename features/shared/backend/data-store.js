const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..", "..");
const PUBLIC_ROOT = path.join(PROJECT_ROOT, "public");
const ASSETS_ROOT = path.join(PROJECT_ROOT, "assets");
const DATA_ROOT = path.join(PROJECT_ROOT, "data");
const DATA_JSON_ROOT = path.join(DATA_ROOT, "json");
const DATA_ROUTE_ROOT = path.join(DATA_ROOT, "routes");
const DATA_GEOJSON_ROOT = path.join(DATA_ROOT, "geojson");
const ROUTE_LAYER_ROOT = path.join(DATA_ROUTE_ROOT, "route-layers");
const routeDataFiles = new Set(["route-layer-config.json", "routes.json"]);

function assertInside(root, filePath) {
  const relativePath = path.relative(root, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid data path: ${filePath}`);
  }

  return filePath;
}

function resolveDataFile(filename) {
  const normalized = String(filename).replace(/\\/g, "/");
  const root = routeDataFiles.has(normalized) || normalized.startsWith("route-layers/")
    ? DATA_ROUTE_ROOT
    : normalized.endsWith(".geojson")
      ? DATA_GEOJSON_ROOT
      : DATA_JSON_ROOT;

  return assertInside(root, path.join(root, ...normalized.split("/")));
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");

  return JSON.parse(text);
}

function readDataFile(filename) {
  return readJsonFile(resolveDataFile(filename));
}

function getRouteLayerConfigs() {
  const configs = readDataFile("route-layer-config.json");

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
  const relativePath = path.relative(ROUTE_LAYER_ROOT, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
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

module.exports = {
  PROJECT_ROOT,
  PUBLIC_ROOT,
  ASSETS_ROOT,
  DATA_ROOT,
  DATA_JSON_ROOT,
  DATA_ROUTE_ROOT,
  DATA_GEOJSON_ROOT,
  readDataFile,
  readJsonFile,
  getRouteLayerConfigs,
  getRouteFeatureCollection,
  sortRouteAnimation,
  sortEventTimeline,
};
