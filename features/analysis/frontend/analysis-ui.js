(function () {
  const toolNames = {
    route: "路线统计分析",
    terrain: "地形起伏分析",
    buffer: "多尺度缓冲分析",
    node: "节点类型统计",
    resource: "红色资源关联分析",
  };

  let activeTool = "route";
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

  function createProcessFlow() {
    const flow = document.createElement("div");
    flow.className = "analysis-flow";
    flow.innerHTML = `
      <span><i>01</i><b>输入数据</b><small>路线 / 节点 / DEM</small></span>
      <em>→</em>
      <span><i>02</i><b>空间处理</b><small>统计 / 缓冲 / 关联</small></span>
      <em>→</em>
      <span><i>03</i><b>成果表达</b><small>地图 / 指标 / 图表</small></span>
    `;
    $(".analysis-map").appendChild(flow);
  }

  async function loadData() {
    const [summary, province, elevation, buffer, events, resources] =
      await Promise.all([
        DataService.getAnalysisSummary(),
        DataService.getAnalysisProvince(),
        DataService.getAnalysisElevation(),
        DataService.getAnalysisBuffer(),
        DataService.getEvents(),
        DataService.getResources(),
      ]);

    data = {
      summary,
      province,
      elevation,
      buffer,
      events,
      resources,
    };

    renderMetrics();
    renderChart();
    updateConclusion();
  }

  function renderMetrics() {
    const summary = data.summary;

    $("#metrics").innerHTML = `
      <article><span>路线总里程</span><b>${MapUtils.formatNumber(summary.totalDistance)}</b><small>km</small></article>
      <article><span>历史节点</span><b>${summary.totalEvents}</b><small>个</small></article>
      <article><span>途经省份</span><b>${summary.totalProvinces}</b><small>省</small></article>
      <article><span>红色资源</span><b>${summary.totalResources}</b><small>处</small></article>
    `;
  }

  function baseChartOption() {
    return {
      backgroundColor: "transparent",
      textStyle: {
        color: "#d6c8a4",
        fontSize: 10,
      },
      grid: {
        left: 42,
        right: 14,
        top: 26,
        bottom: 36,
      },
      tooltip: {
        trigger: "axis",
      },
      xAxis: {
        type: "category",
        axisLine: {
          lineStyle: {
            color: "#8d6548",
          },
        },
      },
      yAxis: {
        type: "value",
        splitLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.08)",
          },
        },
      },
      series: [],
    };
  }

  function countBy(items, key) {
    return Object.entries(
      items.reduce((result, item) => {
        const value = item[key];
        result[value] = (result[value] || 0) + 1;
        return result;
      }, {}),
    ).map(([name, value]) => ({ name, value }));
  }

  function pieOption() {
    const values =
      activeTool === "node"
        ? countBy(data.events, "type").map((item) => ({
            name: MapUtils.typeNames[item.name] || item.name,
            value: item.value,
          }))
        : countBy(data.resources, "type");

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
      },
      legend: {
        bottom: 0,
        textStyle: {
          color: "#d9bf83",
          fontSize: 9,
        },
      },
      series: [
        {
          type: "pie",
          radius: ["35%", "66%"],
          center: ["50%", "45%"],
          label: {
            color: "#efe0ba",
            fontSize: 10,
          },
          data: values,
          itemStyle: {
            borderColor: "#4d160f",
            borderWidth: 2,
          },
        },
      ],
    };
  }

  function chartOption() {
    if (activeTool === "node" || activeTool === "resource") {
      return pieOption();
    }

    const option = baseChartOption();

    if (activeTool === "route") {
      option.xAxis.data = data.province.map((item) => item.province);
      option.series = [
        {
          type: "bar",
          data: data.province.map((item) => item.distance),
          itemStyle: { color: "#d4aa4c" },
          barWidth: "52%",
        },
      ];
    }

    if (activeTool === "terrain") {
      option.xAxis.data = data.elevation.map((item) => item.place);
      option.series = [
        {
          type: "line",
          smooth: true,
          areaStyle: { color: "rgba(185, 107, 49, 0.25)" },
          lineStyle: { color: "#ddbd67" },
          data: data.elevation.map((item) => item.elevation),
        },
      ];
    }

    if (activeTool === "buffer") {
      option.xAxis.data = data.buffer.map((item) => item.buffer);
      option.series = [
        {
          name: "资源点",
          type: "bar",
          data: data.buffer.map((item) => item.resourceCount),
          itemStyle: { color: "#b9974d" },
        },
        {
          name: "历史节点",
          type: "bar",
          data: data.buffer.map((item) => item.eventCount),
          itemStyle: { color: "#b33a2c" },
        },
      ];
    }

    return option;
  }

  function renderChart() {
    if (!window.echarts || !data.summary) {
      return;
    }

    chart = chart || echarts.init($("#analysisChart"));
    chart.setOption(chartOption(), true);
  }

  function updateConclusion() {
    if (!data.summary) {
      return;
    }

    const conclusions = {
      route:
        "路线统计显示，四川、贵州段里程与节点密度较高，是长征历史叙事与资源展示的重点区域。",
      terrain: `路线平均海拔约 ${data.summary.averageElevation} m，最高点约 ${data.summary.maxElevation} m，川西雪山草地段地形阻隔最为显著。`,
      buffer: `${$("#bufferSelect").value} km 缓冲范围用于统计沿线历史节点、红色资源数量与覆盖面积。`,
      node:
        "节点类型以战役战斗和会议会师为主，重要节点沿中央红军主线形成明显的时空序列。",
      resource:
        "红色资源与遵义、泸定、会宁等关键节点高度耦合，具备构建主题研学线路的空间基础。",
    };

    $("#conclusionText").textContent = conclusions[activeTool];
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

    $("#mapTheme").textContent = toolNames[activeTool];
    renderChart();
    updateConclusion();
  });

  $("#routeSelect").addEventListener("change", (event) => {
    AnalysisMap.showRoute(event.target.value);
  });

  $("#runAnalysis").addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "模型执行中...";
    $("#taskState").textContent = "分析任务运行中";

    setTimeout(() => {
      AnalysisMap.drawResult(activeTool, $("#bufferSelect").value);
      renderChart();
      updateConclusion();
      $("#taskState").textContent = "分析成功 / 1.6s";
      button.disabled = false;
      button.textContent = "执行 GIS 分析";
      flash("分析结果已加载至地图");
    }, 650);
  });

  $("#reportBtn").addEventListener("click", () => {
    flash("成果报告模块已预留");
  });

  $("#tableBtn").addEventListener("click", () => {
    flash("统计表格已生成（演示）");
  });

  $("#exportBtn").addEventListener("click", () => {
    flash("分析结果已加入导出队列");
  });

  window.addEventListener("resize", () => {
    chart?.resize();
  });

  createProcessFlow();
  loadData().catch(console.error);
})();
