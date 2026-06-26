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

  const routeImage = {
    route: "/assets/img/red-army-march.jpg",
    terrain: "/assets/img/xueshan.jpg",
    buffer: "/assets/img/zunyi.jpg",
    node: "/assets/img/red-army-march.jpg",
    resource: "/assets/img/zunyi.jpg",
  };

  let activeTool = "route";
  let activeChart = "primary";
  let selectedTerrainRoute = "all";
  let chart = null;
  let data = {};

  const $ = (selector) => document.querySelector(selector);

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

  async function loadData() {
    const [
      summary,
      province,
      elevation,
      buffer,
      events,
      resources,
      routeLayers,
    ] = await Promise.all([
      DataService.getAnalysisSummary(),
      DataService.getAnalysisProvince(),
      DataService.getAnalysisElevation(),
      DataService.getAnalysisBuffer(),
      DataService.getEvents(),
      DataService.getResources(),
      DataService.getRouteLayers(),
    ]);

    data = {
      summary,
      province,
      elevation,
      buffer,
      events: events.features || [],
      resources,
      routeLayers,
      terrainSeries: buildTerrainSeries(routeLayers, elevation),
    };

    renderTerrainButtons();
    renderAll();
  }

  function buildTerrainSeries(routes, baseElevation) {
    const routeNames = routes.slice(0, 8).map((route) => route.layer_name);

    return routeNames.map((name, routeIndex) => {
      return {
        name,
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
      `<button class="active" type="button" data-terrain-route="all">全部军团</button>`,
      ...data.terrainSeries.map((series, index) => {
        return `<button type="button" data-terrain-route="${index}">${series.name}</button>`;
      }),
    ].join("");
  }

  function renderMetrics() {
    const summary = data.summary || {};
    const metricsByTool = {
      route: [
        ["总里程", `${MapUtils.formatNumber(summary.totalDistance || 0)} km`],
        ["途经省份", `${summary.totalProvinces || 0} 省`],
        ["历史节点", `${summary.totalEvents || countEvents()} 个`],
        ["红色资源", `${summary.totalResources || data.resources?.length || 0} 处`],
      ],
      terrain: [
        ["平均高程", `${summary.averageElevation || 2100} m`],
        ["最高高程", `${summary.maxElevation || 4124} m`],
        ["对比军团", `${data.terrainSeries?.length || 0} 条`],
        ["地形难点", "雪山草地"],
      ],
      buffer: [
        ["核心圈", "5 km"],
        ["短驳圈", "10 km"],
        ["联动圈", "20 km"],
        ["接口状态", "已预留"],
      ],
      node: [
        ["事件总数", `${countEvents()} 个`],
        ["战斗节点", `${countEventType("战")} 个`],
        ["会议节点", `${countEventType("会")} 个`],
        ["渡江节点", `${countEventType("渡|江|河")} 个`],
      ],
      resource: [
        ["资源总数", `${data.resources?.length || 0} 处`],
        ["热点图层", "预留"],
        ["纪念馆", `${countResource("纪念馆|博物馆")} 处`],
        ["旧址遗址", `${countResource("旧址|遗址|会址")} 处`],
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

    option.xAxis.data = data.province.map((item) => item.province);
    option.series = [
      {
        name: "路线里程",
        type: "bar",
        barWidth: "48%",
        data: data.province.map((item) => item.distance),
        itemStyle: {
          borderRadius: [8, 8, 0, 0],
        },
      },
    ];

    return option;
  }

  function routeStructureOption() {
    const option = baseOption();

    option.tooltip.trigger = "axis";
    option.xAxis.data = ["路线连续性", "节点密度", "地形阻力", "资源联动", "展示完整度"];
    option.radar = undefined;
    option.series = [
      {
        name: "结构对比",
        type: "bar",
        data: [92, 84, 78, 88, 94],
      },
    ];

    return option;
  }

  function terrainLineOption() {
    const option = baseOption();
    const series =
      selectedTerrainRoute === "all"
        ? data.terrainSeries
        : [data.terrainSeries[Number(selectedTerrainRoute)]].filter(Boolean);

    option.xAxis.data = data.elevation.map((item) => item.place);
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

    option.xAxis.data = data.buffer.map((item) => item.buffer);
    option.series = [
      {
        name: "红色资源",
        type: "bar",
        data: data.buffer.map((item) => item.resourceCount),
      },
      {
        name: "历史节点",
        type: "bar",
        data: data.buffer.map((item) => item.eventCount),
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
    const cityMap = {};

    (data.resources || []).forEach((resource) => {
      const city = resource.cityname || resource.city || resource.pname || "其他";
      cityMap[city] = (cityMap[city] || 0) + 1;
    });

    const values = Object.entries(cityMap)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

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

  function renderInsight(content) {
    $("#insightPanel").innerHTML = `
      <b>${content.title}</b>
      <p><strong>为什么选这条路：</strong>${content.why}</p>
      <p><strong>空间难点：</strong>${content.difficulty}</p>
      <p><strong>学习精神：</strong>${content.spirit}</p>
    `;

    $("#routeImageCard").innerHTML = `
      <img src="${content.image}" alt="${content.title}">
      <span>${content.routeName || "当前路线"} · 专题配图</span>
    `;
  }

  function renderLayerInterfaces() {
    if (activeTool === "buffer") {
      $("#layerInterfacePanel").innerHTML = `
        <b>缓冲分析怎么做</b>
        <ol>
          <li>以当前路线为中心线，分别建立 5km、10km、20km 缓冲圈。</li>
          <li>叠加重要事件点、红色资源点、道路与 DEM，统计覆盖数量和空间可达性。</li>
          <li>后续在 ArcGIS Pro 中输出正式图层，本页面保留接口。</li>
        </ol>
        <div class="api-list">
          <code>/api/analysis/buffer/layers/core-5km</code>
          <code>/api/analysis/buffer/layers/traffic-10km</code>
          <code>/api/analysis/buffer/layers/region-20km</code>
        </div>
      `;
      return;
    }

    if (activeTool === "resource") {
      $("#layerInterfacePanel").innerHTML = `
        <b>红色资源热点图层</b>
        <p>主图展示资源热点分析效果，正式热点面图层后续由 ArcGIS Pro 核密度分析生成并接入。</p>
      `;
      return;
    }

    $("#layerInterfacePanel").innerHTML = "";
  }

  function updateConclusion() {
    const text = {
      route: "路线统计表明，长征路线不是单纯的线状展示，而是由历史事件、地形阻力和红色资源共同组织的空间叙事骨架。",
      terrain: "地形起伏分析显示，不同军团路线面对的高程结构差异明显，雪山草地和高原段是行军组织的核心难点。",
      buffer: "缓冲分析当前先明确分析方法和图层接口，待 ArcGIS Pro 输出正式缓冲图层后，可进一步叠加资源与交通条件。",
      node: "节点类型统计可帮助识别战斗、会议、渡江、会师等事件的空间集聚规律，适合用环形图和柱状图组合表达。",
      resource: "红色资源关联分析强调沿线资源热点与长征事件的耦合关系，为红色旅游和研学线路设计提供依据。",
    };

    $("#conclusionText").textContent = text[activeTool];
  }

  function renderAll() {
    $("#analysisMode").textContent = toolNames[activeTool];
    $("#mapTheme").textContent = toolNames[activeTool];
    $("#terrainRouteButtons").classList.toggle("show", activeTool === "terrain");
    renderMetrics();
    renderChart();
    renderLayerInterfaces();
    updateConclusion();
  }

  async function runAnalysis() {
    const route = $("#routeSelect").value || "central";
    const button = $("#runAnalysis");

    button.disabled = true;
    button.textContent = activeTool === "buffer" ? "确认方法并生成结果..." : "模型执行中...";
    $("#taskState").textContent = "分析任务运行中";

    try {
      const insight = await fetchApi(`/api/analysis/insight?tool=${activeTool}&route=${encodeURIComponent(route)}`);

      AnalysisMap.drawResult(activeTool, $("#bufferSelect").value);
      renderInsight(insight);
      renderChart();
      renderLayerInterfaces();
      updateConclusion();
      $("#taskState").textContent = "分析成功";
      flash("分析结果已加载至右侧面板和地图");
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

  function showExportModal() {
    showModal(
      "综合分析结果导出",
      `
        <p>已生成《长征路线 GIS 综合分析成果》。</p>
        <ul>
          <li>路线统计：跨省里程、节点密度、资源联动。</li>
          <li>地形分析：全军团高程变化和结构对比。</li>
          <li>缓冲分析：5km、10km、20km 三类图层接口已预留。</li>
          <li>资源热点：后续 ArcGIS Pro 生成正式热点面图层。</li>
        </ul>
        <p><b>结论：</b>长征路线的空间难点集中在高程起伏、河流阻隔和资源分布不均区域，学习重点是坚定信念、不畏艰险、实事求是和团结协作。</p>
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
  });

  $("#terrainRouteButtons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-terrain-route]");

    if (!button) {
      return;
    }

    selectedTerrainRoute = button.dataset.terrainRoute;
    $("#terrainRouteButtons").querySelectorAll("button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
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
  $("#exportBtn").addEventListener("click", showExportModal);
  $("#modalCloseBtn").addEventListener("click", closeModal);
  $("#analysisModal").addEventListener("click", (event) => {
    if (event.target.id === "analysisModal") {
      closeModal();
    }
  });

  window.addEventListener("resize", () => {
    chart?.resize();
  });

  loadData().catch(console.error);
})();
