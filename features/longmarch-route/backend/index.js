const { URL } = require("url");
const { readDataFile } = require("../../shared/backend/data-store");

function getQuery(request) {
  return new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  ).searchParams;
}

function safeReadDataFile(filename, fallback) {
  try {
    const data = readDataFile(filename);
    return data || fallback;
  } catch (error) {
    return fallback;
  }
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizePoint(point, index) {
  if (Array.isArray(point)) {
    return {
      name: `节点${index + 1}`,
      lng: Number(point[0]),
      lat: Number(point[1]),
      date: "",
      event: "",
    };
  }

  const props = point.properties || point;
  const coords = point.geometry?.coordinates || point.coordinates || [];

  return {
    name: first(props.name, props.title, props.place, props["地名"], props["地点"], `节点${index + 1}`),
    lng: Number(first(props.lng, props.lon, props.longitude, props.x, coords[0])),
    lat: Number(first(props.lat, props.latitude, props.y, coords[1])),
    date: first(props.date, props.time, props.year, props["事件日"], ""),
    event: first(props.event, props.desc, props.description, props.summary, props["事件"], ""),
  };
}

function normalizeRoute(route, index) {
  const props = route.properties || route;
  const geometryCoords = route.geometry?.coordinates || [];
  let rawPoints = first(
    props.points,
    props.nodes,
    props.stops,
    route.points,
    route.nodes,
    route.stops,
    [],
  );

  if ((!rawPoints || !rawPoints.length) && geometryCoords.length) {
    rawPoints = geometryCoords.map((item) => Array.isArray(item[0]) ? item[0] : item);
  }

  const points = (rawPoints || [])
    .map(normalizePoint)
    .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));

  return {
    id: String(first(props.id, route.id, `route_${index + 1}`)),
    name: first(props.name, props.title, props.routeName, `长征分析路线 ${index + 1}`),
    stage: first(props.stage, props.type, props.category, props["阶段"], "综合分析"),
    days: Number(first(props.days, props.duration, props["天数"], points.length, 0)),
    distanceKm: Number(first(props.distanceKm, props.distance, props.length, props["里程"], 0)),
    summary: first(props.summary, props.description, props.desc, "该路线用于展示长征关键节点、事件关联与空间转折过程。"),
    points,
  };
}

function flattenFeatures(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.features)) return data.features;
  if (Array.isArray(data?.routes)) return data.routes;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function fallbackRoutesFromEvents(events) {
  const points = flattenFeatures(events)
    .map((item, index) => normalizePoint(item, index))
    .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat))
    .slice(0, 10);

  if (points.length < 2) return [];

  return [{
    id: "events-route",
    name: "长征重要事件串联路线",
    stage: "事件关联",
    days: points.length,
    distanceKm: 0,
    summary: "由 events-important.json 中的事件点自动串联生成，用于路线分析展示。",
    points,
  }];
}

function loadRoutes() {
  const routeFiles = [
    "analysis-routes.json",
    "routes.json",
    "route-layer-config.json",
  ];

  let routes = [];

  routeFiles.forEach((filename) => {
    if (routes.length) return;
    const data = safeReadDataFile(filename, []);
    routes = flattenFeatures(data).map(normalizeRoute).filter((route) => route.points.length >= 2);
  });

  if (!routes.length) {
    routes = fallbackRoutesFromEvents(safeReadDataFile("events-important.json", []));
  }

  return routes;
}

function loadEvents() {
  return flattenFeatures(safeReadDataFile("events-important.json", []));
}

function loadStages(routes) {
  const dataStages = flattenFeatures(safeReadDataFile("analysis-stage.json", []))
    .map((item) => first(item.name, item.title, item.stage, item.properties?.name))
    .filter(Boolean);
  const routeStages = routes.map((route) => route.stage).filter(Boolean);
  return [...new Set([...dataStages, ...routeStages])];
}

function filterRoutes(routes, query) {
  const stage = String(query.get("stage") || "").trim();
  const keyword = String(query.get("keyword") || "").trim();

  return routes.filter((route) => {
    if (stage && route.stage !== stage) return false;
    if (keyword) {
      const text = `${route.name} ${route.stage} ${route.summary} ${route.points.map((point) => `${point.name} ${point.event}`).join(" ")}`;
      return text.includes(keyword);
    }
    return true;
  });
}

function handleRoutes({ request, response, sendSuccess }) {
  const query = getQuery(request);
  const routes = filterRoutes(loadRoutes(), query);
  sendSuccess(response, {
    routes,
    stages: loadStages(routes),
    events: loadEvents().slice(0, 60),
  });
  return true;
}

function handleRouteDetail({ request, response, sendSuccess }) {
  const query = getQuery(request);
  const id = String(query.get("id") || "");
  const route = loadRoutes().find((item) => item.id === id) || loadRoutes()[0] || null;
  sendSuccess(response, route);
  return true;
}

function handleApi(context) {
  if (context.pathname === "/api/longmarch-route/routes") {
    return handleRoutes(context);
  }

  if (context.pathname === "/api/longmarch-route/detail") {
    return handleRouteDetail(context);
  }

  return false;
}

module.exports = {
  handleApi,
};
