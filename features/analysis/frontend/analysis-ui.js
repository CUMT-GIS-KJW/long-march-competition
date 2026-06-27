(function () {
  const toolNames = {
    route: "路线统计分析",
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
      if (!best) {
        return item;
      }

      return Number(getter(item) || 0) > Number(getter(best) || 0) ? item : best;
    }, null);
  }

  function minBy(items, getter) {
    return (items || []).reduce((best, item) => {
      if (!best) {
        return item;
      }

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
    if (percent >= 92) {
      return 3;
    }

    if (percent >= 72) {
      return 2;
    }

    if (percent >= 42) {
      return 1;
    }

    return 0;
  }

  function setAnalysisProgress(percent, label, stepIndex = progressStepFromPercent(percent)) {
    const progress = $("#analysisProgress");
    const bar = $("#progressBar");
    const value = $("#progressValue");
    const labelNode = $("#progressLabel");

    if (!progress || !bar || !value || !labelNode) {
      return;
    }

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

      if (percent >= 86) {
        window.clearInterval(progressTimer);
      }
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
      summary,
      province,
      elevation,
      buffer,
      events,
      resources,
      routeLayers,
      routeAnalyses,
    ] = await Promise.all([
      DataService.getAnalysisSummary(),
      DataService.getAnalysisProvince(),
      DataService.getAnalysisElevation(),
      DataService.getAnalysisBuffer(),
      DataService.getEvents(),
      DataService.getResources(),
      DataService.getRouteLayers(),
      DataService.getAnalysisRoutes(),
    ]);

    data = {
      summary,
      province,
      elevation,
      buffer,
      events: events.features || [],
      resources,
      routeLayers,
      routeAnalyses,
      routeAnalysisById: Object.fromEntries((routeAnalyses || []).map((item) => [item.routeKey, item])),
      terrainSeries: buildTerrainSeries(routeAnalyses, routeLayers, elevation),
    };

    renderTerrainButtons();
    renderAll();
  }

  function buildTerrainSeries(routeAnalyses, routes, baseElevation) {
    if (routeAnalyses?.length) {
      return routeAnalyses.map((analysis) => {
        return {
          id: analysis.routeKey,
          name: analysis.routeName,
          places: (analysis.elevation || []).map((item) => item.place),
          values: (analysis.elevation || []).map((item) => item.elevation),
        };
      });
    }

    const routeNames = routes.slice(0, 8).map((route) => route.layer_name);

    return routeNames.map((name, routeIndex) => {
      return {
        id: routes[routeIndex]?.layer_key || String(routeIndex),
        name,
        places: baseElevation.map((item) => item.place),
        values: baseElevation.map((item, index) => {
          const wave = Math.sin(index + routeIndex * 0.8) * 180;
          const offset = routeIndex * 90;

          return Math.max(120, Math.round(Number(item.elevation) + wave + offset));
        }),
      };
    });
  }

  function renderTerrainButtons() {
    $("#terrainRouteButtons").innerHTML = [
      `<button class="active" type="button" data-terrain-route="current">当前路线</button>`,
      `<button type="button" data-terrain-route="all">全部路线</button>`,
      ...data.terrainSeries.map((series) => {
        return `<button type="button" data-terrain-route="${series.id}">${series.name}</button>`;
      }),
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

  function selectedBufferStats() {
    const radius = `${appliedAnalysis.radius || $("#bufferSelect")?.value || 20}km`;
    const rows = currentAnalysis().buffer || data.buffer || [];

    return rows.find((item) => item.buffer === radius) || rows[rows.length - 1] || {};
  }

  function syncParameterVisibility() {
    const bufferField = $("#bufferRadiusField");
    const isBufferTool = activeTool === "buffer";

    if (!bufferField) {
      return;
    }

    bufferField.hidden = !isBufferTool;
    bufferField.classList.toggle("show", isBufferTool);
  }

  function sumBy(rows, getter) {
    return (rows || []).reduce((sum, item) => sum + Number(getter(item) || 0), 0);
  }

  function percent(value, total) {
    if (!total) {
      return 0;
    }

    return Math.round((Number(value || 0) / Number(total || 1)) * 100);
  }

  function densityPer100(count, distance) {
    if (!distance) {
      return 0;
    }

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
      current,
      previous,
      maxRow,
      density,
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
    let climb = 0;
    let descent = 0;
    let steepest = null;

    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const elevationDelta = Number(current.elevation || 0) - Number(previous.elevation || 0);
      const distanceDelta = Math.max(1, Number(current.distance || 0) - Number(previous.distance || 0));
      const gradient = Math.abs(elevationDelta) / distanceDelta;

      if (elevationDelta > 0) {
        climb += elevationDelta;
      } else {
        descent += Math.abs(elevationDelta);
      }

      if (!steepest || gradient > steepest.gradient) {
        steepest = {
          from: previous,
          to: current,
          delta: elevationDelta,
          distance: distanceDelta,
          gradient,
        };
      }
    }

    const relief = Math.max(0, Number(highest.elevation || 0) - Number(lowest.elevation || 0));
    const highCount = rows.filter((item) => Number(item.elevation || 0) >= 1500).length;
    const highShare = rows.length ? Math.round((highCount / rows.length) * 100) : 0;
    const category = relief >= 1800
      ? "强起伏山地-高原过渡型"
      : relief >= 900
        ? "中高起伏山地型"
        : "低中起伏丘陵型";

    return {
      rows,
      first,
      last,
      highest,
      lowest,
      relief,
      climb: Math.round(climb),
      descent: Math.round(descent),
      highShare,
      category,
      steepest,
      sampleCount: rows.length,
    };
  }

  function renderAiMetrics(rows) {
    return `
      <div class="ai-mini-metrics">
        ${rows.map(([value, unit, label]) => {
          return `<span><b>${value}</b><em>${unit}</em><small>${label}</small></span>`;
        }).join("")}
      </div>
    `;
  }

  function renderAiParagraphs(rows) {
    return rows.map(([label, text]) => `<p><strong>${label}：</strong>${text}</p>`).join("");
  }

  function typeCount(rows, name) {
    return rows.find((item) => item.name === name || item.type === name)?.value ||
      rows.find((item) => item.name === name || item.type === name)?.count ||
      0;
  }

  function renderMetrics() {
    const analysis = currentAnalysis();
    const summary = analysis.summary || data.summary || {};
    const selectedBuffer = selectedBufferStats();
    const nodeRows = eventTypeData();
    const resourceRows = resourceTypeData();
    const metricsByTool = {
      route: [
        ["总里程", `${MapUtils.formatNumber(summary.totalDistance || 0)} km`],
        ["途经省份", `${summary.totalProvinces || 0} 省`],
        ["历史节点", `${summary.totalEvents || 0} 个`],
        ["红色资源", `${summary.totalResources || 0} 处`],
      ],
      terrain: [
        ["平均高程", `${summary.averageElevation || 0} m`],
        ["最高高程", `${summary.maxElevation || 0} m`],
        ["剖面采样", `${analysis.elevation?.length || 0} 点`],
        ["当前路线", currentRouteName().replace("路线图", "")],
      ],
      buffer: [
        ["当前半径", selectedBuffer.buffer || "20km"],
        ["覆盖节点", `${selectedBuffer.eventCount || 0} 个`],
        ["覆盖资源", `${selectedBuffer.resourceCount || 0} 处`],
        ["缓冲面积", `${MapUtils.formatNumber(selectedBuffer.area || 0)} km²`],
      ],
      node: [
        ["事件总数", `${summary.totalEvents || 0} 个`],
        ["战斗节点", `${typeCount(nodeRows, "战斗")} 个`],
        ["会议节点", `${typeCount(nodeRows, "会议")} 个`],
        ["渡江节点", `${typeCount(nodeRows, "渡江")} 个`],
      ],
      resource: [
        ["资源总数", `${summary.totalResources || 0} 处`],
        ["纪念馆", `${typeCount(resourceRows, "纪念馆")} 处`],
        ["革命旧址", `${typeCount(resourceRows, "革命旧址")} 处`],
        ["红色景区", `${typeCount(resourceRows, "红色景区")} 处`],
      ],
    };

    $("#metrics").innerHTML = metricsByTool[activeTool]
      .map(([label, value]) => {
        return `<article><span>${label}</span><b>${value}</b></article>`;
      })
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

    return (data.resources || []).filter((resource) => {
      return regex.test(`${resource.name || ""}${resource.type || ""}`);
    }).length;
  }

  function eventTypeData() {
    const rows = currentAnalysis().nodeTypes;

    if (rows?.length) {
      return rows.map((item) => ({
        name: item.type,
        value: item.count,
      }));
    }

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

    if (rows?.length) {
      return rows.map((item) => ({
        name: item.type,
        value: item.count,
      }));
    }

    const groups = {
      纪念馆: countResource("纪念馆|博物馆"),
      革命旧址: countResource("旧址|遗址|会址"),
      红色景区: countResource("景区|风景"),
      其他资源: Math.max(
        0,
        (data.resources?.length || 0) -
          countResource("纪念馆|博物馆|旧址|遗址|会址|景区|风景"),
      ),
    };

    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }

  function baseOption() {
    return {
      backgroundColor: "transparent",
      color: ["#d8a84f", "#a8261d", "#457b9d", "#2a9d8f", "#8e7dbe", "#b56576"],
      tooltip: {
        trigger: "axis",
        confine: true,
      },
      legend: {
        top: 0,
        type: "scroll",
        textStyle: {
          color: "#f4e1ae",
          fontSize: 10,
        },
      },
      grid: {
        left: 42,
        right: 20,
        top: 44,
        bottom: 40,
      },
      textStyle: {
        color: "#f0dfb2",
      },
      xAxis: {
        type: "category",
        axisLabel: {
          color: "#d9c99c",
          interval: 0,
          rotate: 24,
          fontSize: 10,
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#d9c99c",
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: "rgba(255,255,255,.08)",
          },
        },
      },
      series: [],
    };
  }

  function chartOption() {
    if (activeTool === "route") {
      return activeChart === "primary" ? routeBarOption() : routeStructureOption();
    }

    if (activeTool === "terrain") {
      return activeChart === "primary" ? terrainLineOption() : terrainCompareOption();
    }

    if (activeTool === "buffer") {
      return bufferMethodOption();
    }

    if (activeTool === "node") {
      return activeChart === "primary" ? nodeRoseOption() : nodeBarOption();
    }

    return activeChart === "primary" ? resourceHotOption() : resourcePieOption();
  }

  function routeBarOption() {
    const option = baseOption();
    const province = currentAnalysis().province || data.province || [];

    option.xAxis.data = province.map((item) => item.province);
    option.series = [
      {
        name: "路线里程",
        type: "bar",
        barWidth: "48%",
        data: province.map((item) => item.distance),
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
        },
      },
    ];

    return option;
  }

  function routeStructureOption() {
    const option = baseOption();
    const analysis = currentAnalysis();
    const summary = analysis.summary || {};
    const terrainRange = Math.max(0, (summary.maxElevation || 0) - (summary.averageElevation || 0));

    option.tooltip.trigger = "axis";
    option.xAxis.data = ["路线连续性", "节点密度", "地形阻力", "资源联动", "展示完整度"];
    option.radar = undefined;
    option.series = [
      {
        name: "结构对比",
        type: "bar",
        data: [
          92,
          Math.min(100, Math.round(((summary.totalEvents || 0) / Math.max(summary.totalDistance || 1, 1)) * 1200)),
          Math.min(100, Math.round(terrainRange / 25)),
          Math.min(100, Math.round(((summary.totalResources || 0) / Math.max(summary.totalDistance || 1, 1)) * 900)),
          94,
        ],
      },
    ];

    return option;
  }

  function terrainLineOption() {
    const option = baseOption();
    const currentSeries = data.terrainSeries.find((item) => item.id === currentRouteId()) || data.terrainSeries[0];
    const pickedSeries = data.terrainSeries.find((item) => item.id === selectedTerrainRoute);
    const series = selectedTerrainRoute === "all" ? data.terrainSeries : [pickedSeries || currentSeries].filter(Boolean);

    option.xAxis.data = series[0]?.places || data.elevation.map((item) => item.place);
    option.series = series.map((item) => {
      return {
        name: item.name,
        type: "line",
        smooth: true,
        showSymbol: false,
        data: item.values,
        areaStyle: {
          opacity: 0.08,
        },
      };
    });

    return option;
  }

  function terrainCompareOption() {
    const option = baseOption();

    option.xAxis.data = data.terrainSeries.map((item) => item.name);
    option.xAxis.axisLabel.rotate = 35;
    option.series = [
      {
        name: "最高高程",
        type: "bar",
        data: data.terrainSeries.map((item) => Math.max(...item.values)),
      },
      {
        name: "平均高程",
        type: "bar",
        data: data.terrainSeries.map((item) => {
          return Math.round(item.values.reduce((sum, value) => sum + value, 0) / item.values.length);
        }),
      },
    ];

    return option;
  }

  function bufferMethodOption() {
    const option = baseOption();
    const buffer = currentAnalysis().buffer || data.buffer || [];

    option.xAxis.data = buffer.map((item) => item.buffer);
    option.series = [
      {
        name: "红色资源",
        type: "bar",
        data: buffer.map((item) => item.resourceCount),
      },
      {
        name: "历史节点",
        type: "bar",
        data: buffer.map((item) => item.eventCount),
      },
    ];

    return option;
  }

  function nodeRoseOption() {
    return {
      backgroundColor: "transparent",
      color: ["#a8261d", "#d8a84f", "#457b9d", "#2a9d8f", "#8e7dbe"],
      tooltip: {
        trigger: "item",
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: "#f4e1ae",
          fontSize: 10,
        },
      },
      series: [
        {
          name: "节点类型",
          type: "pie",
          radius: ["28%", "66%"],
          center: ["50%", "43%"],
          roseType: "radius",
          avoidLabelOverlap: true,
          label: {
            color: "#f3e1b7",
            fontSize: 11,
          },
          labelLine: {
            length: 10,
            length2: 8,
          },
          data: eventTypeData(),
        },
      ],
    };
  }

  function nodeBarOption() {
    const option = baseOption();
    const values = eventTypeData();

    option.xAxis.data = values.map((item) => item.name);
    option.series = [
      {
        name: "事件数量",
        type: "bar",
        data: values.map((item) => item.value),
      },
    ];

    return option;
  }

  function resourceHotOption() {
    const option = baseOption();
    const values = (currentAnalysis().province || [])
      .slice()
      .sort((left, right) => right.resourceCount - left.resourceCount)
      .slice(0, 8)
      .map((item) => ({
        name: item.province,
        value: item.resourceCount,
      }));

    option.xAxis.data = values.map((item) => item.name);
    option.xAxis.axisLabel.rotate = 28;
    option.series = [
      {
        name: "热点强度",
        type: "bar",
        data: values.map((item) => item.value),
        itemStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#f3cf73" },
              { offset: 1, color: "#a8261d" },
            ],
          },
        },
      },
    ];

    return option;
  }

  function resourcePieOption() {
    return {
      backgroundColor: "transparent",
      color: ["#8e7dbe", "#a98467", "#7a9ebd", "#b56576"],
      tooltip: {
        trigger: "item",
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: "#f4e1ae",
          fontSize: 10,
        },
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "42%"],
          avoidLabelOverlap: true,
          label: {
            color: "#f3e1b7",
            fontSize: 10,
          },
          data: resourceTypeData(),
        },
      ],
    };
  }

  function renderChart() {
    if (!window.echarts || !data.summary) {
      return;
    }

    chart = chart || echarts.init($("#analysisChart"));
    chart.setOption(chartOption(), true);

    chart.off("click");
    chart.on("click", (params) => {
      showModal(
        `${toolNames[activeTool]}：${params.name || params.seriesName}`,
        `<p>当前值：<b>${params.value}</b></p><p>该图形已放大展示，标签避让并可继续切换专题查看。</p>`,
      );
    });
  }

  function renderAiPending(message = "参数已变更，请重新执行 GIS 分析生成 AI 解读。") {
    const state = $("#aiResultState");

    if (state) {
      state.textContent = "待生成";
    }

    $("#insightPanel").innerHTML = `
      <div class="panel-title-row">
        <span>AI 分析结果</span>
        <b id="aiResultState">待生成</b>
      </div>
      <p class="ai-result-empty">${message}</p>
    `;
  }

  function renderInsight(content) {
    const analysis = currentAnalysis();
    const summary = analysis.summary || data.summary || {};
    const buffer = selectedBufferStats();
    const routeName = content.routeName || currentRouteName();
    const terrain = terrainProfileStats(analysis);
    const spatial = routeSpatialStats(analysis);
    const bufferGrowth = bufferGrowthStats(analysis, buffer);
    const nodeTypeText = topTypeText(eventTypeData());
    const resourceTypeText = topTypeText(resourceTypeData());
    const professionalText = {
      route: [
        ["数据依据", `以 ${routeName} 的路线矢量、省域里程、历史节点和红色资源点为输入，综合评估路线空间连续性与节点组织强度。`],
        ["空间格局", `${spatial.topDistanceProvince.province || "重点省域"}承担主要里程表达，约占全线 ${spatial.provinceShare}%；路线全长 ${formatNumber(spatial.totalDistance)} km，跨越 ${summary.totalProvinces || 0} 个省级区域，具有明显的跨区域战略转移特征。`],
        ["GIS 证据", `沿线叠加 ${summary.totalEvents || 0} 个历史节点与 ${summary.totalResources || 0} 处红色资源，事件密度约 ${spatial.eventDensity} 个/100km，资源密度约 ${spatial.resourceDensity} 处/100km。${spatial.topEventProvince.province || "事件集中区"}是事件密集省域，${spatial.topResourceProvince.province || "资源集中区"}是资源支撑重点。`],
        ["应用建议", "展示时应优先突出省域转折点、节点密集段和资源耦合区，并用分段线宽、节点热度或省域标签表达空间强弱差异。"],
      ],
      buffer: [
        ["数据依据", `以 ${routeName} 为中心线建立 ${buffer.buffer || "当前"} 缓冲圈，并叠加历史节点、红色资源和沿线空间要素。`],
        ["覆盖结果", `当前圈层覆盖 ${buffer.eventCount || 0} 个历史节点、${buffer.resourceCount || 0} 处红色资源，缓冲面积约 ${formatNumber(buffer.area)} km²，点位覆盖强度约 ${bufferGrowth.density} 个/万km²。`],
        ["边际增益", `相对上一圈层新增历史节点 ${bufferGrowth.eventGain} 个、红色资源 ${bufferGrowth.resourceGain} 处，新增面积约 ${formatNumber(bufferGrowth.areaGain)} km²；相对最大圈层，事件覆盖率约 ${bufferGrowth.eventCapture}%，资源覆盖率约 ${bufferGrowth.resourceCapture}%。`],
        ["空间判读", "缓冲结果反映路线周边资源可达性和研学服务半径，可区分步行研学圈、短驳接驳圈和县域联动圈，并判断圈层扩张是否仍有明显收益。"],
        ["应用建议", "若边际增益下降，应优先优化核心圈讲解点；若边际增益仍高，应增加短驳交通和县域联动节点。"],
      ],
      node: [
        ["数据依据", `对 ${routeName} 沿线历史事件按战斗、会议、渡江、雪山草地、会师等类型进行分类统计。`],
        ["结构特征", `该路线共关联 ${summary.totalEvents || 0} 个历史节点，主导类型为 ${nodeTypeText || "暂未识别"}；事件密度约 ${spatial.eventDensity} 个/100km，反映了战略转移中的军事行动、组织决策和自然阻隔突破过程。`],
        ["空间判读", `${spatial.topEventProvince.province || "事件集中区"}事件数量较高，节点高密度区通常与渡江口岸、战役发生地、重要会议地和阶段性转折点重合，可作为专题地图的核心标注对象。`],
        ["应用建议", "建议在地图上按事件类型分层表达，并用时间轴联动节点；对主导类型与关键转折点使用更高视觉权重。"],
      ],
      resource: [
        ["数据依据", `将 ${routeName} 与红色资源点进行空间叠加，识别沿线纪念馆、旧址、遗址和景区的集聚关系。`],
        ["关联强度", `当前路线周边关联 ${summary.totalResources || 0} 处红色资源，资源密度约 ${spatial.resourceDensity} 处/100km；资源类型以 ${resourceTypeText || "暂未识别"} 为主。`],
        ["空间判读", `${spatial.topResourceProvince.province || "重点省域"}资源数量较高，应作为线路解说和旅游服务组织的重点片区；资源热点应与历史节点密集段叠加判读。`],
        ["应用建议", "资源开发不宜平均铺开，应优先选择节点密度高、交通可达性强、历史叙事连续的片区组织主题路线，并预留热点面图层。"],
      ],
    };

    if (activeTool === "terrain") {
      const steepest = terrain.steepest;
      const steepestText = steepest
        ? `${steepest.from.place || "前一采样点"}至${steepest.to.place || "后一采样点"}，样点距离约 ${formatNumber(steepest.distance)} km，高程${steepest.delta >= 0 ? "抬升" : "下降"} ${formatNumber(Math.abs(Math.round(steepest.delta)))} m，坡变强度约 ${Math.round(steepest.gradient)} m/km。`
        : "当前 DEM 样点不足，暂不能识别最大坡变区段。";

      $("#insightPanel").innerHTML = `
        <div class="panel-title-row">
          <span>AI 分析结果</span>
          <b id="aiResultState">已生成</b>
        </div>
        <div class="ai-route-name">${routeName} · 整线地形剖面分析</div>
        ${renderAiMetrics([
          [formatNumber(summary.totalDistance), "km", "剖面长度"],
          [formatNumber(terrain.relief), "m", "相对高差"],
          [formatNumber(terrain.climb), "m", "样点爬升"],
        ])}
        ${renderAiParagraphs([
          ["数据依据", `以 ${routeName} 全线为分析对象，按行进距离读取 ${terrain.sampleCount} 个 DEM 高程样点，形成从起点到终点的连续地形剖面。`],
          ["整线地形", `路线由${terrain.first.place || "起点"}约 ${terrain.first.elevation || 0} m 延伸至${terrain.last.place || "终点"}约 ${terrain.last.elevation || 0} m，最低样点位于${terrain.lowest.place || "低海拔段"}约 ${terrain.lowest.elevation || 0} m，最高样点位于${terrain.highest.place || "高海拔段"}约 ${terrain.highest.elevation || 0} m，整体属于${terrain.category}。`],
          ["起伏强度", `样点级累计爬升约 ${formatNumber(terrain.climb)} m、累计下降约 ${formatNumber(terrain.descent)} m，高海拔样点占比约 ${terrain.highShare}%。这说明整条路线的地形阻力并非均匀分布，而是在高程跃升段集中增强。`],
          ["关键区段", steepestText],
          ["空间结论", `地形分析应围绕整条路线的“低海拔出发段-河谷/丘陵过渡段-高海拔山地段”组织表达，重点解释高程突变、连续爬升和高海拔暴露对行军速度、补给组织和风险控制的影响。`],
        ])}
      `;
      return;
    }

    $("#insightPanel").innerHTML = `
      <div class="panel-title-row">
        <span>AI 分析结果</span>
        <b id="aiResultState">已生成</b>
      </div>
      <div class="ai-route-name">${routeName} · ${toolNames[activeTool]}</div>
      <div class="ai-mini-metrics">
        <span><b>${formatNumber(summary.totalDistance)}</b><em>km</em><small>路线里程</small></span>
        <span><b>${summary.totalEvents || 0}</b><em>个</em><small>历史节点</small></span>
        <span><b>${summary.totalResources || 0}</b><em>处</em><small>红色资源</small></span>
      </div>
      ${renderAiParagraphs(professionalText[activeTool] || professionalText.route)}
    `;
  }

  function renderOverallAnalysis() {
    const panel = $("#overallAnalysisPanel");

    if (!panel) {
      return;
    }

    if (!data.summary) {
      panel.innerHTML = `
        <div class="panel-title-row">
          <span>全局综合</span>
          <b>加载中</b>
        </div>
      `;
      return;
    }

    const summary = data.summary;
    const routes = data.routeAnalyses || [];
    const pointCount = (summary.totalEvents || 0) + (summary.totalResources || 0);
    const distanceSum = routes.reduce((sum, route) => sum + Number(route.summary?.totalDistance || 0), 0);
    const topDistanceRoutes = topItems(routes, (item) => item.summary?.totalDistance)
      .map((item) => item.routeName.replace("路线图", ""))
      .join("、");
    const eventRoute = maxBy(routes, (item) => item.summary?.totalEvents);
    const resourceRoute = maxBy(routes, (item) => item.summary?.totalResources);
    const highPoint = maxBy(data.elevation, (item) => item.elevation);
    const topProvince = maxBy(data.province, (item) => item.distance);

    panel.innerHTML = `
      <div class="panel-title-row">
        <span>全局综合</span>
        <b>全部路线 / 全部点位</b>
      </div>
      <div class="overall-kpis">
        <article><span>路线图层</span><b>${routes.length || data.routeLayers?.length || 0}</b><small>条</small></article>
        <article><span>综合里程</span><b>${formatNumber(summary.totalDistance)}</b><small>km</small></article>
        <article><span>全部点位</span><b>${formatNumber(pointCount)}</b><small>个/处</small></article>
        <article><span>覆盖省份</span><b>${summary.totalProvinces || 0}</b><small>省</small></article>
      </div>
      <p><strong>整体格局：</strong>系统汇总 ${routes.length || 0} 条长征路线，去重后的综合路线骨架约 ${formatNumber(summary.totalDistance)} km；按路线图层累计展示里程约 ${formatNumber(distanceSum)} km，可用于表现不同部队行军路径的交织关系。</p>
      <p><strong>点位结构：</strong>全部历史节点与红色资源共 ${formatNumber(pointCount)} 个/处，其中历史节点 ${summary.totalEvents || 0} 个、红色资源 ${summary.totalResources || 0} 处，适合用“路线 + 事件 + 资源”三层叠加讲述。</p>
      <p><strong>空间重点：</strong>${topDistanceRoutes || "重点路线"}承担主要展示骨架；${eventRoute?.routeName || "重点路线"}历史节点较密集，${resourceRoute?.routeName || "重点路线"}红色资源关联度较高。</p>
      <p><strong>地形判断：</strong>${topProvince?.province || "重点省域"}是里程表达重点，最高高程样点位于${highPoint?.place || "高海拔路段"}，约 ${highPoint?.elevation || summary.maxElevation || 0} m，说明地形阻力仍是全局分析的核心解释变量。</p>
    `;
  }

  function updateConclusion() {
    const routeName = currentRouteName();
    const runLabel = appliedAnalysis.routeId
      ? `当前结果来自最近一次执行的 ${routeName}。`
      : `当前为默认路线结果，修改参数后请点击“执行 GIS 分析”刷新统计。`;
    const text = {
      route: `${runLabel}${routeName} 的路线统计表明，当前路线不是单纯的线状展示，而是由历史事件、地形阻力和红色资源共同组织的空间叙事骨架。`,
      terrain: `${runLabel}${routeName} 的地形起伏分析基于整条路线 DEM 高程剖面，重点识别相对高差、累计爬升、最大坡变区段和高海拔样点占比，用于解释全线地形阻力的空间分布。`,
      buffer: `${runLabel}${routeName} 的缓冲分析按照本次执行半径统计沿线节点和资源，可进一步用于研学圈层、交通接驳和县域联动表达。`,
      node: `${runLabel}${routeName} 的节点类型统计可识别战斗、会议、渡江、会师等事件在该路线周边的集聚规律。`,
      resource: `${runLabel}${routeName} 的红色资源关联分析强调路线周边资源热点与长征事件的耦合关系，为红色旅游和研学线路设计提供依据。`,
    };

    $("#conclusionText").textContent = text[activeTool];
  }

  function renderAll() {
    $("#analysisMode").textContent = toolNames[activeTool];
    $("#mapTheme").textContent = toolNames[activeTool];
    $("#terrainRouteButtons").classList.toggle("show", activeTool === "terrain");
    syncParameterVisibility();
    renderMetrics();
    renderChart();
    renderOverallAnalysis();
    updateConclusion();
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

      if (runId !== analysisRunId) {
        return;
      }

      setAnalysisProgress(52, "正在叠加路线、节点和缓冲统计", 1);
      appliedAnalysis = {
        routeId: route,
        radius,
        tool,
      };
      setAnalysisProgress(76, "正在绘制地图专题结果与山体阴影", 2);
      AnalysisMap.drawResult(tool, radius, route);
      setAnalysisProgress(92, "正在生成 AI 解读和全局结论", 3);
      renderAll();
      renderInsight(insight);
      await wait(Math.max(0, 720 - (Date.now() - startedAt)));
      finishAnalysisProgress(true);
      $("#taskState").textContent = "分析成功";
      flash("分析结果已加载至左侧 AI、右侧全局面板和地图");
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

  function showStatsModal() {
    showModal(
      "统计表类型说明",
      `
        <div class="modal-grid">
          <article><b>热力图</b><p>表达红色资源和事件节点的空间集聚强度。</p></article>
          <article><b>气泡图</b><p>表达不同城市或节点的数量级差异。</p></article>
          <article><b>柱状图</b><p>对比省域里程、缓冲区覆盖数量和节点数量。</p></article>
          <article><b>环形图</b><p>表达节点类型、资源类型等组成结构。</p></article>
        </div>
      `,
    );
  }

  $("#toolList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tool]");

    if (!button) {
      return;
    }

    activeTool = button.dataset.tool;
    $("#toolList").querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderAll();
    renderAiPending("专题已切换，请点击“执行 GIS 分析”刷新当前 AI 解读。");
  });

  $("#terrainRouteButtons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-terrain-route]");

    if (!button) {
      return;
    }

    selectedTerrainRoute = button.dataset.terrainRoute;
    syncTerrainButtons();
    renderChart();
  });

  document.querySelector(".chart-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-chart]");

    if (!button) {
      return;
    }

    activeChart = button.dataset.chart;
    document.querySelectorAll(".chart-tabs button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    renderChart();
  });

  $("#routeSelect").addEventListener("change", (event) => {
    AnalysisMap.showRoute(event.target.value);
    AnalysisMap.clearResult();
    selectedTerrainRoute = "current";
    syncTerrainButtons();
    renderAiPending("路线已切换，请重新执行 GIS 分析生成该路线的 AI 结果。");
    $("#taskState").textContent = "参数已变更，等待分析";
    flash("路线已切换，请点击执行 GIS 分析刷新分析结果");
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

  $("#tableBtn").addEventListener("click", showStatsModal);
  $("#modalCloseBtn").addEventListener("click", closeModal);
  $("#analysisModal").addEventListener("click", (event) => {
    if (event.target.id === "analysisModal") {
      closeModal();
    }
  });

  window.addEventListener("resize", () => {
    chart?.resize();
  });

  document.addEventListener("analysismapready", () => {
    renderAll();
  });

  window.AnalysisUI = {
    getAppliedAnalysis: () => ({
      ...appliedAnalysis,
      routeId: currentRouteId(),
      routeName: currentRouteName(),
    }),
  };

  loadData().catch(console.error);
})();
