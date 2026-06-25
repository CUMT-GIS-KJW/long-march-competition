(function () {
  const EVENT_FIELD = {
    id: "\u4e8b\u4ef6\u7f16",
    name: "\u5730\u540d",
    description: "\u4e8b\u4ef6",
    stage: "\u4e8b\u4ef6\u9636",
    unit: "\u5173\u8054\u90e8",
    date: "\u4e8b\u4ef6\u65e5",
    type: "\u4e8b\u4ef6\u7c7b",
    people: "\u961f\u4f0d\u603b",
  };

  const state = {
    map: null,
    events: [],
    routeConfigs: [],
    resources: [],
    markers: new Map(),
    routeLayers: {},
    resourceLayer: null,
    photoLayer: null,
    animator: null,
    activeRouteKey: "",
    baseLayer: null,
    baseKey: "ancient",
  };

  function createBaseLayer(key) {
    const definition = APP_CONFIG.basemaps[key];

    return L.tileLayer(definition.url, definition.options);
  }

  function setBase(key) {
    if (state.baseLayer) {
      state.map.removeLayer(state.baseLayer);
    }

    state.baseLayer = createBaseLayer(key);
    state.baseLayer.addTo(state.map);
    state.baseLayer.bringToBack();
    state.baseKey = key;

    const mapArea = document.getElementById("mapArea");
    mapArea.classList.remove(
      "basemap-ancient",
      "basemap-standard",
      "basemap-satellite",
    );
    mapArea.classList.add(`basemap-${key}`);

    document.querySelectorAll("#basemapMenu button").forEach((button) => {
      button.classList.toggle("active", button.dataset.map === key);
    });
  }

  function readValue(properties, key, fallback = "") {
    return properties[key] ?? fallback;
  }

  function normalizeEvent(feature) {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [0, 0];
    const people = Number(readValue(properties, EVENT_FIELD.people, 0)) || 0;
    const eventClass = String(
      readValue(properties, EVENT_FIELD.type, "\u4e8b\u4ef6"),
    );

    return {
      id: `event-${readValue(properties, EVENT_FIELD.id, coordinates.join("-"))}`,
      name: readValue(properties, EVENT_FIELD.name, "\u672a\u547d\u540d\u4e8b\u4ef6\u70b9"),
      date: readValue(properties, EVENT_FIELD.date, ""),
      type: normalizeEventType(eventClass),
      stage: readValue(properties, EVENT_FIELD.stage, "\u672a\u5206\u9636\u6bb5"),
      tag: eventClass,
      province: readValue(properties, EVENT_FIELD.unit, ""),
      city: readValue(properties, EVENT_FIELD.name, ""),
      lat: coordinates[1],
      lng: coordinates[0],
      people,
      importance: getPeopleImportance(people),
      description: readValue(properties, EVENT_FIELD.description, ""),
      quote: "",
      originalProperties: properties,
      figures: [
        {
          label: "\u4e8b\u4ef6\u65e5",
          value: readValue(properties, EVENT_FIELD.date, "\u672a\u5f55\u5165"),
        },
        {
          label: "\u4e8b\u4ef6\u7c7b\u578b",
          value: eventClass,
        },
        {
          label: "\u5173\u8054\u90e8\u961f",
          value: readValue(properties, EVENT_FIELD.unit, "\u672a\u5f55\u5165"),
        },
        {
          label: "\u961f\u4f0d\u603b\u4eba\u6570",
          value: people ? `${people.toLocaleString()} \u4eba` : "\u672a\u5f55\u5165",
        },
      ],
    };
  }

  function normalizeEventType(eventClass) {
    if (eventClass.includes("\u6218") || eventClass.includes("\u7a81\u7834")) {
      return "battle";
    }

    if (eventClass.includes("\u4f1a") || eventClass.includes("\u4f1a\u8bae")) {
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
      return geometry.coordinates.map((line) => {
        return line.map((coordinate) => {
          return [coordinate[1], coordinate[0]];
        });
      });
    }

    return [];
  }

  function flattenLineLatLngs(latLngs) {
    if (!latLngs.length) {
      return [];
    }

    if (Array.isArray(latLngs[0][0])) {
      return latLngs.flat();
    }

    return latLngs;
  }

  function buildRouteAnimationData(config, collection) {
    const points = [];
    const segments = [];

    collection.features.forEach((feature) => {
      const latLngs = flattenLineLatLngs(toLatLngs(feature.geometry));

      if (!latLngs.length) {
        return;
      }

      const startIndex = points.length;

      latLngs.forEach((point) => {
        const previous = points[points.length - 1];

        if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) {
          points.push(point);
        }
      });

      segments.push({
        startIndex,
        endIndex: points.length - 1,
        properties: feature.properties,
      });
    });

    return {
      id: config.layer_key,
      name: config.layer_name,
      color: config.color,
      weight: Number(config.line_width || 4) + 2,
      points,
      segments,
    };
  }

  function addRouteFeature(config, feature, layerGroup) {
    const latLngs = toLatLngs(feature.geometry);

    if (!latLngs.length) {
      return;
    }

    L.polyline(latLngs, {
      color: "#f1d89a",
      weight: Number(config.line_width || 3) + 4,
      opacity: 0.35,
      lineCap: "round",
      interactive: false,
    }).addTo(layerGroup);

    L.polyline(latLngs, {
      color: config.color,
      weight: Number(config.line_width || 3),
      opacity: 0.78,
      lineCap: "round",
      lineJoin: "round",
    })
      .bindTooltip(config.layer_name, {
        sticky: true,
        direction: "top",
      })
      .addTo(layerGroup);
  }

  async function addRouteLayer(config) {
    const collection = await DataService.getRouteLayerFeatures(config.layer_key);
    const layerGroup = L.featureGroup();

    collection.features.forEach((feature) => {
      addRouteFeature(config, feature, layerGroup);
    });

    state.routeLayers[config.layer_key] = {
      config,
      layerGroup,
      features: collection.features,
      visible: Boolean(config.default_visible),
    };

    if (config.default_visible) {
      layerGroup.addTo(state.map);
    }
  }

  async function addRoutes() {
    await Promise.all(
      state.routeConfigs.map((config) => {
        return addRouteLayer(config);
      }),
    );
  }

  function addEvents(eventCollection) {
    state.events = eventCollection.features.map(normalizeEvent);

    state.events.forEach((event) => {
      const marker = L.marker([event.lat, event.lng], {
        icon: MapUtils.eventIcon(event),
        zIndexOffset: event.importance * 100,
      });

      marker.bindPopup(MapUtils.eventPopup(event));
      marker.on("click", () => {
        document.dispatchEvent(
          new CustomEvent("eventselect", {
            detail: event,
          }),
        );
      });

      marker.addTo(state.map);
      state.markers.set(event.id, marker);
    });

    state.map.on("zoomend", applyFilters);
  }

  function addResources(resources) {
    const markers = resources.map((resource) => {
      const eventLike = {
        ...resource,
        date: resource.level,
        type: "resource",
        importance: 4,
      };

      return L.marker([resource.lat, resource.lng], {
        icon: MapUtils.eventIcon(eventLike),
      }).bindPopup(MapUtils.eventPopup(eventLike));
    });

    state.resourceLayer = L.layerGroup(markers);
  }

  function createPhotoMarker(annotation) {
    const icon = L.divIcon({
      className: "lm-div-icon photo-icon",
      html: `
        <button class="map-photo ${annotation.className || ""}">
          <span class="drop-thumb">
            <img src="${annotation.image}" alt="${annotation.title}">
          </span>
          <span class="photo-copy">
            <b>${annotation.title}</b>
            <small>${annotation.caption}</small>
          </span>
        </button>
      `,
      iconSize: [48, 58],
      iconAnchor: [24, 54],
    });

    const marker = L.marker(annotation.card, {
      icon,
      zIndexOffset: 800,
      riseOnHover: true,
    });

    marker.on("click", () => {
      document.querySelectorAll(".map-photo.expanded").forEach((element) => {
        element.classList.remove("expanded");
      });

      const card = marker.getElement()?.querySelector(".map-photo");

      if (card) {
        card.classList.add("expanded");
        clearTimeout(card.closeTimer);
        card.closeTimer = setTimeout(() => {
          card.classList.remove("expanded");
        }, 6000);
      }
    });

    const leader = L.polyline([annotation.anchor, annotation.card], {
      color: "#9e2d23",
      weight: 1.5,
      dashArray: "4 4",
      opacity: 0.65,
      interactive: false,
    });

    return L.layerGroup([leader, marker]);
  }

  function addPhotoAnnotations() {
    const annotations = [
      {
        anchor: [26.3, 102.9],
        card: [25.55, 101.2],
        image: "assets/img/red-army-march.jpg",
        title: "\u7ea2\u519b\u884c\u519b\u5f71\u50cf",
        caption: "\u897f\u5357\u8def\u7ebf \u00b7 \u56fe\u50cf\u8d44\u6599",
      },
      {
        anchor: [30.958, 102.722],
        card: [31.72, 100.95],
        image: "assets/img/xueshan.jpg",
        title: "\u7ffb\u8d8a\u96ea\u5c71",
        caption: "\u96ea\u5c71\u9644\u8fd1 \u00b7 \u56fe\u50cf\u8d44\u6599",
        className: "snow",
      },
    ];

    state.photoLayer = L.layerGroup(
      annotations.map(createPhotoMarker),
    ).addTo(state.map);
  }

  function applyFilters() {
    const selectedType =
      document.querySelector("#typeFilters .on")?.dataset.type || "all";
    const selectedStage =
      document.getElementById("stageFilter")?.value || "all";
    const zoom = state.map.getZoom();

    const filtered = state.events.filter((event) => {
      const typeMatches =
        selectedType === "all" || event.type === selectedType;
      const stageMatches =
        selectedStage === "all" || event.stage === selectedStage;

      return typeMatches && stageMatches;
    });

    state.events.forEach((event) => {
      const minimumZoom =
        event.importance >= 5
          ? 4
          : event.importance === 4
            ? 6
            : event.importance === 3
              ? 7
              : event.importance === 2
                ? 8
                : 9;

      const shouldShow = filtered.includes(event) && zoom >= minimumZoom;
      const marker = state.markers.get(event.id);

      if (shouldShow && !state.map.hasLayer(marker)) {
        marker.addTo(state.map);
      }

      if (!shouldShow && state.map.hasLayer(marker)) {
        state.map.removeLayer(marker);
      }
    });

    document.dispatchEvent(
      new CustomEvent("filterchange", {
        detail: filtered,
      }),
    );
  }

  function activateEvent(event, focus = false) {
    state.markers.forEach((marker, id) => {
      marker
        .getElement()
        ?.querySelector(".lm-marker")
        ?.classList.toggle("is-active", id === event.id);
    });

    if (!focus) {
      return;
    }

    state.map.flyTo([event.lat, event.lng], Math.max(state.map.getZoom(), 7), {
      duration: 0.8,
    });

    const marker = state.markers.get(event.id);

    if (marker && state.map.hasLayer(marker)) {
      marker.openPopup();
    }
  }

  function getVisibleRouteBounds() {
    const bounds = L.latLngBounds([]);

    Object.values(state.routeLayers).forEach((item) => {
      if (item.visible) {
        const layerBounds = item.layerGroup.getBounds?.();

        if (layerBounds?.isValid()) {
          bounds.extend(layerBounds);
        }
      }
    });

    return bounds;
  }

  function reset() {
    const bounds = getVisibleRouteBounds();

    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [35, 35],
      });
    }
  }

  function toggleRoute(layerKey, show) {
    const layer = state.routeLayers[layerKey];

    if (!layer) {
      return;
    }

    layer.visible = show;

    if (show) {
      layer.layerGroup.addTo(state.map);
      return;
    }

    state.map.removeLayer(layer.layerGroup);
  }

  function zoomToRoute(layerKey) {
    const layer = state.routeLayers[layerKey];
    const bounds = layer?.layerGroup.getBounds?.();

    if (bounds?.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [42, 42],
      });
    }
  }

  async function playRoute(layerKey) {
    const config = state.routeConfigs.find((item) => {
      return item.layer_key === layerKey;
    });

    if (!config) {
      return;
    }

    if (state.animator) {
      state.animator.remove();
    }

    state.activeRouteKey = layerKey;

    const collection = await DataService.getRouteLayerAnimation(layerKey);
    const route = buildRouteAnimationData(config, collection);

    if (route.points.length < 2) {
      return;
    }

    state.animator = new RouteAnimator(state.map, route, {
      duration: 22000,
      onProgress(detail) {
        document.dispatchEvent(
          new CustomEvent("routeprogress", {
            detail,
          }),
        );
      },
      onComplete(detailRoute) {
        document.dispatchEvent(
          new CustomEvent("routecomplete", {
            detail: detailRoute,
          }),
        );
      },
    });

    zoomToRoute(layerKey);
    state.animator.play();
  }

  function toggleResources(show) {
    if (show) {
      state.resourceLayer.addTo(state.map);
      return;
    }

    state.map.removeLayer(state.resourceLayer);
  }

  async function init() {
    state.map = L.map("map", {
      center: APP_CONFIG.map.center,
      zoom: APP_CONFIG.map.zoom,
      minZoom: APP_CONFIG.map.minZoom,
      maxZoom: APP_CONFIG.map.maxZoom,
      zoomControl: true,
      attributionControl: true,
    });

    setBase("ancient");

    const [routeConfigs, eventCollection, resources] = await Promise.all([
      DataService.getRouteLayers(),
      DataService.getEvents(),
      DataService.getResources(),
    ]);

    state.routeConfigs = routeConfigs;
    state.resources = resources;

    await addRoutes();
    addEvents(eventCollection);
    addResources(resources);
    addPhotoAnnotations();
    reset();
    applyFilters();

    document.dispatchEvent(
      new CustomEvent("mapready", {
        detail: {
          events: state.events,
          routeConfigs,
          routeLayers: state.routeLayers,
          resources,
        },
      }),
    );
  }

  window.IndexMap = {
    state,
    init,
    applyFilters,
    setBase,
    activateEvent,
    focusEvent(event) {
      activateEvent(event, true);
    },
    reset,
    toggleRoute,
    zoomToRoute,
    playRoute,
    toggleResources,
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error(error);
      document.getElementById("serviceState").textContent =
        "\u4e8c\u7ef4\u5730\u56fe\u52a0\u8f7d\u5931\u8d25";
    });
  });
})();
