window.APP_CONFIG = {
  dataMode: "api",
  apiBase: "/api",

  staticApi: {
    events: "./assets/data/events-important.json",
    routes: "./assets/data/routes.json",
    routeLayers: "./assets/data/route-layer-config.json",
    resources: "./assets/data/resources.json",
    analysisSummary: "./assets/data/analysis-summary.json",
    analysisProvince: "./assets/data/analysis-province.json",
    analysisElevation: "./assets/data/analysis-elevation.json",
    analysisBuffer: "./assets/data/analysis-buffer.json",
    analysisStage: "./assets/data/analysis-stage.json",
    scene3dFocus: "./assets/data/scene3d-focus.json",
  },

  backendApi: {
    events: "/events",
    eventTimeline: "/events/timeline",
    routes: "/routes",
    routeLayers: "/route-layers",
    routeLayerFeatures: "/route-layers/{layerKey}/features",
    routeLayerAnimation: "/route-layers/{layerKey}/animation",
    resources: "/resources",
    analysisSummary: "/analysis/summary",
    analysisProvince: "/analysis/province",
    analysisElevation: "/analysis/elevation",
    analysisBuffer: "/analysis/buffer",
    analysisStage: "/analysis/stage",
    scene3dFocus: "/scene3d/focus",
  },

  map: {
    center: [31.2, 104.8],
    zoom: 5,
    minZoom: 4,
    maxZoom: 18,
  },

  terrain: {
    name: "公开 AWS Terrain Tiles Terrarium DEM",
    provider: "terrarium",
    url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    ionToken: "",
    requestVertexNormals: true,
    requestWaterMask: false,
    exaggeration: 2.6,
    useElevationRamp: false,
  },

  terrainImagery: {
    name: "同源 Terrarium DEM 山影渲染",
    provider: "terrariumShade",
    url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    maximumLevel: 12,
    alpha: 1,
  },

  basemaps: {
    ancient: {
      name: "古地图风格",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      },
    },
    standard: {
      name: "标准地图",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      },
    },
    satellite: {
      name: "卫星影像",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      options: {
        attribution: "Tiles © Esri",
        maxZoom: 18,
      },
    },
  },
};
