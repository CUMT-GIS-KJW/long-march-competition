(function () {
  const redTourismResources = [
    {
      id: "zunyi_site",
      name: "\u9075\u4e49\u4f1a\u8bae\u4f1a\u5740",
      type: "\u9769\u547d\u65e7\u5740",
      province: "\u8d35\u5dde",
      city: "\u9075\u4e49",
      lat: 27.725,
      lng: 106.928,
      level: "\u5168\u56fd\u91cd\u70b9\u6587\u7269\u4fdd\u62a4\u5355\u4f4d",
      description: "\u957f\u5f81\u8f6c\u6298\u70b9\u7684\u91cd\u8981\u7ea2\u8272\u65c5\u6e38\u8d44\u6e90\u3002",
    },
    {
      id: "luding_bridge",
      name: "\u6cf8\u5b9a\u6865",
      type: "\u7ea2\u8272\u9057\u5740",
      province: "\u56db\u5ddd",
      city: "\u6cf8\u5b9a",
      lat: 29.914,
      lng: 102.234,
      level: "\u957f\u5f81\u7ecf\u5178\u666f\u533a",
      description: "\u98de\u593a\u6cf8\u5b9a\u6865\u7684\u91cd\u8981\u5386\u53f2\u5730\u70b9\u3002",
    },
    {
      id: "ruijin_memorial",
      name: "\u745e\u91d1\u4e2d\u592e\u9769\u547d\u6839\u636e\u5730\u7eaa\u5ff5\u9986",
      type: "\u7eaa\u5ff5\u9986",
      province: "\u6c5f\u897f",
      city: "\u745e\u91d1",
      lat: 25.889,
      lng: 116.021,
      level: "\u56fd\u5bb6\u4e00\u7ea7\u535a\u7269\u9986",
      description: "\u5c55\u793a\u4e2d\u592e\u82cf\u533a\u5386\u53f2\u7684\u91cd\u8981\u7ea2\u8272\u6587\u5316\u573a\u9986\u3002",
    },
  ];

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
    const response = await fetch(getUrl(key, params));

    if (!response.ok) {
      throw new Error(`data load failed: ${key}`);
    }

    const payload = await response.json();

    if (payload && payload.code === 200) {
      return payload.data;
    }

    return payload;
  }

  async function getRedTourismResources() {
    try {
      return await fetchJson("redTourismResources");
    } catch (error) {
      console.warn(error);
      return redTourismResources;
    }
  }

  window.DataService = {
    redTourismResources,
    getEvents: () => fetchJson("events"),
    getEventTimeline: () => fetchJson("eventTimeline"),
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
    getRedTourismResources,
    getAnalysisSummary: () => fetchJson("analysisSummary"),
    getAnalysisProvince: () => fetchJson("analysisProvince"),
    getAnalysisElevation: () => fetchJson("analysisElevation"),
    getAnalysisBuffer: () => fetchJson("analysisBuffer"),
    getAnalysisStage: () => fetchJson("analysisStage"),
    getScene3dFocus: () => fetchJson("scene3dFocus"),
  };
})();
