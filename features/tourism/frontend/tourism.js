(function () {
  const state = {
    map: null,
    resourceLayer: null,
    routeLayer: null,
    resources: [],
    options: null,
    markers: new Map(),
  };

  const categoryMeta = {
    site: { label: "旧址", color: "#8E7DBE", icon: "" },
    museum: { label: "馆", color: "#A98467", icon: "" },
    scenic: { label: "景", color: "#7A9EBD", icon: "" },
    other: { label: "红", color: "#B56576", icon: "" },
  };

  const palette = [
    "#E63946",
    "#1D3557",
    "#2A9D8F",
    "#F4A261",
    "#7B2CBF",
    "#457B9D",
    "#B56576",
    "#6D6875",
  ];

  const $ = (selector) => document.querySelector(selector);

  function flash(message) {
    const toast = $("#toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => toast.classList.remove("show"), 1500);
  }

  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`request failed: ${url}`);
    }

    const payload = await response.json();

    return payload && payload.code === 200 ? payload.data : payload;
  }

  function initMap() {
    state.map = L.map("tourismMap", {
      center: APP_CONFIG.map.center,
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
    });

    L.tileLayer(
      APP_CONFIG.basemaps.ancient.url,
      APP_CONFIG.basemaps.ancient.options,
    ).addTo(state.map);

    state.resourceLayer = L.layerGroup().addTo(state.map);
    state.routeLayer = L.layerGroup().addTo(state.map);
  }

  function fillSelect(select, items, firstLabel) {
    select.innerHTML = [
      `<option value="">${firstLabel}</option>`,
      ...items.map((item) => {
        if (typeof item === "string") {
          return `<option value="${item}">${item}</option>`;
        }

        return `<option value="${item.value}">${item.label}</option>`;
      }),
    ].join("");
  }

  function preferredCities(cities) {
    const priority = [
      "甘孜藏族自治州",
      "阿坝藏族羌族自治州",
      "雅安市",
      "遵义市",
      "赣州市",
      "凉山彝族自治州",
      "延安市",
      "会宁县",
    ];
    const result = [
      ...priority.filter((city) => cities.includes(city)),
      ...cities.filter((city) => !priority.includes(city)).slice(0, 16),
    ];

    return result.slice(0, 18);
  }

  async function loadOptions() {
    state.options = await fetchJson("/api/tourism/options");

    fillSelect($("#provinceSelect"), state.options.provinces, "全部省份");
    fillSelect($("#categorySelect"), state.options.categories, "全部类型");
    fillSelect($("#themeSelect"), state.options.themes, "选择研学主题");
  }

  function resourceQuery() {
    const params = new URLSearchParams();
    const province = $("#provinceSelect").value;
    const category = $("#categorySelect").value;
    const keyword = $("#keywordInput").value.trim();

    if (province) {
      params.set("province", province);
    }

    if (category) {
      params.set("category", category);
    }

    if (keyword) {
      params.set("keyword", keyword);
    }

    return params;
  }

  async function loadResources() {
    clearRoute();
    const data = await fetchJson(`/api/tourism/resources?${resourceQuery().toString()}`);

    state.resources = data.resources || [];
    $("#resourceTotal").textContent = String(data.total || state.resources.length);
    renderResourceMarkers();
    renderCharts(data.charts || {});

    if (state.resources.length) {
      fitBounds(state.resources);
    }
  }

  function createResourceIcon(resource, active = false) {
    const meta = categoryMeta[resource.category] || categoryMeta.other;
    const size = active ? 34 : resource.featured ? 25 : 18;

    return L.divIcon({
      className: "",
      html: `
        <div class="resource-marker ${active ? "focus" : ""}" style="--size:${size}px;--color:${meta.color}">
          <i></i>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });
  }

  function renderResourceMarkers(resources = state.resources, focusIds = new Set()) {
    state.resourceLayer.clearLayers();
    state.markers.clear();

    resources.forEach((resource) => {
      const active = focusIds.has(resource.id);
      const marker = L.marker([resource.lat, resource.lng], {
        icon: createResourceIcon(resource, active),
        zIndexOffset: active ? 900 : 500,
      });

      marker.on("click", () => {
        showResourceDetail(resource);
        state.map.flyTo([resource.lat, resource.lng], Math.max(state.map.getZoom(), 8), {
          duration: 0.55,
        });
      });

      marker.addTo(state.resourceLayer);
      state.markers.set(resource.id, marker);
    });
  }

  function showResourceDetail(resource) {
    const meta = categoryMeta[resource.category] || categoryMeta.other;

    $("#detailPanel").innerHTML = `
      <span class="panel-kicker">RESOURCE DETAIL</span>
      <h2>${resource.name}</h2>
      <p>该点位于 <b>${resource.province || "-"}</b>${resource.city ? ` · ${resource.city}` : ""}，是${meta.label}类红色旅游资源。</p>
      <div class="detail-grid">
        <div class="detail-row"><span>省份</span><b>${resource.province || "-"}</b></div>
        <div class="detail-row"><span>城市</span><b>${resource.city || "-"}</b></div>
        <div class="detail-row"><span>地址</span><b>${resource.address || "-"}</b></div>
        <div class="detail-row"><span>类型</span><b>${resource.type || meta.label}</b></div>
        <div class="detail-row"><span>坐标</span><b>${resource.lng}, ${resource.lat}</b></div>
      </div>
    `;
  }

  function fitBounds(resources) {
    const bounds = L.latLngBounds(resources.map((item) => [item.lat, item.lng]));

    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [52, 52],
      });
    }
  }

  function showAnalysis(show) {
    $("#analysisOverlay").classList.toggle("show", show);
  }

  async function generateRoute() {
    showAnalysis(true);
    state.routeLayer.clearLayers();

    const params = new URLSearchParams();
    const theme = $("#themeSelect").value || "meeting";
    const days = $("#daysSelect").value;
    const province = $("#provinceSelect").value;

    params.set("theme", theme);
    params.set("days", days);

    if (province) {
      params.set("province", province);
    }

    await new Promise((resolve) => setTimeout(resolve, 900));

    const route = await fetchJson(`/api/tourism/study-route?${params.toString()}`);

    showAnalysis(false);
    renderStudyRoute(route);
    renderRelatedEvents(route.relatedEvents || []);
    renderCharts(route.charts || {});
    $("#routeDistance").textContent = route.totalDistanceKm || "--";

    renderResourceMarkers(
      route.provinceResources || route.resources,
      new Set(route.resources.map((item) => item.id)),
    );
    showArcRoute(route);
    flash("研学方案和空间路线已生成");
  }

  function renderStudyRoute(route) {
    $("#routePanel").innerHTML = `
      <span class="panel-kicker">ROUTE PLAN</span>
      <div class="route-summary">
        <h3>${route.title}</h3>
        <div class="route-tags">
          <span>出发：中国矿业大学（南湖校区）</span>
          <span>终点：${route.resources[route.resources.length - 1]?.name || "研学总结点"}</span>
          <span>${route.days} 天</span>
          <span>${route.theme.label}</span>
          <span>${route.weather.city} ${route.weather.temperature}</span>
        </div>
        <p><b>交通：</b>${route.transport}</p>
        <p><b>天气：</b>${route.weather.summary}${route.weather.advice}</p>
        <p><b>餐饮：</b>${route.dining}</p>
      </div>
      <div class="day-route-list">
        ${route.schedule.map(renderDaySchedule).join("")}
      </div>
    `;
  }

  function renderDaySchedule(day) {
    return `
      <section class="day-card" style="--day-color:${day.color}">
        <h4>${day.title}</h4>
        <p class="day-flow">${day.from} → ${day.to}</p>
        <div class="schedule-list">
          ${day.items
            .map((item) => {
              return `
                <div class="schedule-item">
                  <time>${item.time}</time>
                  <div>
                    <b>${item.place}</b>
                    <p>${item.activity}</p>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function curvePoints(start, end, heightFactor) {
    const points = [];
    const steps = 36;
    const midLat = (start.lat + end.lat) / 2 + heightFactor;
    const midLng = (start.lng + end.lng) / 2;

    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;

      points.push([
        a * start.lat + b * midLat + c * end.lat,
        a * start.lng + b * midLng + c * end.lng,
      ]);
    }

    return points;
  }

  function showArcRoute(route) {
    const allResources = route.resources || [];
    const allBounds = [];

    state.routeLayer.clearLayers();

    route.dayGroups.forEach((group, groupIndex) => {
      const resources = group.resources || [];

      resources.forEach((resource) => {
        allBounds.push([resource.lat, resource.lng]);
      });

      for (let index = 0; index < resources.length - 1; index += 1) {
        const points = curvePoints(resources[index], resources[index + 1], group.height);
        const shadowPoints = curvePoints(
          resources[index],
          resources[index + 1],
          group.height * 0.42,
        );
        L.polyline(shadowPoints, {
          color: "#2f2118",
          weight: 9 + groupIndex,
          opacity: 0.16,
          className: "arc-shadow",
          interactive: false,
        }).addTo(state.routeLayer);
        L.polyline(points, {
          color: group.color,
          weight: 6 + groupIndex,
          opacity: 0.92,
          className: "arc-line floating-arc",
          interactive: false,
        }).addTo(state.routeLayer);
        L.polyline(points.slice(6, -6), {
          color: "#fff7dc",
          weight: 2,
          opacity: 0.72,
          className: "arc-highlight",
          interactive: false,
        }).addTo(state.routeLayer);
      }
    });

    addRouteNameLabels(route.resources || []);
    addEndpointLabels(route.resources || []);

    if (allBounds.length) {
      state.map.fitBounds(L.latLngBounds(allBounds), {
        padding: [80, 80],
      });
    }
  }

  function addRouteNameLabels(resources) {
    resources.forEach((resource, index) => {
      L.marker([resource.lat, resource.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="route-name-label">${resource.name}</div>`,
          iconSize: [160, 24],
          iconAnchor: [80, 34],
        }),
        interactive: true,
        zIndexOffset: 1300,
      })
        .on("click", () => {
          showResourceDetail(resource);
        })
        .addTo(state.routeLayer);
    });
  }

  function addEndpointLabels(resources) {
    const start = resources[0];
    const end = resources[resources.length - 1];

    if (!start || !end) {
      return;
    }

    [
      {
        resource: start,
        text: "起点",
        className: "start",
      },
      {
        resource: end,
        text: "终点",
        className: "end",
      },
    ].forEach((item) => {
      L.marker([item.resource.lat, item.resource.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="endpoint-label ${item.className}"><b>${item.text}</b><span>${item.resource.name}</span></div>`,
          iconSize: [112, 34],
          iconAnchor: [56, 42],
        }),
        interactive: true,
        zIndexOffset: 1600,
      })
        .on("click", () => {
          showResourceDetail(item.resource);
        })
        .addTo(state.routeLayer);
    });
  }

  function clearRoute() {
    state.routeLayer?.clearLayers();
    $("#routeDistance").textContent = "--";
  }

  function renderCharts(charts) {
    renderDonut(charts.categories || {});
    renderBubble(charts.cities || {});
    renderWordCloud(charts.words || {});
  }

  function renderDonut(data) {
    const labels = {
      site: "旧址",
      museum: "纪念馆",
      scenic: "景区",
      other: "其他",
    };
    const entries = Object.entries(data);
    const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0) || 1;
    let current = 0;
    const gradient = entries
      .map(([key, value], index) => {
        const start = current;
        const end = current + (Number(value) / total) * 100;

        current = end;
        return `${palette[index % palette.length]} ${start}% ${end}%`;
      })
      .join(",");

    $("#donutChart").innerHTML = `
      <div class="donut" style="background:conic-gradient(${gradient})">
        <b>${total}</b>
        <span>点位</span>
      </div>
      <div class="donut-legend">
        ${entries.map(([key, value]) => `<span><i></i>${labels[key] || key} ${value}</span>`).join("")}
      </div>
    `;
  }

  function renderBubble(data) {
    const entries = Object.entries(data);
    const max = Math.max(1, ...entries.map((entry) => Number(entry[1])));

    $("#cityChart").innerHTML = entries
      .map(([city, value], index) => {
        const size = 36 + (Number(value) / max) * 44;

        return `<span class="bubble" style="width:${size}px;height:${size}px;--bubble-color:${palette[index % palette.length]}">${city}<b>${value}</b></span>`;
      })
      .join("");
  }

  function renderWordCloud(words) {
    const entries = Object.entries(words);
    const max = Math.max(1, ...entries.map((entry) => Number(entry[1])));
    const fallback = entries.length ? entries : [["长征", 5], ["研学", 4], ["红军", 3], ["泸定桥", 3]];

    $("#wordCloud").innerHTML = fallback
      .map(([word, value], index) => {
        const size = 13 + (Number(value) / max) * 14;

        const rotate = [-8, 5, -3, 9, -11][index % 5];
        const offset = [0, 12, -8, 18, -14][index % 5];

        return `<span class="word" style="font-size:${size}px;color:${palette[index % palette.length]};transform:translateY(${offset}px) rotate(${rotate}deg)">${word}</span>`;
      })
      .join("");
  }

  function renderRelatedEvents(events) {
    const list = events.length
      ? events
      : [{ date: "1935", name: "飞夺泸定桥", event: "红军强渡大渡河后飞夺泸定桥，是长征转折进程中的重要节点。" }];

    $("#eventList").innerHTML = list
      .map((event) => {
        return `
          <div class="event-item">
            <b>${event.date || "历史节点"} · ${event.name}</b>
            <p>${event.event || event.type || ""}</p>
          </div>
        `;
      })
      .join("");
  }

  function bindEvents() {
    $("#applyFilterBtn").addEventListener("click", () => {
      loadResources().catch((error) => {
        console.error(error);
        flash("资源筛选失败");
      });
    });

    ["themeSelect", "daysSelect", "provinceSelect", "categorySelect"].forEach((id) => {
      $(`#${id}`).addEventListener("change", () => {
        clearRoute();
      });
    });

    $("#generateRouteBtn").addEventListener("click", () => {
      generateRoute().catch((error) => {
        console.error(error);
        showAnalysis(false);
        flash("研学方案生成失败");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      initMap();
      bindEvents();
      await loadOptions();
      await loadResources();
    } catch (error) {
      console.error(error);
      flash("红色旅游模块加载失败");
    }
  });
})();
