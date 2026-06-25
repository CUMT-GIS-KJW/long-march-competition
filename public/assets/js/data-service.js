(function () {
  function fillPath(path, params = {}) {
    return Object.entries(params).reduce((result, [key, value]) => {
      return result.replace(`{${key}}`, encodeURIComponent(value));
    }, path);
  }

  function getUrl(key, params = {}) {
    if (APP_CONFIG.dataMode === "static") {
      return fillPath(APP_CONFIG.staticApi[key], params);
    }

    return APP_CONFIG.apiBase + fillPath(APP_CONFIG.backendApi[key], params);
  }

  async function fetchJson(key, params = {}) {
    const url = getUrl(key, params);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`数据加载失败：${url}`);
    }

    const payload = await response.json();

    if (payload && payload.code === 200) {
      return payload.data;
    }

    return payload;
  }

  window.DataService = {
    getEvents: () => fetchJson("events"),
    getEventTimeline: () => fetchJson("eventTimeline"),
    getRoutes: () => fetchJson("routes"),
    getRouteLayers: () => fetchJson("routeLayers"),
    getRouteLayerFeatures: (layerKey) => {
      return fetchJson("routeLayerFeatures", {
        layerKey,
      });
    },
    getRouteLayerAnimation: (layerKey) => {
      return fetchJson("routeLayerAnimation", {
        layerKey,
      });
    },
    getResources: () => fetchJson("resources"),
    getAnalysisSummary: () => fetchJson("analysisSummary"),
    getAnalysisProvince: () => fetchJson("analysisProvince"),
    getAnalysisElevation: () => fetchJson("analysisElevation"),
    getAnalysisBuffer: () => fetchJson("analysisBuffer"),
    getAnalysisStage: () => fetchJson("analysisStage"),
    getScene3dFocus: () => fetchJson("scene3dFocus"),
  };
})();
