(function () {
  const EVENT_FIELD = {
    id: "\u4e8b\u4ef6\u7f16",
    name: "\u5730\u540d",
    stage: "\u4e8b\u4ef6\u9636",
    date: "\u4e8b\u4ef6\u65e5",
    type: "\u4e8b\u4ef6\u7c7b",
    people: "\u961f\u4f0d\u603b",
  };

  const state = {
    map: null,
    routes: {},
    routeConfigs: [],
    resources: [],
    events: [],
    routeLayer: null,
    allRoutesLayer: null,
    resultLayer: null,
    resourceLayer: null,
    eventLayer: null,
    hillshadeLayer: null,
    layerVisibility: {
      route: true,
      event: true,
      resource: false,
      hillshade: true,
    },
  };

  function normalizeEvent(feature) {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [0, 0];
    const people = Number(properties[EVENT_FIELD.people] || 0);

    return {
      id: `event-${properties[EVENT_FIELD.id]}`,
      name: properties[EVENT_FIELD.name],
      date: properties[EVENT_FIELD.date],
      type: normalizeEventType(String(properties[EVENT_FIELD.type] || "")),
      stage: properties[EVENT_FIELD.stage],
      importance: getPeopleImportance(people),
      lat: coordinates[1],
      lng: coordinates[0],
    };
  }

  function normalizeEventType(eventClass) {
    if (eventClass.includes("战") || eventClass.includes("突破")) return "battle";
    if (eventClass.includes("会")) return "meeting";
    if (eventClass.includes("渡") || eventClass.includes("江")) return "crossing";
    if (eventClass.includes("山") || eventClass.includes("草")) return "mountain";
    return "event";
  }

  function getPeopleImportance(people) {
    if (people >= 80000) return 5;
    if (people >= 50000) return 4;
    if (people >= 30000) return 3;
    if (people >= 10000) return 2;
    return 1;
  }

  function toLatLngsList(geometry) {
    if (!geometry) return [];
    if (geometry.type === "LineString") return [geometry.coordinates.map((c) => [c[1], c[0]])];
    if (geometry.type === "MultiLineString") return geometry.coordinates.map((line) => line.map((c) => [c[1], c[0]]));
    return [];
  }

  function buildRoute(config, collection) {
    const parts = [];
    const points = [];
    (collection.features || []).forEach((feature) => {
      toLatLngsList(feature.geometry).forEach((latLngs) => {
        if (!latLngs.length) return;
        parts.push(latLngs);
        latLngs.forEach((point) => points.push(point));
      });
    });

    return {
      id: config.layer_key,
      name: config.layer_name,
      color: config.color,
      parts,
      points,
      features: collection.features || [],
    };
  }

  function renderRouteSelect() {
    const routeSelect = document.getElementById("routeSelect");
    routeSelect.innerHTML = state.routeConfigs
      .map((config) => `<option value="${config.layer_key}">${config.layer_name}</option>`)
      .join("");
  }

  async function loadRoutes() {
    const configs = await DataService.getRouteLayers();
    const entries = await Promise.all(
      configs.map(async (config) => {
        const collection = await DataService.getRouteLayerFeatures(config.layer_key);
        return [config.layer_key, buildRoute(config, collection)];
      }),
    );

    state.routeConfigs = configs;
    state.routes = Object.fromEntries(entries);
    renderRouteSelect();
  }

  async function init() {
    state.map = L.map("analysisMap", {
      center: APP_CONFIG.map.center,
      zoom: 8,
      minZoom: APP_CONFIG.map.minZoom,
      preferCanvas: true,
      zoomControl: true,
    });

    L.tileLayer(APP_CONFIG.basemaps.ancient.url, APP_CONFIG.basemaps.ancient.options).addTo(state.map);
    addHillshadeLayer();

    const [resources, eventCollection] = await Promise.all([
      DataService.getResources(),
      DataService.getEvents(),
    ]);

    state.resources = resources;
    state.events = (eventCollection.features || []).map(normalizeEvent);
    await loadRoutes();
    buildPointLayers();
    showAllRoutes();
    applyLayerVisibility();
    document.dispatchEvent(new Event("analysismapready"));
  }

  function addHillshadeLayer() {
    const hillshade = APP_CONFIG.basemaps?.hillshade;
    if (!hillshade?.url) return;
    state.map.createPane("hillshadePane");
    const pane = state.map.getPane("hillshadePane");
    if (pane) {
      pane.style.zIndex = 260;
      pane.style.pointerEvents = "none";
      pane.classList.add("hillshade-pane");
    }
    state.hillshadeLayer = L.tileLayer(hillshade.url, {
      ...hillshade.options,
      pane: "hillshadePane",
      crossOrigin: true,
    }).addTo(state.map);
  }

  function buildPointLayers() {
    state.resourceLayer = L.layerGroup(
      state.resources.map((resource) => {
        const eventLike = { ...resource, type: "resource", date: resource.level, importance: 4 };
        return L.marker([resource.lat, resource.lng], { icon: MapUtils.eventIcon(eventLike) })
          .bindPopup(MapUtils.eventPopup(eventLike));
      }),
    );

    state.eventLayer = L.layerGroup(
      state.events.map((event) => L.circleMarker([event.lat, event.lng], {
        radius: 3 + event.importance,
        color: "#fff0b5",
        weight: 1,
        fillColor: event.type === "battle" ? "#a72b22" : event.type === "crossing" ? "#457b9d" : "#c09242",
        fillOpacity: 0.78,
      }).bindPopup(`<b>${event.name || "历史节点"}</b><br>${event.date || ""}<br>${event.stage || ""}`)),
    );
  }

  function addIfVisible(layer, key) {
    if (layer && state.layerVisibility[key] && !state.map.hasLayer(layer)) layer.addTo(state.map);
  }

  function removeIfHidden(layer, key) {
    if (layer && !state.layerVisibility[key] && state.map.hasLayer(layer)) state.map.removeLayer(layer);
  }

  function applyLayerVisibility() {
    [state.routeLayer, state.allRoutesLayer].forEach((layer) => {
      if (!layer) return;
      if (state.layerVisibility.route && !state.map.hasLayer(layer)) layer.addTo(state.map);
      if (!state.layerVisibility.route && state.map.hasLayer(layer)) state.map.removeLayer(layer);
    });
    addIfVisible(state.eventLayer, "event");
    removeIfHidden(state.eventLayer, "event");
    addIfVisible(state.resourceLayer, "resource");
    removeIfHidden(state.resourceLayer, "resource");
    addIfVisible(state.hillshadeLayer, "hillshade");
    removeIfHidden(state.hillshadeLayer, "hillshade");
  }

  function setLayerVisibility(layer, visible) {
    if (!(layer in state.layerVisibility)) return;
    state.layerVisibility[layer] = visible;
    applyLayerVisibility();
  }

  function fitLayer(layer) {
    if (layer?.getBounds?.().isValid()) state.map.fitBounds(layer.getBounds(), { padding: [35, 35] });
  }

  function showAllRoutes() {
    if (state.allRoutesLayer) state.map.removeLayer(state.allRoutesLayer);
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);

    const fg = L.featureGroup();
    Object.values(state.routes).forEach((route) => {
      route.parts.forEach((part) => {
        L.polyline(part, {
          color: route.color || "#a72b22",
          weight: 3,
          opacity: 0.82,
          lineCap: "round",
          lineJoin: "round",
        }).bindTooltip(route.name).addTo(fg);
      });
    });

    state.allRoutesLayer = fg;
    state.routeLayer = null;
    if (state.layerVisibility.route) fg.addTo(state.map);
    fitLayer(fg);
  }

  function hideAllRoutes() {
    if (!state.allRoutesLayer) return;
    state.map.removeLayer(state.allRoutesLayer);
    state.allRoutesLayer = null;
  }

  function showRoute(routeId) {
    hideAllRoutes();
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    clearResult();

    const route = state.routes[routeId] || Object.values(state.routes)[0];
    if (!route) return;

    const fg = L.featureGroup();
    route.parts.forEach((part) => {
      L.polyline(part, { color: "#f0cf7a", weight: 10, opacity: 0.32, lineCap: "round", lineJoin: "round" }).addTo(fg);
      L.polyline(part, { color: route.color || "#a72b22", weight: 4, opacity: 0.96, lineCap: "round", lineJoin: "round" }).bindTooltip(route.name).addTo(fg);
    });

    state.routeLayer = fg;
    if (state.layerVisibility.route) fg.addTo(state.map);
    fitLayer(fg);
  }

  function clearResult() {
    if (!state.resultLayer) return;
    state.map.removeLayer(state.resultLayer);
    state.resultLayer = null;
  }

  function showResourceLayer() {
    state.layerVisibility.resource = true;
    applyLayerVisibility();
  }

  function hideResourceLayer() {
    state.layerVisibility.resource = false;
    applyLayerVisibility();
  }

  function drawBuffer(route, radius) {
    const multiLine = turf.multiLineString(route.parts.map((part) => part.map((p) => [p[1], p[0]])));
    let polygon;
    try {
      polygon = turf.buffer(multiLine, Number(radius), { units: "kilometers" });
    } catch (error) {
      const buffers = route.parts.map((part) => turf.buffer(turf.lineString(part.map((p) => [p[1], p[0]])), Number(radius), { units: "kilometers" }));
      polygon = buffers.reduce((acc, cur) => (acc ? turf.union(acc, cur) : cur), null);
    }
    state.resultLayer = L.geoJSON(polygon, {
      style: { color: "#a72b22", weight: 2, fillColor: "#d28b4c", fillOpacity: 0.28 },
    }).addTo(state.map);
    fitLayer(state.resultLayer);
  }

  function drawResourceRelation() {
    const layers = [];
    state.resources.forEach((resource) => {
      layers.push(
        L.circle([resource.lat, resource.lng], { radius: 52000, color: "#d8a84f", weight: 1, opacity: 0.35, fillColor: "#a8261d", fillOpacity: 0.1 }),
        L.circle([resource.lat, resource.lng], { radius: 18000, color: "#f2d799", weight: 1, opacity: 0.45, fillColor: "#d34a35", fillOpacity: 0.28 }),
      );
    });
    state.resultLayer = L.layerGroup(layers).addTo(state.map);
  }

  function drawNodes() {
    state.resultLayer = L.layerGroup(
      state.events.map((event) => L.circleMarker([event.lat, event.lng], {
        radius: 4 + event.importance,
        color: "#f2d799",
        weight: 1,
        fillColor: event.type === "battle" ? "#a72b22" : "#b98327",
        fillOpacity: 0.8,
      })),
    ).addTo(state.map);
  }

  function drawTerrainSamples(route) {
    const samples = route.points.filter((_, index) => index % 180 === 0);
    const colors = ["#6c8b6d", "#c09242", "#9e3528"];
    state.resultLayer = L.layerGroup(samples.map((point, index) => L.circleMarker(point, {
      radius: 9,
      color: "#f1d899",
      weight: 2,
      fillColor: colors[index % colors.length],
      fillOpacity: 0.65,
    }))).addTo(state.map);
  }

  function drawRouteHighlight(route) {
    const layers = [];
    route.parts.forEach((part) => {
      layers.push(
        L.polyline(part, { color: "#f6d56f", weight: 12, opacity: 0.34, lineCap: "round", lineJoin: "round" }),
        L.polyline(part, { color: "#ffffff", weight: 3, opacity: 0.36, dashArray: "8 10", lineCap: "round", lineJoin: "round" }),
      );
    });
    state.resultLayer = L.layerGroup(layers).addTo(state.map);
  }

  function drawCompareRoutes(rows = []) {
    hideAllRoutes();
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    const maxDifficulty = Math.max(1, ...rows.map((item) => Number(item.maxDifficulty || 0)));
    const fg = L.featureGroup();
    rows.forEach((row) => {
      const route = state.routes[row.routeKey];
      if (!route) return;
      const ratio = Number(row.maxDifficulty || 0) / maxDifficulty;
      route.parts.forEach((part) => {
        L.polyline(part, {
          color: ratio > 0.75 ? "#b3261e" : ratio > 0.5 ? "#d46a35" : route.color || "#a72b22",
          weight: 3 + ratio * 4,
          opacity: 0.88,
          lineCap: "round",
          lineJoin: "round",
        }).bindPopup(`<b>${row.routeName}</b><br>里程：${row.totalDistance} km<br>最高难度：${row.maxDifficulty}<br>资源密度：${row.resourceDensity} 处/百km`).addTo(fg);
      });
    });
    state.resultLayer = fg.addTo(state.map);
    fitLayer(fg);
  }

  function drawDifficulty(difficultyRows = [], routeId) {
    hideAllRoutes();
    if (state.routeLayer) state.map.removeLayer(state.routeLayer);
    const analysis = difficultyRows.find((item) => item.routeKey === routeId) || difficultyRows[0];
    if (!analysis) return;
    const fg = L.featureGroup();
    (analysis.segments || []).forEach((segment) => {
      const latLngs = (segment.coordinates || []).map((point) => [point[1], point[0]]);
      if (latLngs.length < 2) return;
      const line = L.polyline(latLngs, {
        color: segment.color || "#d8a84f",
        weight: 7,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round",
      }).bindPopup(`<b>${segment.from} 至 ${segment.to}</b><br>难度：${segment.level} / ${segment.score}<br>平均海拔：${segment.avgElevation} m<br>坡度：${segment.avgSlope} m/km`);
      line.on("click", () => {
        document.dispatchEvent(new CustomEvent("analysissegmentselect", { detail: segment }));
      });
      line.addTo(fg);
    });
    state.resultLayer = fg.addTo(state.map);
    fitLayer(fg);
  }

  function drawResult(tool, radius = 10, routeId = null, payload = {}) {
    clearResult();
    const selectedRouteId = routeId || document.getElementById("routeSelect").value;
    const route = state.routes[selectedRouteId] || Object.values(state.routes)[0];
    if (tool === "compare") return drawCompareRoutes(payload.routeCompare || []);
    if (tool === "difficulty") return drawDifficulty(payload.difficulty || [], selectedRouteId);
    if (!route) return;
    if (tool === "buffer" && window.turf) return drawBuffer(route, radius);
    if (tool === "resource") return drawResourceRelation();
    if (tool === "node") return drawNodes();
    if (tool === "terrain") return drawTerrainSamples(route);
    drawRouteHighlight(route);
  }

  window.AnalysisMap = {
    state,
    showRoute,
    showAllRoutes,
    hideAllRoutes,
    drawResult,
    clearResult,
    showResourceLayer,
    hideResourceLayer,
    setLayerVisibility,
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
  });
})();
