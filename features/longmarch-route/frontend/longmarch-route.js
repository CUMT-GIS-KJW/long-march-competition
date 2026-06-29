(function () {
  const state = {
    routes: [],
    stages: [],
    events: [],
    currentIndex: 0,
    selectedStage: "",
  };

  const fallbackRoutes = [
    {
      id: "central-red-army",
      name: "中央红军长征分析路线",
      stage: "中央红军",
      days: 368,
      distanceKm: 12500,
      summary: "从瑞金出发，经遵义、泸定桥、雪山草地到达陕北，体现长征主要空间转折过程。",
      points: [
        { name: "瑞金", lng: 116.03, lat: 25.89, date: "1934.10", event: "中央红军主力开始长征。" },
        { name: "遵义", lng: 106.93, lat: 27.73, date: "1935.01", event: "遵义会议召开，是长征中的重要转折。" },
        { name: "泸定桥", lng: 102.23, lat: 29.91, date: "1935.05", event: "飞夺泸定桥，突破大渡河天险。" },
        { name: "夹金山", lng: 102.86, lat: 30.87, date: "1935.06", event: "翻越雪山，进入更加艰苦的行军阶段。" },
        { name: "吴起镇", lng: 108.18, lat: 36.93, date: "1935.10", event: "中央红军到达陕北，胜利完成战略转移。" },
      ],
    },
    {
      id: "zunyi-turning",
      name: "遵义转折节点分析线",
      stage: "转折阶段",
      days: 45,
      distanceKm: 860,
      summary: "围绕遵义会议前后路线变化，展示战略方向调整与关键节点关联。",
      points: [
        { name: "乌江", lng: 106.62, lat: 27.08, date: "1935.01", event: "强渡乌江，为进入遵义创造条件。" },
        { name: "遵义", lng: 106.93, lat: 27.73, date: "1935.01", event: "召开遵义会议。" },
        { name: "娄山关", lng: 106.85, lat: 28.13, date: "1935.02", event: "娄山关战斗取得胜利。" },
        { name: "赤水", lng: 105.70, lat: 28.59, date: "1935.03", event: "四渡赤水机动作战。" },
      ],
    },
    {
      id: "snow-grassland",
      name: "雪山草地艰险环境分析线",
      stage: "艰险环境",
      days: 72,
      distanceKm: 1280,
      summary: "突出雪山、草地、高寒地区对行军组织、补给与路线选择的影响。",
      points: [
        { name: "泸定", lng: 102.23, lat: 29.91, date: "1935.05", event: "突破大渡河后继续北上。" },
        { name: "宝兴", lng: 102.82, lat: 30.37, date: "1935.06", event: "进入雪山地区。" },
        { name: "夹金山", lng: 102.86, lat: 30.87, date: "1935.06", event: "翻越第一座大雪山。" },
        { name: "毛儿盖", lng: 103.04, lat: 32.10, date: "1935.08", event: "筹备过草地。" },
        { name: "若尔盖", lng: 102.96, lat: 33.58, date: "1935.08", event: "穿越草地，环境极其艰苦。" },
      ],
    },
    {
      id: "meeting-north",
      name: "陕甘会师收束分析线",
      stage: "胜利会师",
      days: 60,
      distanceKm: 920,
      summary: "展示红军到达陕甘区域后的会师、整编与胜利落点。",
      points: [
        { name: "哈达铺", lng: 104.22, lat: 34.08, date: "1935.09", event: "获得陕北根据地消息。" },
        { name: "榜罗镇", lng: 105.26, lat: 35.18, date: "1935.09", event: "召开榜罗镇会议。" },
        { name: "吴起镇", lng: 108.18, lat: 36.93, date: "1935.10", event: "中央红军到达陕北。" },
        { name: "会宁", lng: 105.05, lat: 35.69, date: "1936.10", event: "红军三大主力会师。" },
      ],
    },
  ];

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`request failed: ${url}`);
    const payload = await response.json();
    return payload && payload.code === 200 ? payload.data : payload;
  }

  function normalizePoint(point, index) {
    if (Array.isArray(point)) {
      return { name: `节点${index + 1}`, lng: Number(point[0]), lat: Number(point[1]) };
    }
    const lng = Number(point.lng ?? point.lon ?? point.longitude ?? point.x ?? point.coordinates?.[0]);
    const lat = Number(point.lat ?? point.latitude ?? point.y ?? point.coordinates?.[1]);
    return {
      name: point.name || point.title || point.place || point.label || `节点${index + 1}`,
      lng,
      lat,
      date: point.date || point.time || point.year || "",
      event: point.event || point.desc || point.description || point.summary || "",
    };
  }

  function normalizeRoute(route, index) {
    const props = route.properties || route;
    let rawPoints = route.points || route.nodes || route.stops || props.points || props.nodes || [];
    if (!rawPoints.length && route.geometry?.coordinates) {
      rawPoints = route.geometry.coordinates.map((item) => Array.isArray(item[0]) ? item[0] : item);
    }
    const points = rawPoints.map(normalizePoint).filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));
    return {
      id: String(props.id || route.id || `route_${index}`),
      name: props.name || props.title || props.routeName || `长征分析路线 ${index + 1}`,
      stage: props.stage || props.type || props.category || "综合分析",
      days: Number(props.days || props.duration || points.length || 0),
      distanceKm: Number(props.distanceKm || props.distance || props.length || 0),
      summary: props.summary || props.description || props.desc || "该路线用于展示长征关键节点、事件关联与空间转折过程。",
      points,
    };
  }

  async function loadData() {
    showLoading(true);
    try {
      const data = await fetchJson("/api/longmarch-route/routes");
      state.routes = (data.routes || []).map(normalizeRoute).filter((route) => route.points.length >= 2);
      state.stages = data.stages || [];
      state.events = data.events || [];
    } catch (error) {
      console.warn(error);
      state.routes = fallbackRoutes;
      state.stages = [...new Set(fallbackRoutes.map((item) => item.stage))];
      state.events = [];
    }
    if (!state.routes.length) state.routes = fallbackRoutes;
    renderFilters();
    renderCards();
    renderCurrentRoute();
    showLoading(false);
  }

  function showLoading(show) {
    let loading = $("#lmLoading");
    if (!loading) {
      loading = document.createElement("div");
      loading.id = "lmLoading";
      loading.className = "lm-loading";
      loading.innerHTML = `<div class="lm-ring" id="lmRing" data-progress="0%" style="--p:0%"></div>`;
      document.body.appendChild(loading);
    }
    loading.classList.toggle("show", show);
    if (!show) return;
    let value = 0;
    const ring = $("#lmRing");
    const timer = setInterval(() => {
      value = Math.min(100, value + Math.ceil(Math.random() * 16));
      ring.style.setProperty("--p", `${value}%`);
      ring.dataset.progress = `${value}%`;
      if (value >= 100) clearInterval(timer);
    }, 120);
  }

  function renderFilters() {
    const routeSelect = $("#routeSelect");
    const stageSelect = $("#stageSelect");
    routeSelect.innerHTML = state.routes
      .map((route, index) => `<option value="${index}">${escapeHtml(route.name)}</option>`)
      .join("");
    const stages = [...new Set([...(state.stages || []), ...state.routes.map((item) => item.stage)].filter(Boolean))];
    stageSelect.innerHTML = [`<option value="">全部阶段</option>`, ...stages.map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`)].join("");
  }

  function filteredRoutes() {
    const stage = $("#stageSelect")?.value || "";
    const keyword = $("#keywordInput")?.value.trim() || "";
    return state.routes.filter((route) => {
      if (stage && route.stage !== stage) return false;
      if (keyword) {
        const text = `${route.name} ${route.stage} ${route.summary} ${route.points.map((point) => `${point.name} ${point.event}`).join(" ")}`;
        return text.includes(keyword);
      }
      return true;
    });
  }

  function renderCards() {
    const routes = filteredRoutes();
    const cards = routes.slice(0, 4);
    $("#routeCards").innerHTML = cards.map((route) => {
      const originalIndex = state.routes.indexOf(route);
      const width = Math.min(100, 28 + route.points.length * 12);
      return `
        <article class="lm-route-card ${originalIndex === state.currentIndex ? "active" : ""}" data-route-index="${originalIndex}">
          <h4>${escapeHtml(route.name)}</h4>
          <p>${escapeHtml(route.summary).slice(0, 54)}${route.summary.length > 54 ? "……" : ""}</p>
          <div class="lm-card-progress"><i style="--w:${width}%"></i></div>
        </article>
      `;
    }).join("");
    document.querySelectorAll(".lm-route-card").forEach((card) => {
      card.addEventListener("click", () => {
        state.currentIndex = Number(card.dataset.routeIndex);
        renderCurrentRoute();
      });
    });
  }

  function renderCurrentRoute() {
    const route = state.routes[state.currentIndex] || state.routes[0] || fallbackRoutes[0];
    const select = $("#routeSelect");
    if (select) select.value = String(state.currentIndex);
    $("#routeTitle").textContent = route.name;
    renderMetrics(route);
    renderSvgRoute(route);
    renderDetail(route.points[0], route);
    renderCards();
  }

  function renderMetrics(route) {
    const eventCount = route.points.filter((point) => point.event).length;
    $("#routeMetrics").innerHTML = `
      <article><b>${escapeHtml(route.stage)}</b><span>阶段</span></article>
      <article><b>${route.points.length}</b><span>节点</span></article>
      <article><b>${route.distanceKm ? Math.round(route.distanceKm) : "--"}</b><span>里程 km</span></article>
      <article><b>${eventCount}</b><span>事件</span></article>
    `;
  }

  function projectPoints(points) {
    const minLng = Math.min(...points.map((point) => point.lng));
    const maxLng = Math.max(...points.map((point) => point.lng));
    const minLat = Math.min(...points.map((point) => point.lat));
    const maxLat = Math.max(...points.map((point) => point.lat));
    const width = 600;
    const height = 275;
    const padX = 62;
    const padY = 56;
    const lngSpan = Math.max(1, maxLng - minLng);
    const latSpan = Math.max(1, maxLat - minLat);
    return points.map((point) => ({
      ...point,
      x: padX + ((point.lng - minLng) / lngSpan) * width,
      y: padY + ((maxLat - point.lat) / latSpan) * height,
    }));
  }

  function smoothPath(projected) {
    if (projected.length < 2) return "";
    let d = `M ${projected[0].x} ${projected[0].y}`;
    for (let i = 1; i < projected.length; i += 1) {
      const prev = projected[i - 1];
      const current = projected[i];
      const midX = (prev.x + current.x) / 2;
      const midY = (prev.y + current.y) / 2 - (i % 2 ? 24 : -18);
      d += ` Q ${midX} ${midY} ${current.x} ${current.y}`;
    }
    return d;
  }

  function renderSvgRoute(route) {
    const svg = $("#routeSvg");
    const points = projectPoints(route.points);
    const d = smoothPath(points);
    const nodes = points.map((point, index) => `
      <g class="route-node" data-point-index="${index}">
        <circle cx="${point.x}" cy="${point.y}" r="13"></circle>
        <circle cx="${point.x}" cy="${point.y}" r="5"></circle>
        <text x="${point.x + 16}" y="${point.y - 12}">${escapeHtml(point.name)}</text>
      </g>
    `).join("");
    svg.innerHTML = `
      <defs>
        <filter id="paperBlur"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <path class="route-base-line" d="${d}"></path>
      <path class="route-active-line" d="${d}"></path>
      ${nodes}
    `;
    svg.querySelectorAll(".route-node").forEach((node) => {
      node.addEventListener("click", () => {
        renderDetail(route.points[Number(node.dataset.pointIndex)], route);
      });
    });
  }

  function renderDetail(point, route) {
    $("#detailCard").innerHTML = `
      <span>DETAIL</span>
      <h3>${escapeHtml(point.name)}</h3>
      <div class="lm-detail-row"><span>所属路线</span><b>${escapeHtml(route.name)}</b></div>
      <div class="lm-detail-row"><span>时间</span><b>${escapeHtml(point.date || "待补充")}</b></div>
      <div class="lm-detail-row"><span>坐标</span><b>${point.lng.toFixed(3)}, ${point.lat.toFixed(3)}</b></div>
      <p>${escapeHtml(point.event || route.summary || "该节点为长征路线分析中的重要空间节点。")}</p>
    `;
  }

  function bindEvents() {
    $("#routeSelect").addEventListener("change", (event) => {
      state.currentIndex = Number(event.target.value);
      renderCurrentRoute();
    });
    $("#stageSelect").addEventListener("change", () => {
      renderCards();
    });
    $("#applyBtn").addEventListener("click", () => {
      const routes = filteredRoutes();
      if (routes.length) state.currentIndex = state.routes.indexOf(routes[0]);
      showLoading(true);
      setTimeout(() => {
        showLoading(false);
        renderCurrentRoute();
      }, 720);
    });
    $("#reloadBtn").addEventListener("click", loadData);
    $("#prevRouteBtn").addEventListener("click", () => {
      state.currentIndex = (state.currentIndex - 1 + state.routes.length) % state.routes.length;
      renderCurrentRoute();
    });
    $("#nextRouteBtn").addEventListener("click", () => {
      state.currentIndex = (state.currentIndex + 1) % state.routes.length;
      renderCurrentRoute();
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await loadData();
  });
})();
