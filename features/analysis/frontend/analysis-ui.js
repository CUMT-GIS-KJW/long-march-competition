(function () {
  const toolNames = {
    route: "路线统计分析",
    compare: "多路线对比分析",
    difficulty: "地形难度指数",
    terrain: "地形起伏分析",
    buffer: "多尺度缓冲分析",
    node: "节点类型统计",
    resource: "红色资源关联",
  };

  const eventField = {
    type: "\u4e8b\u4ef6\u7c7b",
    place: "\u5730\u540d",
    people: "\u961f\u4f0d\u603b",
  };

  let activeTool = "route";
  let activeChart = "primary";
  let selectedTerrainRoute = "all";
  let selectedSegment = null;
  let analysisRunId = 0;
  let appliedAnalysis = {
    routeId: "",
    radius: "",
    tool: "route",
  };
  let chart = null;
  let data = {};
  let progressTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function flash(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 1600);
  }

  async function fetchApi(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`request failed: ${path}`);
    }
    const payload = await response.json();
    return payload && payload.code === 200 ? payload.data : payload;
  }

  function formatNumber(value) {
    return window.MapUtils?.formatNumber
      ? MapUtils.formatNumber(value || 0)
      : Number(value || 0).toLocaleString("zh-CN");
  }

  function maxBy(items, getter) {
    return (items || []).reduce((best, item) => {
      if (!best) return item;
      return Number(getter(item) || 0) > Number(getter(best) || 0) ? item : best;
    }, null);
  }

  function minBy(items, getter) {
    return (items || []).reduce((best, item) => {
      if (!best) return item;
      return Number(getter(item) || 0) < Number(getter(best) || 0) ? item : best;
    }, null);
  }

  function topItems(items, getter, limit = 3) {
    return (items || [])
      .slice()
      .sort((left, right) => Number(getter(right) || 0) - Number(getter(left) || 0))
      .slice(0, limit);
  }

  function progressStepFromPercent(percent) {
    if (percent >= 92) return 3;
    if (percent >= 72) return 2;
    if (percent >= 42) return 1;
    return 0;
  }

  function setAnalysisProgress(percent, label, stepIndex = progressStepFromPercent(percent)) {
    const progress = $("#analysisProgress");
    const bar = $("#progressBar");
    const value = $("#progressValue");
    const labelNode = $("#progressLabel");
    if (!progress || !bar || !value || !labelNode) return;
    const normalized = Math.max(0, Math.min(100, Math.round(percent)));
    progress.classList.add("show");
    progress.setAttribute("aria-hidden", "false");
    bar.style.width = `${normalized}%`;
    value.textContent = `${normalized}%`;
    labelNode.textContent = label;
    document.querySelectorAll("[data-progress-step]").forEach((step) => {
      const index = Number(step.dataset.progressStep || 0);
      step.classList.toggle("active", index <= stepIndex);
      step.classList.toggle("current", index === stepIndex && normalized < 100);
    });
  }

  function startAnalysisProgress(tool) {
    window.clearInterval(progressTimer);
    const labels = {
      route: "正在统计路线里程与省域分布",
      terrain: "正在采样 DEM 高程剖面",
      buffer: "正在构建缓冲圈并叠加点位",
      node: "正在识别历史节点类型",
      resource: "正在关联红色资源热点",
    };
    let percent = 8;
    setAnalysisProgress(percent, labels[tool] || "正在执行 GIS 空间分析", 0);
    progressTimer = window.setInterval(() => {
      percent = Math.min(86, percent + Math.max(2, Math.round((88 - percent) * 0.12)));
      setAnalysisProgress(percent, labels[tool] || "正在执行 GIS 空间分析");
      if (percent >= 86) window.clearInterval(progressTimer);
    }, 180);
  }

  function finishAnalysisProgress(success = true) {
    window.clearInterval(progressTimer);
    setAnalysisProgress(100, success ? "GIS 分析完成，结果已刷新" : "GIS 分析失败，请重试", success ? 3 : 0);
    window.setTimeout(() => {
      const progress = $("#analysisProgress");
      if (progress) {
        progress.classList.remove("show");
        progress.setAttribute("aria-hidden", "true");
      }
    }, success ? 1500 : 2200);
  }

  async function loadData() {
    const [
      summary, province, elevation, buffer,
      events, resources, routeLayers, routeAnalyses, difficulty, routeCompare,
    ] = await Promise.all([
      DataService.getAnalysisSummary(),
      DataService.getAnalysisProvince(),
      DataService.getAnalysisElevation(),
      DataService.getAnalysisBuffer(),
      DataService.getEvents(),
      DataService.getResources(),
      DataService.getRouteLayers(),
      DataService.getAnalysisRoutes(),
      DataService.getAnalysisDifficulty(),
      DataService.getAnalysisRouteCompare(),
    ]);
    data = {
      summary, province, elevation, buffer,
      events: events.features || [], resources, routeLayers, routeAnalyses, difficulty, routeCompare,
      routeAnalysisById: Object.fromEntries((routeAnalyses || []).map((item) => [item.routeKey, item])),
      difficultyById: Object.fromEntries((difficulty || []).map((item) => [item.routeKey, item])),
      compareById: Object.fromEntries((routeCompare || []).map((item) => [item.routeKey, item])),
      terrainSeries: buildTerrainSeries(routeAnalyses, routeLayers, elevation),
    };
    renderTerrainButtons();
    renderAll();
  }

  function buildTerrainSeries(routeAnalyses, routes, baseElevation) {
    if (routeAnalyses?.length) {
      return routeAnalyses.map((analysis) => ({
        id: analysis.routeKey,
        name: analysis.routeName,
        places: (analysis.elevation || []).map((item) => item.place),
        values: (analysis.elevation || []).map((item) => item.elevation),
      }));
    }
    const routeNames = routes.slice(0, 8).map((route) => route.layer_name);
    return routeNames.map((name, routeIndex) => ({
      id: routes[routeIndex]?.layer_key || String(routeIndex),
      name,
      places: baseElevation.map((item) => item.place),
      values: baseElevation.map((item, index) => {
        const wave = Math.sin(index + routeIndex * 0.8) * 180;
        const offset = routeIndex * 90;
        return Math.max(120, Math.round(Number(item.elevation) + wave + offset));
      }),
    }));
  }

  function renderTerrainButtons() {
    selectedTerrainRoute = "current";
    
    $("#terrainRouteButtons").innerHTML = [
      `<button class="active" type="button" data-terrain-route="current">当前路线</button>`,
      `<button type="button" data-terrain-route="all">全部路线</button>`,
      ...data.terrainSeries.map((series) => `<button type="button" data-terrain-route="${series.id}">${series.name}</button>`),
    ].join("");
    syncTerrainButtons();
  }

  function syncTerrainButtons() {
    $("#terrainRouteButtons")?.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item.dataset.terrainRoute === selectedTerrainRoute);
    });
  }

  function currentRouteId() {
    return (
      appliedAnalysis.routeId ||
      data.routeLayers?.[0]?.layer_key ||
      data.routeAnalyses?.[0]?.routeKey ||
      $("#routeSelect")?.value
    );
  }

  function currentRouteName() {
    const routeId = currentRouteId();
    const selectedOption = $("#routeSelect")?.selectedOptions?.[0];
    const optionText = selectedOption?.value === routeId ? selectedOption.textContent : "";
    const analysisName = data.routeAnalysisById?.[routeId]?.routeName;
    const configName = data.routeLayers?.find((route) => route.layer_key === routeId)?.layer_name;
    return optionText || analysisName || configName || "当前路线";
  }

  function currentAnalysis() {
    const routeId = currentRouteId();
    return (
      data.routeAnalysisById?.[routeId] ||
      data.routeAnalyses?.[0] || {
        routeKey: routeId,
        routeName: currentRouteName(),
        summary: data.summary,
        province: data.province,
        elevation: data.elevation,
        buffer: data.buffer,
        stage: [],
        nodeTypes: [],
        resourceTypes: [],
      }
    );
  }

  function currentDifficulty() {
    const routeId = currentRouteId();
    return data.difficultyById?.[routeId] || data.difficulty?.[0] || {};
  }

  function compareRows() {
    return data.routeCompare || [];
  }

  function selectedBufferStats() {
    const radius = `${appliedAnalysis.radius || $("#bufferSelect")?.value || 20}km`;
    const rows = currentAnalysis().buffer || data.buffer || [];
    return rows.find((item) => item.buffer === radius) || rows[rows.length - 1] || {};
  }

  function syncParameterVisibility() {
    const bufferField = $("#bufferRadiusField");
    if (!bufferField) return;
    const isBufferTool = activeTool === "buffer";
    bufferField.hidden = !isBufferTool;
    bufferField.classList.toggle("show", isBufferTool);
  }

  function sumBy(rows, getter) {
    return (rows || []).reduce((sum, item) => sum + Number(getter(item) || 0), 0);
  }

  function percent(value, total) {
    if (!total) return 0;
    return Math.round((Number(value || 0) / Number(total || 1)) * 100);
  }

  function densityPer100(count, distance) {
    if (!distance) return 0;
    return Math.round((Number(count || 0) / Number(distance || 1)) * 1000) / 10;
  }

  function routeSpatialStats(analysis) {
    const summary = analysis.summary || data.summary || {};
    const provinceRows = analysis.province || data.province || [];
    const totalDistance = Number(summary.totalDistance || sumBy(provinceRows, (item) => item.distance));
    const topDistanceProvince = maxBy(provinceRows, (item) => item.distance) || {};
    const topEventProvince = maxBy(provinceRows, (item) => item.eventCount) || {};
    const topResourceProvince = maxBy(provinceRows, (item) => item.resourceCount) || {};
    return {
      totalDistance,
      topDistanceProvince,
      topEventProvince,
      topResourceProvince,
      provinceShare: percent(topDistanceProvince.distance, totalDistance),
      eventDensity: densityPer100(summary.totalEvents, totalDistance),
      resourceDensity: densityPer100(summary.totalResources, totalDistance),
    };
  }

  function bufferGrowthStats(analysis, selectedBuffer) {
    const rows = (analysis.buffer || data.buffer || [])
      .slice()
      .sort((left, right) => parseInt(left.buffer, 10) - parseInt(right.buffer, 10));
    const current = rows.find((item) => item.buffer === selectedBuffer.buffer) || selectedBuffer || rows[rows.length - 1] || {};
    const currentIndex = rows.findIndex((item) => item.buffer === current.buffer);
    const previous = rows[Math.max(0, currentIndex - 1)] || {};
    const maxRow = rows[rows.length - 1] || {};
    const hasPrevious = previous.buffer && previous.buffer !== current.buffer;
    const coveredPoints = Number(current.eventCount || 0) + Number(current.resourceCount || 0);
    const density = current.area ? Math.round((coveredPoints / Number(current.area || 1)) * 10000) / 10 : 0;
    return {
      current, previous, maxRow, density,
      eventGain: hasPrevious ? Number(current.eventCount || 0) - Number(previous.eventCount || 0) : Number(current.eventCount || 0),
      resourceGain: hasPrevious ? Number(current.resourceCount || 0) - Number(previous.resourceCount || 0) : Number(current.resourceCount || 0),
      areaGain: hasPrevious ? Number(current.area || 0) - Number(previous.area || 0) : Number(current.area || 0),
      eventCapture: percent(current.eventCount, maxRow.eventCount),
      resourceCapture: percent(current.resourceCount, maxRow.resourceCount),
    };
  }

  function topTypeText(rows, limit = 2) {
    return topItems(rows || [], (item) => item.value ?? item.count, limit)
      .map((item) => {
        const count = item.value ?? item.count ?? 0;
        return `${item.name || item.type}${count}个`;
      })
      .join("、");
  }

  function terrainProfileStats(analysis) {
    const rows = (analysis.elevation || data.elevation || [])
      .filter((item) => Number.isFinite(Number(item.elevation)))
      .slice()
      .sort((left, right) => Number(left.distance || 0) - Number(right.distance || 0));
    const highest = maxBy(rows, (item) => item.elevation) || {};
    const lowest = minBy(rows, (item) => item.elevation) || {};
    const first = rows[0] || {};
    const last = rows[rows.length - 1] || {};
    let climb = 0, descent = 0, steepest = null;
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const elevationDelta = Number(current.elevation || 0) - Number(previous.elevation || 0);
      const distanceDelta = Math.max(1, Number(current.distance || 0) - Number(previous.distance || 0));
      const gradient = Math.abs(elevationDelta) / distanceDelta;
      if (elevationDelta > 0) climb += elevationDelta;
      else descent += Math.abs(elevationDelta);
      if (!steepest || gradient > steepest.gradient) {
        steepest = { from: previous, to: current, delta: elevationDelta, distance: distanceDelta, gradient };
      }
    }
    const relief = Math.max(0, Number(highest.elevation || 0) - Number(lowest.elevation || 0));
    const highCount = rows.filter((item) => Number(item.elevation || 0) >= 1500).length;
    const highShare = rows.length ? Math.round((highCount / rows.length) * 100) : 0;
    const category = relief >= 1800 ? "强起伏山地-高原过渡型" : relief >= 900 ? "中高起伏山地型" : "低中起伏丘陵型";
    return { rows, first, last, highest, lowest, relief, climb: Math.round(climb), descent: Math.round(descent), highShare, category, steepest, sampleCount: rows.length };
  }

  function renderAiMetrics(rows) {
    return `<div class="ai-mini-metrics">${rows.map(([value, unit, label]) => `<span><b>${value}</b><em>${unit}</em><small>${label}</small></span>`).join("")}</div>`;
  }

  function renderAiParagraphs(rows) {
    return rows.map(([label, text]) => `<p><strong>${label}：</strong>${text}</p>`).join("");
  }

  function typeCount(rows, name) {
    return rows.find((item) => item.name === name || item.type === name)?.value ||
           rows.find((item) => item.name === name || item.type === name)?.count || 0;
  }

  function renderMetrics() {
    const analysis = currentAnalysis();
    const summary = analysis.summary || data.summary || {};
    const selectedBuffer = selectedBufferStats();
    const nodeRows = eventTypeData();
    const resourceRows = resourceTypeData();
    
    const hasData = appliedAnalysis.routeId && appliedAnalysis.tool === activeTool;
    
    const metricsByTool = {
      route: [
        ["总里程", hasData ? `${MapUtils.formatNumber(summary.totalDistance || 0)} km` : "-"],
        ["途经省份", hasData ? `${summary.totalProvinces || 0} 省` : "-"],
        ["历史节点", hasData ? `${summary.totalEvents || 0} 个` : "-"],
        ["红色资源", hasData ? `${summary.totalResources || 0} 处` : "-"],
      ],
      compare: (() => {
        const rows = compareRows();
        const longest = maxBy(rows, (item) => item.totalDistance) || {};
        const hardest = maxBy(rows, (item) => item.maxDifficulty) || {};
        const dense = maxBy(rows, (item) => item.resourceDensity) || {};
        return [
          ["对比路线", hasData ? `${rows.length} 条` : "-"],
          ["最长路线", hasData ? (longest.routeName || "-").replace("路线图", "") : "-"],
          ["最高难度", hasData ? `${hardest.maxDifficulty || 0} 分` : "-"],
          ["资源最密", hasData ? `${dense.resourceDensity || 0} 处/百km` : "-"],
        ];
      })(),
      difficulty: (() => {
        const difficulty = currentDifficulty();
        return [
          ["平均难度", hasData ? `${difficulty.averageScore || 0} 分` : "-"],
          ["最高难度", hasData ? `${difficulty.maxScore || 0} 分` : "-"],
          ["高难里程", hasData ? `${MapUtils.formatNumber(difficulty.highDifficultyDistance || 0)} km` : "-"],
          ["分段数量", hasData ? `${difficulty.segments?.length || 0} 段` : "-"],
        ];
      })(),
      terrain: [
        ["平均高程", hasData ? `${summary.averageElevation || 0} m` : "-"],
        ["最高高程", hasData ? `${summary.maxElevation || 0} m` : "-"],
        ["剖面采样", hasData ? `${analysis.elevation?.length || 0} 点` : "-"],
        ["当前路线", hasData ? currentRouteName().replace("路线图", "") : "-"],
      ],
      buffer: [
        ["当前半径", hasData ? (selectedBuffer.buffer || "20km") : "-"],
        ["覆盖节点", hasData ? `${selectedBuffer.eventCount || 0} 个` : "-"],
        ["覆盖资源", hasData ? `${selectedBuffer.resourceCount || 0} 处` : "-"],
        ["缓冲面积", hasData ? `${MapUtils.formatNumber(selectedBuffer.area || 0)} km²` : "-"],
      ],
      node: [
        ["事件总数", hasData ? `${summary.totalEvents || 0} 个` : "-"],
        ["战斗节点", hasData ? `${typeCount(nodeRows, "战斗")} 个` : "-"],
        ["会议节点", hasData ? `${typeCount(nodeRows, "会议")} 个` : "-"],
        ["渡江节点", hasData ? `${typeCount(nodeRows, "渡江")} 个` : "-"],
      ],
      resource: [
        ["资源总数", hasData ? `${summary.totalResources || 0} 处` : "-"],
        ["纪念馆", hasData ? `${typeCount(resourceRows, "纪念馆")} 处` : "-"],
        ["革命旧址", hasData ? `${typeCount(resourceRows, "革命旧址")} 处` : "-"],
        ["红色景区", hasData ? `${typeCount(resourceRows, "红色景区")} 处` : "-"],
      ],
    };
    
    $("#metrics").innerHTML = metricsByTool[activeTool]
      .map(([label, value]) => `<article><span>${label}</span><b>${value}</b></article>`)
      .join("");
  }

  function countEvents() {
    return data.events?.length || 0;
  }

  function countEventType(pattern) {
    const regex = new RegExp(pattern);
    return (data.events || []).filter((feature) => {
      const props = feature.properties || {};
      return regex.test(`${props[eventField.type] || ""}${props[eventField.place] || ""}`);
    }).length;
  }

  function countResource(pattern) {
    const regex = new RegExp(pattern);
    return (data.resources || []).filter((resource) => regex.test(`${resource.name || ""}${resource.type || ""}`)).length;
  }

  function eventTypeData() {
    const rows = currentAnalysis().nodeTypes;
    if (rows?.length) return rows.map((item) => ({ name: item.type, value: item.count }));
    const groups = {
      战斗: countEventType("战|攻占|突破|阻击|飞夺"),
      会议: countEventType("会|政治局|决策"),
      渡江: countEventType("渡|江|河|赤水"),
      雪山草地: countEventType("雪山|草地|夹金山"),
      会师: countEventType("会师|汇合"),
    };
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }

  function resourceTypeData() {
    const rows = currentAnalysis().resourceTypes;
    if (rows?.length) return rows.map((item) => ({ name: item.type, value: item.count }));
    const groups = {
      纪念馆: countResource("纪念馆|博物馆"),
      革命旧址: countResource("旧址|遗址|会址"),
      红色景区: countResource("景区|风景"),
      其他资源: Math.max(0, (data.resources?.length || 0) - countResource("纪念馆|博物馆|旧址|遗址|会址|景区|风景")),
    };
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }

  function baseOption() {
    return {
      backgroundColor: "transparent",
      color: ["#d8a84f", "#a8261d", "#457b9d", "#2a9d8f", "#8e7dbe", "#b56576"],
      tooltip: { trigger: "axis", confine: true },
      legend: { top: 0, type: "scroll", textStyle: { color: "rgba(38, 8, 0, 0.72)", fontSize: 10 } },
      grid: { left: 42, right: 20, top: 44, bottom: 40 },
      textStyle: { color: "#f0dfb2" },
      xAxis: { type: "category", axisLabel: { color: "rgba(38, 8, 0, 0.72)", interval: 0, rotate: 24, fontSize: 10 } },
      yAxis: { type: "value", axisLabel: { color: "rgba(38, 8, 0, 0.72)", fontSize: 10 }, splitLine: { lineStyle: { color: "rgba(255,255,255,.08)" } } },
      series: [],
    };
  }

  function chartOption() {
    if (activeTool === "route") return activeChart === "primary" ? routeBarOption() : routeStructureOption();
    if (activeTool === "compare") return activeChart === "primary" ? compareDistanceOption() : compareStructureOption();
    if (activeTool === "difficulty") return activeChart === "primary" ? difficultyScoreOption() : difficultyPieOption();
    if (activeTool === "terrain") return activeChart === "primary" ? terrainLineOption() : terrainCompareOption();
    if (activeTool === "buffer") return bufferMethodOption();
    if (activeTool === "node") return activeChart === "primary" ? nodeRoseOption() : nodeBarOption();
    return activeChart === "primary" ? resourceHotOption() : resourcePieOption();
  }

  function routeBarOption() {
    const option = baseOption();
    const province = currentAnalysis().province || data.province || [];
    option.xAxis.data = province.map((item) => item.province);
    option.series = [{ name: "路线里程", type: "bar", barWidth: "48%", data: province.map((item) => item.distance), itemStyle: { borderRadius: [8, 8, 0, 0] } }];
    return option;
  }

  function routeStructureOption() {
    const option = baseOption();
    const analysis = currentAnalysis();
    const summary = analysis.summary || {};
    const terrainRange = Math.max(0, (summary.maxElevation || 0) - (summary.averageElevation || 0));
    option.tooltip.trigger = "axis";
    option.xAxis.data = ["路线连续性", "节点密度", "地形阻力", "资源联动", "展示完整度"];
    option.series = [{
      name: "结构对比", type: "bar",
      data: [92, Math.min(100, Math.round(((summary.totalEvents || 0) / Math.max(summary.totalDistance || 1, 1)) * 1200)), Math.min(100, Math.round(terrainRange / 25)), Math.min(100, Math.round(((summary.totalResources || 0) / Math.max(summary.totalDistance || 1, 1)) * 900)), 94],
    }];
    return option;
  }

  function terrainLineOption() {
    const option = baseOption();
    const currentSeries = data.terrainSeries.find((item) => item.id === currentRouteId()) || data.terrainSeries[0];
    
    let series;
    if (selectedTerrainRoute === "current") {
      series = [currentSeries].filter(Boolean);
    } else if (selectedTerrainRoute === "all") {
      series = data.terrainSeries;
    } else {
      const pickedSeries = data.terrainSeries.find((item) => item.id === selectedTerrainRoute);
      series = [pickedSeries || currentSeries].filter(Boolean);
    }
    
    option.xAxis.data = series[0]?.places || data.elevation.map((item) => item.place);
    option.series = series.map((item) => ({ 
      name: item.name, 
      type: "line", 
      smooth: true, 
      showSymbol: false, 
      data: item.values, 
      areaStyle: { opacity: 0.08 } 
    }));
    return option;
  }

  function terrainCompareOption() {
    const option = baseOption();
    option.xAxis.data = data.terrainSeries.map((item) => item.name);
    option.xAxis.axisLabel.rotate = 35;
    option.series = [
      { name: "最高高程", type: "bar", data: data.terrainSeries.map((item) => Math.max(...item.values)) },
      { name: "平均高程", type: "bar", data: data.terrainSeries.map((item) => Math.round(item.values.reduce((sum, v) => sum + v, 0) / item.values.length)) },
    ];
    return option;
  }

  function compareDistanceOption() {
    const option = baseOption();
    const rows = compareRows();
    option.xAxis.data = rows.map((item) => item.routeName.replace("路线图", ""));
    option.xAxis.axisLabel.rotate = 35;
    option.series = [{ name: "总里程", type: "bar", data: rows.map((item) => item.totalDistance) }];
    return option;
  }

  function compareStructureOption() {
    const option = baseOption();
    const rows = compareRows();
    option.xAxis.data = rows.map((item) => item.routeName.replace("路线图", ""));
    option.xAxis.axisLabel.rotate = 35;
    option.series = [
      { name: "最高难度", type: "bar", data: rows.map((item) => item.maxDifficulty) },
      { name: "节点密度", type: "bar", data: rows.map((item) => item.eventDensity) },
      { name: "资源密度", type: "bar", data: rows.map((item) => item.resourceDensity) },
    ];
    return option;
  }

  function difficultyScoreOption() {
    const option = baseOption();
    const segments = currentDifficulty().segments || [];
    option.xAxis.data = segments.map((item) => `${item.from}-${item.to}`);
    option.xAxis.axisLabel.rotate = 35;
    option.series = [{
      name: "难度指数",
      type: "bar",
      data: segments.map((item) => ({ value: item.score, itemStyle: { color: item.color } })),
    }];
    return option;
  }

  function difficultyPieOption() {
    const rows = currentDifficulty().byLevel || [];
    return {
      backgroundColor: "transparent",
      color: rows.map((item) => item.color),
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: "#f4e1ae", fontSize: 10 } },
      series: [{
        name: "难度里程",
        type: "pie",
        radius: ["38%", "66%"],
        center: ["50%", "42%"],
        label: { color: "#f3e1b7", fontSize: 10 },
        data: rows.map((item) => ({ name: item.level, value: item.distance })),
      }],
    };
  }

  function bufferMethodOption() {
    const option = baseOption();
    const buffer = currentAnalysis().buffer || data.buffer || [];
    option.xAxis.data = buffer.map((item) => item.buffer);
    option.series = [
      { name: "红色资源", type: "bar", data: buffer.map((item) => item.resourceCount) },
      { name: "历史节点", type: "bar", data: buffer.map((item) => item.eventCount) },
    ];
    return option;
  }

  function nodeRoseOption() {
    return {
      backgroundColor: "transparent",
      color: ["#a8261d", "#d8a84f", "#457b9d", "#2a9d8f", "#8e7dbe"],
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: "rgba(38, 8, 0, 0.72)", fontSize: 10 } },
      series: [{
        name: "节点类型", type: "pie", radius: ["28%", "66%"], center: ["50%", "43%"], roseType: "radius",
        avoidLabelOverlap: true, label: { color: "rgba(38, 8, 0, 0.72)", fontSize: 11 }, labelLine: { length: 10, length2: 8 },
        data: eventTypeData(),
      }],
    };
  }

  function nodeBarOption() {
    const option = baseOption();
    const values = eventTypeData();
    option.xAxis.data = values.map((item) => item.name);
    option.series = [{ name: "事件数量", type: "bar", data: values.map((item) => item.value) }];
    return option;
  }

  function resourceHotOption() {
    const option = baseOption();
    const values = (currentAnalysis().province || [])
      .slice().sort((a, b) => b.resourceCount - a.resourceCount).slice(0, 8)
      .map((item) => ({ name: item.province, value: item.resourceCount }));
    option.xAxis.data = values.map((item) => item.name);
    option.xAxis.axisLabel.rotate = 28;
    option.series = [{
      name: "热点强度", type: "bar", data: values.map((item) => item.value),
      itemStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "#f3cf73" }, { offset: 1, color: "#a8261d" }] } },
    }];
    return option;
  }

  function resourcePieOption() {
    return {
      backgroundColor: "transparent",
      color: ["#8e7dbe", "#a98467", "#7a9ebd", "#b56576"],
      tooltip: { trigger: "item" },
      legend: { bottom: 0, textStyle: { color: "#f4e1ae", fontSize: 10 } },
      series: [{ type: "pie", radius: ["42%", "68%"], center: ["50%", "42%"], avoidLabelOverlap: true, label: { color: "#f3e1b7", fontSize: 10 }, data: resourceTypeData() }],
    };
  }

  function renderChart() {
    const chartContainer = $("#analysisChart");
    
    const hasData = appliedAnalysis.routeId && appliedAnalysis.tool === activeTool && data.summary;
    
    if (!hasData || !window.echarts) {
      chartContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(38, 8, 0, 0.72);font-size:14px;">此处可查看 GIS 分析结果</div>`;
      if (chart) {
        chart.dispose();
        chart = null;
      }
      return;
    }
    
    chart = chart || echarts.init(chartContainer);
    chart.setOption(chartOption(), true);
    chart.off("click");
    chart.on("click", (params) => {
      showModal(`${toolNames[activeTool]}：${params.name || params.seriesName}`, `<p>当前值：<b>${params.value}</b></p><p>该图形已放大展示，标签避让并可继续切换专题查看。</p>`);
    });
  }

  function renderAiPending(message = "参数已变更，请重新执行 GIS 分析生成 AI 解读。") {
    const state = $("#aiResultState"); if (state) state.textContent = "待生成";
    $("#insightPanel").innerHTML = `<div class="panel-title-row"><span>AI 分析结果</span><b id="aiResultState">待生成</b></div><p class="ai-result-empty">${message}</p>`;
  }

  // ★ 渲染 AI 结果到右侧面板（图表下方）
  function renderInsightToRight(content) {
    const analysis = currentAnalysis();
    const summary = analysis.summary || data.summary || {};
    const buffer = selectedBufferStats();
    const routeName = content.routeName || currentRouteName();
    const terrain = terrainProfileStats(analysis);
    const spatial = routeSpatialStats(analysis);
    const bufferGrowth = bufferGrowthStats(analysis, buffer);
    const nodeTypeText = topTypeText(eventTypeData());
    const resourceTypeText = topTypeText(resourceTypeData());

    const analysisTexts = {
      route: [
        ["路线布局", `${routeName} 的路线里程总量为 ${MapUtils.formatNumber(spatial.totalDistance)} km，途经 ${summary.totalProvinces || 0} 个省级行政区。其中里程最长省份为 ${spatial.topDistanceProvince.province || "—"}，占总里程 ${spatial.provinceShare}%。省域分布呈现以 ${spatial.topDistanceProvince.province || "主要省份"} 为中心的线状展开格局。`],
        ["节点与资源耦合", `沿线共有 ${summary.totalEvents || 0} 个历史节点和 ${summary.totalResources || 0} 处红色资源，节点密度为 ${spatial.eventDensity} 个/百km，资源密度为 ${spatial.resourceDensity} 处/百km。节点与资源在 ${spatial.topEventProvince.province || "主要省份"} 和 ${spatial.topResourceProvince.province || "主要省份"} 分布最为集中，表明该线路具有显著的红色叙事聚合特征。`],
        ["空间叙事建议", `建议在 ${spatial.topEventProvince.province || "主要省份"} 和 ${spatial.topResourceProvince.province || "主要省份"} 增设研学展陈节点，强化路线叙事节奏。省域连接段可补充中转服务设施，提升全线研学体验的连续性与完整性。`],
      ],
      compare: [
        ["路线差异", `本次纳入 ${compareRows().length} 条路线对比，最长路线为 ${(maxBy(compareRows(), (item) => item.totalDistance) || {}).routeName || "—"}，最高难度路线为 ${(maxBy(compareRows(), (item) => item.maxDifficulty) || {}).routeName || "—"}。`],
        ["综合判断", "多路线对比把里程、海拔、节点密度、资源密度和难度指数放在同一框架下，适合展示系统的横向 GIS 分析能力。"],
        ["答辩建议", "可以强调系统不只是展示路线，而是能够比较不同部队路线的空间组织差异和行军阻力差异。"],
      ],
      difficulty: [
        ["难度指数", `${routeName} 平均难度指数为 ${currentDifficulty().averageScore || 0} 分，最高难度 ${currentDifficulty().maxScore || 0} 分，高难及极高难路段 ${MapUtils.formatNumber(currentDifficulty().highDifficultyDistance || 0)} km。`],
        ["最难路段", `最难路段为 ${currentDifficulty().hardestSegment?.from || "—"} 至 ${currentDifficulty().hardestSegment?.to || "—"}，等级为 ${currentDifficulty().hardestSegment?.level || "—"}。`],
        ["地图表达", "地图按低、中、高、极高四级对路线分段着色，点击路段可查看平均海拔、高差、坡度和相关历史节点。"],
      ],
      terrain: [
        ["地形起伏特征", `${routeName} 的 DEM 剖面显示，路线地形属于“${terrain.category}”，相对高差 ${terrain.relief} m，累计爬升约 ${terrain.climb} m，下降约 ${terrain.descent} m。高海拔样点（≥1500m）占比 ${terrain.highShare}%，表明路线在 ${terrain.highShare > 30 ? "中高海拔" : "低中海拔"} 区间内具有明显地形梯度。`],
        ["最大坡变区段", `最陡坡变位于 ${terrain.steepest?.from?.place || "起点"} 至 ${terrain.steepest?.to?.place || "终点"} 之间，高程差 ${Math.round(terrain.steepest?.delta || 0)} m，坡度 ${(terrain.steepest?.gradient || 0).toFixed(1)} m/km。该区段是全线地形阻力最大的路段，建议在展陈中设置专题标识解说地形与行军的关系。`],
        ["海拔梯度叙事", `全线海拔从 ${terrain.first?.elevation || "—"} m 变化至 ${terrain.last?.elevation || "—"} m，整体呈 ${terrain.last?.elevation > terrain.first?.elevation ? "上升" : "下降"} 趋势。建议将高程剖面与历史事件时间轴叠加，形成“海拔-事件”双轴叙事结构，增强 AI 数字展陈的时空沉浸感。`],
      ],
      buffer: [
        ["覆盖范围评估", `当前选择的缓冲半径为 ${buffer.buffer || "—"}，覆盖 ${buffer.eventCount || 0} 个历史节点和 ${buffer.resourceCount || 0} 处红色资源。相比上一级半径，新增节点 ${bufferGrowth.eventGain} 个、资源 ${bufferGrowth.resourceGain} 处，覆盖效率呈 ${bufferGrowth.eventGain + bufferGrowth.resourceGain > 0 ? "增长" : "平稳"} 态势。`],
        ["密度与面积效率", `缓冲区内点密度为 ${bufferGrowth.density} 处/百km²，已捕获最大半径下 ${bufferGrowth.eventCapture}% 的节点和 ${bufferGrowth.resourceCapture}% 的资源。若以 ${bufferGrowth.maxRow.buffer || "最大半径"} 为基准，当前半径的覆盖效率较高，适合作为研学圈层的核心辐射范围。`],
        ["空间优化建议", `建议在 ${buffer.buffer || "当前"} 半径范围内筛选核心节点与资源点，构建“核心圈-拓展圈-联动圈”三层研学空间结构。对于 ${bufferGrowth.eventGain + bufferGrowth.resourceGain > 5 ? "高增益" : "低增益"} 区段，可进一步优化点位的筛选与展示优先级。`],
      ],
      node: [
        ["节点类型构成", `${routeName} 沿线共识别 ${summary.totalEvents || 0} 个历史节点，类型以 ${nodeTypeText || "无显著类型"} 为主。其中战斗节点 ${typeCount(eventTypeData(), "战斗")} 个，占比 ${summary.totalEvents ? Math.round((typeCount(eventTypeData(), "战斗") / (summary.totalEvents || 1)) * 100) : 0}%；会议节点 ${typeCount(eventTypeData(), "会议")} 个，占比 ${summary.totalEvents ? Math.round((typeCount(eventTypeData(), "会议") / (summary.totalEvents || 1)) * 100) : 0}%。整体呈现 ${typeCount(eventTypeData(), "战斗") > typeCount(eventTypeData(), "会议") ? "军事主导" : "决策与会商"} 特征。`],
        ["空间节点聚类", `节点在 ${spatial.topEventProvince.province || "主要省份"} 分布密度较高，占总节点的 ${spatial.topEventProvince.eventCount ? Math.round((spatial.topEventProvince.eventCount / (summary.totalEvents || 1)) * 100) : 0}%。建议将该区域作为重点展陈区，形成“战斗-会议-渡江”多元节点组合叙事。`],
        ["叙事节奏优化", `建议按照“起始段—关键决策段—高强度行军段—胜利会师段”四个阶段组织节点展陈，将战斗、会议、渡江等类型节点分阶段串联，形成清晰的叙事节奏与情感曲线。`],
      ],
      resource: [
        ["资源类型分布", `${routeName} 沿线共有 ${summary.totalResources || 0} 处红色资源，类型以 ${resourceTypeText || "无显著类型"} 为主。其中纪念馆 ${typeCount(resourceTypeData(), "纪念馆")} 处，占比 ${summary.totalResources ? Math.round((typeCount(resourceTypeData(), "纪念馆") / (summary.totalResources || 1)) * 100) : 0}%；革命旧址 ${typeCount(resourceTypeData(), "革命旧址")} 处，占比 ${summary.totalResources ? Math.round((typeCount(resourceTypeData(), "革命旧址") / (summary.totalResources || 1)) * 100) : 0}%。资源类型结构 ${typeCount(resourceTypeData(), "纪念馆") > typeCount(resourceTypeData(), "革命旧址") ? "以纪念展示型为主" : "以遗址保护型为主"}。`],
        ["资源密度与热点", `资源密度为 ${spatial.resourceDensity} 处/百km，资源热点省份为 ${spatial.topResourceProvince.province || "—"}，占资源总量的 ${summary.totalResources ? Math.round((spatial.topResourceProvince.resourceCount / (summary.totalResources || 1)) * 100) : 0}%。建议围绕热点区域构建红色研学精品线路，形成资源联动效应。`],
        ["红色研学应用", `建议以 ${spatial.topResourceProvince.province || "主要省份"} 为核心，结合 ${resourceTypeText || "主要资源类型"} 设计“红色寻访”主题线路，通过 AI 数字展陈呈现资源点之间的历史关联与时空逻辑。`],
      ],
    };

    const panel = document.getElementById('overallAnalysisPanel');
    if (panel) {
      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span style="color:#e0b755;font-weight:700;font-size:11px;letter-spacing:0.08em;">AI 分析结果</span>
          <b style="flex:0 0 auto;color:#5c1b13;background:#f2d58d;border:1px solid rgba(255,236,177,.55);border-radius:999px;padding:4px 8px;font:700 8px var(--serif);">已完成</b>
        </div>
        <div class="ai-paragraphs">
          ${renderAiParagraphs(analysisTexts[activeTool] || analysisTexts.route)}
        </div>
      `;
    }
  }

  function renderOverallAnalysis() {
    const panel = document.getElementById('overallAnalysisPanel');
    if (!panel) return;
    
    // 如果 panel 已经有 AI 结果内容，不覆盖
    if (panel.innerHTML.trim() && panel.innerHTML.includes('AI 分析结果')) {
      return;
    }
    
    // 显示默认内容
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="color:#e0b755;font-weight:700;font-size:11px;letter-spacing:0.08em;">综合分析</span>
      </div>
      <p style="margin:0;color:#c8bea7;font:9px/1.75 var(--serif);">请执行 GIS 分析查看详细结果。</p>
    `;
  }

  function updateConclusion() {
    const routeName = currentRouteName();
    
    if (appliedAnalysis.routeId && appliedAnalysis.tool === activeTool) {
      const runLabel = `当前结果来自最近一次执行的 ${routeName}。`;
      const text = {
        route: `${runLabel}${routeName} 的路线统计表明，当前路线不是单纯的线状展示，而是由历史事件、地形阻力和红色资源共同组织的空间叙事骨架。`,
        compare: `${runLabel}多路线对比已完成，可横向比较各路线的里程、省域跨度、节点密度、资源密度和地形难度。`,
        difficulty: `${runLabel}${routeName} 的地形难度指数已按路段分级，红色和橙色段可作为讲解行军阻力的重点区域。`,
        terrain: `${runLabel}${routeName} 的地形起伏分析基于整条路线 DEM 高程剖面，重点识别相对高差、累计爬升、最大坡变区段和高海拔样点占比，用于解释全线地形阻力的空间分布。`,
        buffer: `${runLabel}${routeName} 的缓冲分析按照本次执行半径统计沿线节点和资源，可进一步用于研学圈层、交通接驳和县域联动表达。`,
        node: `${runLabel}${routeName} 的节点类型统计可识别战斗、会议、渡江、会师等事件在该路线周边的集聚规律。`,
    resource: `${runLabel}${routeName} 的红色资源关联分析强调路线周边资源热点与长征事件的耦合关系，为红色研学线路设计提供依据。`,
      };
      $("#conclusionText").textContent = text[activeTool];
    } else {
      $("#conclusionText").textContent = "请点击「执行 GIS 分析」查看该路线的综合评估结论。";
    }
  }

  function renderAll() {
    $("#analysisMode").textContent = toolNames[activeTool];
    $("#mapTheme").textContent = toolNames[activeTool];
    $("#terrainRouteButtons").classList.toggle("show", activeTool === "terrain");
    syncParameterVisibility();
    
    // ★ 切换到新专题但未分析时，清空 AI 结果区域
    if (!(appliedAnalysis.routeId && appliedAnalysis.tool === activeTool)) {
      const panel = document.getElementById('overallAnalysisPanel');
      if (panel) {
        panel.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#e0b755;font-weight:700;font-size:11px;letter-spacing:0.08em;">综合分析</span>
          </div>
          <p style="margin:0;color:#c8bea7;font:9px/1.75 var(--serif);">请执行 GIS 分析查看详细结果。</p>
        `;
      }
    }
    
    if (appliedAnalysis.routeId && appliedAnalysis.tool === activeTool) {
      renderMetrics();
      renderChart();
    } else {
      renderMetrics();
      renderChart();
    }
    
    updateConclusion();
  }

  /* ========== 控制资源层显隐 ========== */
  function updateResourceLayer() {
    if (activeTool === "resource") {
      AnalysisMap.showResourceLayer();
    } else {
      AnalysisMap.hideResourceLayer();
    }
  }

  /* ========== 更新路线显示 ========== */
  function updateRouteDisplay(mode, routeId) {
    if (mode === "all") {
      AnalysisMap.showAllRoutes();
    } else {
      const id = routeId || currentRouteId();
      AnalysisMap.hideAllRoutes();
      AnalysisMap.showRoute(id);
    }
  }

  async function runAnalysis() {
    const route = $("#routeSelect").value || "central";
    const radius = $("#bufferSelect").value || "20";
    const tool = activeTool;
    const runId = ++analysisRunId;
    const button = $("#runAnalysis");
    const startedAt = Date.now();

    button.disabled = true;
    button.textContent = tool === "buffer" ? "确认方法并生成结果..." : "模型执行中...";
    $("#taskState").textContent = "分析任务运行中";
    startAnalysisProgress(tool);

    try {
      const insight = await fetchApi(`/api/analysis/insight?tool=${tool}&route=${encodeURIComponent(route)}`);
      if (runId !== analysisRunId) return;

      setAnalysisProgress(52, "正在叠加路线、节点和缓冲统计", 1);
      appliedAnalysis = { routeId: route, radius, tool };

      updateRouteDisplay("single", route);
      updateResourceLayer();

      setAnalysisProgress(76, "正在绘制地图专题结果与山体阴影", 2);
      AnalysisMap.drawResult(tool, radius, route, data);
      setAnalysisProgress(92, "正在生成 AI 解读和全局结论", 3);
      renderAll();
      
      // ★ AI 结果直接渲染到右侧 overallAnalysisPanel（左侧不再显示）
      renderInsightToRight(insight);
      
      // ★ 清空左侧 AI 卡片内容，避免重复
      const leftPanel = document.getElementById('insightPanel');
      if (leftPanel) {
        leftPanel.innerHTML = `
          <div class="panel-title-row">
            <span>AI 分析结果</span>
            <b id="aiResultState">已移至右侧</b>
          </div>
          <p class="ai-result-empty">AI 分析结果已移至右侧「综合分析」面板，请查看右侧图表下方区域。</p>
        `;
      }
      
      await wait(Math.max(0, 720 - (Date.now() - startedAt)));
      finishAnalysisProgress(true);
      $("#taskState").textContent = "分析成功";
      flash("分析结果已加载至地图和右侧面板");
    } catch (error) {
      finishAnalysisProgress(false);
      throw error;
    } finally {
      button.disabled = false;
      button.textContent = "执行 GIS 分析";
    }
  }

  function showModal(title, body) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#analysisModal").classList.add("show");
    $("#analysisModal").setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    $("#analysisModal").classList.remove("show");
    $("#analysisModal").setAttribute("aria-hidden", "true");
  }

  /* ========== 事件监听 ========== */
  $("#toolList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tool]");
    if (!button) return;
    activeTool = button.dataset.tool;
    $("#toolList").querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));

    AnalysisMap.clearResult();
    
    if (appliedAnalysis.routeId && appliedAnalysis.tool === activeTool) {
      updateRouteDisplay("single", appliedAnalysis.routeId);
      AnalysisMap.drawResult(activeTool, appliedAnalysis.radius || 10, appliedAnalysis.routeId, data);
    } else if (appliedAnalysis.routeId) {
      updateRouteDisplay("single", appliedAnalysis.routeId);
    } else {
      updateRouteDisplay("all");
    }
    
    updateResourceLayer();

    renderAll();
    renderAiPending("专题已切换，请点击“执行 GIS 分析”刷新当前 AI 解读。");
  });

  $("#terrainRouteButtons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-terrain-route]");
    if (!button) return;
    selectedTerrainRoute = button.dataset.terrainRoute;
    syncTerrainButtons();
    renderChart();
  });

  document.querySelector(".chart-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-chart]");
    if (!button) return;
    activeChart = button.dataset.chart;
    document.querySelectorAll(".chart-tabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderChart();
  });

  $("#routeSelect").addEventListener("change", (event) => {
    const routeId = event.target.value;
    updateRouteDisplay("all");
    AnalysisMap.clearResult();
    selectedTerrainRoute = "current";
    syncTerrainButtons();
    appliedAnalysis.routeId = "";
    renderAiPending("路线已切换，请重新执行 GIS 分析生成该路线的 AI 结果。");
    $("#taskState").textContent = "参数已变更，等待分析";
    flash("路线已切换，请点击执行 GIS 分析刷新分析结果");
  });

  $("#layerControl")?.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-layer]");
    if (!input) return;
    AnalysisMap.setLayerVisibility(input.dataset.layer, input.checked);
  });

  document.addEventListener("analysissegmentselect", (event) => {
    selectedSegment = event.detail;
    renderOverallAnalysis();
    flash(`${selectedSegment.from} 至 ${selectedSegment.to}：${selectedSegment.level}`);
  });

  $("#bufferSelect").addEventListener("change", () => {
    renderAiPending("缓冲半径已变更，请重新执行 GIS 分析生成该半径的 AI 结果。");
    $("#taskState").textContent = "参数已变更，等待分析";
    flash("缓冲半径已变更，请点击执行 GIS 分析刷新分析结果");
  });

  $("#runAnalysis").addEventListener("click", () => {
    runAnalysis().catch((error) => {
      console.error(error);
      flash("分析接口调用失败");
      $("#taskState").textContent = "分析失败";
      $("#runAnalysis").disabled = false;
      $("#runAnalysis").textContent = "执行 GIS 分析";
    });
  });

  $("#tableBtn").addEventListener("click", () => {
    showModal("统计表类型说明", `
      <div class="modal-grid">
        <article><b>热力图</b><p>表达红色资源和事件节点的空间集聚强度。</p></article>
        <article><b>气泡图</b><p>表达不同城市或节点的数量级差异。</p></article>
        <article><b>柱状图</b><p>对比省域里程、缓冲区覆盖数量和节点数量。</p></article>
        <article><b>环形图</b><p>表达节点类型、资源类型等组成结构。</p></article>
      </div>
    `);
  });

  $("#modalCloseBtn").addEventListener("click", closeModal);
  $("#analysisModal").addEventListener("click", (event) => {
    if (event.target.id === "analysisModal") closeModal();
  });

  window.addEventListener("resize", () => chart?.resize());

  document.addEventListener("analysismapready", () => {
    updateRouteDisplay("all");
    updateResourceLayer();
    renderAll();
  });

  window.AnalysisUI = {
    getAppliedAnalysis: () => ({ ...appliedAnalysis, routeId: currentRouteId(), routeName: currentRouteName() }),
  };

  loadData().catch(console.error);
})();
