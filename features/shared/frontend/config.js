window.APP_CONFIG = {
  dataMode: "api",
  apiBase: "/api",

  staticApi: {
    events: "/assets/data/events-important.json",
    eventTimeline: "/assets/data/events-important.json",
    routeLayers: "/assets/data/route-layer-config.json",
    routeLayerFeatures: "/assets/data/route-layers/{layerKey}.json",
    routeLayerAnimation: "/assets/data/route-layers/{layerKey}.json",
    resources: "/assets/data/resources.json",
    redTourismResources: "/assets/data/resources.json",
    analysisSummary: "/assets/data/analysis-summary.json",
    analysisProvince: "/assets/data/analysis-province.json",
    analysisElevation: "/assets/data/analysis-elevation.json",
    analysisBuffer: "/assets/data/analysis-buffer.json",
    analysisStage: "/assets/data/analysis-stage.json",
    scene3dFocus: "/assets/data/scene3d-focus.json",
  },

  backendApi: {
    events: "/events",
    eventTimeline: "/events/timeline",
    routeLayers: "/route-layers",
    routeLayerFeatures: "/route-layers/{layerKey}/features",
    routeLayerAnimation: "/route-layers/{layerKey}/animation",
    resources: "/resources",
    redTourismResources: "/red-tourism/resources",
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
    name: "\u516c\u5f00 AWS Terrain Tiles Terrarium DEM",
    provider: "terrarium",
    url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    ionToken: "",
    requestVertexNormals: true,
    requestWaterMask: false,
    exaggeration: 2.6,
    useElevationRamp: false,
  },

  terrainImagery: {
    name: "\u540c\u6e90 Terrarium DEM \u5c71\u5f71\u6e32\u67d3",
    provider: "terrariumShade",
    url: "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
    maximumLevel: 12,
    alpha: 1,
  },

  basemaps: {
    ancient: {
      name: "\u53e4\u5730\u56fe\u98ce\u683c",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: "\u00a9 OpenStreetMap contributors",
        maxZoom: 18,
      },
    },
    standard: {
      name: "\u6807\u51c6\u5730\u56fe",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: "\u00a9 OpenStreetMap contributors",
        maxZoom: 18,
      },
    },
    satellite: {
      name: "\u536b\u661f\u5f71\u50cf",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      options: {
        attribution: "Tiles \u00a9 Esri",
        maxZoom: 18,
      },
    },
  },
};
