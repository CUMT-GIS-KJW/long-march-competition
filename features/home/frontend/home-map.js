(function () {
  const FIELD = {
    id: "事件编号",
    place: "地名",
    event: "事件",
    stage: "事件阶段",
    unit: "关联部",
    date: "事件日",
    type: "事件类",
    people: "队伍总",
  };

  const routeUnitKeywords = {
    route_zhongyang_zongdui: ["中央纵队", "中央红军"],
    route_hongyi_juntuan: ["红一军团"],
    route_hongqi_juntuan: ["红七军团"],
    route_hongsan_juntuan: ["红三军团"],
    route_hongsanshi_jun: ["红三十军"],
    route_hongjiu_juntuan: ["红九军团"],
    route_honger_juntuan: ["红二军团", "红二方面军"],
    route_hongershiwu_jun: ["红二十五军"],
    route_hongwu_juntuan: ["红五军团"],
    route_hongliu_juntuan: ["红六军团"],
    route_hongshiba_shi: ["红十八师"],
    route_hongsi_juntuan: ["红四军团", "红四方面军"],
  };

  const POINT_DISTANCE_THRESHOLD = 5000; // 5km

  const state = {
    map: null,
    contextDataLayer: null,
    routeConfigs: [],
    routeLayers: {},
    eventFeatures: [],
    eventTimeline: [],
    eventMarkers: new Map(),
    eventLayerGroup: null,
    movingPeopleLayer: null,
    animatedRouteLayer: null,
    eventTimer: 0,
    routeTimer: 0,
    routeAnimationFrame: 0,
    activeEventIndex: 0,
    activeEventFilter: "all",
    eventsVisible: true,
    activeRouteKey: "",
    isPlayingEvents: false,
    isPlayingRoute: false,
    routePlaybackMode: false,
    routePlaybackEventIds: new Set(),
    routePlaybackEventIndexes: new Map(),
    routePlaybackStartTime: 0,
    routeNearbyEventIds: {},
    routeSegmentTimes: null,
    routePlayback: null,
    allRoutePlayback: null,
    routeHeadMarker: null,
    routeBranchHeadMarkers: new Map(),
    isPlayingAllRoutes: false,
    mapBackgroundLayer: null,
    poetryPoints: [],
    poetryLayer: null,
    poetryVisible: false,
    poetryList: [],        // ★ 新增：所有诗歌列表
    currentPoemIndex: -1,
    poetryOpenToken: 0,
  };

  const $ = (selector) => document.querySelector(selector);

  function flash(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1500);
  }

  function featureId(feature) {
    return String(feature.properties?.[FIELD.id] ?? JSON.stringify(feature.geometry));
  }

  function featureLatLng(feature) {
    const coordinates = feature.geometry?.coordinates || [0, 0];
    return [coordinates[1], coordinates[0]];
  }

  function includesAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
  }

  function getEventDisplayType(feature) {
    const props = feature.properties || {};
    const typeText = String(props[FIELD.type] || "");
    const eventText = String(props[FIELD.event] || "");
    const placeText = String(props[FIELD.place] || "");
    const text = `${typeText} ${eventText} ${placeText}`;
    if (includesAny(text, ["会师", "汇合", "胜利会师"])) return "join";
    if (includesAny(text, ["战役", "战斗", "攻占", "强渡", "飞夺", "突破", "阻击"])) return "battle";
    if (includesAny(text, ["会议", "决策", "政治局", "部署"])) return "meeting";
    if (includesAny(text, ["渡", "江", "河", "赤水", "金沙江", "大渡河", "乌江"])) return "river";
    if (includesAny(text, ["雪山", "草地", "夹金山", "翻越", "沼泽", "腊子口"])) return "mountain";
    return "other";
  }

  function getTroopCount(feature, index, total) {
    const rawValue = Number(feature.properties?.[FIELD.people]);
    if (Number.isFinite(rawValue) && rawValue > 0) return { value: rawValue, estimated: false };
    const progress = total <= 1 ? 0 : index / (total - 1);
    const estimated = Math.round((86000 - 79000 * progress) / 1000) * 1000;
    return { value: Math.max(5000, estimated), estimated: true };
  }

  function enrichEvents(events) {
    const unique = new Map();
    events.forEach(feature => {
      const id = featureId(feature);
      if (!unique.has(id)) unique.set(id, feature);
    });
    return [...unique.values()].map((feature, index, list) => ({
      ...feature,
      displayType: getEventDisplayType(feature),
      displayTroop: getTroopCount(feature, index, list.length),
      timelineIndex: index,
    }));
  }

  function eventMatchesRoute(feature, routeKey) {
    const keywords = routeUnitKeywords[routeKey] || [];
    if (!routeKey || !keywords.length) return true;
    const unit = String(feature.properties?.[FIELD.unit] || "");
    return includesAny(unit, keywords);
  }

  function parseDateTime(value) {
    const text = String(value || "").replace(/[./]/g, "-");
    const time = Date.parse(text);
    return Number.isFinite(time) ? time : 0;
  }

  function getEventTime(feature) {
    return parseDateTime(feature.properties?.[FIELD.date]);
  }

  function getSegmentStartTime(segment) {
    return parseDateTime(segment?.feature?.properties?.start_date);
  }

  function getSegmentEndTime(segment) {
    const props = segment?.feature?.properties || {};
    return parseDateTime(props.end_date || props.start_date);
  }

  function coordinateDistance(left, right) {
    if (!left || !right) return Number.POSITIVE_INFINITY;
    const latGap = left[0] - right[0];
    const lngGap = left[1] - right[1];
    return Math.sqrt(latGap * latGap + lngGap * lngGap);
  }

  function latLngDistance(left, right) {
    if (!left || !right) return Number.POSITIVE_INFINITY;
    return L.latLng(left).distanceTo(L.latLng(right));
  }

  function eventTimeMatchesPart(eventTime, part) {
    if (!eventTime || !part) return false;
    const startTime = getSegmentStartTime(part);
    const endTime = getSegmentEndTime(part);
    if (!startTime && !endTime) return false;
    if (startTime && eventTime < startTime) return false;
    if (endTime && eventTime > endTime) return false;
    return true;
  }

  function buildNearbyEventCaches() {
    state.routeNearbyEventIds = {};
    Object.keys(state.routeLayers).forEach(layerKey => {
      const item = state.routeLayers[layerKey];
      const latLngs = [];
      (item.collection?.features || []).forEach(feature => {
        const parts = getRouteLatLngParts(feature.geometry);
        parts.forEach(part => latLngs.push(...part));
      });
      const nearSet = new Set();
      if (latLngs.length) {
        state.eventFeatures.forEach(feature => {
          const eventPt = featureLatLng(feature);
          let minDist = Infinity;
          for (const pt of latLngs) {
            const dist = L.latLng(eventPt).distanceTo(L.latLng(pt));
            if (dist < minDist) minDist = dist;
            if (minDist <= POINT_DISTANCE_THRESHOLD) break;
          }
          if (minDist <= POINT_DISTANCE_THRESHOLD) nearSet.add(featureId(feature));
        });
      }
      state.routeNearbyEventIds[layerKey] = nearSet;
    });
  }

  function getVisibleRouteKeys() {
    return Object.keys(state.routeLayers).filter(key => state.routeLayers[key].visible);
  }

  function buildRouteEventIndexes(layerKey, routeData) {
    const eventIndexes = new Map();
    const routeParts = routeData.parts || [];
    if (!routeParts.length) return eventIndexes;
    state.eventFeatures.forEach(feature => {
      if (!eventMatchesRoute(feature, layerKey)) return;
      const eventPoint = featureLatLng(feature);
      const eventTime = getEventTime(feature);
      const matchingParts = eventTime ? routeParts.filter(part => eventTimeMatchesPart(eventTime, part)) : [];
      const candidateParts = matchingParts.length ? matchingParts : routeParts;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      candidateParts.forEach(part => {
        part.points.forEach((routePoint, localIndex) => {
          const distance = latLngDistance(eventPoint, routePoint);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = part.startIndex + localIndex;
          }
        });
      });
      eventIndexes.set(featureId(feature), nearestIndex);
    });
    return eventIndexes;
  }

  function updateRoutePlaybackEvents(currentIndex) {
    const eventIds = new Set();
    state.routePlaybackEventIndexes.forEach((routeIndex, eventId) => {
      if (routeIndex <= currentIndex) eventIds.add(eventId);
    });
    const unchanged =
      eventIds.size === state.routePlaybackEventIds.size &&
      [...eventIds].every(id => state.routePlaybackEventIds.has(id));
    if (unchanged) return;
    state.routePlaybackEventIds = eventIds;
    renderEventMarkers();
  }

  function getFilteredEvents() {
    const visibleKeys = getVisibleRouteKeys();
    const hasVisible = visibleKeys.length > 0;

    return state.eventFeatures.filter(feature => {
      const matchesType = state.activeEventFilter === "all" || feature.displayType === state.activeEventFilter;
      if (!matchesType) return false;
      if (state.routePlaybackMode) {
        return state.routePlaybackEventIds.has(featureId(feature));
      }
      if (hasVisible) {
        return visibleKeys.some(key => {
          const nearSet = state.routeNearbyEventIds[key];
          return nearSet ? nearSet.has(featureId(feature)) : false;
        });
      }
      return true;
    });
  }

  function getEventMarkerRadius(count) {
    if (count >= 80000) return 11;
    if (count >= 50000) return 9;
    if (count >= 30000) return 8;
    if (count >= 10000) return 7;
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
    L.tileLayer(APP_CONFIG.basemaps.ancient.url, APP_CONFIG.basemaps.ancient.options).addTo(state.map);
    addHomeMapBackground();
  }

  function addHomeMapBackground() {
    const paneName = "homeBackgroundPane";

    if (!state.map.getPane(paneName)) {
      const pane = state.map.createPane(paneName);
      pane.style.zIndex = 250;
      pane.style.pointerEvents = "none";
    }

    addHomeMapRedWash();

    const svg = buildHomeMapBackgroundSvg();
    const imageBounds = [
      [4.5, 71],
      [47.5, 137],
    ];

    state.mapBackgroundLayer = L.svgOverlay(
      svg,
      imageBounds,
      {
        pane: paneName,
        opacity: 0.45,
        interactive: false,
        className: "home-map-background-overlay",
      },
    ).addTo(state.map);
  }

  function addHomeMapRedWash() {
    const mapElement = document.getElementById("map");

    if (!mapElement || mapElement.querySelector(".home-map-red-wash")) {
      return;
    }

    const redWash = document.createElement("div");
    redWash.className = "home-map-red-wash";
    mapElement.insertBefore(redWash, mapElement.firstChild);
  }

  function buildHomeMapBackgroundSvg() {
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    const defs = document.createElementNS(svgNamespace, "defs");
    const mask = document.createElementNS(svgNamespace, "mask");
    const radialGradient = document.createElementNS(svgNamespace, "radialGradient");
    const stopSolid = document.createElementNS(svgNamespace, "stop");
    const stopSoft = document.createElementNS(svgNamespace, "stop");
    const stopFade = document.createElementNS(svgNamespace, "stop");
    const stopClear = document.createElementNS(svgNamespace, "stop");
    const blurFilter = document.createElementNS(svgNamespace, "filter");
    const blurNode = document.createElementNS(svgNamespace, "feGaussianBlur");
    const blackRect = document.createElementNS(svgNamespace, "rect");
    const whiteEllipse = document.createElementNS(svgNamespace, "ellipse");
    const image = document.createElementNS(svgNamespace, "image");

    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");

    mask.setAttribute("id", "homeMountainChinaAreaMask");
    mask.setAttribute("maskUnits", "userSpaceOnUse");

    radialGradient.setAttribute("id", "homeMountainFadeGradient");
    radialGradient.setAttribute("cx", "50%");
    radialGradient.setAttribute("cy", "50%");
    radialGradient.setAttribute("r", "50%");
    radialGradient.setAttribute("fx", "50%");
    radialGradient.setAttribute("fy", "50%");

    stopSolid.setAttribute("offset", "0%");
    stopSolid.setAttribute("stop-color", "white");
    stopSolid.setAttribute("stop-opacity", "1");

    stopSoft.setAttribute("offset", "46%");
    stopSoft.setAttribute("stop-color", "white");
    stopSoft.setAttribute("stop-opacity", "0.68");

    stopFade.setAttribute("offset", "84%");
    stopFade.setAttribute("stop-color", "white");
    stopFade.setAttribute("stop-opacity", "0.12");

    stopClear.setAttribute("offset", "100%");
    stopClear.setAttribute("stop-color", "white");
    stopClear.setAttribute("stop-opacity", "0");

    radialGradient.appendChild(stopSolid);
    radialGradient.appendChild(stopSoft);
    radialGradient.appendChild(stopFade);
    radialGradient.appendChild(stopClear);

    blurFilter.setAttribute("id", "homeMountainMaskBlur");
    blurFilter.setAttribute("x", "-24%");
    blurFilter.setAttribute("y", "-24%");
    blurFilter.setAttribute("width", "148%");
    blurFilter.setAttribute("height", "148%");

    blurNode.setAttribute("stdDeviation", "3.4");
    blurFilter.appendChild(blurNode);

    blackRect.setAttribute("x", "0");
    blackRect.setAttribute("y", "0");
    blackRect.setAttribute("width", "100");
    blackRect.setAttribute("height", "100");
    blackRect.setAttribute("fill", "black");

    whiteEllipse.setAttribute("cx", "50");
    whiteEllipse.setAttribute("cy", "48");
    whiteEllipse.setAttribute("rx", "42");
    whiteEllipse.setAttribute("ry", "25");
    whiteEllipse.setAttribute("fill", "url(#homeMountainFadeGradient)");
    whiteEllipse.setAttribute("filter", "url(#homeMountainMaskBlur)");

    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("width", "100");
    image.setAttribute("height", "100");
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("href", "/assets/images/home/map-background.png");
    image.setAttribute("mask", "url(#homeMountainChinaAreaMask)");

    defs.appendChild(radialGradient);
    defs.appendChild(blurFilter);
    mask.appendChild(blackRect);
    mask.appendChild(whiteEllipse);
    defs.appendChild(mask);
    svg.appendChild(defs);
    svg.appendChild(image);

    return svg;
  }

  function initLayerGroups() {
    state.eventLayerGroup = L.layerGroup().addTo(state.map);
    state.movingPeopleLayer = L.layerGroup().addTo(state.map);
    state.animatedRouteLayer = L.layerGroup().addTo(state.map);
  }

  function contextDataStyle(feature) {
    const kind = feature.properties?.kind;

    if (kind === "river") {
      return {
        color: "#1e88e5",
        weight: 3,
        opacity: 0.88,
        lineCap: "round",
        lineJoin: "round",
      };
    }

    return {
      color: "#8f1d14",
      weight: 1.4,
      opacity: 0.76,
      fillColor: "#c66a3d",
      fillOpacity: 0.18,
    };
  }

  async function loadHomeContextData() {
    try {
      const collection = await DataService.getHomeContextData();
      if (state.contextDataLayer) state.map.removeLayer(state.contextDataLayer);

      state.contextDataLayer = L.geoJSON(collection, {
        style: contextDataStyle,
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const name = props.kind === "base"
            ? props.NAME || props.Name || props.name || props.layer_name
            : props.layer_name || props.Name || props.NAME || props.name;
          if (name) layer.bindTooltip(name, { sticky: true });
        },
      }).addTo(state.map);

      state.contextDataLayer.bringToBack();
    } catch (error) {
      console.warn("home context data load failed", error);
    }
  }

  function toLatLngs(geometry) {
    if (!geometry) return [];
    if (geometry.type === "LineString") return geometry.coordinates.map(c => [c[1], c[0]]);
    if (geometry.type === "MultiLineString") return geometry.coordinates.map(line => line.map(c => [c[1], c[0]]));
    return [];
  }

  function getRouteLatLngParts(geometry) {
    const latLngs = toLatLngs(geometry);
    if (!latLngs.length) return [];
    if (Array.isArray(latLngs[0][0])) return latLngs.filter(part => part.length);
    return [latLngs];
  }

  function renderRouteControls() {
    $("#routeLayerList").innerHTML = state.routeConfigs
      .map(config => {
        return `
          <label style="--route-color: ${config.color || "#b42318"}">
            <i class="route-color-line" aria-hidden="true"></i>
            <input type="checkbox" data-route-layer="${config.layer_key}">
            <span>${config.layer_name}</span>
          </label>
        `;
      })
      .join("");

    $("#routeSelect").innerHTML = state.routeConfigs
      .map(config => `<option value="${config.layer_key}">${config.layer_name}</option>`)
      .join("");
  }

  async function renderRouteLayer(config) {
    const collection = await DataService.getRouteLayerFeatures(config.layer_key);
    const layerGroup = L.featureGroup();

    collection.features.forEach(feature => {
      const latLngs = toLatLngs(feature.geometry);
      if (!latLngs.length) return;

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
      }).on("click", () => {
        renderRouteDetail(feature, config);
      }).addTo(layerGroup);
    });

    state.routeLayers[config.layer_key] = {
      config,
      collection,
      layerGroup,
      visible: false,
    };
  }

  function toggleRouteLayer(layerKey, visible) {
    const item = state.routeLayers[layerKey];
    if (!item) return;
    item.visible = visible;
    if (visible) {
      item.layerGroup.addTo(state.map);
    } else {
      state.map.removeLayer(item.layerGroup);
    }
    renderEventMarkers();
  }

  function setActiveRouteFilter(layerKey) {
    state.activeRouteKey = layerKey || "";
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

  function renderPeopleIcons(troopCount, estimated) {
    const iconCount = Math.max(1, Math.min(8, Math.round(troopCount / 12000)));
    const label = `约 ${Math.max(1, Math.round(troopCount / 10000))} 万人`;
    const suffix = estimated ? "（估算）" : "";
    return `
      <div class="people-icons">
        <span class="icons">${"👥".repeat(iconCount)}</span>
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
            <b>${"👥".repeat(iconCount)}</b>
            <span>${Math.round(troopInfo.value / 10000)}万${troopInfo.estimated ? "·估" : ""}</span>
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
        <h2>红图绘长征</h2>
        <p>左侧控制路线、事件类型与红色资源；路线保持独立 SHP 图层，事件按军团关联和队伍人数节点展示。</p>
      </article>
    `;
  }

  function renderEventDetail(feature, troopInfo) {
    const props = feature.properties || {};
    const description = props.descript || props[FIELD.event] || "";
    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">事件详情</span>
        <h2>${props[FIELD.place] || "未命名事件"}</h2>
        <div class="detail-grid">
          <div class="detail-row"><span>事件编号</span><b>${props[FIELD.id] || "-"}</b></div>
          <div class="detail-row"><span>事件日</span><b>${props[FIELD.date] || "-"}</b></div>
          <div class="detail-row"><span>地名</span><b>${props[FIELD.place] || "-"}</b></div>
          <div class="detail-row"><span>关联部队</span><b>${props[FIELD.unit] || "-"}</b></div>
          <div class="detail-row"><span>事件类</span><b>${props[FIELD.type] || "-"}</b></div>
          <div class="detail-row"><span>队伍总数</span><b>${troopInfo.value.toLocaleString("zh-CN")} 人${troopInfo.estimated ? "（估算）" : ""}</b></div>
        </div>
        ${renderPeopleIcons(troopInfo.value, troopInfo.estimated)}
        <h3>历史叙事</h3>
        <p>${description}</p>
      </article>
    `;
  }

  function renderRouteDetail(feature, config) {
    const props = feature.properties || {};
    $("#detailPanel").innerHTML = `
      <article class="detail-card">
        <span class="detail-kicker">路线详情</span>
        <h2>${config.layer_name}</h2>
        <div class="detail-grid">
          <div class="detail-row"><span>图层</span><b>${config.layer_name}</b></div>
          <div class="detail-row"><span>军团</span><b>${props.corps_name || "-"}</b></div>
          <div class="detail-row"><span>阶段</span><b>${props.stage_name || "-"}</b></div>
          <div class="detail-row"><span>_order</span><b>${props._order ?? "-"}</b></div>
          <div class="detail-row"><span>起始时间</span><b>${props.start_date || "-"} — ${props.end_date || "-"}</b></div>
          <div class="detail-row"><span>长度</span><b>${props.Shape_Leng ?? "-"}</b></div>
        </div>
        <p>${props.descript || props.descriptio || "该路线段暂无说明字段。"}</p>
      </article>
    `;
  }

  function updatePlayStatus(feature) {
    const props = feature.properties || {};
    $("#playStatusTitle").textContent = `${props[FIELD.date] || ""} ${props[FIELD.place] || props[FIELD.event] || ""}`.trim();
  }

  function setProgressValue(value) {
    const progressRange = $("#progressRange");
    if (progressRange) progressRange.value = String(Math.round(value));
  }

  function setRoutePlayButtonLabel(text) {
    const button = $("#playRouteBtn");
    if (button) button.textContent = text;
  }

  function setAllRoutePlayButtonLabel(text) {
    const button = $("#playAllRoutesBtn");
    if (button) button.textContent = text;
  }

  function getRouteSpeed() {
    const value = Number($("#routeSpeedSelect")?.value || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function cancelRouteFrame() {
    if (state.routeAnimationFrame) {
      cancelAnimationFrame(state.routeAnimationFrame);
      state.routeAnimationFrame = 0;
    }
  }

  function clearRoutePlayback(options = {}) {
    const { clearLayer = true, resetEvents = true } = options;
    cancelRouteFrame();
    state.isPlayingRoute = false;
    state.isPlayingAllRoutes = false;
    state.routePlayback = null;
    state.allRoutePlayback = null;
    clearRouteHeadMarkers();
    state.activeRouteKey = "";
    if (clearLayer) state.animatedRouteLayer.clearLayers();
    if (resetEvents) {
      state.routePlaybackMode = false;
      state.routePlaybackEventIds = new Set();
      state.routePlaybackEventIndexes = new Map();
      renderEventMarkers();
    }
    setRoutePlayButtonLabel("播放路线");
    setAllRoutePlayButtonLabel("播放全部路线");
  }

  function stopAnimation(options = {}) {
    state.isPlayingEvents = false;
    clearInterval(state.eventTimer);
    clearInterval(state.routeTimer);
    clearRoutePlayback(options);
  }

  function highlightEventMarker(feature) {
    state.eventMarkers.forEach(marker => {
      marker.getElement()?.querySelector(".event-marker")?.classList.remove("active");
    });
    state.eventMarkers.get(featureId(feature))?.getElement()?.querySelector(".event-marker")?.classList.add("active");
  }

  function activateEvent(feature, focusMap) {
    const troopInfo = feature.displayTroop || getTroopCount(feature, 0, 1);
    highlightEventMarker(feature);
    updateMovingPeople(feature, troopInfo);
    renderEventDetail(feature, troopInfo);
    updatePlayStatus(feature);
    if (focusMap) {
      state.map.flyTo(featureLatLng(feature), Math.max(state.map.getZoom(), 7), { duration: 0.55 });
    }
  }

  function pauseAnimation() {
    state.isPlayingEvents = false;
    state.isPlayingRoute = false;
    state.isPlayingAllRoutes = false;
    clearInterval(state.eventTimer);
    clearInterval(state.routeTimer);
    cancelRouteFrame();
    if (state.routePlayback && state.routePlayback.progress < 1) {
      setRoutePlayButtonLabel("继续路线");
    }
    if (isAllRouteTimelineIncomplete(state.allRoutePlayback)) {
      setAllRoutePlayButtonLabel("继续全部");
    }
  }

  function playEventsTimeline() {
    stopAnimation({ clearLayer: true, resetEvents: true });
    const events = getFilteredEvents();
    if (!events.length) {
      flash("当前路线没有可播放事件");
      return;
    }
    state.isPlayingEvents = true;
    const step = () => {
      if (!state.isPlayingEvents) return;
      if (state.activeEventIndex >= events.length) {
        state.activeEventIndex = 0;
        pauseAnimation();
        $("#progressRange").value = "100";
        return;
      }
      const feature = events[state.activeEventIndex];
      activateEvent(feature, true);
      setProgressValue(((state.activeEventIndex + 1) / events.length) * 100);
      state.activeEventIndex += 1;
    };
    step();
    state.eventTimer = setInterval(step, 1100);
  }

  function playPrevious() {
    const events = getFilteredEvents();
    stopAnimation({ clearLayer: true, resetEvents: true });
    state.activeEventIndex = Math.max(0, state.activeEventIndex - 1);
    if (events[state.activeEventIndex]) activateEvent(events[state.activeEventIndex], true);
  }

  function playNext() {
    const events = getFilteredEvents();
    stopAnimation({ clearLayer: true, resetEvents: true });
    state.activeEventIndex = Math.min(events.length - 1, state.activeEventIndex + 1);
    if (events[state.activeEventIndex]) activateEvent(events[state.activeEventIndex], true);
  }

  function getRouteFeatureOrder(feature) {
    const order = Number(feature.properties?._order ?? 999999);
    return Number.isFinite(order) ? order : 999999;
  }

  function routePartDistanceToAnchor(part, anchor) {
    const start = part.points[0];
    const end = part.points[part.points.length - 1];
    const startDistance = latLngDistance(anchor, start);
    const endDistance = latLngDistance(anchor, end);
    return {
      distance: Math.min(startDistance, endDistance),
      reverse: endDistance < startDistance,
    };
  }

  function buildOrderedRouteParts(collection) {
    const groups = [];
    [...collection.features]
      .map((feature, index) => ({ feature, index, order: getRouteFeatureOrder(feature) }))
      .sort((a, b) => {
        const orderGap = a.order - b.order;
        if (orderGap !== 0) return orderGap;
        return a.index - b.index;
      })
      .forEach(item => {
        const routeParts = getRouteLatLngParts(item.feature.geometry)
          .filter(latLngs => latLngs.length)
          .map((latLngs, partIndex) => ({
            feature: item.feature,
            featureIndex: item.index,
            order: item.order,
            partIndex,
            points: latLngs,
          }));
        if (!routeParts.length) return;
        const lastGroup = groups[groups.length - 1];
        if (!lastGroup || lastGroup.order !== item.order) {
          groups.push({ order: item.order, parts: [] });
        }
        groups[groups.length - 1].parts.push(...routeParts);
      });

    const orderedParts = [];
    let anchor = null;
    groups.forEach(group => {
      if (group.parts.some(part => part.feature.properties?._branch_group)) {
        const branchParts = group.parts
          .map(part => ({ ...part, points: [...part.points] }))
          .sort((a, b) => {
            const branchGap = String(a.feature.properties?._branch_id || "").localeCompare(
              String(b.feature.properties?._branch_id || ""),
            );
            if (branchGap !== 0) return branchGap;
            return Number(a.feature.properties?._play_part_index || a.partIndex) -
              Number(b.feature.properties?._play_part_index || b.partIndex);
          });
        orderedParts.push(...branchParts);
        const mergePart = branchParts.find(part => part.feature.properties?._branch_id === "left") || branchParts[0];
        anchor = mergePart?.points?.[mergePart.points.length - 1] || anchor;
        return;
      }

      const remaining = group.parts.map(part => ({ ...part, points: [...part.points] }));
      while (remaining.length) {
        let bestIndex = 0;
        let shouldReverse = false;
        if (anchor) {
          let bestDistance = Number.POSITIVE_INFINITY;
          remaining.forEach((part, index) => {
            const candidate = routePartDistanceToAnchor(part, anchor);
            if (candidate.distance < bestDistance) {
              bestDistance = candidate.distance;
              bestIndex = index;
              shouldReverse = candidate.reverse;
            }
          });
        }

        const selected = remaining.splice(bestIndex, 1)[0];
        const selectedPoints = shouldReverse ? [...selected.points].reverse() : selected.points;
        const orderedPart = { ...selected, points: selectedPoints };
        orderedParts.push(orderedPart);
        anchor = selectedPoints[selectedPoints.length - 1];
      }
    });

    return orderedParts;
  }

  function routeLineDistance(points) {
    return points.slice(1).reduce((sum, point, index) => {
      return sum + L.latLng(points[index]).distanceTo(L.latLng(point));
    }, 0);
  }

  function sliceRouteLine(points, distance) {
    if (!points.length || distance <= 0) return points.length ? [points[0]] : [];
    const slice = [points[0]];
    let walked = 0;

    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const segmentDistance = L.latLng(start).distanceTo(L.latLng(end));
      if (walked + segmentDistance <= distance) {
        slice.push(end);
        walked += segmentDistance;
        continue;
      }

      const ratio = segmentDistance ? (distance - walked) / segmentDistance : 0;
      slice.push([
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ]);
      break;
    }

    return slice;
  }

  function renderRouteUnitParts(parts, distance) {
    const rendered = [];
    let remaining = distance;

    for (const part of parts) {
      if (remaining <= 0) {
        const start = part.points[0];
        if (start) rendered.push([start]);
        break;
      }

      const slice = sliceRouteLine(part.points, remaining);
      if (slice.length) rendered.push(slice);
      remaining -= part.distance;
      if (remaining < 0) break;
    }

    return rendered;
  }

  function routeUnitHeadPoint(parts, distance) {
    let remaining = distance;
    let fallback = parts[0]?.points?.[0];

    for (const part of parts) {
      fallback = part.points[part.points.length - 1] || fallback;
      if (remaining <= part.distance) {
        return sliceRouteLine(part.points, remaining).at(-1) || fallback;
      }
      remaining -= part.distance;
    }

    return fallback;
  }

  function routeUnitAtDistance(routeData, distance) {
    return routeData.units?.find(item => distance >= item.startDistance && distance <= item.endDistance) ||
      routeData.units?.[routeData.units.length - 1];
  }

  function routeBranchHeadPoints(routeData, distance) {
    const unit = routeUnitAtDistance(routeData, distance);
    if (unit?.type !== "branch") return null;
    const unitDistance = Math.max(0, Math.min(unit.length, distance - unit.startDistance));

    return unit.branches
      .map(branch => ({
        branchId: branch.branchId,
        point: routeUnitHeadPoint(branch.parts, Math.min(unitDistance, branch.length)),
      }))
      .filter(item => item.point);
  }

  function buildRoutePoints(collection) {
    const orderedRouteParts = buildOrderedRouteParts(collection);
    const points = [];
    const cumulativeDistances = [];
    const segments = [];
    const parts = [];
    const units = [];
    let totalDistance = 0;

    for (let index = 0; index < orderedRouteParts.length; index += 1) {
      const routePart = orderedRouteParts[index];
      const branchGroup = routePart.feature.properties?._branch_group;
      if (branchGroup) {
        const branchItems = [];
        while (
          index < orderedRouteParts.length &&
          orderedRouteParts[index].feature.properties?._branch_group === branchGroup
        ) {
          branchItems.push(orderedRouteParts[index]);
          index += 1;
        }
        index -= 1;

        const branches = new Map();
        branchItems.forEach(item => {
          const branchId = item.feature.properties?._branch_id || "main";
          if (!branches.has(branchId)) branches.set(branchId, []);
          branches.get(branchId).push(item);
        });

        const unit = {
          type: "branch",
          order: branchGroup,
          startDistance: totalDistance,
          length: 0,
          branches: [],
        };

        branches.forEach((items, branchId) => {
          const branchParts = items.map(item => {
            const startIndex = points.length;
            const distance = routeLineDistance(item.points);
            item.points.forEach((pt, localIndex) => {
              if (localIndex > 0) {
                const previous = item.points[localIndex - 1];
                const lastDistance = cumulativeDistances[cumulativeDistances.length - 1] || totalDistance;
                cumulativeDistances.push(lastDistance + L.latLng(previous).distanceTo(L.latLng(pt)));
              } else {
                cumulativeDistances.push(totalDistance);
              }
              points.push(pt);
            });
            const part = {
              feature: item.feature,
              points: item.points,
              distance,
              startIndex,
              endIndex: points.length - 1,
              unit,
              branchId,
            };
            parts.push(part);
            segments.push(part);
            return part;
          });
          const branchLength = branchParts.reduce((sum, part) => sum + part.distance, 0);
          unit.length = Math.max(unit.length, branchLength);
          unit.branches.push({ branchId, parts: branchParts, length: branchLength });
        });

        unit.endDistance = unit.startDistance + unit.length;
        units.push(unit);
        totalDistance = unit.endDistance;
        continue;
      }

      const startIndex = points.length;
      const distance = routeLineDistance(routePart.points);
      routePart.points.forEach((pt, localIndex) => {
        if (localIndex > 0) {
          totalDistance += L.latLng(routePart.points[localIndex - 1]).distanceTo(L.latLng(pt));
        }
        points.push(pt);
        cumulativeDistances.push(totalDistance);
      });
      const part = {
        feature: routePart.feature,
        points: routePart.points,
        distance,
        startIndex,
        endIndex: points.length - 1,
      };
      parts.push(part);
      segments.push(part);
      units.push({
        type: "line",
        part,
        startDistance: cumulativeDistances[startIndex] || 0,
        endDistance: totalDistance,
        length: distance,
      });
    }

    return { points, cumulativeDistances, totalDistance, segments, parts, units };
  }

  function findSegmentByPointIndex(segments, index) {
    return segments.find(s => index >= s.startIndex && index <= s.endIndex) || segments[0];
  }

  function getRenderedRoutePartsByDistance(routeData, distance) {
    if (!routeData.units?.length) return [];
    const rendered = [];

    routeData.units.forEach(unit => {
      if (distance < unit.startDistance) return;
      const unitDistance = Math.min(distance - unit.startDistance, unit.length);

      if (unit.type === "branch") {
        unit.branches.forEach(branch => {
          rendered.push(...renderRouteUnitParts(branch.parts, unitDistance));
        });
        return;
      }

      const slice = sliceRouteLine(unit.part.points, unitDistance);
      if (slice.length) rendered.push(slice);
    });

    return rendered;
  }

  function getRouteHeadPointByDistance(routeData, distance) {
    const unit = routeData.units?.find(item => distance >= item.startDistance && distance <= item.endDistance) ||
      routeData.units?.[routeData.units.length - 1];
    if (!unit) return routeData.points[0];
    const unitDistance = Math.max(0, Math.min(unit.length, distance - unit.startDistance));

    if (unit.type === "branch") {
      const branch = unit.branches.reduce((longest, item) => {
        return item.length > (longest?.length || 0) ? item : longest;
      }, null);
      return routeUnitHeadPoint(branch?.parts || [], unitDistance);
    }

    return sliceRouteLine(unit.part.points, unitDistance).at(-1);
  }

  function findSegmentByDistance(routeData, distance) {
    const unit = routeData.units?.find(item => distance >= item.startDistance && distance <= item.endDistance);
    if (!unit) return routeData.segments[0];
    const unitDistance = Math.max(0, distance - unit.startDistance);

    if (unit.type === "branch") {
      const branch = unit.branches[0];
      let walked = 0;
      return branch?.parts.find(part => {
        walked += part.distance;
        return unitDistance <= walked;
      }) || branch?.parts?.[0] || routeData.segments[0];
    }

    return unit.part;
  }

  function getRenderedRouteParts(routeData, index) {
    if (routeData.units?.length) {
      const distance = routeData.totalDistance * Math.max(0, Math.min(1, routeData.currentProgress || 0));
      return getRenderedRoutePartsByDistance(routeData, distance);
    }

    const rendered = [];
    routeData.parts.forEach(part => {
      if (index < part.startIndex) return;
      const localEnd = Math.min(index, part.endIndex) - part.startIndex;
      const slice = part.points.slice(0, localEnd + 1);
      if (slice.length) rendered.push(slice);
    });
    return rendered;
  }

  function findPointIndexByProgress(routeData, progress) {
    const pointCount = routeData.points.length;
    if (pointCount <= 1) return 0;
    const clamped = Math.max(0, Math.min(1, progress));
    if (!routeData.totalDistance) return Math.round((pointCount - 1) * clamped);

    const targetDistance = routeData.totalDistance * clamped;
    const distances = routeData.cumulativeDistances;
    let left = 0;
    let right = distances.length - 1;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (distances[middle] < targetDistance) left = middle + 1;
      else right = middle;
    }
    return Math.max(0, Math.min(pointCount - 1, left));
  }

  function getRouteDurationMs(routeData) {
    const pointDriven = routeData.points.length * 28;
    const segmentDriven = routeData.segments.length * 180;
    return Math.min(26000, Math.max(11000, pointDriven, segmentDriven));
  }

  const cpcPartyFlagIcon = L.icon({
    iconUrl: "/assets/images/cpc-party-flag.png",
    iconSize: [72, 54],
    iconAnchor: [36, 27],
    popupAnchor: [0, -27],
  });

  function clearRouteHeadMarkers() {
    if (!state.animatedRouteLayer) {
      state.routeHeadMarker = null;
      state.routeBranchHeadMarkers.clear();
      return;
    }
    if (state.routeHeadMarker) {
      state.animatedRouteLayer.removeLayer(state.routeHeadMarker);
      state.routeHeadMarker = null;
    }
    state.routeBranchHeadMarkers.forEach(marker => {
      state.animatedRouteLayer.removeLayer(marker);
    });
    state.routeBranchHeadMarkers.clear();
  }

  function clearRouteBranchHeadMarkers() {
    if (!state.animatedRouteLayer) {
      state.routeBranchHeadMarkers.clear();
      return;
    }
    state.routeBranchHeadMarkers.forEach(marker => {
      state.animatedRouteLayer.removeLayer(marker);
    });
    state.routeBranchHeadMarkers.clear();
  }

  function updateRouteBranchHeads(branchHeads) {
    if (state.routeHeadMarker) {
      state.animatedRouteLayer.removeLayer(state.routeHeadMarker);
      state.routeHeadMarker = null;
    }

    const activeBranchIds = new Set(branchHeads.map(item => item.branchId));
    state.routeBranchHeadMarkers.forEach((marker, branchId) => {
      if (!activeBranchIds.has(branchId)) {
        state.animatedRouteLayer.removeLayer(marker);
        state.routeBranchHeadMarkers.delete(branchId);
      }
    });

    branchHeads.forEach(({ branchId, point }) => {
      let marker = state.routeBranchHeadMarkers.get(branchId);
      if (!marker) {
        marker = L.marker(point, {
          icon: cpcPartyFlagIcon,
          zIndexOffset: 720,
          interactive: false,
        }).addTo(state.animatedRouteLayer);
        state.routeBranchHeadMarkers.set(branchId, marker);
        return;
      }
      marker.setLatLng(point);
    });
  }

  function updateSingleRouteHeadPoint(point) {
    if (!point) return;
    clearRouteBranchHeadMarkers();
    if (!state.routeHeadMarker) {
      state.routeHeadMarker = L.marker(point, {
        icon: cpcPartyFlagIcon,
        zIndexOffset: 720,
        interactive: false,
      }).addTo(state.animatedRouteLayer);
      return;
    }
    state.routeHeadMarker.setLatLng(point);
  }

  function updateRouteHead(playback, index) {
    const distance = playback.routeData.totalDistance * Math.max(0, Math.min(1, playback.progress || 0));
    const branchHeads = playback.routeData.units?.length
      ? routeBranchHeadPoints(playback.routeData, distance)
      : null;
    if (branchHeads?.length) {
      updateRouteBranchHeads(branchHeads);
      return;
    }

    clearRouteBranchHeadMarkers();
    const point = playback.routeData.units?.length
      ? getRouteHeadPointByDistance(playback.routeData, distance)
      : playback.routeData.points[index];
    updateSingleRouteHeadPoint(point);
  }

  function renderRoutePlaybackFrame(playback, updateRange = true) {
    const routeData = playback.routeData;
    routeData.currentProgress = playback.progress;
    const index = findPointIndexByProgress(routeData, playback.progress);
    const rendered = getRenderedRouteParts(routeData, index);
    playback.glow.setLatLngs(rendered);
    playback.line.setLatLngs(rendered);
    updateRouteHead(playback, index);
    updateRoutePlaybackEvents(index);

    const distance = routeData.totalDistance * Math.max(0, Math.min(1, playback.progress || 0));
    const segment = routeData.units?.length
      ? findSegmentByDistance(routeData, distance)
      : findSegmentByPointIndex(routeData.segments, index);
    const segmentKey = `${segment?.startIndex ?? 0}-${segment?.feature.properties?._order ?? ""}`;
    if (segment && playback.lastSegmentKey !== segmentKey) {
      playback.lastSegmentKey = segmentKey;
      renderRouteDetail(segment.feature, playback.config);
    }

    const progressPercent = Math.round(playback.progress * 100);
    const orderText = segment?.feature.properties?._order ?? "-";
    $("#playStatusTitle").textContent = `${playback.config.layer_name} · ${progressPercent}% · _order ${orderText}`;
    if (updateRange) setProgressValue(progressPercent);
  }

  function finishRoutePlayback() {
    const playback = state.routePlayback;
    if (!playback) return;
    cancelRouteFrame();
    state.isPlayingRoute = false;
    playback.progress = 1;
    renderRoutePlaybackFrame(playback);
    $("#playStatusTitle").textContent = `${playback.config.layer_name} · 播放完成`;
    setRoutePlayButtonLabel("重播路线");
  }

  function animateRouteFrame(now) {
    const playback = state.routePlayback;
    if (!state.isPlayingRoute || !playback) return;

    const lastFrameTime = playback.lastFrameTime || now;
    const elapsed = now - lastFrameTime;
    playback.lastFrameTime = now;
    playback.progress = Math.min(
      1,
      playback.progress + (elapsed * getRouteSpeed()) / playback.durationMs,
    );

    renderRoutePlaybackFrame(playback);
    if (playback.progress >= 1) {
      finishRoutePlayback();
      return;
    }
    state.routeAnimationFrame = requestAnimationFrame(animateRouteFrame);
  }

  function startRoutePlayback(playback) {
    cancelRouteFrame();
    state.routePlayback = playback;
    state.isPlayingRoute = true;
    state.routePlaybackMode = true;
    playback.lastFrameTime = performance.now();
    setRoutePlayButtonLabel("暂停路线");
    state.routeAnimationFrame = requestAnimationFrame(animateRouteFrame);
  }

  function seekRouteProgress(value) {
    const playback = state.routePlayback;
    if (!playback) {
      setProgressValue(Number(value) || 0);
      return;
    }
    const progress = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
    playback.progress = progress;
    playback.lastFrameTime = performance.now();
    state.routePlaybackMode = true;
    renderRoutePlaybackFrame(playback, false);
    setProgressValue(progress * 100);
    if (!state.isPlayingRoute && progress < 1) setRoutePlayButtonLabel("继续路线");
    if (progress >= 1) finishRoutePlayback();
  }

  async function playSelectedRoute() {
    const layerKey = $("#routeSelect").value;
    if (!layerKey) return;

    if (state.routePlayback?.layerKey === layerKey && state.routePlayback.progress < 1) {
      if (state.isPlayingRoute) pauseAnimation();
      else startRoutePlayback(state.routePlayback);
      return;
    }

    stopAnimation({ clearLayer: true, resetEvents: true });
    state.animatedRouteLayer.clearLayers();

    if (!state.routeLayers[layerKey]?.visible) {
      toggleRouteLayer(layerKey, true);
      const input = document.querySelector(`#routeLayerList input[data-route-layer="${layerKey}"]`);
      if (input) input.checked = true;
    }

    const config = state.routeConfigs.find(c => c.layer_key === layerKey);
    if (!config) return;

    const collection = await DataService.getRouteLayerAnimation(layerKey);
    const routeData = buildRoutePoints(collection);
    if (routeData.points.length < 2) return;

    state.activeRouteKey = layerKey;
    state.routePlaybackMode = true;
    state.routePlaybackEventIds = new Set();
    state.routePlaybackEventIndexes = buildRouteEventIndexes(layerKey, routeData);
    updateRoutePlaybackEvents(0);
    renderEventMarkers();

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

    state.map.fitBounds(L.latLngBounds(routeData.points), { padding: [36, 36] });

    const playback = {
      layerKey,
      config,
      routeData,
      glow,
      line,
      durationMs: getRouteDurationMs(routeData),
      progress: 0,
      lastFrameTime: 0,
      lastSegmentKey: "",
    };
    state.routePlayback = playback;
    renderRoutePlaybackFrame(playback);
    startRoutePlayback(playback);
  }

  async function loadRouteSegmentTimes() {
    if (state.routeSegmentTimes) return state.routeSegmentTimes;
    try {
      state.routeSegmentTimes = await DataService.getRouteSegmentTimes();
    } catch (error) {
      console.warn("route segment times load failed", error);
      state.routeSegmentTimes = { routes: {} };
    }
    return state.routeSegmentTimes;
  }

  function getRouteTimeSegments(layerKey) {
    return state.routeSegmentTimes?.routes?.[layerKey]?.segments || [];
  }

  function getPartTimeRange(layerKey, part) {
    const props = part?.feature?.properties || {};
    const order = getRouteFeatureOrder(part.feature);
    let startDate = props.start_date || "";
    let endDate = props.end_date || props.start_date || "";

    if (!startDate) {
      const candidates = getRouteTimeSegments(layerKey).filter(item => Number(item.order) === order);
      const partIndex = Math.max(0, Number(props._play_part_index || 1) - 1);
      const fallback = candidates[Math.min(partIndex, candidates.length - 1)] || candidates[0];
      startDate = fallback?.start_date || "";
      endDate = fallback?.end_date || fallback?.start_date || "";
    }

    return {
      startDate,
      endDate: endDate || startDate,
      startTime: parseDateTime(startDate),
      endTime: parseDateTime(endDate || startDate),
    };
  }

  function getRoutePlaybackTimeRange(layerKey, routeData) {
    const ranges = (routeData.parts || [])
      .map(part => getPartTimeRange(layerKey, part))
      .filter(range => range.startTime || range.endTime);

    if (!ranges.length) {
      getRouteTimeSegments(layerKey).forEach(item => {
        const startDate = item.start_date || "";
        const endDate = item.end_date || item.start_date || "";
        const startTime = parseDateTime(startDate);
        const endTime = parseDateTime(endDate || startDate);
        if (startTime || endTime) ranges.push({ startDate, endDate, startTime, endTime });
      });
    }

    if (!ranges.length) return { startDate: "", endDate: "", startTime: 0, endTime: 0 };

    const first = ranges.reduce((best, item) => {
      const itemTime = item.startTime || item.endTime || Number.MAX_SAFE_INTEGER;
      const bestTime = best.startTime || best.endTime || Number.MAX_SAFE_INTEGER;
      return itemTime < bestTime ? item : best;
    }, ranges[0]);
    const last = ranges.reduce((best, item) => {
      const itemTime = item.endTime || item.startTime || 0;
      const bestTime = best.endTime || best.startTime || 0;
      return itemTime > bestTime ? item : best;
    }, ranges[0]);

    return {
      startDate: first.startDate || first.endDate || "",
      endDate: last.endDate || last.startDate || "",
      startTime: first.startTime || first.endTime || 0,
      endTime: last.endTime || last.startTime || 0,
    };
  }

  function updateAllRoutePlaybackEvents(currentTime) {
    if (!state.routePlaybackEventIds.size) return;
    state.routePlaybackEventIds = new Set();
    renderEventMarkers();
  }

  async function buildAllRoutePlaybackItems() {
    await loadRouteSegmentTimes();
    const routeItems = await Promise.all(state.routeConfigs.map(async config => {
      const collection = await DataService.getRouteLayerAnimation(config.layer_key);
      const routeData = buildRoutePoints(collection);
      return { config, routeData };
    }));

    const items = [];
    routeItems.forEach(({ config, routeData }) => {
      if (routeData.points.length < 2 || !routeData.parts.length) return;
      const timeRange = getRoutePlaybackTimeRange(config.layer_key, routeData);
      const sortTime = timeRange.startTime || timeRange.endTime || Number.MAX_SAFE_INTEGER;
      items.push({
        layerKey: config.layer_key,
        config,
        routeData,
        durationMs: getRouteDurationMs(routeData),
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime || timeRange.startTime,
        sortTime,
      });
    });

    return items.sort((a, b) => {
      const timeGap = a.sortTime - b.sortTime;
      if (timeGap !== 0) return timeGap;
      const endGap = (a.endTime || 0) - (b.endTime || 0);
      if (endGap !== 0) return endGap;
      const routeGap = Number(a.config.display_order || 0) - Number(b.config.display_order || 0);
      if (routeGap !== 0) return routeGap;
      return String(a.layerKey).localeCompare(String(b.layerKey));
    });
  }

  function getAllRouteCurrentTime(playback) {
    const item = playback.currentItem;
    if (!item) return 0;
    if (!item.startTime && !item.endTime) return 0;
    if (!item.startTime || !item.endTime || item.startTime === item.endTime) {
      return item.endTime || item.startTime;
    }
    return item.startTime + (item.endTime - item.startTime) * Math.max(0, Math.min(1, playback.currentProgress || 0));
  }

  function setAllRouteProgressValue(playback) {
    const currentElapsed = (playback.currentItem?.durationMs || 0) * (playback.currentProgress || 0);
    const totalElapsed = playback.completedDurationMs + currentElapsed;
    const percent = playback.totalDurationMs ? (totalElapsed / playback.totalDurationMs) * 100 : 0;
    setProgressValue(percent);
  }

  function renderAllRoutePlaybackFrame(playback) {
    const item = playback.currentItem;
    if (!item) return;
    const progress = Math.max(0, Math.min(1, playback.currentProgress || 0));
    const routeData = item.routeData;
    routeData.currentProgress = progress;
    const index = findPointIndexByProgress(routeData, progress);
    const rendered = getRenderedRouteParts(routeData, index);

    item.glow.setLatLngs(rendered);
    item.line.setLatLngs(rendered);
    updateRouteHead({ routeData, progress }, index);

    const currentTime = getAllRouteCurrentTime(playback);
    const eventTimeBucket = currentTime ? Math.floor(currentTime / 86400000) : 0;
    if (eventTimeBucket !== playback.lastEventTimeBucket) {
      playback.lastEventTimeBucket = eventTimeBucket;
      updateAllRoutePlaybackEvents(currentTime);
    }

    const progressPercent = Math.round(progress * 100);
    const dateText = item.startDate && item.endDate
      ? `${item.startDate} — ${item.endDate}`
      : "时间待补充";
    $("#playStatusTitle").textContent =
      `全部路线 ${playback.index + 1}/${playback.items.length} · ${item.config.layer_name} · ${dateText} · ${progressPercent}%`;
    setAllRouteProgressValue(playback);
  }

  function startAllRouteItem(index) {
    const playback = state.allRoutePlayback;
    if (!playback) return false;
    if (index >= playback.items.length) return false;

    const item = playback.items[index];
    playback.index = index;
    playback.currentItem = item;
    playback.currentProgress = item.progress || 0;
    playback.lastEventTimeBucket = 0;

    item.glow = L.polyline([], {
      color: "#ffd36b",
      weight: 10,
      opacity: 0.24,
      interactive: false,
    }).addTo(state.animatedRouteLayer);
    item.line = L.polyline([], {
      color: item.config.color || "#b42318",
      weight: Number(item.config.line_width || 4) + 2,
      opacity: 0.98,
      className: "animated-route",
      interactive: false,
    }).addTo(state.animatedRouteLayer);

    state.activeRouteKey = item.layerKey;
    state.routePlaybackMode = true;
    renderRouteDetail(item.routeData.segments[0]?.feature, item.config);
    renderAllRoutePlaybackFrame(playback);
    return true;
  }

  function finishAllRoutePlayback() {
    const playback = state.allRoutePlayback;
    cancelRouteFrame();
    state.isPlayingAllRoutes = false;
    if (playback) {
      playback.index = playback.items.length;
      playback.currentProgress = 1;
    }
    $("#playStatusTitle").textContent = "全部路线 · 播放完成";
    setProgressValue(100);
    setAllRoutePlayButtonLabel("重播全部路线");
  }

  function animateAllRouteFrame(now) {
    const playback = state.allRoutePlayback;
    if (!state.isPlayingAllRoutes || !playback?.currentItem) return;

    const lastFrameTime = playback.lastFrameTime || now;
    const elapsed = now - lastFrameTime;
    playback.lastFrameTime = now;
    playback.currentProgress = Math.min(
      1,
      playback.currentProgress + (elapsed * getRouteSpeed()) / playback.currentItem.durationMs,
    );
    playback.currentItem.progress = playback.currentProgress;

    renderAllRoutePlaybackFrame(playback);
    if (playback.currentProgress >= 1) {
      playback.completedDurationMs += playback.currentItem.durationMs;
      playback.currentItem.progress = 1;
      const nextIndex = playback.index + 1;
      if (!startAllRouteItem(nextIndex)) {
        finishAllRoutePlayback();
        return;
      }
      playback.lastFrameTime = now;
    }

    state.routeAnimationFrame = requestAnimationFrame(animateAllRouteFrame);
  }

  function isAllRouteTimelineIncomplete(playback) {
    return Boolean(playback && !playback.finished && (playback.timelineProgress || 0) < 1);
  }

  function formatTimelineDate(time) {
    if (!time) return "";
    return new Date(time).toISOString().slice(0, 10);
  }

  function getAllRouteTimelineCurrentTime(playback) {
    return playback?.currentTime || playback?.timelineStart || 0;
  }

  function ensureAllRouteTimelineLayers(item) {
    if (item.line && item.glow) return false;

    item.glow = L.polyline([], {
      color: "#ffd36b",
      weight: 10,
      opacity: 0.24,
      interactive: false,
    }).addTo(state.animatedRouteLayer);
    item.line = L.polyline([], {
      color: item.config.color || "#b42318",
      weight: Number(item.config.line_width || 4) + 2,
      opacity: 0.98,
      className: "animated-route",
      interactive: false,
    }).addTo(state.animatedRouteLayer);
    item.branchHeadMarkers = item.branchHeadMarkers || new Map();
    return true;
  }

  function clearAllRouteTimelineBranchHeads(item) {
    item.branchHeadMarkers?.forEach(marker => {
      state.animatedRouteLayer.removeLayer(marker);
    });
    item.branchHeadMarkers?.clear();
  }

  function updateAllRouteTimelineBranchHeads(item, branchHeads) {
    if (item.headMarker) {
      state.animatedRouteLayer.removeLayer(item.headMarker);
      item.headMarker = null;
    }

    item.branchHeadMarkers = item.branchHeadMarkers || new Map();
    const activeBranchIds = new Set(branchHeads.map(head => head.branchId));
    item.branchHeadMarkers.forEach((marker, branchId) => {
      if (!activeBranchIds.has(branchId)) {
        state.animatedRouteLayer.removeLayer(marker);
        item.branchHeadMarkers.delete(branchId);
      }
    });

    branchHeads.forEach(({ branchId, point }) => {
      let marker = item.branchHeadMarkers.get(branchId);
      if (!marker) {
        marker = L.marker(point, {
          icon: cpcPartyFlagIcon,
          zIndexOffset: 720,
          interactive: false,
        }).addTo(state.animatedRouteLayer);
        item.branchHeadMarkers.set(branchId, marker);
        return;
      }
      marker.setLatLng(point);
    });
  }

  function updateAllRouteTimelineHeadPoint(item, point) {
    if (!point) return;
    clearAllRouteTimelineBranchHeads(item);
    if (!item.headMarker) {
      item.headMarker = L.marker(point, {
        icon: cpcPartyFlagIcon,
        zIndexOffset: 720,
        interactive: false,
      }).addTo(state.animatedRouteLayer);
      return;
    }
    item.headMarker.setLatLng(point);
  }

  function updateAllRouteTimelineHead(item, index, progress) {
    const routeData = item.routeData;
    const distance = routeData.totalDistance * Math.max(0, Math.min(1, progress || 0));
    const branchHeads = routeData.units?.length ? routeBranchHeadPoints(routeData, distance) : null;
    if (branchHeads?.length) {
      updateAllRouteTimelineBranchHeads(item, branchHeads);
      return;
    }

    const point = routeData.units?.length
      ? getRouteHeadPointByDistance(routeData, distance)
      : routeData.points[index];
    updateAllRouteTimelineHeadPoint(item, point);
  }

  function getAllRouteTimelineItemProgress(item, currentTime) {
    const startTime = item.startTime || item.endTime || 0;
    const endTime = item.endTime || item.startTime || 0;
    if (!startTime || !endTime || startTime === endTime) {
      return currentTime >= startTime ? 1 : 0;
    }
    return Math.max(0, Math.min(1, (currentTime - startTime) / (endTime - startTime)));
  }

  function renderAllRouteTimelineItem(playback, item) {
    const currentTime = getAllRouteTimelineCurrentTime(playback);
    const startTime = item.startTime || item.endTime || 0;
    if (!startTime || currentTime < startTime) return { started: false, active: false };

    const created = ensureAllRouteTimelineLayers(item);
    const progress = getAllRouteTimelineItemProgress(item, currentTime);
    item.progress = progress;
    const routeData = item.routeData;
    routeData.currentProgress = progress;
    const index = findPointIndexByProgress(routeData, progress);
    const rendered = getRenderedRouteParts(routeData, index);
    item.glow.setLatLngs(rendered);
    item.line.setLatLngs(rendered);
    updateAllRouteTimelineHead(item, index, progress);

    if (created) {
      state.activeRouteKey = item.layerKey;
      renderRouteDetail(item.routeData.segments[0]?.feature, item.config);
    }

    return {
      started: true,
      active: progress > 0 && progress < 1,
    };
  }

  function renderAllRouteTimelineFrame(playback) {
    if (!playback?.items?.length) return;
    const currentTime = getAllRouteTimelineCurrentTime(playback);
    const started = [];
    const active = [];

    playback.items.forEach(item => {
      const result = renderAllRouteTimelineItem(playback, item);
      if (result.started) started.push(item);
      if (result.active) active.push(item);
    });

    const eventTimeBucket = currentTime ? Math.floor(currentTime / 86400000) : 0;
    if (eventTimeBucket !== playback.lastEventTimeBucket) {
      playback.lastEventTimeBucket = eventTimeBucket;
      updateAllRoutePlaybackEvents(currentTime);
    }

    playback.timelineProgress = playback.totalDurationMs ? (playback.elapsedMs || 0) / playback.totalDurationMs : 1;
    setProgressValue(playback.timelineProgress * 100);

    const activeNames = active.slice(0, 3).map(item => item.config.layer_name).join("、");
    const activeText = activeNames
      ? `${activeNames}${active.length > 3 ? `等${active.length}条` : ""}`
      : "暂无进行中路线";
    $("#playStatusTitle").textContent =
      `全部路线 · ${formatTimelineDate(currentTime)} · 已启动 ${started.length}/${playback.items.length} · ${activeText}`;
  }

  function finishAllRouteTimelinePlayback() {
    const playback = state.allRoutePlayback;
    cancelRouteFrame();
    state.isPlayingAllRoutes = false;
    if (playback) {
      playback.finished = true;
      playback.elapsedMs = playback.totalDurationMs;
      playback.timelineProgress = 1;
      playback.currentTime = playback.timelineEnd;
      renderAllRouteTimelineFrame(playback);
    }
    $("#playStatusTitle").textContent = "全部路线 · 播放完成";
    setProgressValue(100);
    setAllRoutePlayButtonLabel("重播全部路线");
  }

  function animateAllRouteTimelineFrame(now) {
    const playback = state.allRoutePlayback;
    if (!state.isPlayingAllRoutes || !playback) return;

    const lastFrameTime = playback.lastFrameTime || now;
    const elapsed = now - lastFrameTime;
    playback.lastFrameTime = now;
    playback.elapsedMs = Math.min(
      playback.totalDurationMs,
      (playback.elapsedMs || 0) + elapsed * getRouteSpeed(),
    );
    playback.timelineProgress = playback.totalDurationMs ? playback.elapsedMs / playback.totalDurationMs : 1;
    playback.currentTime = playback.timelineStart +
      (playback.timelineEnd - playback.timelineStart) * Math.max(0, Math.min(1, playback.timelineProgress));

    renderAllRouteTimelineFrame(playback);
    if (playback.timelineProgress >= 1) {
      finishAllRouteTimelinePlayback();
      return;
    }

    state.routeAnimationFrame = requestAnimationFrame(animateAllRouteTimelineFrame);
  }

  function startAllRoutePlayback(playback) {
    cancelRouteFrame();
    state.allRoutePlayback = playback;
    state.isPlayingAllRoutes = true;
    state.isPlayingRoute = false;
    state.routePlayback = null;
    state.routePlaybackMode = true;
    playback.lastFrameTime = performance.now();
    setAllRoutePlayButtonLabel("暂停全部");
    setRoutePlayButtonLabel("播放路线");
    state.routeAnimationFrame = requestAnimationFrame(animateAllRouteTimelineFrame);
  }

  async function playAllRoutesChronologically() {
    const existing = state.allRoutePlayback;
    if (isAllRouteTimelineIncomplete(existing)) {
      if (state.isPlayingAllRoutes) pauseAnimation();
      else startAllRoutePlayback(existing);
      return;
    }

    stopAnimation({ clearLayer: true, resetEvents: true });
    state.animatedRouteLayer.clearLayers();

    const items = await buildAllRoutePlaybackItems();
    if (!items.length) {
      flash("暂无可播放的路线时间段");
      return;
    }

    const bounds = L.latLngBounds([]);
    items.forEach(item => item.routeData.points.forEach(point => bounds.extend(point)));
    if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [36, 36] });

    const timelineStart = Math.min(...items.map(item => item.startTime || item.endTime).filter(Boolean));
    const timelineEnd = Math.max(...items.map(item => item.endTime || item.startTime).filter(Boolean));
    const playback = {
      items,
      timelineStart,
      timelineEnd,
      currentTime: timelineStart,
      elapsedMs: 0,
      totalDurationMs: Math.min(70000, Math.max(36000, items.length * 4200)),
      timelineProgress: 0,
      lastFrameTime: 0,
      lastEventTimeBucket: 0,
      finished: false,
    };

    state.allRoutePlayback = playback;
    state.routePlaybackEventIds = new Set();
    state.routePlaybackEventIndexes = new Map();
    state.routePlaybackMode = true;
    renderEventMarkers();
    renderAllRouteTimelineFrame(playback);
    startAllRoutePlayback(playback);
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
      if (!state.map.hasLayer(state.eventLayerGroup)) state.eventLayerGroup.addTo(state.map);
    } else {
      pauseAnimation();
      clearMovingPeople();
      state.map.removeLayer(state.eventLayerGroup);
    }
  }

  function resetView() {
    const bounds = L.latLngBounds([]);
    Object.values(state.routeLayers).forEach(item => {
      if (item.visible && item.layerGroup.getBounds().isValid()) bounds.extend(item.layerGroup.getBounds());
    });
    if (bounds.isValid()) state.map.fitBounds(bounds, { padding: [30, 30] });
  }

  // ★ 辅助：启用/禁用按钮
  function setButtonEnabled(enabled) {
    const btns = [
      '#poetryCloseBtn',
      '#poetryBackBtn',
      '#poetryPrevBtn',
      '#poetryNextBtn',
      '#poetrySwitchBtn',
      '#poetryVoiceBtn'
    ];
    btns.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.disabled = !enabled;
    });
  }

  // ★ 加载诗歌点
  async function loadPoetryPoints() {
    try {
      const response = await fetch("/api/poetry-points");
      const payload = await response.json();
      const data = payload.code === 200 ? payload.data : payload;
      state.poetryPoints = data.features || [];
      createPoetryLayer();
      console.log('✅ 诗歌点加载完成，数量:', state.poetryPoints.length);
    } catch (error) {
      console.warn("加载诗歌点失败:", error);
      state.poetryPoints = [];
    }
  }

async function loadAllPoems() {
  try {
    const response = await fetch("/api/poetry-content");
    if (!response.ok) throw new Error('加载诗歌列表失败');
    const payload = await response.json();
    const data = payload.code === 200 ? payload.data : payload;
    state.poetryList = data.poems || [];
    console.log('✅ 诗歌列表加载完成，数量:', state.poetryList.length);
    return state.poetryList;
  } catch (error) {
    console.error('加载诗歌列表失败:', error);
    state.poetryList = [];
    return [];
  }
}

  // ★ 打开诗词详情（卷轴弹窗）
async function openPoetryDetail(poemId, direction) {
  const openToken = ++state.poetryOpenToken;

  try {
    if (!state.poetryList.length) {
      await loadAllPoems();
    }

    let targetIndex = state.poetryList.findIndex((poem) => poem.id === poemId);

    if (direction === "prev") {
      targetIndex = Math.max(0, state.currentPoemIndex - 1);
    }

    if (direction === "next") {
      targetIndex = Math.min(state.poetryList.length - 1, state.currentPoemIndex + 1);
    }

    if (targetIndex === -1 || targetIndex >= state.poetryList.length) {
      flash('没有更多诗歌了');
      return;
    }

    const poem = state.poetryList[targetIndex];
    state.currentPoemIndex = targetIndex;

    let fullPoem = poem;

    if (!poem.text || poem.text.length < 10) {
      const response = await fetch(`/api/poetry/${poem.id}`);

      if (response.ok) {
        const payload = await response.json();
        fullPoem = payload.code === 200 ? payload.data : payload;
        state.poetryList[targetIndex] = fullPoem;
      }
    }

    if (openToken !== state.poetryOpenToken) {
      return;
    }

    const modal = document.getElementById('poetryModal');

    if (!modal) return;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('poetry-cursor-active');

    const wallPage = document.getElementById('poetryWallPage');
    const detailPage = document.getElementById('poetryDetailPage');
    const windowEl = document.getElementById('poetryWindow');

    if (wallPage) wallPage.classList.remove('active');
    if (detailPage) detailPage.classList.add('active');
    if (windowEl) windowEl.classList.add('detail-mode');

    const titleEl = document.getElementById('poetryDetailTitle');
    const metaEl = document.getElementById('poetryDetailMeta');
    const textEl = document.getElementById('poetryDetailText');
    const placeNameEl = document.getElementById('poetryPlaceName');
    const placePositionEl = document.getElementById('poetryPlacePosition');
    const placeStoryEl = document.getElementById('poetryPlaceStory');
    const ancientImgEl = document.getElementById('poetryAncientImg');
    const modernImgEl = document.getElementById('poetryModernImg');
    const poetImgEl = document.getElementById('poetryPoetImg');

    const poetryImages = {
      poem_001: "/assets/images/poetry/VCG211634570806.jpg",
      poem_002: "/assets/images/poetry/VCG211620090490.png",
      poem_003: "/assets/images/poetry/VCG211611345420.jpg",
      poem_004: "/assets/images/poetry/OIP.webp",
      poem_005: "/assets/images/poetry/VCG211643672387.jpg",
      poem_006: "/assets/images/poetry/O1CN01a4fN2C1f43yrCr9ya_!!533673952.jpg_q90.webp",
      poem_007: "/assets/images/poetry/VCG211444428325.jpg",
      poem_008: "/assets/images/poetry/VCG211353582315.jpg",
      poem_009: "/assets/images/poetry/VCG211458592604.jpg",
      poem_010: "/assets/images/poetry/VCG211611345420.jpg",
    };

    const poetryAnalysis = {
      poem_001: {
        theme: "全程概括与胜利叙事",
        geography: "诗中把五岭、乌蒙、金沙江、大渡河、岷山等关键地理障碍连成一条完整长征空间链，适合和主路线、渡江点、雪山点联动理解。",
        history: "作品写于中央红军到达陕北后，是对长征艰难历程的高度概括，也把军事转移升华为革命意志的集中表达。",
        spirit: "突出“不怕远征难”的坚定信念、战略乐观和革命英雄主义。",
        study: "研学时可让学生按诗句标注地理节点，比较“山、水、桥、雪”四类障碍对应的行军困难。"
      },
      poem_002: {
        theme: "娄山关战斗与转折豪情",
        geography: "娄山关位于黔北山地要冲，地势险峻，是理解红军突破封锁、夺取主动的重要地形节点。",
        history: "遵义会议后，红军取得娄山关大捷，诗词中的悲壮声响与“从头越”的气势共同表现革命重新出发。",
        spirit: "体现面对险关不退缩、在困难中重建信心的奋斗精神。",
        study: "可结合遵义会议、娄山关战斗和黔北地形，讨论为什么战略方向调整会影响部队行动成效。"
      },
      poem_003: {
        theme: "群山意象与长征初期行军",
        geography: "湘桂黔山区山高路险、道路曲折，是长征初期红军连续行军和摆脱围追堵截的重要地理背景。",
        history: "三首小令以“山”为核心意象，写出红军在复杂山地环境中快速行军、突破险阻的状态。",
        spirit: "突出不畏艰险、勇往直前和革命队伍作为中流砥柱的担当。",
        study: "可观察山区地形与路线弯曲度，分析山地对行军速度、后勤补给和路线选择的影响。"
      },
      poem_004: {
        theme: "六盘山与胜利在望",
        geography: "六盘山是长征后期的重要山地节点，翻越此处意味着中央红军接近陕北根据地。",
        history: "作品写于长征即将胜利之时，“不到长城非好汉”把空间跋涉转化为坚定目标意识。",
        spirit: "体现必胜信念、革命理想和继续斗争的昂扬姿态。",
        study: "可把六盘山与会宁、吴起镇等终段节点连读，理解长征末期的胜利会合脉络。"
      },
      poem_005: {
        theme: "昆仑想象与世界胸怀",
        geography: "昆仑作为高大山脉意象，承载了雪山、高寒、边地等宏阔自然景观。",
        history: "诗人借昆仑抒发改造旧世界的宏大理想，把长征胜利前后的革命视野推向更广阔空间。",
        spirit: "体现胸怀天下、敢于变革和追求共同未来的理想主义。",
        study: "可结合雪山草地段，讨论自然地理意象如何转化为革命诗词中的精神象征。"
      },
      poem_006: {
        theme: "吴起镇与将帅精神",
        geography: "吴起镇是中央红军长征到达陕北后的关键节点，具有终点和新起点的双重意义。",
        history: "诗作赞扬彭德怀及红军将士在长征尾声仍能英勇作战、击退追敌。",
        spirit: "体现英勇斗争、临危不惧和将士同心。",
        study: "可结合吴起镇战斗与终点位置，分析长征胜利并非停止斗争，而是革命力量重新集结。"
      },
      poem_007: {
        theme: "北国雪景与革命气象",
        geography: "陕北、黄河、长城等北方意象构成宏阔空间背景，和长征胜利后的战略新阶段相连接。",
        history: "虽作于长征胜利之后，但常被视为长征精神的延伸，展现革命队伍到达北方后的历史自信。",
        spirit: "体现历史担当、时代自信和开创新局面的气魄。",
        study: "可把诗中北国意象与陕北根据地结合，讨论地理空间转换如何影响革命叙事。"
      },
      poem_008: {
        theme: "会昌高峰与长征前夜",
        geography: "会昌处在赣南山地，诗中高峰、南粤等意象展示中央苏区周边地理视野。",
        history: "作品写于长征前，能帮助理解红军出发前的环境、心境和战略背景。",
        spirit: "体现革命乐观主义和在复杂局面中保持信心的精神状态。",
        study: "可与瑞金、于都出发节点关联，梳理长征前中央苏区的空间格局。"
      },
      poem_009: {
        theme: "井冈山斗争与根据地经验",
        geography: "井冈山山地易守难攻，黄洋界等地形节点体现了山地根据地的防御优势。",
        history: "诗作表现井冈山时期根据地军民团结、壁垒森严的斗争经验，是理解长征精神源流的重要补充。",
        spirit: "体现众志成城、坚定信念和依靠群众的革命传统。",
        study: "可比较井冈山山地防御与长征山地行军，理解地形在不同革命阶段的作用差异。"
      },
      poem_010: {
        theme: "突围战斗与长征初期艰险",
        geography: "镇远、石阡一带山谷狭窄、道路迂回，是红军面对封锁和突围压力的典型地形环境。",
        history: "作品记录长征初期被围追堵截、兵疲粮少的困难处境，呈现基层行军作战的真实艰辛。",
        spirit: "体现顽强突围、百折不挠和艰苦奋斗。",
        study: "可结合路线狭窄处、敌军封锁线和补给困难，讨论为什么长征路线选择充满风险。"
      },
    };

    const poemImage = poetryImages[fullPoem.id] || "/assets/images/poetry/source-poet-placeholder.png";
    const analysis = poetryAnalysis[fullPoem.id] || {
      theme: fullPoem.stage || "长征诗词",
      geography: "该诗词与长征沿线地理节点、路线转折和历史事件存在空间关联。",
      history: fullPoem.description || "作品呈现长征历史记忆与革命叙事。",
      spirit: "体现坚定信念、艰苦奋斗、团结协作和勇于胜利的长征精神。",
      study: "可结合地图点位、路线动画和事件详情开展诗词—地理—历史综合研学。"
    };
    const formattedText = String(fullPoem.text || "")
      .replace(/。/g, "。\n")
      .replace(/！/g, "！\n")
      .replace(/？/g, "？\n")
      .replace(/；/g, "；\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    if (titleEl) titleEl.textContent = `《${fullPoem.title}》`;
    if (metaEl) metaEl.textContent = `${fullPoem.author} · ${fullPoem.year}`;
    if (textEl) textEl.textContent = formattedText;
    if (placeNameEl) placeNameEl.textContent = fullPoem.places ? fullPoem.places.join('、') : '长征沿线';
    if (placePositionEl) placePositionEl.textContent = `位置：${fullPoem.provinces ? fullPoem.provinces.join('、') : ''}`;
    if (placeStoryEl) placeStoryEl.textContent = fullPoem.description || '';
    if (ancientImgEl) ancientImgEl.src = "/assets/images/poetry/source-bg.jpg";
    if (modernImgEl) modernImgEl.src = "/assets/images/poetry/source-bg.jpg";
    if (poetImgEl) poetImgEl.src = poemImage;

    let analysisBox = document.querySelector(".poetry-analysis");

    if (!analysisBox && detailPage) {
      analysisBox = document.createElement("section");
      analysisBox.className = "poetry-analysis";
      detailPage.appendChild(analysisBox);
    }

    if (analysisBox) {
      analysisBox.innerHTML = `
        <b>诗词解读</b>
        <dl>
          <dt>主题</dt>
          <dd>${analysis.theme}</dd>
          <dt>地理关联</dt>
          <dd>${analysis.geography}</dd>
          <dt>历史语境</dt>
          <dd>${analysis.history}</dd>
          <dt>精神内涵</dt>
          <dd>${analysis.spirit}</dd>
          <dt>研学提示</dt>
          <dd>${analysis.study}</dd>
        </dl>
      `;
    }

    if (detailPage) {
      detailPage.classList.remove("show-analysis");
    }

    const switchText = document.getElementById("poetrySwitchText");

    if (switchText) {
      switchText.textContent = "析";
    }

    updatePoetryNavButtons(targetIndex);
    setButtonEnabled(true);

    console.log('✅ 打开诗歌:', fullPoem.title, `(${targetIndex + 1}/${state.poetryList.length})`);
  } catch (error) {
    console.error('打开诗歌失败:', error);
    flash('加载诗歌失败');
  }
}

function updatePoetryNavButtons(currentIndex) {
  const prevBtn = document.getElementById('poetryPrevBtn');
  const nextBtn = document.getElementById('poetryNextBtn');
  
  if (prevBtn) {
    prevBtn.disabled = true;
    prevBtn.style.display = 'none';
  }
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.style.display = 'none';
  }
}

// ★ 地图点位诗词只展示本地点对应诗歌，不做跨地点切换
function prevPoem() {
  flash('当前点位仅展示对应诗词');
}

// ★ 地图点位诗词只展示本地点对应诗歌，不做跨地点切换
function nextPoem() {
  flash('当前点位仅展示对应诗词');
}

// ★ 关闭诗歌弹窗（不返回卷轴墙）
function closePoetryModal() {
  const modal = document.getElementById('poetryModal');
  if (modal) {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('poetry-cursor-active');
  
  // 停止语音朗读
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  
  state.currentPoemIndex = -1;
  state.poetryOpenToken += 1;
}


  // ★ 创建诗歌点图层
function createPoetryLayer() {
  if (state.poetryLayer) {
    state.map.removeLayer(state.poetryLayer);
  }
  
  state.poetryLayer = L.layerGroup();

  state.poetryPoints.forEach(feature => {
    const props = feature.properties || {};
    const coords = feature.geometry?.coordinates || [0, 0];
    const lat = coords[1];
    const lng = coords[0];
    const poemId = props.poem_id;

    const icon = L.divIcon({
      className: 'poetry-point-icon',
      html: `
        <div class="poetry-point-marker" data-poem-id="${poemId}" title="${props.poem_title || props.name || '长征诗词'}">
          <span class="poetry-icon">📜</span>
          <span class="poetry-tooltip">${props.name}</span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([lat, lng], {
      icon: icon,
      zIndexOffset: 800,
    });

    // ★ 点击直接打开卷轴显示诗歌
    marker.on('click', function() {
      // 先加载诗歌列表，再打开
      if (!state.poetryList.length) {
        loadAllPoems().then(() => {
          openPoetryDetail(poemId);
        });
      } else {
        openPoetryDetail(poemId);
      }
    });

    marker.addTo(state.poetryLayer);
  });

  state.poetryLayer.addTo(state.map);
  state.poetryVisible = true;
  
  const poetryToggle = document.getElementById('poetryToggle');
  if (poetryToggle) {
    poetryToggle.dataset.visible = 'true';
    poetryToggle.textContent = '隐藏诗词点';
    poetryToggle.classList.remove('is-off');
  }
  
  console.log('✅ 诗歌点已显示，数量:', state.poetryPoints.length);
}

  // ★ 切换诗歌点显示
  function togglePoetryLayer(visible) {
    console.log('togglePoetryLayer 调用:', visible);
    
    state.poetryVisible = visible;
    
    if (state.poetryLayer) {
      if (visible) {
        if (!state.map.hasLayer(state.poetryLayer)) {
          state.poetryLayer.addTo(state.map);
        }
        flash('诗词点已显示');
      } else {
        if (state.map.hasLayer(state.poetryLayer)) {
          state.map.removeLayer(state.poetryLayer);
        }
        flash('诗词点已隐藏');
      }
    } else {
      console.warn('poetryLayer 未创建，尝试重新加载');
      loadPoetryPoints();
    }
  }

async function initApp() {
  initMap();
  initLayerGroups();
  renderDefaultDetail();
  await loadHomeContextData();

  state.routeConfigs = await DataService.getRouteLayers();
  const firstKey = state.routeConfigs[0]?.layer_key || "";
  renderRouteControls();

  await Promise.all(state.routeConfigs.map(config => renderRouteLayer(config)));

  const events = await DataService.getEventTimeline();
  state.eventTimeline = enrichEvents(events.features || []);
  state.eventFeatures = state.eventTimeline;
  buildNearbyEventCaches();

  // ★ 加载诗歌点数据 和 诗歌列表
  await loadPoetryPoints();
  await loadAllPoems();

  if (firstKey && state.routeLayers[firstKey]) {
    toggleRouteLayer(firstKey, true);
    const input = document.querySelector(`#routeLayerList input[data-route-layer="${firstKey}"]`);
    if (input) input.checked = true;
  }

  const routeSelect = $("#routeSelect");
  if (routeSelect) routeSelect.value = firstKey || "";

  resetView();
}



  // ★ 暴露全局方法
  window.IndexMap = {
    state,
    initApp,
    resetView,
    toggleRouteLayer,
    setEventFilter,
    setActiveRouteFilter,
    setEventLayerVisible,
    playEventsTimeline,
    playSelectedRoute,
    playAllRoutesChronologically,
    playPrevious,
    playNext,
    pauseAnimation,
    seekRouteProgress,
    flash,
    togglePoetryLayer,
    loadPoetryPoints,
    openPoetryDetail,
    prevPoem,           // ★ 暴露上一首
    nextPoem,           // ★ 暴露下一首
    closePoetryModal,   // ★ 暴露打开诗歌方法
  };
})();
