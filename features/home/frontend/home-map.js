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
    routePlayback: null,
    routeHeadMarker: null,
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
  }

  function initLayerGroups() {
    state.eventLayerGroup = L.layerGroup().addTo(state.map);
    state.movingPeopleLayer = L.layerGroup().addTo(state.map);
    state.animatedRouteLayer = L.layerGroup().addTo(state.map);
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
    state.routePlayback = null;
    state.routeHeadMarker = null;
    state.activeRouteKey = "";
    if (clearLayer) state.animatedRouteLayer.clearLayers();
    if (resetEvents) {
      state.routePlaybackMode = false;
      state.routePlaybackEventIds = new Set();
      state.routePlaybackEventIndexes = new Map();
      renderEventMarkers();
    }
    setRoutePlayButtonLabel("播放路线");
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
    clearInterval(state.eventTimer);
    clearInterval(state.routeTimer);
    cancelRouteFrame();
    if (state.routePlayback && state.routePlayback.progress < 1) {
      setRoutePlayButtonLabel("继续路线");
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

  function buildRoutePoints(collection) {
    const orderedRouteParts = buildOrderedRouteParts(collection);
    const points = [];
    const cumulativeDistances = [];
    const segments = [];
    const parts = [];
    let totalDistance = 0;

    orderedRouteParts.forEach(routePart => {
      const startIndex = points.length;
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
        startIndex,
        endIndex: points.length - 1,
      };
      parts.push(part);
      segments.push(part);
    });

    return { points, cumulativeDistances, totalDistance, segments, parts };
  }

  function findSegmentByPointIndex(segments, index) {
    return segments.find(s => index >= s.startIndex && index <= s.endIndex) || segments[0];
  }

  function getRenderedRouteParts(routeData, index) {
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

  function createRouteHeadIcon() {
    return L.divIcon({
      className: "march-head-icon",
      html: `<div class="march-head"><i></i><span></span></div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  function updateRouteHead(playback, index) {
    const point = playback.routeData.points[index];
    if (!point) return;
    if (!state.routeHeadMarker) {
      state.routeHeadMarker = L.marker(point, {
        icon: createRouteHeadIcon(),
        zIndexOffset: 720,
        interactive: false,
      }).addTo(state.animatedRouteLayer);
      return;
    }
    state.routeHeadMarker.setLatLng(point);
  }

  function renderRoutePlaybackFrame(playback, updateRange = true) {
    const routeData = playback.routeData;
    const index = findPointIndexByProgress(routeData, playback.progress);
    const rendered = getRenderedRouteParts(routeData, index);
    playback.glow.setLatLngs(rendered);
    playback.line.setLatLngs(rendered);
    updateRouteHead(playback, index);
    updateRoutePlaybackEvents(index);

    const segment = findSegmentByPointIndex(routeData.segments, index);
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

  async function initApp() {
    initMap();
    initLayerGroups();
    renderDefaultDetail();

    state.routeConfigs = await DataService.getRouteLayers();
    const firstKey = state.routeConfigs[0]?.layer_key || "";
    renderRouteControls();

    await Promise.all(state.routeConfigs.map(config => renderRouteLayer(config)));

    const events = await DataService.getEventTimeline();
    state.eventTimeline = enrichEvents(events.features || []);
    state.eventFeatures = state.eventTimeline;
    buildNearbyEventCaches();

    if (firstKey && state.routeLayers[firstKey]) {
      toggleRouteLayer(firstKey, true);
      const input = document.querySelector(`#routeLayerList input[data-route-layer="${firstKey}"]`);
      if (input) input.checked = true;
    }

    const routeSelect = $("#routeSelect");
    if (routeSelect) routeSelect.value = firstKey || "";

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
    playEventsTimeline,
    playSelectedRoute,
    playPrevious,
    playNext,
    pauseAnimation,
    seekRouteProgress,
    flash,
  };
})();
