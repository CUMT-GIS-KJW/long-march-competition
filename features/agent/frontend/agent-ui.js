(function () {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#agentPanel");
  const toggle = $("#agentToggle");
  const form = $("#agentForm");
  const input = $("#agentInput");
  const messages = $("#agentMessages");
  const windowEl = $(".agent-window");
  const closeButton = $("#agentCloseBtn");

  if (!panel || !toggle || !form || !input || !messages || !windowEl) {
    return;
  }

  const isAnalysisPage = Boolean($(".analysis-app"));
  const apiKeyStorageKey = "long-march-deepseek-api-key";
  let sending = false;
  const history = [];

  function compactText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function readText(selector) {
    const element = $(selector);

    return compactText(element?.innerText || element?.textContent || "");
  }

  function readApiKey() {
    return localStorage.getItem(apiKeyStorageKey) || "";
  }

  function writeApiKey(value) {
    const apiKey = compactText(value);

    if (apiKey) {
      localStorage.setItem(apiKeyStorageKey, apiKey);
      return;
    }

    localStorage.removeItem(apiKeyStorageKey);
  }

  function collectAnalysisContext() {
    if (!$(".analysis-app")) {
      return null;
    }

    const selectedRoute = $("#routeSelect")?.selectedOptions?.[0]?.textContent;
    const selectedBuffer = $("#bufferSelect")?.selectedOptions?.[0]?.textContent;
    const metrics = Array.from(document.querySelectorAll("#metrics article"))
      .map((item) => {
        const label = compactText(item.querySelector("span")?.textContent || "");
        const value = compactText(item.querySelector("b")?.textContent || "");

        return label && value ? { label, value } : compactText(item.innerText || item.textContent);
      })
      .filter(Boolean);

    return {
      page: "综合分析页面",
      topic: readText("#mapTheme") || readText("#analysisMode"),
      selectedRoute: compactText(selectedRoute),
      bufferRadius: compactText(selectedBuffer),
      metrics,
      insight: readText("#insightPanel"),
      layerMethod: readText("#layerInterfacePanel"),
      conclusion: readText("#conclusionText"),
      modalTitle: $(".analysis-modal.show") ? readText("#modalTitle") : "",
      modalBody: $(".analysis-modal.show") ? readText("#modalBody") : "",
    };
  }

  function collectPageContext() {
    return collectAnalysisContext();
  }

  function metricText(metrics) {
    return (metrics || [])
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return `${item.label}：${item.value}`;
      })
      .filter(Boolean)
      .join("；");
  }

  function analysisAdvice(topic) {
    if (topic.includes("地形")) {
      return "地形起伏分析重点说明行军阻力来源，高程变化越明显，越能解释雪山、草地、河谷等区域的组织难度。";
    }

    if (topic.includes("缓冲")) {
      return "缓冲分析重点说明路线周边资源的可达范围，适合用于研学圈层、交通接驳和县域联动设计。";
    }

    if (topic.includes("节点")) {
      return "节点统计重点说明历史事件的类型结构，可突出战斗、会议、渡江、会师等关键节点的空间集聚特征。";
    }

    if (topic.includes("资源")) {
      return "红色资源关联分析重点说明沿线资源热点与历史事件的耦合关系，可支撑红色旅游和研学线路设计。";
    }

    return "路线统计分析重点说明长征路线的空间骨架，结合省域跨度、历史节点和资源分布解释路线组织逻辑。";
  }

  function buildAutoAnalysis(context) {
    const topic = context?.topic || "当前专题";
    const metrics = metricText(context?.metrics);
    const selectedRoute = context?.selectedRoute || "当前路线";
    const bufferRadius = context?.bufferRadius ? `\n缓冲参数：${context.bufferRadius}` : "";
    const layerMethod = context?.layerMethod ? `\n方法说明：${context.layerMethod}` : "";
    const insight = context?.insight ? `\n专题解读：${context.insight}` : "";
    const conclusion = context?.conclusion || analysisAdvice(topic);

    return [
      "已根据当前 GIS 分析数据自动生成结论：",
      `专题：${topic}`,
      `分析路线：${selectedRoute}${bufferRadius}`,
      metrics ? `关键指标：${metrics}` : "",
      `空间判断：${analysisAdvice(topic)}`,
      insight,
      layerMethod,
      `答辩表述：${conclusion}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function loadGisAnalysisResults() {
    const fallbackFetch = async (path) => {
      const response = await fetch(path);

      if (!response.ok) {
        throw new Error(`analysis data load failed: ${path}`);
      }

      const payload = await response.json();

      return payload && payload.code === 200 ? payload.data : payload;
    };

    const loadNodeTypes = async () => {
      if (window.DataService?.getAnalysisNodeTypes) {
        try {
          return await DataService.getAnalysisNodeTypes();
        } catch (error) {
          console.warn(error);
        }
      }

      return fallbackFetch("/assets/data/analysis-node-types.json");
    };

    const [
      summary,
      province,
      elevation,
      buffer,
      stage,
      nodeTypes,
    ] = await Promise.all([
      DataService.getAnalysisSummary(),
      DataService.getAnalysisProvince(),
      DataService.getAnalysisElevation(),
      DataService.getAnalysisBuffer(),
      DataService.getAnalysisStage(),
      loadNodeTypes(),
    ]);

    return {
      summary,
      province,
      elevation,
      buffer,
      stage,
      nodeTypes,
    };
  }

  function maxBy(items, getter) {
    return (items || []).reduce((best, item) => {
      if (!best) {
        return item;
      }

      return Number(getter(item)) > Number(getter(best)) ? item : best;
    }, null);
  }

  function minBy(items, getter) {
    return (items || []).reduce((best, item) => {
      if (!best) {
        return item;
      }

      return Number(getter(item)) < Number(getter(best)) ? item : best;
    }, null);
  }

  function topNames(items, getter, limit = 3) {
    return (items || [])
      .slice()
      .sort((left, right) => Number(getter(right)) - Number(getter(left)))
      .slice(0, limit);
  }

  function buildComprehensiveAnalysis(results, context) {
    const { summary, province, elevation, buffer, stage, nodeTypes } = results;
    const topDistanceProvinces = topNames(province, (item) => item.distance)
      .map((item) => `${item.province}${window.MapUtils?.formatNumber ? MapUtils.formatNumber(item.distance) : item.distance}km`)
      .join("、");
    const topResourceProvinces = topNames(province, (item) => item.resourceCount)
      .map((item) => `${item.province}${item.resourceCount}处`)
      .join("、");
    const topEventProvinces = topNames(province, (item) => item.eventCount)
      .map((item) => `${item.province}${item.eventCount}个`)
      .join("、");
    const highestPoint = maxBy(elevation, (item) => item.elevation);
    const lowestPoint = minBy(elevation, (item) => item.elevation);
    const largestBuffer = buffer?.[buffer.length - 1];
    const coreBuffer = buffer?.[0];
    const mainStage = maxBy(stage, (item) => item.eventCount);
    const mainNodeType = maxBy(nodeTypes, (item) => item.count);
    const metricLine = [
      `总里程 ${window.MapUtils?.formatNumber ? MapUtils.formatNumber(summary.totalDistance) : summary.totalDistance} km`,
      `途经 ${summary.totalProvinces} 省`,
      `历史节点 ${summary.totalEvents} 个`,
      `红色资源 ${summary.totalResources} 处`,
      `平均高程 ${summary.averageElevation} m`,
      `最高高程 ${summary.maxElevation} m`,
    ].join("；");

    return [
      "长征路线 GIS 综合分析报告",
      "",
      `一、总体格局：${metricLine}。这些指标说明长征路线不是单一线状轨迹，而是由路线、省域、事件、地形和红色资源共同组成的空间叙事系统。`,
      "",
      `二、省域分布：路线里程主要集中在${topDistanceProvinces || "重点省域"}；历史事件较集中的省份为${topEventProvinces || "沿线核心区域"}；红色资源较集中的省份为${topResourceProvinces || "沿线资源集聚区"}。这说明路线展示应重点突出“行军路径 + 事件密度 + 资源支撑”的叠加关系。`,
      "",
      `三、地形阻力：DEM 结果显示，剖面最高点位于${highestPoint?.place || "高海拔路段"}，约 ${highestPoint?.elevation || summary.maxElevation} m；最低点位于${lowestPoint?.place || "低海拔路段"}，约 ${lowestPoint?.elevation || "-"} m。高程起伏解释了雪山、草地、河谷等区域成为行军组织难点的空间原因。`,
      "",
      `四、缓冲可达：${coreBuffer?.buffer || "5km"} 核心圈覆盖红色资源 ${coreBuffer?.resourceCount || 0} 处、历史节点 ${coreBuffer?.eventCount || 0} 个；${largestBuffer?.buffer || "20km"} 联动圈覆盖红色资源 ${largestBuffer?.resourceCount || 0} 处、历史节点 ${largestBuffer?.eventCount || 0} 个。缓冲结果可用于研学路线、短驳交通和县域红色资源联动设计。`,
      "",
      `五、阶段与节点：事件最多的阶段是“${mainStage?.stage || "重点阶段"}”，共 ${mainStage?.eventCount || 0} 个节点；主要节点类型为“${mainNodeType?.type || "重点类型"}”，共 ${mainNodeType?.count || 0} 个。节点结构能支撑战斗、会议、渡江、会师等历史主题的分层表达。`,
      "",
      `六、当前页面专题：当前选中“${context?.topic || "综合分析"}”，路线为“${context?.selectedRoute || "当前路线"}”。如果用于答辩，可以概括为：本系统以 GIS 分析结果为依据，将长征路线的空间跨度、地形阻力、事件节点和红色资源联系起来，证明长征精神既有历史叙事价值，也有现实研学和红色旅游组织价值。`,
    ].join("\n");
  }

  async function runAutoAnalysis() {
    const context = collectAnalysisContext();

    if (!context) {
      addMessage("assistant", "当前 GIS 分析页面还在加载，请稍后再次打开 AI 分析结果。");
      return;
    }

    messages.innerHTML = "";
    addMessage("assistant", "正在读取 GIS 分析结果并生成综合分析...");

    let results;

    try {
      results = await loadGisAnalysisResults();
    } catch (error) {
      console.error(error);
      messages.innerHTML = "";
      addMessage("assistant", "GIS 分析结果读取失败，请确认 analysis-*.json 数据文件已经生成。");
      return;
    }

    messages.innerHTML = "";
    addMessage("assistant", buildComprehensiveAnalysis(results, context));
  }

  function createKeySettings() {
    const settings = document.createElement("div");
    const label = document.createElement("label");
    const keyInput = document.createElement("input");
    const saveButton = document.createElement("button");
    const clearButton = document.createElement("button");
    const status = document.createElement("span");

    settings.className = "agent-key-settings";
    label.className = "agent-key-label";
    label.textContent = "DeepSeek Key";
    keyInput.id = "agentApiKey";
    keyInput.type = "password";
    keyInput.placeholder = "不填则使用系统默认 Key";
    keyInput.autocomplete = "off";
    keyInput.value = readApiKey();
    saveButton.type = "button";
    saveButton.textContent = "保存";
    clearButton.type = "button";
    clearButton.textContent = "清除";
    status.className = "agent-key-status";

    function refreshStatus() {
      status.textContent = readApiKey() ? "使用用户 Key" : "使用默认 Key";
    }

    refreshStatus();

    saveButton.addEventListener("click", () => {
      writeApiKey(keyInput.value);
      refreshStatus();
    });

    clearButton.addEventListener("click", () => {
      keyInput.value = "";
      writeApiKey("");
      refreshStatus();
    });

    keyInput.addEventListener("input", () => {
      writeApiKey(keyInput.value);
      refreshStatus();
    });

    settings.append(label, keyInput, saveButton, clearButton, status);
    windowEl.insertBefore(settings, messages);
  }

  function addMessage(role, text) {
    const item = document.createElement("div");
    item.className = `agent-message ${role}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function rememberMessage(role, content) {
    history.push({
      role,
      content,
    });

    if (history.length > 12) {
      history.splice(0, history.length - 12);
    }
  }

  function setLoading(isLoading) {
    form.classList.toggle("is-loading", isLoading);
    input.disabled = isLoading;
    const button = form.querySelector("button");

    if (button) {
      button.disabled = isLoading;
    }
  }

  async function sendMessage(message) {
    if (sending) {
      return;
    }

    sending = true;
    setLoading(true);
    addMessage("user", message);
    rememberMessage("user", message);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          page: $(".analysis-app") ? "analysis" : "home",
          pageContext: collectPageContext(),
          history: history.slice(0, -1),
          apiKey: readApiKey(),
        }),
      });
      const result = await response.json();

      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || "智能助手请求失败");
      }

      addMessage("assistant", result.data.reply);
      rememberMessage("assistant", result.data.reply);
    } catch (error) {
      console.error(error);
      addMessage(
        "assistant",
        error.message ||
          "智能助手暂时无法连接，请检查 DeepSeek Key 或网络后重试。",
      );
    } finally {
      sending = false;
      setLoading(false);
      input.focus();
    }
  }

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");

    if (isAnalysisPage && isOpen) {
      runAutoAnalysis().catch((error) => {
        console.error(error);
        messages.innerHTML = "";
        addMessage("assistant", "综合分析生成失败，请检查 GIS 分析结果数据。");
      });
      return;
    }

    if (isOpen) {
      input.focus();
    }
  });

  closeButton?.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      panel.classList.remove("open");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
      return;
    }

    input.value = "";
    sendMessage(message);
  });

  if (isAnalysisPage) {
    form.hidden = true;
    windowEl.classList.add("agent-auto-mode");
    addMessage("assistant", "点击右下角 AI 分析结果后，我会自动读取当前 GIS 专题数据并生成结论。");
  } else {
    addMessage(
      "assistant",
      "你好，我是长征 GIS 智能助手。可以问我当前分析结果、路线解读、空间关系或答辩讲解。",
    );

    createKeySettings();
  }
})();
