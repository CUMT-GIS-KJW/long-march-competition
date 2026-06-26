const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DATA_DIR = path.resolve(__dirname, "..", "public", "assets", "data");
const ROUTE_LAYER_DIR = path.join(DATA_DIR, "route-layers");
const CACHE_DIR = path.join(__dirname, "cache");
const PROVINCE_CACHE = path.join(CACHE_DIR, "china-provinces.geojson");
const PROVINCE_SOURCE_URL = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json";
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRARIUM_ZOOM = 8;
const terrariumImageCache = new Map();

const EVENT_FIELD = {
  id: "事件编",
  name: "地名",
  stage: "事件阶",
  date: "事件日",
  type: "事件类",
  people: "队伍总",
};

const BUFFER_RADII = [5, 10, 20];
const TERRAIN_ANCHORS = [
  { place: "瑞金", lng: 116.021, lat: 25.889, elevation: 250 },
  { place: "湘江", lng: 110.711, lat: 25.611, elevation: 420 },
  { place: "遵义", lng: 106.928, lat: 27.725, elevation: 850 },
  { place: "赤水", lng: 105.697, lat: 28.589, elevation: 520 },
  { place: "大渡河", lng: 102.234, lat: 29.914, elevation: 1680 },
  { place: "夹金山", lng: 102.75, lat: 30.83, elevation: 4124 },
  { place: "松潘草地", lng: 103.61, lat: 32.65, elevation: 3500 },
  { place: "腊子口", lng: 103.93, lat: 34.08, elevation: 1760 },
  { place: "会宁", lng: 105.052, lat: 35.692, elevation: 1720 },
];

function ensureCacheDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const outputPath = path.join(DATA_DIR, relativePath);
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchBuffer(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`request failed: ${url}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function fetchJson(url) {
  const buffer = await fetchBuffer(url);

  return JSON.parse(buffer.toString("utf8"));
}

function round(value, digits = 0) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function haversineKm(left, right) {
  const radius = 6371.0088;
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toPoint(coordinate) {
  return {
    lng: Number(coordinate[0]),
    lat: Number(coordinate[1]),
  };
}

function normalizeProvince(value) {
  return String(value || "其他")
    .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|省|市/g, "")
    .replace(/特别行政区/g, "")
    .trim() || "其他";
}

function provinceName(feature) {
  const props = feature.properties || {};

  return normalizeProvince(
    props.name || props.fullname || props.province || props.NAME || props.NL_NAME_1,
  );
}

function geometryBBox(geometry) {
  const points = [];

  function collect(coordinates) {
    if (!Array.isArray(coordinates)) {
      return;
    }

    if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
      points.push(coordinates);
      return;
    }

    coordinates.forEach(collect);
  }

  collect(geometry?.coordinates);

  return points.reduce(
    (bbox, point) => ({
      minLng: Math.min(bbox.minLng, point[0]),
      minLat: Math.min(bbox.minLat, point[1]),
      maxLng: Math.max(bbox.maxLng, point[0]),
      maxLat: Math.max(bbox.maxLat, point[1]),
    }),
    {
      minLng: Infinity,
      minLat: Infinity,
      maxLng: -Infinity,
      maxLat: -Infinity,
    },
  );
}

function buildProvinceIndex(collection) {
  return (collection.features || [])
    .map((feature) => ({
      name: provinceName(feature),
      bbox: geometryBBox(feature.geometry),
      geometry: feature.geometry,
    }))
    .filter((item) => Number.isFinite(item.bbox.minLng));
}

function bboxContainsPoint(bbox, point) {
  return (
    point.lng >= bbox.minLng &&
    point.lng <= bbox.maxLng &&
    point.lat >= bbox.minLat &&
    point.lat <= bbox.maxLat
  );
}

function featurePoint(feature) {
  const geometry = feature.geometry || {};

  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return toPoint(geometry.coordinates);
  }

  const props = feature.properties || feature;
  const lat = Number(props.lat);
  const lng = Number(props.lng);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function featureProps(feature) {
  return feature.properties || feature;
}

function asFeatures(data) {
  if (Array.isArray(data)) {
    return data
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .map((item) => ({
        type: "Feature",
        properties: item,
        geometry: {
          type: "Point",
          coordinates: [Number(item.lng), Number(item.lat)],
        },
      }));
  }

  return data?.features || [];
}

function linePartsFromGeometry(geometry) {
  if (!geometry) {
    return [];
  }

  if (geometry.type === "LineString") {
    return [geometry.coordinates.map(toPoint)];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((line) => line.map(toPoint));
  }

  return [];
}

function routeLineParts(collection) {
  return (collection.features || []).flatMap((feature) => {
    return linePartsFromGeometry(feature.geometry);
  });
}

function routeDistanceKm(lineParts) {
  return lineParts.reduce((routeSum, line) => {
    return routeSum + line.slice(1).reduce((lineSum, point, index) => {
      return lineSum + haversineKm(line[index], point);
    }, 0);
  }, 0);
}

function pointSegmentDistanceKm(point, start, end) {
  if (!point || !start || !end) {
    return Infinity;
  }

  const originLat = toRadians(point.lat);
  const xScale = 111.32 * Math.cos(originLat);
  const yScale = 110.574;
  const px = 0;
  const py = 0;
  const ax = (start.lng - point.lng) * xScale;
  const ay = (start.lat - point.lat) * yScale;
  const bx = (end.lng - point.lng) * xScale;
  const by = (end.lat - point.lat) * yScale;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator));
  const x = ax + t * dx;
  const y = ay + t * dy;

  return Math.sqrt(x * x + y * y);
}

function distanceToRouteKm(point, lineParts) {
  if (!point) {
    return Infinity;
  }

  let minDistance = Infinity;

  lineParts.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      minDistance = Math.min(minDistance, pointSegmentDistanceKm(point, line[index - 1], line[index]));
    }
  });

  return minDistance;
}

function nearestReference(point, referencePoints) {
  if (!point || !referencePoints.length) {
    return {
      province: "其他",
      distance: Infinity,
    };
  }

  return referencePoints.reduce(
    (nearest, candidate) => {
      const distance = haversineKm(point, candidate);
      return distance < nearest.distance ? { ...candidate, distance } : nearest;
    },
    { province: "其他", distance: Infinity },
  );
}

async function loadProvinceBoundaries() {
  ensureCacheDir();

  if (fs.existsSync(PROVINCE_CACHE)) {
    try {
      return JSON.parse(fs.readFileSync(PROVINCE_CACHE, "utf8"));
    } catch (error) {
      console.warn(`province cache read failed, retry download: ${error.message}`);
    }
  }

  try {
    const collection = await fetchJson(PROVINCE_SOURCE_URL);
    fs.writeFileSync(PROVINCE_CACHE, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

    return collection;
  } catch (error) {
    console.warn(`province boundary download failed, fallback to point references: ${error.message}`);

    return {
      type: "FeatureCollection",
      features: [],
    };
  }
}

function pointInRing(point, ring) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    const xi = currentPoint[0];
    const yi = currentPoint[1];
    const xj = previousPoint[0];
    const yj = previousPoint[1];
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygon(point, polygon) {
  if (!polygon.length || !pointInRing(point, polygon[0])) {
    return false;
  }

  return polygon.slice(1).every((hole) => !pointInRing(point, hole));
}

function pointInProvince(point, provinceIndex) {
  if (!point) {
    return "";
  }

  const match = (provinceIndex || []).find((province) => {
    if (!bboxContainsPoint(province.bbox, point)) {
      return false;
    }

    const geometry = province.geometry || {};
    if (geometry.type === "Polygon") {
      return pointInPolygon(point, geometry.coordinates);
    }

    if (geometry.type === "MultiPolygon") {
      return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
    }

    return false;
  });

  return match ? match.name : "";
}

function parsePng(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a") {
    throw new Error("invalid PNG signature");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * channels);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset + x];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[rowStart + x - rowBytes] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[rowStart + x - rowBytes - channels] : 0;
      let value;

      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = raw + predictor;
      } else {
        throw new Error(`unsupported PNG filter: ${filter}`);
      }

      pixels[rowStart + x] = value & 255;
    }

    sourceOffset += rowBytes;
  }

  return {
    width,
    height,
    channels,
    pixels,
  };
}

function tileForPoint(point, zoom) {
  const latRad = toRadians(point.lat);
  const tiles = 2 ** zoom;
  const xFloat = ((point.lng + 180) / 360) * tiles;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tiles;
  const x = Math.max(0, Math.min(tiles - 1, Math.floor(xFloat)));
  const y = Math.max(0, Math.min(tiles - 1, Math.floor(yFloat)));
  const pixelX = Math.max(0, Math.min(255, Math.floor((xFloat - x) * 256)));
  const pixelY = Math.max(0, Math.min(255, Math.floor((yFloat - y) * 256)));

  return {
    z: zoom,
    x,
    y,
    pixelX,
    pixelY,
  };
}

async function loadTerrariumTile(tile) {
  ensureCacheDir();

  const dir = path.join(CACHE_DIR, "terrarium", String(tile.z), String(tile.x));
  const tilePath = path.join(dir, `${tile.y}.png`);

  if (!fs.existsSync(tilePath)) {
    fs.mkdirSync(dir, { recursive: true });
    const url = TERRARIUM_URL.replace("{z}", tile.z).replace("{x}", tile.x).replace("{y}", tile.y);
    fs.writeFileSync(tilePath, await fetchBuffer(url));
  }

  if (!terrariumImageCache.has(tilePath)) {
    terrariumImageCache.set(tilePath, parsePng(fs.readFileSync(tilePath)));
  }

  return terrariumImageCache.get(tilePath);
}

async function sampleTerrariumElevation(point) {
  const tile = tileForPoint(point, TERRARIUM_ZOOM);
  const image = await loadTerrariumTile(tile);
  const index = (tile.pixelY * image.width + tile.pixelX) * image.channels;
  const red = image.pixels[index];
  const green = image.pixels[index + 1];
  const blue = image.pixels[index + 2];

  return round(red * 256 + green + blue / 256 - 32768);
}

function sampleRoute(lineParts, sampleCount) {
  const segments = [];
  let total = 0;

  lineParts.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const length = haversineKm(start, end);
      segments.push({ start, end, length, offset: total });
      total += length;
    }
  });

  if (segments.length === 0) {
    return [];
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const target = sampleCount === 1 ? 0 : total * (index / (sampleCount - 1));
    const segment = segments.find((item) => item.offset + item.length >= target) || segments[segments.length - 1];
    const t = segment.length === 0 ? 0 : (target - segment.offset) / segment.length;

    return {
      distance: round(target),
      lng: segment.start.lng + (segment.end.lng - segment.start.lng) * t,
      lat: segment.start.lat + (segment.end.lat - segment.start.lat) * t,
    };
  });
}

function estimateElevation(point) {
  const weighted = TERRAIN_ANCHORS.map((anchor) => {
    const distance = Math.max(8, haversineKm(point, anchor));

    return {
      ...anchor,
      weight: 1 / distance ** 2,
      distance,
    };
  }).sort((left, right) => left.distance - right.distance);

  const top = weighted.slice(0, 4);
  const weightSum = top.reduce((sum, item) => sum + item.weight, 0);
  const elevation = top.reduce((sum, item) => sum + item.elevation * item.weight, 0) / weightSum;

  return {
    elevation: Math.max(120, round(elevation)),
    place: top[0].place,
  };
}

function eventType(props) {
  const text = `${props.type || ""}${props[EVENT_FIELD.type] || ""}${props.name || ""}${props[EVENT_FIELD.name] || ""}`;

  if (/战|攻占|突破|阻击|飞夺/.test(text)) return "战斗";
  if (/会师|汇合/.test(text)) return "会师";
  if (/会|政治局|决策/.test(text)) return "会议";
  if (/渡|江|河|赤水/.test(text)) return "渡江";
  if (/雪山|草地|夹金山|山/.test(text)) return "雪山草地";

  return "行军驻扎";
}

function loadRoutes() {
  const configs = readJson("route-layer-config.json");

  return configs.map((config) => {
    const collection = JSON.parse(
      fs.readFileSync(path.join(ROUTE_LAYER_DIR, `${config.layer_key}.json`), "utf8"),
    );
    const lineParts = routeLineParts(collection);

    return {
      ...config,
      collection,
      lineParts,
      distance: routeDistanceKm(lineParts),
    };
  });
}

function buildReferencePoints(events, resources, provinceIndex) {
  const eventPoints = events.map((feature) => {
    const props = featureProps(feature);
    const point = featurePoint(feature);

    return point
      ? {
          ...point,
          province: normalizeProvince(props.province || props.pname || pointInProvince(point, provinceIndex)),
        }
      : null;
  });

  const resourcePoints = resources.map((feature) => {
    const props = featureProps(feature);
    const point = featurePoint(feature);

    return point
      ? {
          ...point,
          province: normalizeProvince(props.province || props.pname || pointInProvince(point, provinceIndex)),
        }
      : null;
  });

  return [...eventPoints, ...resourcePoints].filter((item) => item && item.province !== "其他");
}

function buildProvinceStats(primaryRoute, events, resources, provinceIndex, referencePoints) {
  const stats = new Map();

  function ensure(province) {
    const key = normalizeProvince(province);

    if (!stats.has(key)) {
      stats.set(key, {
        province: key,
        distance: 0,
        eventCount: 0,
        resourceCount: 0,
      });
    }

    return stats.get(key);
  }

  events.forEach((feature) => {
    const props = featureProps(feature);
    const point = featurePoint(feature);
    const province =
      props.province ||
      props.pname ||
      pointInProvince(point, provinceIndex) ||
      nearestReference(point, referencePoints).province;
    ensure(province).eventCount += 1;
  });

  resources.forEach((feature) => {
    const props = featureProps(feature);
    const point = featurePoint(feature);
    ensure(props.province || props.pname || pointInProvince(point, provinceIndex)).resourceCount += 1;
  });

  primaryRoute.lineParts.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const midpoint = {
        lng: (start.lng + end.lng) / 2,
        lat: (start.lat + end.lat) / 2,
      };
      const province =
        pointInProvince(midpoint, provinceIndex) || nearestReference(midpoint, referencePoints).province;
      ensure(province).distance += haversineKm(start, end);
    }
  });

  return [...stats.values()]
    .map((item) => ({
      ...item,
      distance: round(item.distance),
    }))
    .filter((item) => item.distance > 0 || item.eventCount > 0 || item.resourceCount > 0)
    .sort((left, right) => right.distance - left.distance);
}

function buildBufferStats(primaryRoute, events, resources) {
  const eventDistances = events
    .map((feature) => distanceToRouteKm(featurePoint(feature), primaryRoute.lineParts))
    .filter(Number.isFinite);
  const resourceDistances = resources
    .map((feature) => distanceToRouteKm(featurePoint(feature), primaryRoute.lineParts))
    .filter(Number.isFinite);

  return BUFFER_RADII.map((radius) => ({
    buffer: `${radius}km`,
    resourceCount: resourceDistances.filter((distance) => distance <= radius).length,
    eventCount: eventDistances.filter((distance) => distance <= radius).length,
    area: round(primaryRoute.distance * radius * 2 + Math.PI * radius * radius),
  }));
}

async function buildElevation(primaryRoute) {
  const samples = sampleRoute(primaryRoute.lineParts, 9);
  return Promise.all(samples.map(async (point) => {
    const estimate = estimateElevation(point);
    let elevation = estimate.elevation;

    try {
      elevation = await sampleTerrariumElevation(point);
    } catch (error) {
      console.warn(`DEM sample fallback at ${round(point.lng, 4)},${round(point.lat, 4)}: ${error.message}`);
    }

    return {
      distance: point.distance,
      elevation,
      place: estimate.place,
    };
  }));
}

function buildStageStats(primaryRoute, events) {
  const stages = new Map();

  events.forEach((feature) => {
    const props = featureProps(feature);
    const stage = props.stage || props[EVENT_FIELD.stage] || "未分阶段";
    const date = props.date || props[EVENT_FIELD.date] || "";

    if (!stages.has(stage)) {
      stages.set(stage, {
        stage,
        distance: 0,
        eventCount: 0,
        startDate: date,
        endDate: date,
      });
    }

    const item = stages.get(stage);
    item.eventCount += 1;

    if (date && (!item.startDate || date < item.startDate)) item.startDate = date;
    if (date && (!item.endDate || date > item.endDate)) item.endDate = date;
  });

  const totalEvents = [...stages.values()].reduce((sum, item) => sum + item.eventCount, 0) || 1;

  return [...stages.values()].map((item) => ({
    ...item,
    distance: round(primaryRoute.distance * (item.eventCount / totalEvents)),
  }));
}

function buildSummary(routes, province, elevation, buffer, events, resources) {
  const visibleRoutes = routes.filter((route) => route.default_visible);
  const totalDistance = visibleRoutes.reduce((sum, route) => sum + route.distance, 0);
  const provinces = new Set(province.map((item) => item.province).filter((item) => item !== "其他"));

  return {
    totalDistance: round(totalDistance),
    totalEvents: events.length,
    totalProvinces: provinces.size,
    totalResources: resources.length,
    averageElevation: elevation.length
      ? round(elevation.reduce((sum, item) => sum + item.elevation, 0) / elevation.length)
      : 0,
    maxElevation: elevation.length ? Math.max(...elevation.map((item) => item.elevation)) : 0,
    bufferArea: buffer[buffer.length - 1]?.area || 0,
    description: "由 Node.js 脚本读取路线、事件与红色资源数据后自动生成，覆盖路线统计、省域近邻、海拔剖面、缓冲区和阶段统计。",
  };
}

function buildNodeTypeStats(events) {
  const groups = new Map();

  events.forEach((feature) => {
    const type = eventType(featureProps(feature));
    groups.set(type, (groups.get(type) || 0) + 1);
  });

  return [...groups.entries()].map(([type, count]) => ({ type, count }));
}

async function main() {
  const routes = loadRoutes();
  const primaryRoute = routes[0];
  const events = asFeatures(readJson("events-important.json"));
  const resources = asFeatures(readJson("resources.json"));
  const provinceCollection = await loadProvinceBoundaries();
  const provinceIndex = buildProvinceIndex(provinceCollection);
  const referencePoints = buildReferencePoints(events, resources, provinceIndex);
  const province = buildProvinceStats(primaryRoute, events, resources, provinceIndex, referencePoints);
  const elevation = await buildElevation(primaryRoute);
  const buffer = buildBufferStats(primaryRoute, events, resources);
  const stage = buildStageStats(primaryRoute, events);
  const summary = buildSummary(routes, province, elevation, buffer, events, resources);
  const nodeTypes = buildNodeTypeStats(events);

  writeJson("analysis-summary.json", summary);
  writeJson("analysis-province.json", province);
  writeJson("analysis-elevation.json", elevation);
  writeJson("analysis-buffer.json", buffer);
  writeJson("analysis-stage.json", stage);
  writeJson("analysis-node-types.json", nodeTypes);

  console.log("GIS analysis data generated:");
  console.log(`- routes: ${routes.length}`);
  console.log(`- events: ${events.length}`);
  console.log(`- resources: ${resources.length}`);
  console.log(`- province rows: ${province.length}`);
  console.log(`- province polygons: ${provinceIndex.length}`);
  console.log(`- province source: ${PROVINCE_SOURCE_URL}`);
  console.log(`- DEM source: ${TERRARIUM_URL} z${TERRARIUM_ZOOM}`);
  console.log(`- output: ${DATA_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
