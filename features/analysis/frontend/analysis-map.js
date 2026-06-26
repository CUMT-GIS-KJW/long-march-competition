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
    if (people >= 80000) {
      return 5;
    }

    if (people >= 50000) {
      return 4;
    }

    if (people >= 30000) {
      return 3;
    }

    if (people >= 10000) {
      return 2;
    }

    return 1;
  }

  function toLatLngs(geometry) {
    if (!geometry) {
      return [];
    }

    if (geometry.type === "LineString") {
      return geometry.coordinates.map((coordinate) => {
        return [coordinate[1], coordinate[0]];
      });
    }

    if (geometry.type === "MultiLineString") {
      return geometry.coordinates.flatMap((line) => {
        return line.map((coordinate) => {
          return [coordinate[1], coordinate[0]];
        });
      });
    }

    return [];
  }

  function buildRoute(config, collection) {
    const points = [];

    collection.features.forEach((feature) => {
      toLatLngs(feature.geometry).forEach((point) => {
        const previous = points[points.length - 1];

        if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
          points.push(point);
        }
      });
    });

    return {
      id: config.layer_key,
      name: config.layer_name,
      color: config.color,
      points,
      features: collection.features,
    };
  }

  function renderRouteSelect() {
    const routeSelect = document.getElementById("routeSelect");

    routeSelect.innerHTML = state.routeConfigs
      .map((config) => {
        return `<option value="${config.layer_key}">${config.layer_name}</option>`;
      })
      .join("");
  }

  async function loadRoutes() {
    const configs = await DataService.getRouteLayers();
    const entries = await Promise.all(
      configs.map(async (config) => {
        const collection = await DataService.getRouteLayerFeatures(
          config.layer_key,
        );

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
      zoom: APP_CONFIG.map.zoom,
      minZoom: APP_CONFIG.map.minZoom,
      zoomControl: true,
    });

    L.tileLayer(
      APP_CONFIG.basemaps.ancient.url,
      APP_CONFIG.basemaps.ancient.options,
    ).addTo(state.map);

    const [resources, eventCollection] = await Promise.all([
      DataService.getResources(),
      DataService.getEvents(),
    ]);

    state.resources = resources;
    state.events = eventCollection.features.map(normalizeEvent);

    await loadRoutes();

    showRoute(state.routeConfigs[0].layer_key);

    state.resourceLayer = L.layerGroup(
      state.resources.map((resource) => {
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

  function showRoute(routeId) {
    if (state.routeLayer) {
      state.map.removeLayer(state.routeLayer);
    }

    const route = state.routes[routeId] || Object.values(state.routes)[0];

    state.routeLayer = L.polyline(route.points, {
      color: route.color,
      weight: 5,
      opacity: 0.9,
    }).addTo(state.map);

    state.map.fitBounds(state.routeLayer.getBounds(), {
      padding: [35, 35],
    });
  }

  function clearResult() {
    if (!state.resultLayer) {
      return;
    }

    state.map.removeLayer(state.resultLayer);
    state.resultLayer = null;
  }

  function drawBuffer(route, radius) {
    const line = turf.lineString(
      route.points.map((point) => {
        return [point[1], point[0]];
      }),
    );
    const polygon = turf.buffer(line, Number(radius), {
      units: "kilometers",
    });

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

    state.resources.forEach((resource) => {
      layers.push(
        L.circle([resource.lat, resource.lng], {
          radius: 52000,
          color: "#d8a84f",
          weight: 1,
          opacity: 0.35,
          fillColor: "#a8261d",
          fillOpacity: 0.1,
        }),
      );
      layers.push(
        L.circle([resource.lat, resource.lng], {
          radius: 18000,
          color: "#f2d799",
          weight: 1,
          opacity: 0.45,
          fillColor: "#d34a35",
          fillOpacity: 0.28,
        }),
      );
    });

    state.resultLayer = L.layerGroup(layers).addTo(state.map);
  }

  function drawNodes() {
    state.resultLayer = L.layerGroup(
      state.events.map((event) => {
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
    const samples = route.points.filter((_, index) => {
      return index % 180 === 0;
    });
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
    state.resultLayer = L.polyline(route.points, {
      color: "#e6c66d",
      weight: 9,
      opacity: 0.38,
    }).addTo(state.map);
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
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch(console.error);
  });
})();
