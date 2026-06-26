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
    routesVisible: true,
    nodesVisible: true,
    orbiting: false,
    orbitFrame: 0,
    terrainSource: "\u771f\u5b9e DEM",
  };

  const $ = (selector) => document.querySelector(selector);

  const GEO_BOUNDS = {
    west: 97.8,
    south: 24.0,
    east: 120.7,
    north: 38.4,
  };

  const SCENE_BOUNDS = {
    ...GEO_BOUNDS,
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
      { height: -200, color: [182, 158, 99] },
      { height: 450, color: [223, 199, 135] },
      { height: 1000, color: [197, 178, 115] },
      { height: 1800, color: [146, 153, 118] },
      { height: 2800, color: [121, 143, 146] },
      { height: 3800, color: [196, 202, 190] },
      { height: 5400, color: [250, 245, 222] },
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
    const lightAzimuth = -0.82;
    const lightAltitude = 0.82;

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
        const aspectShade =
          0.66 +
          Math.cos(lightAzimuth) * clampNumber(dx / 850, -0.36, 0.36) -
          Math.sin(lightAzimuth) * clampNumber(dy / 850, -0.36, 0.36);
        const relief = clampNumber(
          aspectShade + Math.sin(lightAltitude) * (localT - 0.44) * 0.18,
          0.42,
          1.12,
        );
        const contour =
          Math.abs((height % 250 + 250) % 250 - 125) > 117 ? 0.84 : 1;
        const edge = clampNumber(relief * contour, 0.36, 1.08);
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
      terrainExaggeration: window.APP_CONFIG?.terrain?.exaggeration || 1.35,
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
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#d8c48d");
    viewer.scene.globe.show = true;
    viewer.scene.skyAtmosphere.show = false;
    viewer.scene.skyBox.show = false;
    viewer.scene.sun.show = false;
    viewer.scene.moon.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#2f1711");
    viewer.scene.fog.enabled = false;
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
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

    state.coreEntities.push(shadow, river);
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
    $("#focusName").textContent = focus.name;
    $("#focusTitle").textContent = focus.title;
    $("#focusCover").src = focus.coverImage;
    $("#focusLng").textContent = `${focus.lng.toFixed(3)}\u00b0 E`;
    $("#focusLat").textContent = `${focus.lat.toFixed(3)}\u00b0 N`;
    $("#focusHeight").textContent = `\u7ea6 ${focus.height} m`;
    $("#focusCrs").textContent = focus.coordinateSystem;
    $("#focusStage").textContent = focus.stage;
    $("#focusModel").textContent = `${focus.modelType} \u9884\u7559`;
    $("#focusDescription").textContent = focus.description;
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
              material: Cesium.Color.fromCssColorString(config.color).withAlpha(0.98),
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

  function flyToFocus() {
    const focus = state.focus;
    const focusPoint = projectCoordinate(focus.lng, focus.lat);

    state.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        focusPoint.lng,
        focusPoint.lat - 0.15,
        760000,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(4),
        pitch: Cesium.Math.toRadians(-58),
        roll: 0,
      },
      duration: 1.8,
    });
  }

  function flyToOverview(duration = 1.8) {
    state.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        SCENE_CENTER.lng,
        SCENE_CENTER.lat - 0.35,
        4700000,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-82),
        roll: 0,
      },
      duration,
    });
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

  function toggleEntities(entities, show) {
    entities.forEach((entity) => {
      entity.show = show;
    });
  }

  function orbit() {
    if (!state.orbiting) {
      return;
    }

    state.viewer.camera.rotateRight(0.0015);
    state.orbitFrame = requestAnimationFrame(orbit);
  }

  function toggleOrbit() {
    state.orbiting = !state.orbiting;
    $("#orbitScene").classList.toggle("active", state.orbiting);
    $("#orbitScene").textContent = state.orbiting
      ? "\u505c\u6b62\u73af\u7ed5"
      : "\u81ea\u52a8\u73af\u7ed5";

    if (state.orbiting) {
      orbit();
      return;
    }

    cancelAnimationFrame(state.orbitFrame);
  }

  function bindPicking() {
    const handler = new Cesium.ScreenSpaceEventHandler(
      state.viewer.scene.canvas,
    );

    handler.setInputAction((movement) => {
      const picked = state.viewer.scene.pick(movement.position);

      if (!Cesium.defined(picked) || !picked.id) {
        return;
      }

      const entity = picked.id;
      flash(entity.name || "\u957f\u5f81\u7a7a\u95f4\u8282\u70b9");

      if (entity.eventData) {
        $("#sceneState").textContent =
          `${entity.eventData.name} \u00b7 ${entity.eventData.date}`;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function bindControls() {
    $("#flyToFocus").addEventListener("click", flyToFocus);

    $("#toggleRoute").addEventListener("click", () => {
      state.routesVisible = !state.routesVisible;
      toggleEntities(state.routeEntities, state.routesVisible);
      $("#toggleRoute").classList.toggle("active", state.routesVisible);
    });

    $("#toggleNodes").addEventListener("click", () => {
      state.nodesVisible = !state.nodesVisible;
      toggleEntities(state.nodeEntities, state.nodesVisible);
      $("#toggleNodes").classList.toggle("active", state.nodesVisible);
    });

    $("#orbitScene").addEventListener("click", toggleOrbit);

    $("#resetScene").addEventListener("click", () => {
      state.orbiting = false;
      cancelAnimationFrame(state.orbitFrame);
      $("#orbitScene").classList.remove("active");
      $("#orbitScene").textContent = "\u81ea\u52a8\u73af\u7ed5";
      flyToOverview();
    });
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

    updateArchive(focus);
    addDemContextOverlays();
    addSceneDetails();
    addRoutes();
    addAuxiliaryNodes();
    addCorePoint();
    bindPicking();
    bindControls();
    flyToOverview(2.1);

    const imageryName =
      window.APP_CONFIG?.terrainImagery?.name || "\u516c\u5f00 DEM \u5c71\u5f71";
    $("#sceneState").textContent =
      `${state.terrainSource} + ${imageryName} \u00b7 \u72ec\u7acb\u8def\u7ebf ${state.routeConfigs.length} \u6761 \u00b7 \u8f85\u52a9\u8282\u70b9 ${state.nodeEntities.length} \u4e2a`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error(error);
      $("#sceneState").textContent = "\u4e09\u7ef4\u573a\u666f\u52a0\u8f7d\u5931\u8d25";
      flash("\u8bf7\u68c0\u67e5 Cesium / DEM \u5730\u5f62\u8d44\u6e90");
    });
  });
})();
