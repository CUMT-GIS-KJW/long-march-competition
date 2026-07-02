(function () {
  const EVENT_FIELD = {
    id: "\u4e8b\u4ef6\u7f16",
    name: "\u5730\u540d",
    description: "\u4e8b\u4ef6",
    stage: "\u4e8b\u4ef6\u9636",
    unit: "\u5173\u8054\u90e8",
    date: "\u4e8b\u4ef6\u65e5",
    type: "\u4e8b\u4ef6\u7c7b",
    people: "\u961f\u4f0d\u603b",
  };

  const state = {
    viewer: null,
    focus: null,
    events: [],
    routeConfigs: [],
    routeCollections: {},
    routeEntities: [],
    nodeEntities: [],
    coreEntities: [],
    riverEntities: [],
    measureEntities: [],
    activePreset: "overview",
    measurement: {
      enabled: false,
      points: [],
    },
    terrainSource: "\u771f\u5b9e DEM",
    terrainExaggeration: window.APP_CONFIG?.terrain?.exaggeration || 1.8,
  };

  const $ = (selector) => document.querySelector(selector);

  const CHINA_BOUNDS = {
    west: 73.4,
    south: 18.0,
    east: 135.1,
    north: 53.6,
  };

  const SCENE_BOUNDS = {
    ...CHINA_BOUNDS,
  };

  const SCENE_CENTER = {
    lng: (SCENE_BOUNDS.west + SCENE_BOUNDS.east) / 2,
    lat: (SCENE_BOUNDS.south + SCENE_BOUNDS.north) / 2,
  };

  let flagImage = null;
  const terrainTileCache = new Map();
  const terrainShadeCache = new Map();

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mixChannel(start, end, amount) {
    return Math.round(start + (end - start) * amount);
  }

  function mixColor(start, end, amount) {
    const t = clampNumber(amount, 0, 1);

    return [
      mixChannel(start[0], end[0], t),
      mixChannel(start[1], end[1], t),
      mixChannel(start[2], end[2], t),
    ];
  }

  function terrainPalette(height, localT) {
    const stops = [
      { height: -200, color: [121, 145, 107] },
      { height: 250, color: [156, 171, 111] },
      { height: 700, color: [191, 179, 122] },
      { height: 1400, color: [171, 151, 112] },
      { height: 2400, color: [126, 134, 126] },
      { height: 3600, color: [174, 179, 174] },
      { height: 5200, color: [242, 239, 226] },
    ];

    for (let index = 1; index < stops.length; index += 1) {
      if (height <= stops[index].height) {
        const previous = stops[index - 1];
        const next = stops[index];
        const amount =
          (height - previous.height) / (next.height - previous.height);

        return mixColor(previous.color, next.color, amount);
      }
    }

    const lastColor = stops[stops.length - 1].color;
    return mixColor(lastColor, [255, 252, 238], localT * 0.24);
  }

  function decodeTerrariumHeight(pixels, pixelIndex) {
    const red = pixels[pixelIndex];
    const green = pixels[pixelIndex + 1];
    const blue = pixels[pixelIndex + 2];

    return red * 256 + green + blue / 256 - 32768;
  }

  function createTerrariumShadeCanvas(image, tileSize) {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = tileSize;
    sourceCanvas.height = tileSize;
    const sourceContext = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    sourceContext.drawImage(image, 0, 0, tileSize, tileSize);
    const pixels = sourceContext.getImageData(0, 0, tileSize, tileSize).data;
    const heights = new Float32Array(tileSize * tileSize);
    let minHeight = Number.POSITIVE_INFINITY;
    let maxHeight = Number.NEGATIVE_INFINITY;

    for (let index = 0, pixel = 0; index < heights.length; index += 1, pixel += 4) {
      const height = decodeTerrariumHeight(pixels, pixel);
      heights[index] = height;
      minHeight = Math.min(minHeight, height);
      maxHeight = Math.max(maxHeight, height);
    }

    const range = Math.max(maxHeight - minHeight, 1);
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = tileSize;
    outputCanvas.height = tileSize;
    const outputContext = outputCanvas.getContext("2d");
    const imageData = outputContext.createImageData(tileSize, tileSize);
    const lightAzimuth = -0.72;
    const lightAltitude = 0.96;

    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const sampleX0 = Math.max(0, x - 1);
        const sampleX1 = Math.min(tileSize - 1, x + 1);
        const sampleY0 = Math.max(0, y - 1);
        const sampleY1 = Math.min(tileSize - 1, y + 1);
        const index = y * tileSize + x;
        const height = heights[index];
        const dx = heights[y * tileSize + sampleX1] - heights[y * tileSize + sampleX0];
        const dy = heights[sampleY1 * tileSize + x] - heights[sampleY0 * tileSize + x];
        const localT = (height - minHeight) / range;
        const base = terrainPalette(height, localT);
        const slope = clampNumber(Math.hypot(dx, dy) / 1800, 0, 0.34);
        const aspectShade =
          0.78 +
          Math.cos(lightAzimuth) * clampNumber(dx / 1200, -0.24, 0.24) -
          Math.sin(lightAzimuth) * clampNumber(dy / 1200, -0.24, 0.24);
        const relief = clampNumber(
          aspectShade + Math.sin(lightAltitude) * (localT - 0.42) * 0.12 - slope * 0.22,
          0.54,
          1.16,
        );
        const contour =
          Math.abs((height % 300 + 300) % 300 - 150) > 146 ? 0.92 : 1;
        const atmospheric = 0.94 + localT * 0.08;
        const edge = clampNumber(relief * contour * atmospheric, 0.48, 1.12);
        const outputIndex = index * 4;

        imageData.data[outputIndex] = clampNumber(base[0] * edge, 0, 255);
        imageData.data[outputIndex + 1] = clampNumber(base[1] * edge, 0, 255);
        imageData.data[outputIndex + 2] = clampNumber(base[2] * edge, 0, 255);
        imageData.data[outputIndex + 3] = 255;
      }
    }

    outputContext.putImageData(imageData, 0, 0);
    return outputCanvas;
  }

  function flash(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 1700);
  }

  function updateSceneMetrics() {
    $("#routeCount").textContent = state.routeConfigs.length;
    $("#nodeCount").textContent = state.nodeEntities.length;
  }

  function formatDistance(meters) {
    if (!Number.isFinite(meters)) {
      return "-";
    }

    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + " km";
    }

    return Math.round(meters) + " m";
  }

  function updateMeasureSummary(text) {
    const summary = $("#measureSummary");

    if (summary) {
      summary.textContent = text;
    }
  }

  function updateSelectedFeature(title, meta, description) {
    $("#selectedName").textContent = title;
    $("#selectedMeta").textContent = meta;
    $("#selectedDescription").textContent = description;
  }

  function describeRoute(entity) {
    const properties = entity.routeProperties || {};
    const corps = properties.corps_name || entity.name || "长征路线";
    const stage = properties.stage_name || properties.KML_FOLDER || "路线段";
    const date = [properties.start_date, properties.end_date]
      .filter(Boolean)
      .join(" 至 ");
    const detail = properties.descript || properties.descriptio || "路线段已贴合三维地形展示。";

    updateSelectedFeature(
      corps,
      date ? `${stage} · ${date}` : stage,
      detail,
    );
  }

  function describeEvent(event) {
    updateSelectedFeature(
      event.name,
      [event.stage, event.date, event.unit].filter(Boolean).join(" · "),
      event.description || "重要历史节点。",
    );
  }

  function formatLngLat(cartographic) {
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);

    return `${lng.toFixed(3)} E / ${lat.toFixed(3)} N`;
  }

  function formatElevation(height) {
    if (!Number.isFinite(height)) {
      return "-";
    }

    return `${Math.round(height)} m`;
  }

  function pickTerrainCartographic(screenPosition) {
    const scene = state.viewer.scene;
    const ray = state.viewer.camera.getPickRay(screenPosition);

    if (!ray) {
      return null;
    }

    const cartesian = scene.globe.pick(ray, scene);

    if (!Cesium.defined(cartesian)) {
      return null;
    }

    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    const sampledHeight = scene.globe.getHeight(cartographic);

    cartographic.height = Number.isFinite(sampledHeight)
      ? sampledHeight
      : cartographic.height;

    return cartographic;
  }

  function updatePointerReadout(cartographic) {
    if (!cartographic) {
      $("#pointerCoordinate").textContent = "-";
      $("#pointerElevation").textContent = "-";
      return;
    }

    $("#pointerCoordinate").textContent = formatLngLat(cartographic);
    $("#pointerElevation").textContent = formatElevation(cartographic.height);
  }

  function describeTerrainSample(cartographic) {
    const coordinate = formatLngLat(cartographic);
    const elevation = formatElevation(cartographic.height);

    updateSelectedFeature(
      "\u5730\u8868\u91c7\u6837\u70b9",
      `${coordinate} \u00b7 \u4f30\u7b97\u9ad8\u7a0b ${elevation}`,
      "\u57fa\u4e8e\u5f53\u524d DEM \u5730\u5f62\u4e0e Cesium Globe \u8868\u9762\u62fe\u53d6\u7684\u4e34\u573a\u91c7\u6837\u7ed3\u679c\uff0c\u53ef\u7528\u4e8e\u5feb\u901f\u5224\u65ad\u8def\u7ebf\u7ecf\u8fc7\u533a\u57df\u7684\u5730\u5f62\u9ad8\u5dee\u3002",
    );
  }

  function readValue(properties, key, fallback = "") {
    return properties[key] ?? fallback;
  }

  function normalizeEvent(feature) {
    const properties = feature.properties || {};
    const coordinates = feature.geometry?.coordinates || [0, 0];
    const people = Number(readValue(properties, EVENT_FIELD.people, 0)) || 0;
    const eventClass = String(
      readValue(properties, EVENT_FIELD.type, "\u4e8b\u4ef6"),
    );

    return {
      id: `event-${readValue(properties, EVENT_FIELD.id, coordinates.join("-"))}`,
      name: readValue(properties, EVENT_FIELD.name, "\u672a\u547d\u540d\u4e8b\u4ef6\u70b9"),
      date: readValue(properties, EVENT_FIELD.date, ""),
      type: normalizeEventType(eventClass),
      stage: readValue(properties, EVENT_FIELD.stage, ""),
      unit: readValue(properties, EVENT_FIELD.unit, ""),
      lat: coordinates[1],
      lng: coordinates[0],
      people,
      importance: getPeopleImportance(people),
      description: readValue(properties, EVENT_FIELD.description, ""),
    };
  }

  function normalizeEventType(eventClass) {
    if (eventClass.includes("\u6218") || eventClass.includes("\u7a81\u7834")) {
      return "battle";
    }

    if (eventClass.includes("\u4f1a")) {
      return "meeting";
    }

    if (eventClass.includes("\u6e21") || eventClass.includes("\u6c5f")) {
      return "crossing";
    }

    if (eventClass.includes("\u5c71") || eventClass.includes("\u8349")) {
      return "mountain";
    }

    return "event";
  }

  function getPeopleImportance(people) {
    if (people >= 80000) {
      return 5;
    }

    if (people >= 50000) {
      return 4;
    }

    if (people >= 30000) {
      return 3;
    }

    if (people >= 10000) {
      return 2;
    }

    return 1;
  }

  function fillTemplate(template, values) {
    return Object.entries(values).reduce((result, [key, value]) => {
      return result.replace(`{${key}}`, value);
    }, template);
  }

  function loadDemImage(url) {
    if (terrainTileCache.has(url)) {
      return terrainTileCache.get(url);
    }

    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`DEM tile load failed: ${url}`));
      image.src = url;
    });

    terrainTileCache.set(url, promise);
    return promise;
  }

  class TerrariumTerrainProvider {
    constructor(options) {
      this.url = options.url;
      this.tileSize = options.tileSize || 256;
      this.maximumLevel = options.maximumLevel || 12;
      this.tilingScheme = new Cesium.WebMercatorTilingScheme();
      this.errorEvent = new Cesium.Event();
      this.credit = new Cesium.Credit(
        options.credit || "AWS Terrain Tiles / Terrarium DEM",
      );
      this.hasWaterMask = false;
      this.hasVertexNormals = false;
      this.availability = undefined;
      this.ready = true;
      this.readyPromise = Promise.resolve(true);
    }

    getLevelMaximumGeometricError(level) {
      const levelZeroError =
        Cesium.TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(
          this.tilingScheme.ellipsoid,
          this.tileSize,
          this.tilingScheme.getNumberOfXTilesAtLevel(0),
        );

      return levelZeroError / (1 << level);
    }

    requestTileGeometry(x, y, level) {
      if (level > this.maximumLevel) {
        const factor = 1 << (level - this.maximumLevel);
        x = Math.floor(x / factor);
        y = Math.floor(y / factor);
        level = this.maximumLevel;
      }

      const url = fillTemplate(this.url, {
        z: level,
        x,
        y,
      });

      return loadDemImage(url).then((image) => {
        const canvas = document.createElement("canvas");
        canvas.width = this.tileSize;
        canvas.height = this.tileSize;
        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        context.drawImage(image, 0, 0, this.tileSize, this.tileSize);
        const pixels = context.getImageData(0, 0, this.tileSize, this.tileSize).data;
        const heights = new Int16Array(this.tileSize * this.tileSize);

        for (let index = 0, pixel = 0; index < heights.length; index += 1, pixel += 4) {
          heights[index] = Math.round(decodeTerrariumHeight(pixels, pixel));
        }

        return new Cesium.HeightmapTerrainData({
          buffer: heights,
          width: this.tileSize,
          height: this.tileSize,
          childTileMask: 15,
          structure: {
            heightScale: 1,
            heightOffset: 0,
            elementsPerHeight: 1,
            stride: 1,
            elementMultiplier: 1,
            isBigEndian: false,
          },
        });
      });
    }

    getTileDataAvailable() {
      return undefined;
    }

    loadTileDataAvailability() {
      return undefined;
    }
  }

  class TerrariumShadeImageryProvider {
    constructor(options) {
      this.url = options.url;
      this.tileWidth = options.tileSize || 256;
      this.tileHeight = options.tileSize || 256;
      this.maximumLevel = options.maximumLevel || 12;
      this.minimumLevel = options.minimumLevel || 0;
      this.tilingScheme = new Cesium.WebMercatorTilingScheme();
      this.rectangle = this.tilingScheme.rectangle;
      this.credit = new Cesium.Credit(
        options.credit || "AWS Terrain Tiles / DEM shaded relief",
      );
      this.errorEvent = new Cesium.Event();
      this.ready = true;
      this.readyPromise = Promise.resolve(true);
      this.hasAlphaChannel = false;
    }

    requestImage(x, y, level) {
      const url = fillTemplate(this.url, {
        z: level,
        x,
        y,
      });

      if (terrainShadeCache.has(url)) {
        return terrainShadeCache.get(url);
      }

      const promise = loadDemImage(url).then((image) =>
        createTerrariumShadeCanvas(image, this.tileWidth),
      );

      terrainShadeCache.set(url, promise);
      return promise;
    }

    pickFeatures() {
      return undefined;
    }

    getTileCredits() {
      return undefined;
    }
  }

  async function createTerrainOptions() {
    const terrainConfig = window.APP_CONFIG?.terrain || {};
    const options = {
      requestVertexNormals: terrainConfig.requestVertexNormals !== false,
      requestWaterMask: terrainConfig.requestWaterMask === true,
    };

    if (terrainConfig.ionToken) {
      Cesium.Ion.defaultAccessToken = terrainConfig.ionToken;
    }

    if (terrainConfig.provider === "terrarium" && terrainConfig.url) {
      state.terrainSource = terrainConfig.name || "Terrarium DEM";

      return {
        terrainProvider: new TerrariumTerrainProvider({
          url: terrainConfig.url,
          maximumLevel: terrainConfig.maximumLevel || 12,
          credit: terrainConfig.name || "Terrarium DEM",
        }),
      };
    }

    if (
      terrainConfig.provider === "arcgisWorldElevation" &&
      terrainConfig.url &&
      Cesium.ArcGISTiledElevationTerrainProvider?.fromUrl
    ) {
      state.terrainSource = terrainConfig.name || "ArcGIS World Elevation DEM";
      return {
        terrainProvider: await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
          terrainConfig.url,
        ),
      };
    }

    if (terrainConfig.provider !== "arcgisWorldElevation" && terrainConfig.url) {
      state.terrainSource = terrainConfig.name || "\u672c\u5730 DEM Terrain";
      const terrainProvider = Cesium.CesiumTerrainProvider?.fromUrl
        ? await Cesium.CesiumTerrainProvider.fromUrl(terrainConfig.url, options)
        : new Cesium.CesiumTerrainProvider({
            url: terrainConfig.url,
            ...options,
          });

      return {
        terrainProvider,
      };
    }

    if (Cesium.Terrain?.fromWorldTerrain) {
      state.terrainSource = "Cesium World Terrain DEM";
      return {
        terrain: Cesium.Terrain.fromWorldTerrain(options),
      };
    }

    if (Cesium.createWorldTerrainAsync) {
      state.terrainSource = "Cesium World Terrain DEM";
      return {
        terrainProvider: await Cesium.createWorldTerrainAsync(options),
      };
    }

    if (Cesium.CesiumTerrainProvider?.fromIonAssetId) {
      state.terrainSource = "Cesium World Terrain DEM";
      return {
        terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(
          1,
          options,
        ),
      };
    }

    throw new Error("当前 Cesium 版本不支持真实 DEM terrain provider");
  }

  function createElevationRamp() {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, canvas.width, 0);

    gradient.addColorStop(0.0, "#dfc88f");
    gradient.addColorStop(0.22, "#b9a973");
    gradient.addColorStop(0.45, "#758667");
    gradient.addColorStop(0.68, "#536f70");
    gradient.addColorStop(0.86, "#d7d8ca");
    gradient.addColorStop(1.0, "#fff6da");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    return canvas;
  }

  async function createTerrainImageryProvider() {
    const imageryConfig = window.APP_CONFIG?.terrainImagery || {};

    if (
      imageryConfig.provider === "arcgisMapServer" &&
      imageryConfig.url &&
      Cesium.ArcGisMapServerImageryProvider?.fromUrl
    ) {
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(imageryConfig.url);
    }

    if (imageryConfig.provider === "terrariumShade" && imageryConfig.url) {
      return new TerrariumShadeImageryProvider({
        url: imageryConfig.url,
        maximumLevel: imageryConfig.maximumLevel || 12,
        credit: imageryConfig.name || "AWS Terrain Tiles DEM shaded relief",
      });
    }

    if (
      imageryConfig.provider === "arcgisMapServer" &&
      imageryConfig.url &&
      Cesium.ArcGisMapServerImageryProvider
    ) {
      return new Cesium.ArcGisMapServerImageryProvider({
        url: imageryConfig.url,
      });
    }

    if (imageryConfig.url) {
      return new Cesium.UrlTemplateImageryProvider({
        url: imageryConfig.url,
        maximumLevel: imageryConfig.maximumLevel || 13,
        credit: imageryConfig.name || "\u516c\u5f00 DEM \u5c71\u5f71",
      });
    }

    return new Cesium.GridImageryProvider({
      cells: 4,
      color: Cesium.Color.fromCssColorString("#8b6334").withAlpha(0.32),
      glowColor: Cesium.Color.fromCssColorString("#f5dfaa").withAlpha(0.22),
      backgroundColor: Cesium.Color.fromCssColorString("#d9bd7c"),
      glowWidth: 2,
    });
  }

  function styleDemTerrain(viewer) {
    const materialType = Cesium.Material.ElevationRampType || "ElevationRamp";

    try {
      const material = Cesium.Material.fromType(materialType);
      material.uniforms.minimumHeight = -200;
      material.uniforms.maximumHeight = 5200;
      material.uniforms.image = createElevationRamp();
      viewer.scene.globe.material = material;
    } catch (error) {
      console.warn("Elevation ramp material unavailable", error);
    }
  }

  async function createViewer() {
    const terrainOptions = await createTerrainOptions();
    const imageryProvider = await createTerrainImageryProvider();
    const imageryOptions = Cesium.ImageryLayer
      ? { baseLayer: new Cesium.ImageryLayer(imageryProvider) }
      : { imageryProvider };
    const viewer = new Cesium.Viewer("cesiumContainer", {
      ...imageryOptions,
      ...terrainOptions,
      terrainExaggeration: state.terrainExaggeration,
      verticalExaggeration: state.terrainExaggeration,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      selectionIndicator: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      shouldAnimate: true,
      requestRenderMode: false,
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#9f9a78");
    viewer.scene.globe.show = true;
    viewer.scene.globe.atmosphereLightIntensity = 6.5;
    viewer.scene.globe.dynamicAtmosphereLighting = true;
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyBox.show = false;
    viewer.scene.sun.show = true;
    viewer.scene.moon.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#263238");
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.0000018;
    viewer.scene.fog.minimumBrightness = 0.16;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 20000;
    viewer.scene.screenSpaceCameraController.maximumZoomDistance = 6200000;
    viewer.scene.screenSpaceCameraController.inertiaSpin = 0.35;
    viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.28;
    viewer.scene.screenSpaceCameraController.inertiaZoom = 0.22;
    const terrainImageryAlpha = window.APP_CONFIG?.terrainImagery?.alpha;
    const baseImageryLayer = viewer.imageryLayers.get(0);

    if (baseImageryLayer && typeof terrainImageryAlpha === "number") {
      baseImageryLayer.alpha = terrainImageryAlpha;
    }

    if (window.APP_CONFIG?.terrain?.useElevationRamp === true) {
      styleDemTerrain(viewer);
    }

    return viewer;
  }

  function projectCoordinate(lng, lat) {
    return {
      lng,
      lat,
    };
  }

  function fromProjectedDegrees(lng, lat, height = 0) {
    const point = projectCoordinate(lng, lat);

    return Cesium.Cartesian3.fromDegrees(point.lng, point.lat, height);
  }

  function toDegreesHeightPath(points, height) {
    return points.flatMap(([lng, lat]) => {
      return [lng, lat, height];
    });
  }

  function addRiver(name, points, width = 5) {
    const shadow = state.viewer.entities.add({
      id: `${name}-river-shadow`,
      name,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(
          toDegreesHeightPath(points, 1700),
        ),
        width: width + 4,
        material: Cesium.Color.fromCssColorString("#3d2418").withAlpha(0.28),
        clampToGround: true,
      },
    });

    const river = state.viewer.entities.add({
      id: `${name}-river`,
      name,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(
          toDegreesHeightPath(points, 1900),
        ),
        width,
        material: new Cesium.PolylineOutlineMaterialProperty({
          color: Cesium.Color.fromCssColorString("#497a82").withAlpha(0.78),
          outlineColor: Cesium.Color.fromCssColorString("#e9d69e").withAlpha(0.5),
          outlineWidth: 1,
        }),
        clampToGround: true,
      },
    });

    state.riverEntities.push(shadow, river);
  }

  function addDemContextOverlays() {
    addRiver("\u91d1\u6c99\u6c5f-\u957f\u6c5f\u4e0a\u6e38", [
      [99.0, 27.7],
      [101.2, 26.8],
      [103.6, 27.4],
      [105.8, 28.6],
      [108.4, 30.4],
      [112.2, 30.6],
      [116.5, 31.4],
    ], 6);
    addRiver("\u5927\u6e21\u6cb3", [
      [101.2, 31.7],
      [101.8, 30.9],
      [102.2, 30.3],
      [102.5, 29.9],
      [103.0, 29.3],
    ], 4);
    addRiver("\u8d64\u6c34\u6cb3", [
      [105.2, 27.8],
      [105.6, 28.3],
      [106.0, 28.7],
      [106.5, 28.9],
    ], 4);
    addRiver("\u6e58\u6c5f", [
      [110.7, 27.2],
      [111.1, 26.6],
      [111.5, 25.8],
      [111.8, 25.2],
    ], 4);
  }

  function updateArchive(focus) {
    $("#focusLng").textContent = `${focus.lng.toFixed(3)}\u00b0 E`;
    $("#focusLat").textContent = `${focus.lat.toFixed(3)}\u00b0 N`;
    $("#focusHeight").textContent = `\u7ea6 ${focus.height} m`;
    $("#terrainLayerCount").textContent =
      `${state.routeConfigs.length} \u6761\u8def\u7ebf / ${state.nodeEntities.length} \u4e2a\u8282\u70b9`;
  }

  function addCorePoint() {
    const focus = state.focus;
    const viewer = state.viewer;
    const focusPoint = projectCoordinate(focus.lng, focus.lat);
    const longitude = focusPoint.lng;
    const latitude = focusPoint.lat;

    const ring = viewer.entities.add({
      id: "zunyi-core-ring",
      name: focus.name,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1200),
      ellipse: {
        semiMajorAxis: 36000,
        semiMinorAxis: 36000,
        material: Cesium.Color.fromCssColorString("#b52d20").withAlpha(0.28),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#f0c956"),
        height: 80,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
    });

    const column = viewer.entities.add({
      id: "zunyi-core-column",
      name: focus.name,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 6200),
      cylinder: {
        length: 9800,
        topRadius: 1800,
        bottomRadius: 6800,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        material: Cesium.Color.fromCssColorString("#a8261d").withAlpha(0.62),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#f1cd66"),
      },
      label: {
        text: "\u9075\u4e49\u4f1a\u8bae\u4f1a\u5740\n\u957f\u5f81\u4f1f\u5927\u8f6c\u6298\u70b9",
        font: "bold 17px Microsoft YaHei",
        fillColor: Cesium.Color.fromCssColorString("#ffe69a"),
        outlineColor: Cesium.Color.fromCssColorString("#5c160f"),
        outlineWidth: 4,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -104),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          1800000,
        ),
      },
    });

    const pole = viewer.entities.add({
      id: "zunyi-flag-pole",
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 11600),
      cylinder: {
        length: 8800,
        topRadius: 380,
        bottomRadius: 380,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        material: Cesium.Color.fromCssColorString("#e4bf68"),
      },
    });

    const flag = viewer.entities.add({
      id: "zunyi-flag",
      position: Cesium.Cartesian3.fromDegrees(
        longitude + 0.16,
        latitude,
        15200,
      ),
      box: {
        dimensions: new Cesium.Cartesian3(28000, 1200, 15000),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        material: Cesium.Color.fromCssColorString("#b31f18"),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString("#f1cd66"),
      },
    });

    state.coreEntities.push(ring, column, pole, flag);
  }

  function extractLines(geometry) {
    if (!geometry) {
      return [];
    }

    if (geometry.type === "LineString") {
      return [geometry.coordinates];
    }

    if (geometry.type === "MultiLineString") {
      return geometry.coordinates;
    }

    return [];
  }

  function toProjectedDegreesHeightArray(line, height) {
    return line.flatMap((coordinate) => {
      const point = projectCoordinate(coordinate[0], coordinate[1]);

      return [point.lng, point.lat, height];
    });
  }

  function addRoutes() {
    state.routeConfigs.forEach((config) => {
      const collection = state.routeCollections[config.layer_key];

      if (!collection) {
        return;
      }

      collection.features.forEach((feature, index) => {
        const lines = extractLines(feature.geometry);

        lines.forEach((line, lineIndex) => {
          if (line.length < 2) {
            return;
          }

          const coordinates = toProjectedDegreesHeightArray(line, 0);

          const shadow = state.viewer.entities.add({
            id: `scene-route-shadow-${config.layer_key}-${index}-${lineIndex}`,
            name: config.layer_name,
            routeProperties: feature.properties,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights(coordinates),
              width: Number(config.line_width || 3) + 6,
              material: Cesium.Color.fromCssColorString("#5a1e16").withAlpha(0.34),
              clampToGround: true,
            },
          });

          const entity = state.viewer.entities.add({
            id: `scene-route-${config.layer_key}-${index}-${lineIndex}`,
            name: config.layer_name,
            routeProperties: feature.properties,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights(coordinates),
              width: Number(config.line_width || 3) + 5,
              material: new Cesium.PolylineOutlineMaterialProperty({
                color: Cesium.Color.fromCssColorString(config.color).withAlpha(0.98),
                outlineColor: Cesium.Color.fromCssColorString("#f3d06f").withAlpha(0.42),
                outlineWidth: 1,
              }),
              clampToGround: true,
            },
          });

          state.routeEntities.push(shadow, entity);
        });
      });
    });
  }

  function nodeColor(type) {
    const colors = {
      battle: "#bf2d22",
      meeting: "#d09a35",
      crossing: "#347db9",
      mountain: "#dcebf0",
      event: "#9d9485",
    };

    return Cesium.Color.fromCssColorString(colors[type] || colors.event);
  }

  function addAuxiliaryNodes() {
    state.events
      .filter((event) => {
        return event.importance >= 4 && !event.name.includes("\u9075\u4e49");
      })
      .forEach((event) => {
        const height = event.importance >= 5 ? 1300 : 650;
        const color = nodeColor(event.type);

        const entity = state.viewer.entities.add({
          id: `scene-node-${event.id}`,
          name: event.name,
          eventData: event,
          position: fromProjectedDegrees(event.lng, event.lat, height / 2 + 1700),
          cylinder: {
            length: height + 1300,
            topRadius: event.importance >= 5 ? 1200 : 620,
            bottomRadius: event.importance >= 5 ? 3600 : 1800,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            material: color.withAlpha(0.68),
          },
          label: {
            text: event.name,
            font: "12px Microsoft YaHei",
            fillColor: color,
            outlineColor: Cesium.Color.fromCssColorString("#3a100b"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -25),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
              0,
              event.importance >= 5 ? 1900000 : 1100000,
            ),
          },
        });

        state.nodeEntities.push(entity);
      });
  }

  const VIEW_PRESETS = {
    overview: {
      label: "中国区域 DEM 地形",
      lng: SCENE_CENTER.lng,
      lat: SCENE_CENTER.lat - 0.4,
      range: 5200000,
      radius: 1800000,
      heading: -10,
      pitch: -76,
      description: "仅显示中国经纬度范围内的 DEM 地形、长征路线与关键节点。",
    },
    zunyi: {
      label: "遵义会议会址",
      lng: 106.928,
      lat: 27.725,
      range: 110000,
      radius: 26000,
      targetHeight: 850,
      useFocusPoint: true,
      heading: -24,
      pitch: -56,
      description: "聚焦长征转折点与周边山地环境。",
    },
    luding: {
      label: "泸定桥与大渡河",
      lng: 102.23014668332286,
      lat: 29.914233781064183,
      range: 150000,
      radius: 32000,
      targetHeight: 1350,
      eventNameKeywords: ["泸定"],
      heading: 28,
      pitch: -58,
      description: "观察大渡河峡谷与桥位通道关系。",
    },
    snow: {
      label: "夹金山雪山区域",
      lng: 102.63941444172315,
      lat: 30.965968312187897,
      range: 280000,
      radius: 52000,
      targetHeight: 4100,
      eventNameKeywords: ["夹金山"],
      heading: -32,
      pitch: -59,
      description: "查看高海拔雪山地形对行军线路的影响。",
    },
  };

  function setActivePreset(name) {
    state.activePreset = name;
    document.querySelectorAll("[data-view-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.viewPreset === name);
    });
  }

  function findPresetEvent(preset) {
    if (!preset.eventNameKeywords?.length) {
      return null;
    }

    return state.events.find((event) => {
      return preset.eventNameKeywords.every((keyword) =>
        String(event.name || "").includes(keyword),
      );
    });
  }

  function getSurfaceHeight(lng, lat, fallback = 0) {
    const cartographic = Cesium.Cartographic.fromDegrees(lng, lat);
    const height = state.viewer?.scene?.globe?.getHeight(cartographic);

    return Number.isFinite(height) ? height : fallback;
  }

  function resolvePresetTarget(preset) {
    if (preset.useFocusPoint && state.focus) {
      return {
        lng: state.focus.lng,
        lat: state.focus.lat,
        height: state.focus.height ?? preset.targetHeight ?? 0,
      };
    }

    const event = findPresetEvent(preset);

    return {
      lng: event?.lng ?? preset.lng,
      lat: event?.lat ?? preset.lat,
      height: preset.targetHeight ?? 0,
    };
  }

  function flyToPreset(name, duration = 1.5) {
    const presetName = VIEW_PRESETS[name] ? name : "overview";
    const preset = VIEW_PRESETS[presetName];
    const target = resolvePresetTarget(preset);
    const targetHeight = getSurfaceHeight(target.lng, target.lat, target.height);
    const targetCartesian = Cesium.Cartesian3.fromDegrees(
      target.lng,
      target.lat,
      targetHeight,
    );
    const boundingSphere = new Cesium.BoundingSphere(
      targetCartesian,
      preset.radius || 20000,
    );
    const offset = new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(preset.heading),
      Cesium.Math.toRadians(preset.pitch),
      preset.range || 260000,
    );

    setActivePreset(presetName);
    state.viewer.camera.flyToBoundingSphere(boundingSphere, {
      offset,
      duration,
    });
    updatePointerReadout({
      longitude: Cesium.Math.toRadians(target.lng),
      latitude: Cesium.Math.toRadians(target.lat),
      height: targetHeight,
    });
    updateSelectedFeature(
      preset.label,
      "三维视角预设",
      preset.description,
    );
    $("#sceneState").textContent = preset.label;
  }

  function flyToOverview(duration = 1.8) {
    flyToPreset("overview", duration);
  }

  function addBridge(name, start, end) {
    const from = projectCoordinate(start.lng, start.lat);
    const to = projectCoordinate(end.lng, end.lat);
    const mid = {
      lng: (from.lng + to.lng) / 2,
      lat: (from.lat + to.lat) / 2,
    };

    const bridge = state.viewer.entities.add({
      name,
      position: Cesium.Cartesian3.fromDegrees(mid.lng, mid.lat, 18000),
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          from.lng,
          from.lat,
          7600,
          to.lng,
          to.lat,
          7600,
        ]),
        width: 9,
        material: new Cesium.PolylineOutlineMaterialProperty({
          color: Cesium.Color.fromCssColorString("#6b2d19"),
          outlineColor: Cesium.Color.fromCssColorString("#f0cf72"),
          outlineWidth: 2,
        }),
      },
      label: {
        text: name,
        font: "bold 13px Microsoft YaHei",
        fillColor: Cesium.Color.fromCssColorString("#f5d982"),
        outlineColor: Cesium.Color.fromCssColorString("#42130d"),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1700000),
      },
    });

    state.coreEntities.push(bridge);
  }

  function getFlagImage() {
    if (flagImage) {
      return flagImage;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 116;
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#6f2a1b";
    context.fillRect(28, 22, 8, 86);
    context.fillStyle = "#b7281f";
    context.beginPath();
    context.moveTo(36, 22);
    context.lineTo(156, 42);
    context.lineTo(36, 68);
    context.closePath();
    context.fill();
    context.fillStyle = "#f3d56f";
    context.beginPath();
    context.arc(68, 43, 9, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(68, 18, 11, 0.5)";
    context.lineWidth = 4;
    context.stroke();

    flagImage = canvas.toDataURL("image/png");

    return flagImage;
  }

  function addFlag(lng, lat, size = 1) {
    const point = projectCoordinate(lng, lat);
    const entity = state.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, 12000),
      billboard: {
        image: getFlagImage(),
        width: 70 * size,
        height: 46 * size,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scaleByDistance: new Cesium.NearFarScalar(250000, 1.2, 1900000, 0.48),
      },
    });

    state.coreEntities.push(entity);
  }

  function addSceneDetails() {
    addBridge("\u6cf8\u5b9a\u6865", { lng: 102.18, lat: 29.9 }, { lng: 102.62, lat: 29.86 });
    addBridge("\u8d64\u6c34\u6cb3", { lng: 105.55, lat: 28.62 }, { lng: 106.05, lat: 28.44 });

    [
      [116.0, 25.9, 1.08],
      [110.2, 26.3, 0.94],
      [106.93, 27.72, 1.28],
      [102.3, 29.9, 0.98],
      [99.8, 31.8, 1.02],
      [105.0, 35.6, 0.92],
    ].forEach(([lng, lat, size]) => {
      addFlag(lng, lat, size);
    });
  }

  function setEntitiesVisible(entities, visible) {
    entities.forEach((entity) => {
      entity.show = visible;
    });
  }

  function setLabelsVisible(visible) {
    state.viewer.entities.values.forEach((entity) => {
      if (entity.label) {
        entity.label.show = visible;
      }
    });
  }

  function setTerrainExaggeration(value) {
    const exaggeration = clampNumber(Number(value) || 1, 1, 5);

    state.terrainExaggeration = exaggeration;
    if ("verticalExaggeration" in state.viewer.scene) {
      state.viewer.scene.verticalExaggeration = exaggeration;
    }
    if ("terrainExaggeration" in state.viewer.scene.globe) {
      state.viewer.scene.globe.terrainExaggeration = exaggeration;
    }

    const valueNode = $("#terrainExaggerationValue");
    if (valueNode) {
      valueNode.textContent = exaggeration.toFixed(1) + "x";
    }
    $("#sceneState").textContent = "地形起伏 " + exaggeration.toFixed(1) + "x";
    state.viewer.scene.requestRender();
  }

  function clearMeasure() {
    state.measureEntities.forEach((entity) => state.viewer.entities.remove(entity));
    state.measureEntities = [];
    state.measurement.points = [];
    updateMeasureSummary(
      state.measurement.enabled
        ? "量测已开启：请在地形上点击第一个位置。"
        : "开启量测后，在地形上依次点击两个位置，读取距离、高差与坡度。",
    );
  }

  function drawMeasurePoint(cartographic, label) {
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const entity = state.viewer.entities.add({
      name: "量测点 " + label,
      position: Cesium.Cartesian3.fromDegrees(lng, lat, (cartographic.height || 0) + 2400),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString("#68a5ac"),
        outlineColor: Cesium.Color.fromCssColorString("#fff1bf"),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      },
      label: {
        text: label,
        font: "bold 12px Microsoft YaHei",
        fillColor: Cesium.Color.fromCssColorString("#d8fbff"),
        outlineColor: Cesium.Color.fromCssColorString("#1b3d40"),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -22),
      },
    });

    state.measureEntities.push(entity);
  }

  function drawMeasureLine(start, end, summaryText) {
    const midpoint = new Cesium.Cartographic(
      (start.longitude + end.longitude) / 2,
      (start.latitude + end.latitude) / 2,
      ((start.height || 0) + (end.height || 0)) / 2 + 7000,
    );
    const line = state.viewer.entities.add({
      name: "地形量测线",
      position: Cesium.Cartesian3.fromRadians(
        midpoint.longitude,
        midpoint.latitude,
        midpoint.height,
      ),
      polyline: {
        positions: Cesium.Cartesian3.fromRadiansArrayHeights([
          start.longitude,
          start.latitude,
          (start.height || 0) + 3000,
          end.longitude,
          end.latitude,
          (end.height || 0) + 3000,
        ]),
        width: 5,
        material: new Cesium.PolylineOutlineMaterialProperty({
          color: Cesium.Color.fromCssColorString("#68a5ac"),
          outlineColor: Cesium.Color.fromCssColorString("#fff1bf"),
          outlineWidth: 1,
        }),
      },
      label: {
        text: summaryText,
        font: "bold 12px Microsoft YaHei",
        fillColor: Cesium.Color.fromCssColorString("#d8fbff"),
        outlineColor: Cesium.Color.fromCssColorString("#1b3d40"),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      },
    });

    state.measureEntities.push(line);
  }

  function handleMeasureClick(cartographic) {
    if (!state.measurement.enabled || !cartographic) {
      return false;
    }

    if (state.measurement.points.length >= 2) {
      clearMeasure();
    }

    const point = Cesium.Cartographic.clone(cartographic);
    state.measurement.points.push(point);
    drawMeasurePoint(point, state.measurement.points.length === 1 ? "A" : "B");

    if (state.measurement.points.length === 1) {
      updateMeasureSummary("已记录 A 点，请继续点击 B 点。");
      describeTerrainSample(point);
      return true;
    }

    const start = state.measurement.points[0];
    const end = state.measurement.points[1];
    const geodesic = new Cesium.EllipsoidGeodesic(start, end);
    const distance = geodesic.surfaceDistance;
    const heightDelta = (end.height || 0) - (start.height || 0);
    const slope = distance > 0 ? Math.abs(heightDelta / distance) * 100 : 0;
    const summaryText = formatDistance(distance) + " / 高差 " + Math.round(heightDelta) + " m";
    const detail = summaryText + " / 坡度 " + slope.toFixed(1) + "%";

    drawMeasureLine(start, end, summaryText);
    updateMeasureSummary(detail);
    updateSelectedFeature(
      "地形剖面量测",
      detail,
      "根据两点经纬度与当前 DEM 表面高程估算距离、高差和平均坡度。",
    );
    $("#sceneState").textContent = "地形剖面量测完成";
    return true;
  }

  function setMeasureEnabled(enabled) {
    state.measurement.enabled = enabled;
    document.body.classList.toggle("measure-active", enabled);

    if (enabled) {
      clearMeasure();
      flash("地形量测已开启");
      $("#sceneState").textContent = "地形量测模式";
      return;
    }

    updateMeasureSummary("开启量测后，在地形上依次点击两个位置，读取距离、高差与坡度。");
  }

  function bindSceneControls() {
    document.querySelectorAll("[data-view-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        flyToPreset(button.dataset.viewPreset);
      });
    });

    document.querySelectorAll("[data-layer-toggle]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const visible = checkbox.checked;
        const layer = checkbox.dataset.layerToggle;

        if (layer === "routes") setEntitiesVisible(state.routeEntities, visible);
        if (layer === "nodes") setEntitiesVisible(state.nodeEntities, visible);
        if (layer === "core") setEntitiesVisible(state.coreEntities, visible);
        if (layer === "rivers") setEntitiesVisible(state.riverEntities, visible);
        if (layer === "labels") setLabelsVisible(visible);

        $("#sceneState").textContent = checkbox.parentElement.textContent.trim() + "图层" + (visible ? "显示" : "隐藏");
      });
    });

    const exaggerationInput = $("#terrainExaggeration");
    if (exaggerationInput) {
      exaggerationInput.value = String(state.terrainExaggeration);
      setTerrainExaggeration(exaggerationInput.value);
      exaggerationInput.addEventListener("input", () => {
        setTerrainExaggeration(exaggerationInput.value);
      });
    }

    const measureToggle = $("#measureToggle");
    if (measureToggle) {
      measureToggle.addEventListener("change", () => {
        setMeasureEnabled(measureToggle.checked);
      });
    }

    const clearMeasureBtn = $("#clearMeasureBtn");
    if (clearMeasureBtn) {
      clearMeasureBtn.addEventListener("click", clearMeasure);
    }

    setActivePreset(state.activePreset);
  }

  function bindCameraReadout() {
    let lastUpdate = 0;

    state.viewer.scene.postRender.addEventListener(() => {
      const now = performance.now();
      if (now - lastUpdate < 260) {
        return;
      }
      lastUpdate = now;

      const camera = state.viewer.camera;
      const height = camera.positionCartographic.height;
      const pitch = Cesium.Math.toDegrees(camera.pitch);
      const readout = $("#cameraReadout");

      if (readout) {
        readout.textContent = formatDistance(height) + " / " + Math.round(Math.abs(pitch)) + "°";
      }
    });
  }

  function bindPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(
      state.viewer.scene.canvas,
    );
    let probeFrame = 0;

    handler.setInputAction((movement) => {
      cancelAnimationFrame(probeFrame);
      probeFrame = requestAnimationFrame(() => {
        updatePointerReadout(pickTerrainCartographic(movement.endPosition));
      });
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((movement) => {
      if (state.measurement.enabled) {
        const cartographic = pickTerrainCartographic(movement.position);

        if (cartographic) {
          updatePointerReadout(cartographic);
          handleMeasureClick(cartographic);
        }

        return;
      }

      const picked = state.viewer.scene.pick(movement.position);

      if (!Cesium.defined(picked) || !picked.id) {
        const cartographic = pickTerrainCartographic(movement.position);

        if (cartographic) {
          updatePointerReadout(cartographic);
          if (handleMeasureClick(cartographic)) {
            return;
          }
          describeTerrainSample(cartographic);
          $("#sceneState").textContent = "\u5730\u8868 DEM \u91c7\u6837";
        }

        return;
      }

      const entity = picked.id;
      flash(entity.name || "\u957f\u5f81\u7a7a\u95f4\u8282\u70b9");

      if (entity.eventData) {
        updatePointerReadout({
          longitude: Cesium.Math.toRadians(entity.eventData.lng),
          latitude: Cesium.Math.toRadians(entity.eventData.lat),
          height: 0,
        });
        describeEvent(entity.eventData);
        $("#sceneState").textContent =
          `${entity.eventData.name} \u00b7 ${entity.eventData.date}`;
        return;
      }

      if (entity.routeProperties) {
        describeRoute(entity);
        $("#sceneState").textContent = entity.name || "\u957f\u5f81\u8def\u7ebf";
        return;
      }

      updateSelectedFeature(
        entity.name || "\u957f\u5f81\u4e09\u7ef4\u5730\u5f62",
        `\u9075\u4e49\u6838\u5fc3\u70b9 \u00b7 \u7ea6 ${state.focus.height} m`,
        "\u57fa\u4e8e DEM \u5730\u5f62\u7684\u957f\u5f81\u8def\u7ebf\u4e0e\u5173\u952e\u8282\u70b9\u4e09\u7ef4\u5b9a\u4f4d\u3002",
      );
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  async function loadRouteCollections(configs) {
    const entries = await Promise.all(
      configs.map(async (config) => {
        const collection = await DataService.getRouteLayerFeatures(
          config.layer_key,
        );

        return [config.layer_key, collection];
      }),
    );

    return Object.fromEntries(entries);
  }

  async function init() {
    const [focus, eventCollection, routeConfigs] = await Promise.all([
      DataService.getScene3dFocus(),
      DataService.getEvents(),
      DataService.getRouteLayers(),
    ]);

    state.focus = focus;
    state.events = eventCollection.features.map(normalizeEvent);
    state.routeConfigs = routeConfigs;
    state.routeCollections = await loadRouteCollections(routeConfigs);
    state.viewer = await createViewer();

    updateSelectedFeature(
      "\u957f\u5f81\u4e09\u7ef4\u5730\u5f62",
      "\u8def\u7ebf\u53e0\u52a0 \u00b7 \u8282\u70b9\u5b9a\u4f4d \u00b7 DEM \u91c7\u6837",
      "\u7528\u4e09\u7ef4 DEM \u5730\u5f62\u627f\u8f7d\u957f\u5f81\u8def\u7ebf\u3001\u5173\u952e\u8282\u70b9\u548c\u5730\u8868\u9ad8\u7a0b\u4fe1\u606f\uff0c\u652f\u6301\u573a\u666f\u6d4f\u89c8\u3001\u8981\u7d20\u70b9\u9009\u548c\u5730\u5f62\u91c7\u6837\u3002",
    );
    addDemContextOverlays();
    addSceneDetails();
    addRoutes();
    addAuxiliaryNodes();
    addCorePoint();
    updateArchive(focus);
    updateSceneMetrics();
    bindSceneControls();
    bindCameraReadout();
    bindPicking();
    flyToOverview(2.1);

    const imageryName =
      window.APP_CONFIG?.terrainImagery?.name || "\u516c\u5f00 DEM \u5c71\u5f71";
    $("#sceneState").textContent =
      `${state.terrainSource} + ${imageryName} \u00b7 \u72ec\u7acb\u8def\u7ebf ${state.routeConfigs.length} \u6761 \u00b7 \u8f85\u52a9\u8282\u70b9 ${state.nodeEntities.length} \u4e2a`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      window.__scene3dInitError = {
        message: error?.message || String(error),
        stack: error?.stack || "",
      };
      console.error(error);
      $("#sceneState").textContent =
        "\u4e09\u7ef4\u573a\u666f\u52a0\u8f7d\u5931\u8d25\uff1a" +
        (error?.message || String(error));
      flash("\u8bf7\u68c0\u67e5 Cesium / DEM \u5730\u5f62\u8d44\u6e90");
    });
  });
})();
