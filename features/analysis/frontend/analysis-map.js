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
    resultLayer: null,
    resourceLayer: null,
    hillshadeLayer: null,
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
    if (eventClass.includes("\u6218") || eventClass.includes("\u7a81\u7834")) {
      return "battle";
    }

    if (eventClass.includes("\u4f1a")) {
      return "meeting";
    }

    if (eventClass.includes("\u6e21") || eventClass.includes("\u6c5f")) {
      return "crossing";
    }

    if (eventClass.includes("\u5c71") || eventClass.includes("\u8349")) {
      return "mountain";
    }

    return "event";
  }

  function getPeopleImportance(people) {
    if (people >= 80000) return 5;
    if (people >= 50000) return 4;
    if (people >= 30000) return 3;
    if (people >= 10000) return 2;
    return 1;
  }

  /* ---------- 修改点 1：拆分多段线 ---------- */
  function toLatLngsList(geometry) {
    if (!geometry) return [];

    if (geometry.type === "LineString") {
      return [geometry.coordinates.map(c => [c[1], c[0]])];
    }

    if (geometry.type === "MultiLineString") {
      return geometry.coordinates.map(line =>
        line.map(c => [c[1], c[0]])
      );
    }

    return [];
  }

  /* ---------- 修改点 2：同时保留 parts 和 points ---------- */
  function buildRoute(config, collection) {
    const parts = [];   // 多条独立的线段
    const points = [];  // 合并后的点集（用于缓冲、采样等）

    collection.features.forEach(feature => {
      toLatLngsList(feature.geometry).forEach(latLngs => {
        if (latLngs.length) {
          parts.push(latLngs);
          // 避免重复的点可以直接 push，turf 会处理
          latLngs.forEach(p => points.push(p));
        }
      });
    });

    return {
      id: config.layer_key,
      name: config.layer_name,
      color: config.color,
      parts,          // 供绘制使用
      points,         // 供缓冲、地形采样等
      features: collection.features,
    };
  }

  function renderRouteSelect() {
    const routeSelect = document.getElementById("routeSelect");
    routeSelect.innerHTML = state.routeConfigs
      .map(config => `<option value="${config.layer_key}">${config.layer_name}</option>`)
      .join("");
  }

  async function loadRoutes() {
    const configs = await DataService.getRouteLayers();
    const entries = await Promise.all(
      configs.map(async config => {
        const collection = await DataService.getRouteLayerFeatures(config.layer_key);
        return [config.layer_key, buildRoute(config, collection)];
      })
    );

    state.routeConfigs = configs;
    state.routes = Object.fromEntries(entries);
    renderRouteSelect();
  }

  async function init() {
    state.map = L.map("analysisMap", {
      center: APP_CONFIG.map.center,
      zoom: APP_CONFIG.map.zoom,
      minZoom: APP_CONFIG.map.minZoom,
      preferCanvas: true,
      zoomControl: true,
    });

    L.tileLayer(
      APP_CONFIG.basemaps.ancient.url,
      APP_CONFIG.basemaps.ancient.options,
    ).addTo(state.map);

    addHillshadeLayer();

    const [resources, eventCollection] = await Promise.all([
      DataService.getResources(),
      DataService.getEvents(),
    ]);

    state.resources = resources;
    state.events = eventCollection.features.map(normalizeEvent);

    await loadRoutes();

    showRoute(state.routeConfigs[0].layer_key);

    state.resourceLayer = L.layerGroup(
      state.resources.map(resource => {
        const eventLike = {
          ...resource,
          type: "resource",
          date: resource.level,
          importance: 4,
        };

        return L.marker([resource.lat, resource.lng], {
          icon: MapUtils.eventIcon(eventLike),
        }).bindPopup(MapUtils.eventPopup(eventLike));
      }),
    ).addTo(state.map);

    document.dispatchEvent(new Event("analysismapready"));
  }

  function addHillshadeLayer() {
    const hillshade = APP_CONFIG.basemaps?.hillshade;

    if (!hillshade?.url) {
      return;
    }

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

  /* ---------- 修改点 3：使用 parts 逐段绘制 ---------- */
  function showRoute(routeId) {
    if (state.routeLayer) {
      state.map.removeLayer(state.routeLayer);
    }

    const route = state.routes[routeId] || Object.values(state.routes)[0];
    if (!route) return;

    const fg = L.featureGroup();
    route.parts.forEach(part => {
      L.polyline(part, {
        color: "#f0cf7a",
        weight: 10,
        opacity: 0.32,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(fg);
      L.polyline(part, {
        color: route.color || "#a72b22",
        weight: 4,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(fg);
    });

    state.routeLayer = fg.addTo(state.map);
    if (fg.getBounds().isValid()) {
      state.map.fitBounds(fg.getBounds(), { padding: [35, 35] });
    }
  }

  function clearResult() {
    if (!state.resultLayer) return;
    state.map.removeLayer(state.resultLayer);
    state.resultLayer = null;
  }

function drawBuffer(route, radius) {
  // 将多条子线段转为 MultiLineString，避免错误连接
  const multiLine = turf.multiLineString(
    route.parts.map(part => part.map(p => [p[1], p[0]]))
  );
  let polygon;
  try {
    // 尝试直接对 MultiLineString 做缓冲（turf 6+ 支持）
    polygon = turf.buffer(multiLine, Number(radius), { units: "kilometers" });
  } catch (e) {
    // 若不支持，则逐段缓冲后合并
    const buffers = route.parts.map(part => {
      const line = turf.lineString(part.map(p => [p[1], p[0]]));
      return turf.buffer(line, Number(radius), { units: "kilometers" });
    });
    // 使用 union 依次合并所有多边形
    polygon = buffers.reduce((acc, cur) => {
      if (!acc) return cur;
      return turf.union(acc, cur);
    }, null);
  }

  state.resultLayer = L.geoJSON(polygon, {
    style: {
      color: "#a72b22",
      weight: 2,
      fillColor: "#d28b4c",
      fillOpacity: 0.28,
    },
  }).addTo(state.map);

  state.map.fitBounds(state.resultLayer.getBounds());
}

  function drawResourceRelation() {
    const layers = [];
    state.resources.forEach(resource => {
      layers.push(
        L.circle([resource.lat, resource.lng], {
          radius: 52000,
          color: "#d8a84f",
          weight: 1,
          opacity: 0.35,
          fillColor: "#a8261d",
          fillOpacity: 0.1,
        }),
        L.circle([resource.lat, resource.lng], {
          radius: 18000,
          color: "#f2d799",
          weight: 1,
          opacity: 0.45,
          fillColor: "#d34a35",
          fillOpacity: 0.28,
        })
      );
    });

    state.resultLayer = L.layerGroup(layers).addTo(state.map);
  }

  function drawNodes() {
    state.resultLayer = L.layerGroup(
      state.events.map(event => {
        return L.circleMarker([event.lat, event.lng], {
          radius: 4 + event.importance,
          color: "#f2d799",
          weight: 1,
          fillColor: event.type === "battle" ? "#a72b22" : "#b98327",
          fillOpacity: 0.8,
        });
      }),
    ).addTo(state.map);
  }

  function drawTerrainSamples(route) {
    const samples = route.points.filter((_, index) => index % 180 === 0);
    const colors = ["#6c8b6d", "#c09242", "#9e3528"];

    state.resultLayer = L.layerGroup(
      samples.map((point, index) => {
        return L.circleMarker(point, {
          radius: 9,
          color: "#f1d899",
          weight: 2,
          fillColor: colors[index % colors.length],
          fillOpacity: 0.65,
        });
      }),
    ).addTo(state.map);
  }

  function drawRouteHighlight(route) {
    const layers = [];

    route.parts.forEach((part) => {
      layers.push(
        L.polyline(part, {
          color: "#f6d56f",
          weight: 12,
          opacity: 0.34,
          lineCap: "round",
          lineJoin: "round",
        }),
        L.polyline(part, {
          color: "#ffffff",
          weight: 3,
          opacity: 0.36,
          dashArray: "8 10",
          lineCap: "round",
          lineJoin: "round",
        }),
      );
    });

    state.resultLayer = L.layerGroup(layers).addTo(state.map);
  }

  function drawResult(tool, radius = 10, routeId = null) {
    clearResult();

    const selectedRouteId = routeId || document.getElementById("routeSelect").value;
    const route = state.routes[selectedRouteId] || Object.values(state.routes)[0];

    if (tool === "buffer" && window.turf) {
      drawBuffer(route, radius);
      return;
    }

    if (tool === "resource") {
      drawResourceRelation();
      return;
    }

    if (tool === "node") {
      drawNodes();
      return;
    }

    if (tool === "terrain") {
      drawTerrainSamples(route);
      return;
    }

    drawRouteHighlight(route);
  }

  window.AnalysisMap = {
    state,
    showRoute,
    drawResult,
    clearResult,
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
  });
})();
