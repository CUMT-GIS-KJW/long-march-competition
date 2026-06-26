(function () {
  const FIELD = {
    id: "\u4e8b\u4ef6\u7f16",
    place: "\u5730\u540d",
    event: "\u4e8b\u4ef6",
    stage: "\u4e8b\u4ef6\u9636",
    unit: "\u5173\u8054\u90e8",
    date: "\u4e8b\u4ef6\u65e5",
    type: "\u4e8b\u4ef6\u7c7b",
    people: "\u961f\u4f0d\u603b",
  };

  const routeUnitKeywords = {
    route_zhongyang_zongdui: ["\u4e2d\u592e\u7eb5\u961f", "\u4e2d\u592e\u7ea2\u519b"],
    route_hongyi_juntuan: ["\u7ea2\u4e00\u519b\u56e2"],
    route_hongqi_juntuan: ["\u7ea2\u4e03\u519b\u56e2"],
    route_hongsan_juntuan: ["\u7ea2\u4e09\u519b\u56e2"],
    route_hongsanshi_jun: ["\u7ea2\u4e09\u5341\u519b"],
    route_hongjiu_juntuan: ["\u7ea2\u4e5d\u519b\u56e2"],
    route_honger_juntuan: ["\u7ea2\u4e8c\u519b\u56e2", "\u7ea2\u4e8c\u65b9\u9762\u519b"],
    route_hongershiwu_jun: ["\u7ea2\u4e8c\u5341\u4e94\u519b"],
    route_hongwu_juntuan: ["\u7ea2\u4e94\u519b\u56e2"],
    route_hongliu_juntuan: ["\u7ea2\u516d\u519b\u56e2"],
    route_hongshiba_shi: ["\u7ea2\u5341\u516b\u5e08"],
    route_hongsi_juntuan: ["\u7ea2\u56db\u519b\u56e2", "\u7ea2\u56db\u65b9\u9762\u519b"],
  };

  const state = {
    map: null,
    routeConfigs: [],
    routeLayers: {},
    eventFeatures: [],
    eventTimeline: [],
    eventMarkers: new Map(),
    tourismResources: [],
    tourismMarkers: new Map(),
    eventLayerGroup: null,
    tourismLayerGroup: null,
    movingPeopleLayer: null,
    animatedRouteLayer: null,
    eventTimer: 0,
    routeTimer: 0,
    activeEventIndex: 0,
    activeEventFilter: "all",
    eventsVisible: true,
    activeRouteKey: "",
    isPlayingEvents: false,
    isPlayingRoute: false,
  };

  const $ = (selector) => document.querySelector(selector);

  function flash(message) {
    const toast = $("#toast");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 1500);
  }

  function featureId(feature) {
    return String(feature.properties?.[FIELD.id] ?? JSON.stringify(feature.geometry));
  }

  function featureLatLng(feature) {
    const coordinates = feature.geometry?.coordinates || [0, 0];

    return [coordinates[1], coordinates[0]];
  }

  function includesAny(text, keywords) {
    return keywords.some((keyword) => {
      return text.includes(keyword);
    });
  }

  function getEventDisplayType(feature) {
    const props = feature.properties || {};
    const typeText = String(props[FIELD.type] || "");
    const eventText = String(props[FIELD.event] || "");
    const placeText = String(props[FIELD.place] || "");
    const text = `${typeText} ${eventText} ${placeText}`;

    if (includesAny(text, ["\u4f1a\u5e08", "\u6c47\u5408", "\u80dc\u5229\u4f1a\u5e08"])) {
      return "join";
    }

    if (includesAny(text, ["\u6218\u5f79", "\u6218\u6597", "\u653b\u5360", "\u5f3a\u6e21", "\u98de\u593a", "\u7a81\u7834", "\u963b\u51fb"])) {
      return "battle";
    }

    if (includesAny(text, ["\u4f1a\u8bae", "\u51b3\u7b56", "\u653f\u6cbb\u5c40", "\u90e8\u7f72"])) {
      return "meeting";
    }

    if (includesAny(text, ["\u6e21", "\u6c5f", "\u6cb3", "\u8d64\u6c34", "\u91d1\u6c99\u6c5f", "\u5927\u6e21\u6cb3", "\u4e4c\u6c5f"])) {
      return "river";
    }

    if (includesAny(text, ["\u96ea\u5c71", "\u8349\u5730", "\u5939\u91d1\u5c71", "\u7ffb\u8d8a", "\u6cbc\u6cfd", "\u814a\u5b50\u53e3"])) {
      return "mountain";
    }

    return "other";
  }

  function getTroopCount(feature, index, total) {
    const rawValue = Number(feature.properties?.[FIELD.people]);

    if (Number.isFinite(rawValue) && rawValue > 0) {
      return {
        value: rawValue,
        estimated: false,
      };
    }

    const progress = total <= 1 ? 0 : index / (total - 1);
    const estimated = Math.round((86000 - 79000 * progress) / 1000) * 1000;

    return {
      value: Math.max(5000, estimated),
      estimated: true,
    };
  }

  function enrichEvents(events) {
    const unique = new Map();

    events.forEach((feature) => {
      const id = featureId(feature);

      if (!unique.has(id)) {
        unique.set(id, feature);
      }
    });

    return [...unique.values()].map((feature, index, list) => {
      return {
        ...feature,
        displayType: getEventDisplayType(feature),
        displayTroop: getTroopCount(feature, index, list.length),
        timelineIndex: index,
      };
    });
  }

  function eventMatchesRoute(feature, routeKey) {
    const keywords = routeUnitKeywords[routeKey] || [];

    if (!routeKey || !keywords.length) {
      return true;
    }

    const unit = String(feature.properties?.[FIELD.unit] || "");

    return includesAny(unit, keywords);
  }

  function getFilteredEvents() {
    return state.eventFeatures;
  }

  function getRepresentativeEvents() {
    return getFilteredEvents();
  }

  function getEventMarkerRadius(count) {
    if (count >= 80000) {
      return 11;
    }

    if (count >= 50000) {
      return 9;
    }

    if (count >= 30000) {
      return 8;
    }

    if (count >= 10000) {
      return 7;
    }

    return 6;
  }

  function initMap() {
    state.map = L.map("map", {
      center: APP_CONFIG.map.center,
      zoom: APP_CONFIG.map.zoom,
      minZoom: APP_CONFIG.map.minZoom,
      maxZoom: APP_CONFIG.map.maxZoom,
      zoomControl: true,
    });

    L.tileLayer(
      APP_CONFIG.basemaps.ancient.url,
      APP_CONFIG.basemaps.ancient.options,
    ).addTo(state.map);
  }

  function initLayerGroups() {
    state.eventLayerGroup = L.layerGroup().addTo(state.map);
    state.tourismLayerGroup = L.layerGroup().addTo(state.map);
    state.movingPeopleLayer = L.layerGroup().addTo(state.map);
    state.animatedRouteLayer = L.layerGroup().addTo(state.map);
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

  function flattenLatLngs(latLngs) {
    if (!latLngs.length) {
      return [];
    }

    if (Array.isArray(latLngs[0][0])) {
      return latLngs.flat();
    }

    return latLngs;
  }

  function renderRouteControls() {
    $("#routeLayerList").innerHTML = state.routeConfigs
      .map((config) => {
        const checked = config.default_visible ? "checked" : "";

        return `
          <label>
            <input type="checkbox" data-route-layer="${config.layer_key}" ${checked}>
            <span>${config.layer_name}</span>
          </label>
        `;
      })
      .join("");

    $("#routeSelect").innerHTML = state.routeConfigs
      .map((config) => {
        return `<option value="${config.layer_key}">${config.layer_name}</option>`;
      })
      .join("");
  }

  async function renderRouteLayer(config) {
    const collection = await DataService.getRouteLayerFeatures(config.layer_key);
    const layerGroup = L.featureGroup();

    collection.features.forEach((feature) => {
      const latLngs = toLatLngs(feature.geometry);

      if (!latLngs.length) {
        return;
      }

      L.polyline(latLngs, {
        color: "#f9ddb0",
        weight: Number(config.line_width || 3) + 4,
        opacity: 0.32,
        lineCap: "round",
        interactive: false,
      }).addTo(layerGroup);

      L.polyline(latLngs, {
        color: config.color || "#b42318",
        weight: Number(config.line_width || 3),
        opacity: 0.88,
        lineCap: "round",
        lineJoin: "round",
      })
        .on("click", () => {
          setActiveRouteFilter(config.layer_key);
          renderRouteDetail(feature, config);
        })
        .addTo(layerGroup);
    });

    state.routeLayers[config.layer_key] = {
      config,
      collection,
      layerGroup,
      visible: Boolean(config.default_visible),
    };

    if (config.default_visible) {
      layerGroup.addTo(state.map);
    }
  }

  function toggleRouteLayer(layerKey, visible) {
    const item = state.routeLayers[layerKey];

    if (!item) {
      return;
    }

    item.visible = visible;

    if (visible) {
      item.layerGroup.addTo(state.map);
    } else {
      state.map.removeLayer(item.layerGroup);
    }

    setActiveRouteFilter(layerKey);
  }

  function createEventIcon(feature) {
    const type = feature.displayType || "other";
    const count = feature.displayTroop?.value || 0;
    const radius = getEventMarkerRadius(count);
    const diameter = radius * 2;

    return L.divIcon({
      className: "",
      html: `<div class="event-marker ${type}" style="width:${diameter}px;height:${diameter}px"></div>`,
      iconSize: [diameter, diameter],
      iconAnchor: [radius, radius],
    });
  }

  function renderEventMarkers() {
    const events = getFilteredEvents();

    state.eventLayerGroup.clearLayers();
    state.eventMarkers.clear();

    events.forEach((feature, index) => {
      const marker = L.marker(featureLatLng(feature), {
        icon: createEventIcon(feature),
        zIndexOffset: 600 + index,
      });

      marker.on("click", () => {
        state.activeEventIndex = index;
        activateEvent(feature, true);
      });

      marker.addTo(state.eventLayerGroup);
      state.eventMarkers.set(featureId(feature), marker);
    });
  }

  function getTourismCategory(resource) {
    const text = `${resource.name || ""} ${resource.type || ""} ${resource.business_area || ""}`;

    if (includesAny(text, ["\u7eaa\u5ff5\u9986", "\u535a\u7269\u9986", "\u5c55\u89c8\u9986"])) {
      return "museum";
    }

    if (includesAny(text, ["\u4f1a\u5740", "\u65e7\u5740", "\u9057\u5740", "\u6545\u5c45", "\u4f4f\u5c45"])) {
      return "site";
    }

    if (includesAny(text, ["\u666f\u533a", "\u98ce\u666f", "\u666f\u70b9"])) {
      return "scenic";
    }

    return "other";
  }

  function renderTourismControls() {
    const list = $("#resourceLayerList");
    const preferredPatterns = [
      /\u9075\u4e49\u4f1a\u8bae\u4f1a\u5740/,
      /\u6cf8\u5b9a\u6865/,
      /\u745e\u91d1\u4e2d\u592e\u9769\u547d\u6839\u636e\u5730\u7eaa\u5ff5\u9986|\u745e\u91d1/,
    ];
    const preferredResources = preferredPatterns
      .map((pattern) => {
        return state.tourismResources.find((resource) => {
          return pattern.test(resource.name || "");
        });
      })
      .filter(Boolean);
    const children = preferredResources
      .map((resource) => {
        return `
          <label>
            <input type="checkbox" data-resource-id="${resource.id}" checked>
            <span>${resource.name}</span>
          </label>
        `;
      })
      .join("");

    list.innerHTML = `
      <label>
        <input type="checkbox" id="tourismLayerToggle" checked>
        <span>\u663e\u793a\u7ea2\u8272\u8d44\u6e90</span>
      </label>
      ${children}
    `;
  }

  function renderTourismMarkers() {
    const controlledInputs = [...document.querySelectorAll("input[data-resource-id]")];
    const controlledIds = new Set(
      controlledInputs.map((input) => {
        return input.dataset.resourceId;
      }),
    );
    const checkedIds = new Set(
      controlledInputs.filter((input) => {
        return input.checked;
      }).map((input) => {
        return input.dataset.resourceId;
      }),
    );

    state.tourismLayerGroup.clearLayers();
    state.tourismMarkers.clear();

    state.tourismResources.forEach((resource) => {
      if (controlledIds.has(resource.id) && !checkedIds.has(resource.id)) {
        return;
      }

      const category = getTourismCategory(resource);
      const marker = L.marker([resource.lat, resource.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="tourism-marker ${category}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
        zIndexOffset: 460,
      });

      marker.on("click", () => {
        renderTourismDetail(resource);
      });

      marker.addTo(state.tourismLayerGroup);
      state.tourismMarkers.set(resource.id, marker);
    });
  }

  function renderPeopleIcons(troopCount, estimated) {
    const iconCount = Math.max(1, Math.min(8, Math.round(troopCount / 12000)));
    const label = `\u7ea6 ${Math.max(1, Math.round(troopCount / 10000))} \u4e07\u4eba`;
    const suffix = estimated ? "\uff08\u4f30\u7b97\uff09" : "";

    return `
      <div class="people-icons">
        <span class="icons">${"\ud83d\udc65".repeat(iconCount)}</span>
        <strong>${label}${suffix}</strong>
      </div>
    `;
  }

  function updateMovingPeople(feature, troopInfo) {
    const iconCount = Math.max(1, Math.min(5, Math.round(troopInfo.value / 18000)));

    state.movingPeopleLayer.clearLayers();

    L.marker(featureLatLng(feature), {
      icon: L.divIcon({
        className: "",
        html: `
          <div class="moving-people">
            <b>${"\ud83d\udc65".repeat(iconCount)}</b>
            <span>${Math.round(troopInfo.value / 10000)}\u4e07${troopInfo.estimated ? "\u00b7\u4f30" : ""}</span>
          </div>
        `,
        iconSize: [90, 34],
        iconAnchor: [45, 52],
      }),
      zIndexOffset: 520,
      interactive: false,
    }).addTo(state.movingPeopleLayer);
  }

  function clearMovingPeople() {
    state.movingPeopleLayer.clearLayers();
  }

  function renderDefaultDetail() {
    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">WEBGIS SYSTEM</span>
        <h2>\u7ea2\u56fe\u7ed8\u957f\u5f81</h2>
        <p>\u5de6\u4fa7\u63a7\u5236\u8def\u7ebf\u3001\u4e8b\u4ef6\u7c7b\u578b\u4e0e\u7ea2\u8272\u8d44\u6e90\uff1b\u8def\u7ebf\u4fdd\u6301\u72ec\u7acb SHP \u56fe\u5c42\uff0c\u4e8b\u4ef6\u6309\u519b\u56e2\u5173\u8054\u548c\u961f\u4f0d\u4eba\u6570\u8282\u70b9\u5c55\u793a\u3002</p>
      </article>
    `;
  }

  function renderEventDetail(feature, troopInfo) {
    const props = feature.properties || {};
    const description = props.descript || props[FIELD.event] || "";

    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">\u4e8b\u4ef6\u8be6\u60c5</span>
        <h2>${props[FIELD.place] || "\u672a\u547d\u540d\u4e8b\u4ef6"}</h2>
        <div class="detail-grid">
          <div class="detail-row"><span>\u4e8b\u4ef6\u7f16\u53f7</span><b>${props[FIELD.id] || "-"}</b></div>
          <div class="detail-row"><span>\u4e8b\u4ef6\u65e5</span><b>${props[FIELD.date] || "-"}</b></div>
          <div class="detail-row"><span>\u5730\u540d</span><b>${props[FIELD.place] || "-"}</b></div>
          <div class="detail-row"><span>\u5173\u8054\u90e8\u961f</span><b>${props[FIELD.unit] || "-"}</b></div>
          <div class="detail-row"><span>\u4e8b\u4ef6\u7c7b</span><b>${props[FIELD.type] || "-"}</b></div>
          <div class="detail-row"><span>\u961f\u4f0d\u603b\u6570</span><b>${troopInfo.value.toLocaleString("zh-CN")} \u4eba${troopInfo.estimated ? "\uff08\u4f30\u7b97\uff09" : ""}</b></div>
        </div>
        ${renderPeopleIcons(troopInfo.value, troopInfo.estimated)}
        <h3>\u5386\u53f2\u53d9\u4e8b</h3>
        <p>${description}</p>
      </article>
    `;
  }

  function renderRouteDetail(feature, config) {
    const props = feature.properties || {};

    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">\u8def\u7ebf\u8be6\u60c5</span>
        <h2>${config.layer_name}</h2>
        <div class="detail-grid">
          <div class="detail-row"><span>\u56fe\u5c42</span><b>${config.layer_name}</b></div>
          <div class="detail-row"><span>\u519b\u56e2</span><b>${props.corps_name || "-"}</b></div>
          <div class="detail-row"><span>\u9636\u6bb5</span><b>${props.stage_name || "-"}</b></div>
          <div class="detail-row"><span>_order</span><b>${props._order ?? "-"}</b></div>
          <div class="detail-row"><span>\u8d77\u6b62\u65f6\u95f4</span><b>${props.start_date || "-"} \u2014 ${props.end_date || "-"}</b></div>
          <div class="detail-row"><span>\u957f\u5ea6</span><b>${props.Shape_Leng ?? "-"}</b></div>
        </div>
        <p>${props.descript || props.descriptio || "\u8be5\u8def\u7ebf\u6bb5\u6682\u65e0\u8bf4\u660e\u5b57\u6bb5\u3002"}</p>
      </article>
    `;
  }

  function renderTourismDetail(resource) {
    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">\u7ea2\u8272\u8d44\u6e90</span>
        <h2>${resource.name}</h2>
        <div class="detail-grid">
          <div class="detail-row"><span>\u7c7b\u578b</span><b>${resource.type || "-"}</b></div>
          <div class="detail-row"><span>\u5730\u5740</span><b>${resource.address || "-"}</b></div>
          <div class="detail-row"><span>\u7701\u5e02</span><b>${resource.pname || resource.province || ""}${resource.cityname || resource.city ? "\u00b7" + (resource.cityname || resource.city) : ""}</b></div>
          <div class="detail-row"><span>\u5546\u5708</span><b>${resource.business_area || "-"}</b></div>
          <div class="detail-row"><span>\u5750\u6807</span><b>${resource.lng}, ${resource.lat}</b></div>
        </div>
      </article>
    `;
  }

  function updatePlayStatus(feature) {
    const props = feature.properties || {};

    $("#playStatusTitle").textContent =
      `${props[FIELD.date] || ""} ${props[FIELD.place] || props[FIELD.event] || ""}`.trim();
  }

  function highlightEventMarker(feature) {
    state.eventMarkers.forEach((marker) => {
      marker.getElement()?.querySelector(".event-marker")?.classList.remove("active");
    });

    state.eventMarkers
      .get(featureId(feature))
      ?.getElement()
      ?.querySelector(".event-marker")
      ?.classList.add("active");
  }

  function activateEvent(feature, focusMap) {
    const troopInfo = feature.displayTroop || getTroopCount(feature, 0, 1);

    highlightEventMarker(feature);
    updateMovingPeople(feature, troopInfo);
    renderEventDetail(feature, troopInfo);
    updatePlayStatus(feature);

    if (focusMap) {
      state.map.flyTo(featureLatLng(feature), Math.max(state.map.getZoom(), 7), {
        duration: 0.55,
      });
    }
  }

  function pauseAnimation() {
    state.isPlayingEvents = false;
    state.isPlayingRoute = false;
    clearInterval(state.eventTimer);
    clearInterval(state.routeTimer);
  }

  function playEventsTimeline() {
    pauseAnimation();

    const events = getFilteredEvents();

    if (!events.length) {
      flash("\u5f53\u524d\u8def\u7ebf\u6ca1\u6709\u53ef\u64ad\u653e\u4e8b\u4ef6");
      return;
    }

    state.isPlayingEvents = true;

    const step = () => {
      if (!state.isPlayingEvents) {
        return;
      }

      if (state.activeEventIndex >= events.length) {
        state.activeEventIndex = 0;
        pauseAnimation();
        $("#progressRange").value = "100";
        return;
      }

      const feature = events[state.activeEventIndex];
      activateEvent(feature, true);
      $("#progressRange").value = String(
        Math.round(((state.activeEventIndex + 1) / events.length) * 100),
      );
      state.activeEventIndex += 1;
    };

    step();
    state.eventTimer = setInterval(step, 1100);
  }

  function playPrevious() {
    const events = getFilteredEvents();

    pauseAnimation();
    state.activeEventIndex = Math.max(0, state.activeEventIndex - 1);

    if (events[state.activeEventIndex]) {
      activateEvent(events[state.activeEventIndex], true);
    }
  }

  function playNext() {
    const events = getFilteredEvents();

    pauseAnimation();
    state.activeEventIndex = Math.min(events.length - 1, state.activeEventIndex + 1);

    if (events[state.activeEventIndex]) {
      activateEvent(events[state.activeEventIndex], true);
    }
  }

  function buildRoutePoints(collection) {
    const sorted = [...collection.features].sort((left, right) => {
      return Number(left.properties?._order ?? 999999) - Number(right.properties?._order ?? 999999);
    });
    const points = [];
    const segments = [];

    sorted.forEach((feature) => {
      const latLngs = flattenLatLngs(toLatLngs(feature.geometry));
      const startIndex = points.length;

      latLngs.forEach((point) => {
        points.push(point);
      });

      if (latLngs.length) {
        segments.push({
          feature,
          startIndex,
          endIndex: points.length - 1,
        });
      }
    });

    return {
      points,
      segments,
    };
  }

  function findSegmentByPointIndex(segments, index) {
    return (
      segments.find((segment) => {
        return index >= segment.startIndex && index <= segment.endIndex;
      }) || segments[0]
    );
  }

  async function playSelectedRoute() {
    pauseAnimation();
    state.animatedRouteLayer.clearLayers();

    const layerKey = $("#routeSelect").value;
    const config = state.routeConfigs.find((item) => {
      return item.layer_key === layerKey;
    });
    const collection = await DataService.getRouteLayerAnimation(layerKey);
    const routeData = buildRoutePoints(collection);

    if (!config || routeData.points.length < 2) {
      return;
    }

    setActiveRouteFilter(layerKey);
    state.isPlayingRoute = true;

    const glow = L.polyline([], {
      color: "#ffd36b",
      weight: 11,
      opacity: 0.28,
      interactive: false,
    }).addTo(state.animatedRouteLayer);
    const line = L.polyline([], {
      color: config.color,
      weight: Number(config.line_width || 4) + 2,
      opacity: 0.98,
      className: "animated-route",
      interactive: false,
    }).addTo(state.animatedRouteLayer);

    state.map.fitBounds(L.latLngBounds(routeData.points), {
      padding: [36, 36],
    });

    let index = 0;

    const step = () => {
      if (!state.isPlayingRoute) {
        return;
      }

      const count = Math.max(2, Math.ceil(routeData.points.length / 150));
      index = Math.min(routeData.points.length - 1, index + count);
      glow.setLatLngs(routeData.points.slice(0, index + 1));
      line.setLatLngs(routeData.points.slice(0, index + 1));

      const segment = findSegmentByPointIndex(routeData.segments, index);

      if (segment) {
        renderRouteDetail(segment.feature, config);
      }

      $("#playStatusTitle").textContent =
        `${config.layer_name}  _order ${segment?.feature.properties?._order ?? "-"}`;
      $("#progressRange").value = String(
        Math.round((index / (routeData.points.length - 1)) * 100),
      );

      if (index >= routeData.points.length - 1) {
        pauseAnimation();
      }
    };

    step();
    state.routeTimer = setInterval(step, 70);
  }

  function setEventFilter(type) {
    state.activeEventFilter = type || "all";
    state.activeEventIndex = 0;
    clearMovingPeople();
    renderEventMarkers();
  }

  function setEventLayerVisible(visible) {
  state.eventsVisible = visible;

  if (visible) {
    if (!state.map.hasLayer(state.eventLayerGroup)) {
      state.eventLayerGroup.addTo(state.map);
    }
    return;
  }

  pauseAnimation();
  clearMovingPeople();

  if (state.map.hasLayer(state.eventLayerGroup)) {
    state.map.removeLayer(state.eventLayerGroup);
  }
}

  function setActiveRouteFilter(layerKey) {
    state.activeRouteKey = layerKey || "";
    state.activeEventIndex = 0;
    clearMovingPeople();
    renderEventMarkers();
  }

  function resetView() {
    const bounds = L.latLngBounds([]);

    Object.values(state.routeLayers).forEach((item) => {
      if (item.visible && item.layerGroup.getBounds().isValid()) {
        bounds.extend(item.layerGroup.getBounds());
      }
    });

    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [30, 30],
      });
    }
  }

  async function initApp() {
    initMap();
    initLayerGroups();
    renderDefaultDetail();

    state.routeConfigs = await DataService.getRouteLayers();
    state.activeRouteKey = state.routeConfigs[0]?.layer_key || "";
    renderRouteControls();

    await Promise.all(
      state.routeConfigs.map((config) => {
        return renderRouteLayer(config);
      }),
    );

    const events = await DataService.getEventTimeline();
    state.eventTimeline = enrichEvents(events.features || []);
    state.eventFeatures = state.eventTimeline;
    renderEventMarkers();

    state.tourismResources = await DataService.getRedTourismResources();
    renderTourismControls();
    renderTourismMarkers();

    resetView();
  }

  window.IndexMap = {
    state,
    initApp,
    resetView,
    toggleRouteLayer,
    setEventFilter,
    setActiveRouteFilter,
    setEventLayerVisible,
    renderTourismMarkers,
    playEventsTimeline,
    playSelectedRoute,
    playPrevious,
    playNext,
    pauseAnimation,
    flash,
  };
})();
