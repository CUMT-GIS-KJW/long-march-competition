(function () {
  const state = {
    map: null,
    provinceLayer: null,
    provinceIconLayer: null,
    provinceLabelLayer: null,
    resourceLayer: null,
    routeLayer: null,
    resources: [],
    allResources: [],
    options: null,
    markers: new Map(),
    selectedRoutePointIds: new Set(),
    currentMarkerResources: [],
    currentFocusIds: new Set(),
    activeTheme: "meeting",
    activePreset: "",
    mapClickMode: "detail",
    currentDetailResource: null,
    currentRoute: null,
    chinaProvinceGeojson: null,
    chinaGeojsonTried: false,
  };

  let routeProgressTimer = null;
  let routeProgressValue = 0;

  const categoryMeta = {
    site: { label: "旧址", color: "#B58BD5", icon: "" },
    museum: { label: "馆", color: "#FFB347", icon: "" },
    scenic: { label: "景", color: "#5DADEC", icon: "" },
    other: { label: "红", color: "#F49AC2", icon: "" },
  };

  const palette = [
    "#F25F5C",
    "#FFB347",
    "#4DB6AC",
    "#7AC77B",
    "#5DADEC",
    "#B58BD5",
    "#F49AC2",
    "#F4D35E",
  ];

  const CHINA_BOUNDS = L.latLngBounds([17.6, 72.0], [54.2, 136.0]);

  const provinceTourism = {
    北京市: { color: "#ff8a80", kind: "palace", label: "天安门", lat: 39.90, lng: 116.40 },
    天津市: { color: "#ffd180", kind: "bridge", label: "海河桥", lat: 39.12, lng: 117.20 },
    河北省: { color: "#ffcc80", kind: "wall", label: "长城", lat: 38.04, lng: 114.50 },
    山西省: { color: "#ffe082", kind: "tower", label: "古塔", lat: 37.87, lng: 112.55 },
    内蒙古自治区: { color: "#c5e1a5", kind: "horse", label: "草原", lat: 43.65, lng: 111.67 },
    辽宁省: { color: "#80deea", kind: "ship", label: "港口", lat: 41.80, lng: 123.43 },
    吉林省: { color: "#b3e5fc", kind: "snow", label: "雪林", lat: 43.90, lng: 125.32 },
    黑龙江省: { color: "#90caf9", kind: "crane", label: "湿地", lat: 46.64, lng: 127.96 },
    上海市: { color: "#f48fb1", kind: "pearl", label: "东方明珠", lat: 31.23, lng: 121.47 },
    江苏省: { color: "#fff176", kind: "school", label: "校园出发", lat: 33.10, lng: 119.20 },
    浙江省: { color: "#a5d6a7", kind: "boat", label: "西湖", lat: 29.20, lng: 120.15 },
    安徽省: { color: "#dcedc8", kind: "mountain", label: "黄山", lat: 31.86, lng: 117.28 },
    福建省: { color: "#ffccbc", kind: "tulou", label: "土楼", lat: 26.08, lng: 118.30 },
    江西省: { color: "#ffb7c7", kind: "redstar", label: "瑞金", lat: 27.60, lng: 115.90 },
    山东省: { color: "#b2dfdb", kind: "mountain", label: "泰山", lat: 36.67, lng: 118.00 },
    河南省: { color: "#d8e2c8", kind: "tower", label: "中原", lat: 34.65, lng: 113.62 },
    湖北省: { color: "#a9d9ff", kind: "river", label: "江汉", lat: 30.78, lng: 112.70 },
    湖南省: { color: "#d5b4ff", kind: "quilt", label: "半条被子", lat: 27.45, lng: 112.95 },
    广东省: { color: "#ffab91", kind: "flower", label: "南粤", lat: 23.35, lng: 113.28 },
    广西壮族自治区: { color: "#97d9c4", kind: "river", label: "湘江战役", lat: 23.75, lng: 108.32 },
    海南省: { color: "#ffe0b2", kind: "coconut", label: "椰岛", lat: 19.20, lng: 109.74 },
    重庆市: { color: "#ffb0a8", kind: "bridge", label: "山城", lat: 29.56, lng: 106.55 },
    四川省: { color: "#ffd36e", kind: "panda", label: "泸定桥", lat: 30.65, lng: 102.95 },
    贵州省: { color: "#a8e6a3", kind: "meeting", label: "遵义会议", lat: 26.60, lng: 106.70 },
    云南省: { color: "#8dd7f7", kind: "elephant", label: "金沙江", lat: 25.50, lng: 102.76 },
    西藏自治区: { color: "#c7b8ff", kind: "mountain", label: "雪域", lat: 30.15, lng: 88.80 },
    陕西省: { color: "#bde8b3", kind: "cave", label: "延安窑洞", lat: 35.90, lng: 109.20 },
    甘肃省: { color: "#f7c98b", kind: "camel", label: "会宁", lat: 37.20, lng: 103.70 },
    青海省: { color: "#b2ebf2", kind: "lake", label: "青海湖", lat: 35.75, lng: 96.10 },
    宁夏回族自治区: { color: "#f8bbd0", kind: "wall", label: "六盘山", lat: 37.30, lng: 106.20 },
    新疆维吾尔自治区: { color: "#d7ccc8", kind: "camel", label: "丝路", lat: 41.75, lng: 85.60 },
    台湾省: { color: "#c8e6c9", kind: "lighthouse", label: "海峡", lat: 23.80, lng: 121.00 },
    香港特别行政区: { color: "#f3a6d6", kind: "ship", label: "维港", lat: 22.32, lng: 114.17 },
    澳门特别行政区: { color: "#ffe082", kind: "lotus", label: "莲花", lat: 22.20, lng: 113.55 },
  };

  const provinceAlias = {
    北京: "北京市", 天津: "天津市", 河北: "河北省", 山西: "山西省", 内蒙古: "内蒙古自治区",
    辽宁: "辽宁省", 吉林: "吉林省", 黑龙江: "黑龙江省", 上海: "上海市", 江苏: "江苏省",
    浙江: "浙江省", 安徽: "安徽省", 福建: "福建省", 江西: "江西省", 山东: "山东省",
    河南: "河南省", 湖北: "湖北省", 湖南: "湖南省", 广东: "广东省", 广西: "广西壮族自治区",
    海南: "海南省", 重庆: "重庆市", 四川: "四川省", 贵州: "贵州省", 云南: "云南省",
    西藏: "西藏自治区", 陕西: "陕西省", 甘肃: "甘肃省", 青海: "青海省", 宁夏: "宁夏回族自治区",
    新疆: "新疆维吾尔自治区", 台湾: "台湾省", 香港: "香港特别行政区", 澳门: "澳门特别行政区",
  };


  // 地图插画采用“精选代表图 + 少量海边外置引线”：不显示省名，内陆图标直接落在地图上，避免引线过多。
  const featuredMapIllustrations = [
    { province: "新疆维吾尔自治区", kind: "camel", lat: 45.85, lng: 75.80, leader: { lat: 42.45, lng: 84.30 }, forceLeader: true, size: 128, rotate: -8, shift: "west" },
    { province: "西藏自治区", kind: "mountain", lat: 31.20, lng: 80.30, leader: { lat: 30.95, lng: 88.70 }, forceLeader: true, size: 138, rotate: 3, shift: "plateau" },
    { province: "青海省", kind: "lake", lat: 36.80, lng: 93.80, leader: { lat: 35.75, lng: 96.10 }, size: 106, rotate: -2, shift: "lake" },
    { province: "甘肃省", kind: "pass", lat: 40.70, lng: 98.50, leader: { lat: 38.85, lng: 101.40 }, size: 106, rotate: -3, shift: "silk" },
    { province: "陕西省", kind: "cave", lat: 38.15, lng: 107.60, leader: { lat: 36.20, lng: 109.05 }, size: 110, rotate: 4, shift: "yanan" },
    { province: "北京市", kind: "palace", lat: 43.65, lng: 118.90, leader: { lat: 40.10, lng: 116.25 }, size: 112, rotate: 1, shift: "capital" },
    { province: "河北省", kind: "wall", lat: 41.75, lng: 113.10, leader: { lat: 40.80, lng: 115.60 }, size: 104, rotate: -4, shift: "north" },
    { province: "内蒙古自治区", kind: "horse", lat: 47.30, lng: 108.60, leader: { lat: 43.65, lng: 111.70 }, forceLeader: true, size: 112, rotate: 5, shift: "grass" },
    { province: "黑龙江省", kind: "crane", lat: 52.05, lng: 132.80, leader: { lat: 47.65, lng: 127.80 }, forceLeader: true, size: 106, rotate: -6, shift: "northeast" },
    { province: "上海市", kind: "pearl", lat: 30.00, lng: 132.00, leader: { lat: 31.15, lng: 121.25 }, coastLeader: true, size: 112, rotate: 0, shift: "east" },
    { province: "浙江省", kind: "boat", lat: 26.35, lng: 126.80, leader: { lat: 29.20, lng: 120.15 }, coastLeader: true, size: 102, rotate: 3, shift: "boat" },
    { province: "福建省", kind: "tulou", lat: 23.10, lng: 124.80, leader: { lat: 25.35, lng: 117.40 }, coastLeader: true, size: 102, rotate: 5, shift: "coast" },
    { province: "江西省", kind: "redstar", lat: 27.85, lng: 112.70, leader: { lat: 27.60, lng: 115.90 }, size: 96, rotate: -3, shift: "red" },
    { province: "四川省", kind: "panda", lat: 30.78, lng: 103.25, size: 74, rotate: -3, shift: "sichuan" },
    { province: "贵州省", kind: "meeting", lat: 24.85, lng: 110.90, leader: { lat: 27.00, lng: 106.65 }, size: 114, rotate: 3, shift: "zunyi" },
    { province: "湖南省", kind: "quilt", lat: 25.75, lng: 113.35, leader: { lat: 27.45, lng: 112.95 }, size: 94, rotate: 2, shift: "hunan" },
    { province: "云南省", kind: "elephant", lat: 22.05, lng: 97.50, leader: { lat: 24.75, lng: 101.30 }, forceLeader: true, size: 114, rotate: 4, shift: "yunnan" },
    { province: "广东省", kind: "flower", lat: 21.20, lng: 119.80, leader: { lat: 23.35, lng: 113.28 }, coastLeader: true, size: 98, rotate: -5, shift: "south" },
    { province: "海南省", kind: "coconut", lat: 17.95, lng: 115.10, leader: { lat: 19.15, lng: 110.00 }, coastLeader: true, size: 96, rotate: -5, shift: "hainan" },
  ];
  const $ = (selector) => document.querySelector(selector);


  function normalizeProvinceName(rawName) {
    const raw = String(rawName || "").trim();

    if (!raw) {
      return "";
    }

    if (provinceTourism[raw]) {
      return raw;
    }

    const cleaned = raw
      .replace(/特别行政区$/g, "")
      .replace(/壮族自治区$/g, "")
      .replace(/回族自治区$/g, "")
      .replace(/维吾尔自治区$/g, "")
      .replace(/自治区$/g, "")
      .replace(/省$/g, "")
      .replace(/市$/g, "");

    return provinceAlias[cleaned] || raw;
  }

  function provinceNameOfFeature(feature) {
    const props = feature?.properties || {};
    const raw = props.name || props.fullname || props.NAME || props.NAME_CHN || props.province || props.省 || props.地名 || props.NAME_1 || "";

    return normalizeProvinceName(raw);
  }

  function provinceDisplayColor(province, index = 0) {
    return provinceTourism[province]?.color || palette[index % palette.length] || "#ffd36e";
  }

  async function loadChinaProvinceGeoJson() {
    const sources = [
      "/assets/china-provinces.geojson",
      "https://cdn.jsdelivr.net/gh/longwosion/geojson-map-china@master/china.json",
      "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json",
    ];

    for (const source of sources) {
      try {
        const response = await fetch(source, { mode: "cors" });

        if (!response.ok) {
          throw new Error(`${source} ${response.status}`);
        }

        const geojson = await response.json();

        if (!geojson || !Array.isArray(geojson.features)) {
          throw new Error(`${source} is not a FeatureCollection`);
        }

        state.chinaProvinceGeojson = geojson;
        document.querySelector(".tourism-map-wrap")?.classList.add("has-real-china-map");
        document.querySelector(".tourism-map-wrap")?.classList.remove("no-real-china-map");
        renderProvinceTourismMap(state.resources);
        if (!$("#provinceSelect")?.value) {
          fitChinaMap(true);
        }
        return;
      } catch (error) {
        console.info("省界数据源未加载，继续尝试下一个：", source, error.message);
      }
    }

    // 没有真实省界文件时不报错：地图继续使用真实瓦片与真实资源坐标。
    document.querySelector(".tourism-map-wrap")?.classList.add("no-real-china-map");
    console.info("省界 GeoJSON 未加载：建议将标准中国省界文件放到 /assets/china-provinces.geojson");
  }

  function renderRealProvinceBoundaries(provinceNames, selectedProvince) {
    if (!state.chinaProvinceGeojson) {
      return;
    }

    const wanted = new Set(provinceNames);

    L.geoJSON(state.chinaProvinceGeojson, {
      pane: "provincePane",
      interactive: false,
      filter(feature) {
        const name = provinceNameOfFeature(feature);

        // 始终保留完整中国底图；选择某省时只降低其他省份透明度，不切掉中国轮廓。
        return Boolean(name);
      },
      style(feature) {
        const name = provinceNameOfFeature(feature);
        const index = Object.keys(provinceTourism).indexOf(name);
        const color = provinceDisplayColor(name, index < 0 ? Array.from(wanted).indexOf(name) : index);
        const isSelected = !selectedProvince || selectedProvince === name;

        return {
          className: "china-province-real",
          color: "rgba(255, 252, 232, .98)",
          weight: isSelected ? 2.8 : 1.9,
          opacity: isSelected ? 1 : 0.70,
          fillColor: color,
          fillOpacity: isSelected ? 0.86 : 0.38,
        };
      },
    }).addTo(state.provinceLayer);
  }

  function shortProvinceLabel(name) {
    return String(name || "")
      .replace("壮族自治区", "")
      .replace("回族自治区", "")
      .replace("维吾尔自治区", "")
      .replace("自治区", "")
      .replace("省", "")
      .replace("市", "");
  }

  function renderProvinceNameLabels(provinceNames, selectedProvince) {
    if (!state.chinaProvinceGeojson || !state.provinceLabelLayer) {
      return;
    }

    const wanted = new Set(provinceNames);

    L.geoJSON(state.chinaProvinceGeojson, {
      interactive: false,
      filter(feature) {
        const name = provinceNameOfFeature(feature);

        return Boolean(name);
      },
      onEachFeature(feature, layer) {
        const name = provinceNameOfFeature(feature);
        const bounds = layer.getBounds?.();

        if (!name || !bounds?.isValid?.()) {
          return;
        }

        const center = bounds.getCenter();
        const isSelected = !selectedProvince || selectedProvince === name;

        L.marker(center, {
          pane: "provinceIconPane",
          icon: L.divIcon({
            className: "",
            html: `<div class="province-name-label ${isSelected ? "active" : "muted"}">${escapeHtml(shortProvinceLabel(name))}</div>`,
            iconSize: [68, 24],
            iconAnchor: [34, 12],
          }),
          interactive: false,
          zIndexOffset: 40,
        }).addTo(state.provinceLabelLayer);
      },
    });
  }

  function leaderPolylinePoints(item, leader, index = 0) {
    const start = [item.lat, item.lng];
    const end = [leader.lat, leader.lng];
    const bendLat = item.lat + (leader.lat - item.lat) * 0.58;
    const bendLng = item.lng + (leader.lng - item.lng) * 0.42 + (index % 2 === 0 ? 0.42 : -0.42);

    return [start, [bendLat, bendLng], end];
  }

  function renderProvinceLandmarks(provinceNames, selectedProvince) {
    const selectedSet = new Set(provinceNames.length ? provinceNames : Object.keys(provinceTourism));
    let illustrations = selectedProvince
      ? featuredMapIllustrations.filter((item) => item.province === selectedProvince)
      : featuredMapIllustrations.filter((item) => selectedSet.has(item.province));

    // 选择了一个没有预设大插画的省份时，只补一个该省代表图；默认视图不补满所有省。
    if (selectedProvince && !illustrations.length) {
      const meta = provinceTourism[selectedProvince];

      if (meta) {
        illustrations = [{
          province: selectedProvince,
          kind: meta.kind,
          lat: meta.lat,
          lng: meta.lng,
          size: 104,
          rotate: 0,
          shift: "single",
        }];
      }
    }

    illustrations.forEach((item, index) => {
      const meta = provinceTourism[item.province] || {};
      const color = meta.color || palette[index % palette.length];
      const size = item.size || 100;

      // 外置到海面/近海位置的插画保留引线；用户指定的内陆/边疆代表图也保留引导线。
      if (item.leader && (item.coastLeader || item.forceLeader)) {
        L.polyline(leaderPolylinePoints(item, item.leader, index), {
          pane: "provinceIconPane",
          color: "rgba(93, 55, 31, .58)",
          weight: 1.8,
          opacity: 0.78,
          dashArray: "6 6",
          className: "map-illustration-leader",
          interactive: false,
        }).addTo(state.provinceIconLayer);

        L.circleMarker([item.leader.lat, item.leader.lng], {
          pane: "provinceIconPane",
          radius: 3.2,
          color: "rgba(168, 38, 29, .72)",
          weight: 1.5,
          fillColor: "#fff3cf",
          fillOpacity: 0.95,
          className: "map-illustration-anchor",
          interactive: false,
        }).addTo(state.provinceIconLayer);
      }

      L.marker([item.lat, item.lng], {
        pane: "provinceIconPane",
        icon: L.divIcon({
          className: "",
          html: `
            <div class="map-illustration map-illustration-${item.kind} map-illustration-${item.shift || "normal"}" style="--province-color:${color};--illustration-size:${size}px;--illustration-rotate:${item.rotate || 0}deg" title="${escapeHtml(meta.label || item.kind)}">
              ${mapIllustrationSvg(item.kind, color)}
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        interactive: false,
        zIndexOffset: 12,
      }).addTo(state.provinceIconLayer);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const REVIEW_VERSION = 4;
  const REVIEW_ITEMS = [
    { key: "recommend", label: "推荐指数", hint: "整体是否值得加入研学路线" },
    { key: "study", label: "研学价值", hint: "历史学习、现场讲解和任务设计价值" },
    { key: "traffic", label: "交通便利", hint: "到达难度、点位衔接和步行友好程度" },
    { key: "scenery", label: "景观体验", hint: "空间辨识度、拍照打卡和参观体验" },
  ];

  function reviewKey(resource) {
    const parts = [
      resource.id || "",
      resource.name || "",
      resource.province || "",
      resource.city || "",
      resource.lng || "",
      resource.lat || "",
    ];

    return `tourism-review:v${REVIEW_VERSION}:${parts.map((item) => encodeURIComponent(String(item))).join(":")}`;
  }

  function scoreBySeed(seed, min = 3, max = 5) {
    return min + (seed % (max - min + 1));
  }

  function scoreBySeedDecimal(seed, min = 3.8, max = 4.9) {
    const value = min + ((seed % 12) / 11) * (max - min);

    return Math.min(5, Math.max(1, Number(value.toFixed(1))));
  }

  function seedOfResource(resource) {
    const identity = `${resource.id || ""}${resource.name || ""}${resource.city || ""}${resource.lng || ""}${resource.lat || ""}`;

    return Array.from(identity || "red-tourism")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  function normalizeComment(comment, index = 0) {
    return {
      id: comment.id || `comment_${index}_${Date.now()}`,
      name: comment.name || "游客",
      text: comment.text || "",
      time: comment.time || "刚刚",
      replies: Array.isArray(comment.replies)
        ? comment.replies.map((reply, replyIndex) => ({
          id: reply.id || `reply_${index}_${replyIndex}_${Date.now()}`,
          name: reply.name || "游客",
          text: reply.text || "",
          time: reply.time || "刚刚",
        }))
        : [],
    };
  }

  function defaultReview(resource) {
    const seed = seedOfResource(resource);
    const text = `${resource.name || ""}${resource.type || ""}${resource.address || ""}`;
    const isMuseum = resource.category === "museum" || /纪念馆|博物馆|展览馆|陈列馆/.test(text);
    const isSite = resource.category === "site" || /会址|旧址|遗址|故居|指挥部/.test(text);
    const isScenic = resource.category === "scenic" || /景区|公园|桥|山|渡|江|河|广场/.test(text);
    const isFeatured = Boolean(resource.featured);
    const city = resource.city || resource.cityname || "当地";
    const place = resource.name || "该红色资源点";
    const fixedOverall = scoreBySeedDecimal(seed + (isFeatured ? 8 : 0), isFeatured ? 4.5 : 3.8, isFeatured ? 5 : 4.8);

    const comments = [
      normalizeComment({
        id: `${resource.id || seed}_default_1`,
        name: "研学推荐官",
        text: `${place}适合纳入${city}红色研学路线，可作为小组讲解、打卡记录和路线观察的重点点位。`,
        time: "默认留言",
        replies: [{
          id: `${resource.id || seed}_reply_1`,
          name: "带队教师",
          text: "可以提前分配讲解任务，让学生围绕历史节点和空间位置进行汇报。",
          time: "默认回复",
        }],
      }, 1),
      normalizeComment({
        id: `${resource.id || seed}_default_2`,
        name: "路线体验员",
        text: isMuseum
          ? "展陈内容相对集中，适合安排人物、时间、地点和长征精神关键词记录任务。"
          : isSite
            ? "现场遗址感较强，建议结合历史背景讲解，再让学生完成事件复盘。"
            : isScenic
              ? "空间景观辨识度较高，适合做地形观察、路线拍照和研学分享。"
              : "可作为补充点位，适合与周边资源组合形成完整研学线路。",
        time: "默认留言",
        replies: [],
      }, 2),
      normalizeComment({
        id: `${resource.id || seed}_default_3`,
        name: "学生游客",
        text: /桥|渡|江|河/.test(text)
          ? "这个点很适合讨论长征中的交通条件和行军决策，拍照打卡也比较有辨识度。"
          : /雪山|草地|夹金山|山/.test(text)
            ? "适合结合自然环境讲长征困难，路线安排时要注意天气和安全。"
            : /会议|会址/.test(text)
              ? "适合梳理会议背景、人物关系和转折意义，建议多留一些讲解时间。"
              : "和周边点位一起看更完整，单独参观时建议提前准备背景材料。",
        time: "默认留言",
        replies: [],
      }, 3),
    ];

    return {
      version: REVIEW_VERSION,
      fixedOverall,
      ratings: {
        recommend: isFeatured ? 5 : scoreBySeed(seed + 1, 3, 5),
        study: isFeatured || isMuseum || isSite ? scoreBySeed(seed + 2, 4, 5) : scoreBySeed(seed + 2, 3, 5),
        traffic: scoreBySeed(seed + 3, 3, 5),
        scenery: isScenic || /桥|山|渡|江|河|景区|广场/.test(text) ? scoreBySeed(seed + 4, 4, 5) : scoreBySeed(seed + 4, 3, 5),
      },
      comments,
    };
  }

  function loadReview(resource) {
    const base = defaultReview(resource);

    try {
      const stored = localStorage.getItem(reviewKey(resource));

      if (!stored) {
        return base;
      }

      const parsed = JSON.parse(stored);
      const parsedComments = Array.isArray(parsed.comments) ? parsed.comments.map(normalizeComment) : [];
      const userComments = parsed.version === REVIEW_VERSION
        ? parsedComments
        : parsedComments.filter((comment) => comment.time !== "默认留言" && comment.time !== "默认回复");

      return {
        version: REVIEW_VERSION,
        fixedOverall: base.fixedOverall,
        ratings: {
          ...base.ratings,
          ...(parsed.ratings || {}),
        },
        comments: parsed.version === REVIEW_VERSION ? parsedComments : [...base.comments, ...userComments],
      };
    } catch (error) {
      console.warn(error);
      return base;
    }
  }

  function saveReview(resource, review) {
    localStorage.setItem(reviewKey(resource), JSON.stringify({
      version: REVIEW_VERSION,
      ratings: review.ratings || {},
      comments: Array.isArray(review.comments) ? review.comments.map(normalizeComment) : [],
    }));
  }

  function fixedOverallScore(resource) {
    return defaultReview(resource).fixedOverall.toFixed(1);
  }

  function visitorAverageValue(review) {
    const ratings = review?.ratings || {};
    const values = REVIEW_ITEMS.map((item) => Number(ratings[item.key] || 0)).filter(Boolean);

    if (!values.length) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function touristScore(review) {
    return visitorAverageValue(review).toFixed(1);
  }

  function renderStars(name, value) {
    const count = Number(value) || 0;

    return Array.from({ length: 5 })
      .map((_, index) => {
        const star = index + 1;
        const active = star <= count ? "active" : "";

        return `<button class="star ${active}" type="button" data-score-name="${name}" data-score="${star}" aria-label="${star}星">★</button>`;
      })
      .join("");
  }

  function renderStaticStars(value) {
    const count = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));

    return `<span class="static-stars" aria-label="${count}星">${Array.from({ length: 5 })
      .map((_, index) => `<i class="${index < count ? "active" : ""}">★</i>`)
      .join("")}</span>`;
  }

  function renderRatingRows(review) {
    return REVIEW_ITEMS.map((item) => {
      const value = Number(review?.ratings?.[item.key] || 0);

      return `
        <div class="rating-aspect-row">
          <div>
            <b>${item.label}</b>
            <span>${item.hint}</span>
          </div>
          <div class="modal-stars">${renderStars(item.key, value)}</div>
          <strong>${value.toFixed(1)}</strong>
        </div>
      `;
    }).join("");
  }

  function ensureReviewModal() {
    let modal = $("#reviewModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "reviewModal";
      modal.className = "review-modal";
      modal.setAttribute("aria-hidden", "true");
      document.body.appendChild(modal);
    }

    return modal;
  }

  function openReviewModal(resource, showHistory = false) {
    const modal = ensureReviewModal();
    const review = loadReview(resource);
    const comments = review.comments || [];

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = `
      <div class="review-dialog" role="dialog" aria-modal="true">
        <header class="review-dialog-head">
          <div>
            <span>MY REVIEW</span>
            <h3>我的评价 · ${escapeHtml(resource.name)}</h3>
          </div>
          <button class="modal-close" id="reviewCloseBtn" type="button">×</button>
        </header>
        <section class="review-place-card">
          <div>
            <b>${escapeHtml(resource.province || "-")} · ${escapeHtml(resource.city || "-")}</b>
            <p>${escapeHtml(resource.address || "地址待补充")}</p>
            <small>右侧地图面板的综合评分保持固定；本弹窗里的“我的总和评分”会随下方四项星级实时变化。</small>
          </div>
          <div class="score-pair dynamic">
            <span>我的总和评分</span>
            <strong>${touristScore(review)}</strong>
            <small>/5</small>
          </div>
        </section>
        <section class="rating-aspect-box">
          <div class="rating-aspect-title">
            <b>游客推荐评价</b>
            <span>按四个方面评分，点击第几个星就是几分</span>
          </div>
          ${renderRatingRows(review)}
        </section>
        <section class="modal-comment-box">
          <textarea id="modalCommentInput" rows="3" maxlength="160" placeholder="发布你对该点位的游览体验、研学建议或注意事项……"></textarea>
          <div class="modal-comment-actions">
            <button class="history-toggle ${showHistory ? "active" : ""}" id="historyToggleBtn" type="button">历史留言</button>
            <button class="comment-submit" id="modalCommentSubmit" type="button">发布留言</button>
          </div>
        </section>
        <section class="modal-history ${showHistory ? "show" : ""}" id="modalHistory">
          ${comments.slice().reverse().map(renderCommentWithReplies).join("")}
        </section>
      </div>
    `;

    bindReviewModal(resource, showHistory);
  }

  function closeReviewModal() {
    const modal = ensureReviewModal();

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderCommentWithReplies(comment) {
    const replies = Array.isArray(comment.replies) ? comment.replies : [];

    return `
      <article class="history-comment" data-comment-id="${escapeHtml(comment.id)}">
        <div class="history-comment-main">
          <b>${escapeHtml(comment.name || "游客")}</b>
          <span>${escapeHtml(comment.time || "刚刚")}</span>
          <p>${escapeHtml(comment.text || "")}</p>
          <button class="reply-toggle" type="button" data-comment-id="${escapeHtml(comment.id)}">回复</button>
        </div>
        <div class="reply-list">
          ${replies.map((reply) => `
            <div class="reply-item">
              <b>${escapeHtml(reply.name || "游客")}</b>
              <span>${escapeHtml(reply.time || "刚刚")}</span>
              <p>${escapeHtml(reply.text || "")}</p>
            </div>
          `).join("")}
        </div>
        <div class="reply-editor" data-reply-editor="${escapeHtml(comment.id)}">
          <input type="text" maxlength="100" placeholder="回复这条留言……">
          <button type="button" data-reply-submit="${escapeHtml(comment.id)}">发布回复</button>
        </div>
      </article>
    `;
  }

  function bindReviewModal(resource, showHistory) {
    const modal = ensureReviewModal();

    modal.querySelector("#reviewCloseBtn")?.addEventListener("click", closeReviewModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeReviewModal();
      }
    }, { once: true });

    modal.querySelectorAll(".modal-stars .star").forEach((button) => {
      button.addEventListener("click", () => {
        const review = loadReview(resource);
        const scoreName = button.dataset.scoreName;

        review.ratings = review.ratings || {};
        review.ratings[scoreName] = Number(button.dataset.score);
        saveReview(resource, review);
        showResourceDetail(resource);
        openReviewModal(resource, showHistory);
        flash("游客推荐评价已保存");
      });
    });

    modal.querySelector("#historyToggleBtn")?.addEventListener("click", () => {
      const history = modal.querySelector("#modalHistory");
      const isShown = history.classList.toggle("show");
      modal.querySelector("#historyToggleBtn").classList.toggle("active", isShown);
    });

    modal.querySelector("#modalCommentSubmit")?.addEventListener("click", () => {
      const input = modal.querySelector("#modalCommentInput");
      const text = input.value.trim();

      if (!text) {
        flash("请先填写留言内容");
        return;
      }

      const review = loadReview(resource);
      review.comments = review.comments || [];
      review.comments.push(normalizeComment({
        id: `comment_${Date.now()}`,
        name: "游客",
        text,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        replies: [],
      }));
      review.comments = review.comments.slice(-40);
      saveReview(resource, review);
      showResourceDetail(resource);
      openReviewModal(resource, true);
      flash("留言已发布到当前点位");
    });

    modal.querySelectorAll(".reply-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const editor = modal.querySelector(`[data-reply-editor="${CSS.escape(button.dataset.commentId)}"]`);
        editor?.classList.toggle("show");
      });
    });

    modal.querySelectorAll("[data-reply-submit]").forEach((button) => {
      button.addEventListener("click", () => {
        const commentId = button.dataset.replySubmit;
        const editor = modal.querySelector(`[data-reply-editor="${CSS.escape(commentId)}"]`);
        const input = editor?.querySelector("input");
        const text = input?.value.trim();

        if (!text) {
          flash("请先填写回复内容");
          return;
        }

        const review = loadReview(resource);
        const target = (review.comments || []).find((comment) => comment.id === commentId);

        if (!target) {
          flash("没有找到对应留言");
          return;
        }

        target.replies = target.replies || [];
        target.replies.push({
          id: `reply_${Date.now()}`,
          name: "游客",
          text,
          time: new Date().toLocaleString("zh-CN", { hour12: false }),
        });
        saveReview(resource, review);
        openReviewModal(resource, true);
        flash("回复已发布");
      });
    });
  }

  function flash(message) {
    const toast = $("#toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => toast.classList.remove("show"), 1500);
  }

  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`request failed: ${url}`);
    }

    const payload = await response.json();

    return payload && payload.code === 200 ? payload.data : payload;
  }

  function fitChinaMap(animate = false) {
    if (!state.map || !CHINA_BOUNDS?.isValid?.()) {
      return;
    }

    state.map.fitBounds(CHINA_BOUNDS, {
      paddingTopLeft: [22, 18],
      paddingBottomRight: [22, 18],
      maxZoom: 4,
      animate,
      duration: animate ? 0.7 : 0,
    });
  }

  function initMap() {
    state.map = L.map("tourismMap", {
      center: [35.6, 104.2],
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: true,
    });

    L.tileLayer(
      APP_CONFIG.basemaps.standard.url,
      APP_CONFIG.basemaps.standard.options,
    ).addTo(state.map);

    state.map.createPane("provincePane");
    state.map.getPane("provincePane").style.zIndex = 365;
    state.map.getPane("provincePane").style.pointerEvents = "none";
    state.map.createPane("provinceIconPane");
    state.map.getPane("provinceIconPane").style.zIndex = 388;
    state.map.getPane("provinceIconPane").style.pointerEvents = "none";

    state.provinceLayer = L.layerGroup().addTo(state.map);
    state.provinceIconLayer = L.layerGroup().addTo(state.map);
    state.provinceLabelLayer = L.layerGroup().addTo(state.map);
    state.resourceLayer = L.layerGroup().addTo(state.map);
    state.routeLayer = L.layerGroup().addTo(state.map);

    updateTourismZoomScale();
    fitChinaMap(false);
    state.map.on("zoomend", updateTourismZoomScale);
  }

  function fillSelect(select, items, firstLabel) {
    select.innerHTML = [
      `<option value="">${firstLabel}</option>`,
      ...items.map((item) => {
        if (typeof item === "string") {
          return `<option value="${item}">${item}</option>`;
        }

        return `<option value="${item.value}">${item.label}</option>`;
      }),
    ].join("");
  }

  function preferredCities(cities) {
    const priority = [
      "甘孜藏族自治州",
      "阿坝藏族羌族自治州",
      "雅安市",
      "遵义市",
      "赣州市",
      "凉山彝族自治州",
      "延安市",
      "会宁县",
    ];
    const result = [
      ...priority.filter((city) => cities.includes(city)),
      ...cities.filter((city) => !priority.includes(city)).slice(0, 16),
    ];

    return result.slice(0, 18);
  }

  async function loadOptions() {
    state.options = await fetchJson("/api/tourism/options");

    fillSelect($("#provinceSelect"), state.options.provinces, "全部省份");
    fillSelect($("#categorySelect"), state.options.categories, "全部类型");
    if ($("#themeSelect")) {
      fillSelect($("#themeSelect"), state.options.themes, "选择研学主题");
    }
  }

  function resourceQuery() {
    const params = new URLSearchParams();
    const province = $("#provinceSelect").value;
    const category = $("#categorySelect").value;
    const keyword = $("#keywordInput").value.trim();

    if (province) {
      params.set("province", province);
    }

    if (category) {
      params.set("category", category);
    }

    if (keyword) {
      params.set("keyword", keyword);
    }

    return params;
  }

  async function loadResources() {
    clearRoute();
    const data = await fetchJson(`/api/tourism/resources?${resourceQuery().toString()}`);

    state.resources = data.resources || [];
    if (!resourceQuery().toString() || !state.allResources.length) {
      state.allResources = state.resources;
    }
    $("#resourceTotal").textContent = String(data.total || state.resources.length);
    renderProvinceTourismMap(state.resources);
    renderResourceMarkers();
    renderCharts(data.charts || {});
    renderSelectedRoutePoints();

    if (state.resources.length) {
      if ($("#provinceSelect")?.value) {
        fitBounds(state.resources);
      } else {
        fitChinaMap(true);
      }
    } else {
      fitChinaMap(true);
    }
  }

  function uniqueProvinces(resources) {
    return [...new Set((resources || []).map((resource) => resource.province).filter(Boolean))];
  }

  function ellipsePolygon(center, rx, ry, rotation = 0) {
    const points = [];
    const steps = 42;
    const angle = (rotation * Math.PI) / 180;

    for (let index = 0; index < steps; index += 1) {
      const t = (Math.PI * 2 * index) / steps;
      const x = Math.cos(t) * rx;
      const y = Math.sin(t) * ry;
      const lat = center.lat + y * Math.cos(angle) - x * Math.sin(angle) * 0.55;
      const lng = center.lng + x * Math.cos(angle) + y * Math.sin(angle) * 0.55;

      points.push([lat, lng]);
    }

    return points;
  }

  function mapIllustrationSvg(kind, color) {
    const fill = escapeHtml(color || "#ffd36e");
    const common = `width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"`;
    const shadow = `<ellipse cx="61" cy="103" rx="35" ry="8" fill="rgba(94,55,31,.20)"/>`;
    const red = "#d93a2f";
    const dark = "#59311e";
    const cream = "#fff3cf";
    const blue = "#35a7d6";
    const green = "#42a66b";
    const yellow = "#ffd166";
    const drawings = {
      palace: `${shadow}<path d="M20 82h80v15H20V82Z" fill="${dark}"/><path d="M27 60h66v24H27V60Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M15 56h90l-12-17H27L15 56Z" fill="${red}"/><path d="M37 39h46l-8-12H45l-8 12Z" fill="#f8b44b"/><path d="M47 84V68h26v16" fill="${dark}"/><circle cx="60" cy="50" r="7" fill="${yellow}"/>`,
      pass: `${shadow}<path d="M22 91h78" stroke="${dark}" stroke-width="8" stroke-linecap="round"/><path d="M32 35h56v56H32V35Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M23 36h74L84 21H36L23 36Z" fill="${red}"/><path d="M45 91V63c0-9 6-15 15-15s15 6 15 15v28" fill="${dark}"/><path d="M40 46h40" stroke="#d79a36" stroke-width="4"/>`,
      camel: `${shadow}<path d="M22 79c7-22 22-23 34-9 7-24 24-26 36-5l9 14" stroke="#9c6629" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="101" cy="58" r="8" fill="#9c6629"/><path d="M31 80v19M72 80v19" stroke="#9c6629" stroke-width="8" stroke-linecap="round"/><circle cx="104" cy="56" r="2" fill="#211"/>`,
      mountain: `${shadow}<path d="M11 96l27-54 22 38 15-25 34 41H11Z" fill="#65b9e8"/><path d="M38 42l9 16H30l8-16ZM75 55l9 14H66l9-14Z" fill="#fff"/><path d="M20 96h80" stroke="#2e7d55" stroke-width="8" stroke-linecap="round"/>`,
      cave: `${shadow}<path d="M21 91c3-35 21-56 39-56s36 21 39 56v8H21v-8Z" fill="#b16d3b"/><path d="M43 99V65c0-10 7-17 17-17s17 7 17 17v34" fill="#3b2315"/><circle cx="38" cy="63" r="6" fill="${yellow}"/><circle cx="82" cy="63" r="6" fill="${yellow}"/><path d="M31 88h58" stroke="#e8b25c" stroke-width="5"/>`,
      crane: `${shadow}<path d="M35 86c17-6 27-19 36-40 12 11 17 28 8 42-8 13-27 16-44-2Z" fill="#fff" stroke="${dark}" stroke-width="4"/><path d="M72 45c7-9 16-14 26-12" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><path d="M94 33l10-5-6 9" fill="${red}"/><path d="M54 89l-7 17M68 88l7 17" stroke="${dark}" stroke-width="4" stroke-linecap="round"/><circle cx="77" cy="42" r="3" fill="#111"/>`,
      pearl: `${shadow}<path d="M19 98h82" stroke="${dark}" stroke-width="7" stroke-linecap="round"/><path d="M35 97V66h14v31M55 97V49h14v48M75 97V59h14v38" fill="#7dd9ee" stroke="${dark}" stroke-width="3"/><path d="M62 20v78" stroke="${dark}" stroke-width="4"/><circle cx="62" cy="34" r="14" fill="#f48fb1" stroke="${dark}" stroke-width="4"/><circle cx="62" cy="61" r="9" fill="${yellow}" stroke="${dark}" stroke-width="3"/>`,
      school: `${shadow}<path d="M23 87h74v14H23V87Z" fill="${dark}"/><path d="M31 56h58v31H31V56Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M60 25l42 31H18l42-31Z" fill="${red}"/><path d="M52 87V68h16v19" fill="${dark}"/><path d="M37 67h10M73 67h10" stroke="#d79a36" stroke-width="4"/>`,
      tulou: `${shadow}<ellipse cx="60" cy="74" rx="40" ry="25" fill="#c27b43" stroke="${dark}" stroke-width="4"/><ellipse cx="60" cy="65" rx="38" ry="18" fill="${cream}" stroke="${dark}" stroke-width="4"/><ellipse cx="60" cy="66" rx="17" ry="8" fill="#84c97a"/><path d="M28 64c12-20 52-20 64 0" stroke="${red}" stroke-width="9" stroke-linecap="round"/><path d="M43 76h8M58 79h8M73 76h8" stroke="${dark}" stroke-width="4" stroke-linecap="round"/>`,
      panda: `${shadow}<circle cx="41" cy="43" r="15" fill="#222"/><circle cx="79" cy="43" r="15" fill="#222"/><circle cx="60" cy="61" r="36" fill="#fff" stroke="${dark}" stroke-width="4"/><ellipse cx="47" cy="58" rx="10" ry="12" fill="#222"/><ellipse cx="73" cy="58" rx="10" ry="12" fill="#222"/><circle cx="48" cy="57" r="3" fill="#fff"/><circle cx="72" cy="57" r="3" fill="#fff"/><path d="M54 76c4 5 9 5 13 0" stroke="${dark}" stroke-width="5" stroke-linecap="round"/><path d="M23 83c6 13 18 20 37 20s31-7 37-20" fill="#fff" stroke="${dark}" stroke-width="4"/>`,
      meeting: `${shadow}<path d="M24 82h72v17H24V82Z" fill="${dark}"/><path d="M32 48h56l10 34H22l10-34Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M26 49h68L80 31H40L26 49Z" fill="${red}"/><path d="M46 62h28M44 73h32" stroke="${dark}" stroke-width="4" stroke-linecap="round"/><path d="M60 16l8 16H52l8-16Z" fill="${yellow}"/>`,
      elephant: `${shadow}<path d="M30 70c0-24 18-39 43-33 16 4 27 17 25 33-2 21-18 31-41 29H42c-10-2-12-16-12-29Z" fill="#63b7e8" stroke="${dark}" stroke-width="4"/><circle cx="77" cy="55" r="5" fill="#123"/><path d="M33 69c-17 6-23 18-16 29 7 9 24 0 24-14" stroke="#63b7e8" stroke-width="13" stroke-linecap="round"/><path d="M47 95v12M82 94v12" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`,
      wall: `${shadow}<path d="M12 82c18-23 33-9 51-28 12-12 22-17 41-13" stroke="${dark}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 72h16v21H18V72ZM45 61h17v22H45V61ZM77 49h17v22H77V49Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M17 71h18M44 60h19M76 48h19" stroke="${red}" stroke-width="5"/>`,
      horse: `${shadow}<path d="M20 73c8-25 35-30 59-13l16 15" stroke="#8d5a25" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 78v24M70 76v24" stroke="#8d5a25" stroke-width="8" stroke-linecap="round"/><path d="M88 56l14-12" stroke="#8d5a25" stroke-width="8" stroke-linecap="round"/><circle cx="98" cy="44" r="7" fill="#8d5a25"/><path d="M31 55c7-10 21-15 34-9" stroke="#4d2d18" stroke-width="5" stroke-linecap="round"/>`,
      lake: `${shadow}<path d="M12 86c18-16 31 10 52-6 13-10 22 5 39-4" stroke="${blue}" stroke-width="13" stroke-linecap="round"/><path d="M20 62l22-34 18 29 11-17 28 38H20Z" fill="#6bb7e8" stroke="${dark}" stroke-width="3"/><path d="M42 28l8 13H34l8-13ZM71 40l7 10H65l6-10Z" fill="#fff"/><circle cx="94" cy="29" r="9" fill="${yellow}"/>`,
      boat: `${shadow}<path d="M18 75h80l-12 23H31L18 75Z" fill="${dark}"/><path d="M57 26v49" stroke="${dark}" stroke-width="6" stroke-linecap="round"/><path d="M60 31l31 27-31 13V31Z" fill="${cream}" stroke="${dark}" stroke-width="4"/><path d="M10 101c18-11 32 9 52 0 17-8 26 7 46-1" stroke="${blue}" stroke-width="7" stroke-linecap="round"/>`,
      redstar: `${shadow}<path d="M60 15l11 24 26 4-19 19 5 26-23-13-23 13 5-26-19-19 26-4 11-24Z" fill="${red}" stroke="${cream}" stroke-width="6"/><path d="M32 93h56" stroke="${dark}" stroke-width="8" stroke-linecap="round"/>`,
      flower: `${shadow}<circle cx="60" cy="58" r="11" fill="${yellow}" stroke="${dark}" stroke-width="3"/><circle cx="60" cy="32" r="17" fill="${red}"/><circle cx="83" cy="52" r="17" fill="#ff8fab"/><circle cx="74" cy="79" r="17" fill="#f4b942"/><circle cx="46" cy="79" r="17" fill="#ff8fab"/><circle cx="37" cy="52" r="17" fill="#ffb3c7"/><path d="M60 72v30" stroke="${green}" stroke-width="8" stroke-linecap="round"/><path d="M60 91c-13-3-21-9-26-19" stroke="${green}" stroke-width="6" stroke-linecap="round"/>`,
      quilt: `${shadow}<path d="M25 31h70v58H25V31Z" fill="#fff1a8" stroke="${dark}" stroke-width="4"/><path d="M60 31v58M25 60h70" stroke="${red}" stroke-width="5"/><path d="M39 42l12 12M70 42l12 12M39 70l12 12M70 70l12 12" stroke="#e63946" stroke-width="5" stroke-linecap="round"/><path d="M18 94h84" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>`,
      coconut: `${shadow}<path d="M54 101c7-33 12-57 23-82" stroke="#8d5a25" stroke-width="10" stroke-linecap="round"/><path d="M77 20c-27 0-42 12-54 29 22-7 42-8 54-29Z" fill="${green}"/><path d="M77 20c25 4 35 19 41 38-20-13-33-20-41-38Z" fill="${green}"/><path d="M76 19c-8 20-20 32-38 42 21-2 37-14 38-42Z" fill="#5abf73"/><circle cx="75" cy="31" r="9" fill="#8d5a25"/>`,
    };

    return `<svg ${common}>${drawings[kind] || drawings.meeting}</svg>`;
  }

  function landmarkSvg(kind, color) {
    const fill = escapeHtml(color || "#ffd36e");
    const common = `width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"`;
    const bg = `<rect x="3" y="3" width="44" height="44" rx="16" fill="${fill}"/><path d="M8 35c9-5 15-2 21-7 5-4 8-9 14-10v22H8v-5Z" fill="rgba(255,255,255,.38)"/>`;
    const drawings = {
      panda: `${bg}<circle cx="19" cy="20" r="5" fill="#222"/><circle cx="31" cy="20" r="5" fill="#222"/><circle cx="25" cy="25" r="13" fill="#fff"/><circle cx="20" cy="24" r="2.4" fill="#222"/><circle cx="30" cy="24" r="2.4" fill="#222"/><path d="M22 31c2 2 4 2 6 0" stroke="#222" stroke-width="2" stroke-linecap="round"/>`,
      meeting: `${bg}<path d="M13 33h24v6H13v-6Z" fill="#8b2f1d"/><path d="M17 18h16l4 15H13l4-15Z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M21 24h8M20 29h10" stroke="#8b2f1d" stroke-width="2" stroke-linecap="round"/><path d="M25 11l3 6h-6l3-6Z" fill="#e63946"/>`,
      elephant: `${bg}<path d="M17 28c0-8 6-13 14-11 5 1 8 5 8 10 0 6-4 11-10 11h-7c-4 0-5-5-5-10Z" fill="#5da9df"/><circle cx="31" cy="23" r="2" fill="#123"/><path d="M18 27c-5 2-7 6-5 10 2 3 7 0 7-4" stroke="#5da9df" stroke-width="5" stroke-linecap="round"/>`,
      redstar: `${bg}<path d="M25 11l4.2 8.7 9.6 1.4-6.9 6.8 1.6 9.5L25 32.8l-8.5 4.6 1.6-9.5-6.9-6.8 9.6-1.4L25 11Z" fill="#e63946" stroke="#fff7dc" stroke-width="2"/>`,
      cave: `${bg}<path d="M12 35c1-11 8-18 13-18s12 7 13 18v5H12v-5Z" fill="#a86b3d"/><path d="M20 39V28c0-3 2-5 5-5s5 2 5 5v11" fill="#3b2315"/><circle cx="18" cy="27" r="2" fill="#ffd36e"/><circle cx="32" cy="27" r="2" fill="#ffd36e"/>`,
      camel: `${bg}<path d="M12 32c3-8 8-8 12-4 2-7 7-8 11-2l4 6" stroke="#8d5a25" stroke-width="5" stroke-linecap="round"/><path d="M16 34v6M31 34v6" stroke="#8d5a25" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="27" r="3" fill="#8d5a25"/>`,
      quilt: `${bg}<path d="M13 16h24v22H13V16Z" fill="#fff1a8" stroke="#a8261d" stroke-width="2"/><path d="M25 16v22M13 27h24" stroke="#a8261d" stroke-width="2"/><path d="M18 20l4 4M30 20l4 4M18 31l4 4M30 31l4 4" stroke="#e63946" stroke-width="2" stroke-linecap="round"/>`,
      river: `${bg}<path d="M10 16c9 8 21-2 30 7M10 25c9 8 21-2 30 7M10 34c9 8 21-2 30 7" stroke="#1387bd" stroke-width="4" stroke-linecap="round"/><path d="M25 12l3 6h-6l3-6Z" fill="#e63946"/>`,
      mountain: `${bg}<path d="M8 38l12-22 9 15 5-8 9 15H8Z" fill="#5da9df"/><path d="M20 16l4 7h-8l4-7ZM34 23l3 5h-6l3-5Z" fill="#fff"/>`,
      school: `${bg}<path d="M12 34h26v6H12v-6Z" fill="#8b2f1d"/><path d="M15 22h20v12H15V22Z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M25 12l13 10H12l13-10Z" fill="#e63946"/><path d="M22 34v-7h6v7" fill="#8b2f1d"/>`,
      bridge: `${bg}<path d="M10 32c7-10 23-10 30 0" stroke="#8b2f1d" stroke-width="4"/><path d="M12 34h26" stroke="#8b2f1d" stroke-width="4" stroke-linecap="round"/><path d="M16 33v6M25 28v11M34 33v6" stroke="#8b2f1d" stroke-width="3"/>`,
      palace: `${bg}<path d="M10 34h30v6H10v-6Z" fill="#8b2f1d"/><path d="M15 24h20v10H15V24Z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M25 11l13 13H12l13-13Z" fill="#e63946"/><path d="M20 28h10" stroke="#8b2f1d" stroke-width="2"/>`,
      wall: `${bg}<path d="M10 34c7-10 12-3 19-10 4-4 7-6 11-5" stroke="#8b2f1d" stroke-width="5" stroke-linecap="round"/><path d="M12 31h7v8h-7zM23 27h7v8h-7zM34 22h7v8h-7z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="1.7"/>`,
      horse: `${bg}<path d="M13 30c3-8 12-9 20-5l5 5" stroke="#7b4a25" stroke-width="5" stroke-linecap="round"/><path d="M19 32v7M31 32v7" stroke="#7b4a25" stroke-width="4" stroke-linecap="round"/><path d="M35 25l5-4" stroke="#7b4a25" stroke-width="4" stroke-linecap="round"/>`,
      ship: `${bg}<path d="M10 31h30l-5 8H15l-5-8Z" fill="#1387bd"/><path d="M23 14v17" stroke="#8b2f1d" stroke-width="3"/><path d="M24 16l12 8-12 5V16Z" fill="#fff2c7"/><path d="M12 40c6-3 10 3 16 0 5-2 8 2 12 0" stroke="#fff2c7" stroke-width="2" stroke-linecap="round"/>`,
      snow: `${bg}<path d="M8 38l12-22 7 12 5-8 10 18H8Z" fill="#6bb7e8"/><path d="M20 16l4 7h-8l4-7ZM32 20l4 7h-8l4-7Z" fill="#fff"/><circle cx="14" cy="14" r="2" fill="#fff"/><circle cx="38" cy="15" r="2" fill="#fff"/>`,
      crane: `${bg}<path d="M15 35c8-15 18-15 22 0" stroke="#fff2c7" stroke-width="5" stroke-linecap="round"/><path d="M25 19v18" stroke="#222" stroke-width="3"/><circle cx="29" cy="18" r="3" fill="#fff2c7"/><path d="M31 18h7" stroke="#e63946" stroke-width="3" stroke-linecap="round"/>`,
      pearl: `${bg}<circle cx="25" cy="16" r="6" fill="#e63946"/><circle cx="25" cy="29" r="8" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M25 22v18M18 40h14" stroke="#8b2f1d" stroke-width="3" stroke-linecap="round"/>`,
      boat: `${bg}<path d="M12 33h26l-4 6H16l-4-6Z" fill="#8b2f1d"/><path d="M25 13v20" stroke="#8b2f1d" stroke-width="3"/><path d="M26 15l10 10-10 5V15Z" fill="#fff2c7"/><path d="M10 41c7-4 12 4 19 0 5-3 8 2 11 0" stroke="#1387bd" stroke-width="3" stroke-linecap="round"/>`,
      tulou: `${bg}<ellipse cx="25" cy="30" rx="15" ry="10" fill="#a86b3d" stroke="#8b2f1d" stroke-width="2"/><ellipse cx="25" cy="28" rx="8" ry="4" fill="#fff2c7"/><path d="M12 30c4-8 22-8 26 0" stroke="#fff2c7" stroke-width="2"/>`,
      flower: `${bg}<circle cx="25" cy="25" r="5" fill="#ffd166"/><circle cx="25" cy="15" r="6" fill="#e63946"/><circle cx="34" cy="23" r="6" fill="#ff8fab"/><circle cx="30" cy="34" r="6" fill="#f4b942"/><circle cx="16" cy="23" r="6" fill="#ff8fab"/><path d="M25 30v10" stroke="#2d8a4b" stroke-width="3"/>`,
      coconut: `${bg}<path d="M24 40c2-11 4-18 7-25" stroke="#7b4a25" stroke-width="4" stroke-linecap="round"/><path d="M31 15c-8 0-12 4-16 9 7-2 13-2 16-9Z" fill="#2d8a4b"/><path d="M31 15c7 1 10 6 12 11-6-4-10-6-12-11Z" fill="#2d8a4b"/><circle cx="30" cy="19" r="3" fill="#8d5a25"/>`,
      lake: `${bg}<path d="M9 36c7-7 12 4 20-3 5-5 8 2 12-2" stroke="#1387bd" stroke-width="5" stroke-linecap="round"/><path d="M13 25l8-12 6 10 4-6 8 12H13Z" fill="#6bb7e8"/><path d="M21 13l3 5h-6l3-5Z" fill="#fff"/>`,
      lighthouse: `${bg}<path d="M21 17h8l3 22H18l3-22Z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M20 17l5-6 5 6H20Z" fill="#e63946"/><path d="M13 40h24" stroke="#1387bd" stroke-width="4" stroke-linecap="round"/><circle cx="25" cy="23" r="2" fill="#ffd166"/>`,
      lotus: `${bg}<path d="M25 14c6 6 7 13 0 20-7-7-6-14 0-20Z" fill="#f06292"/><path d="M17 22c7 1 11 5 8 13-8-2-10-7-8-13ZM33 22c-7 1-11 5-8 13 8-2 10-7 8-13Z" fill="#ffb7c7"/><path d="M13 39h24" stroke="#1387bd" stroke-width="4" stroke-linecap="round"/>`,
      tower: `${bg}<path d="M25 10l10 10H15l10-10Z" fill="#e63946"/><path d="M18 20h14l3 20H15l3-20Z" fill="#fff2c7" stroke="#8b2f1d" stroke-width="2"/><path d="M21 27h8M20 33h10" stroke="#8b2f1d" stroke-width="2"/>`,
    };

    return `<svg ${common}>${drawings[kind] || drawings.redstar}</svg>`;
  }

  function updateTourismZoomScale() {
    if (!state.map) {
      return;
    }

    const zoom = state.map.getZoom();
    // 全中国视图下代表图标不能太小；缩放后再适度放大，避免看成杂点。
    const scale = Math.max(0.96, Math.min(1.34, 0.96 + (zoom - 4) * 0.08));

    document.documentElement.style.setProperty("--tourism-zoom-scale", scale.toFixed(2));
  }

  function renderProvinceTourismMap(resources = state.resources, forceAllProvinces = false) {
    const selectedProvince = forceAllProvinces ? "" : $("#provinceSelect")?.value;
    const dataProvinces = uniqueProvinces(resources);
    const provinceNames = selectedProvince
      ? [selectedProvince]
      : [...new Set([...dataProvinces, ...Object.keys(provinceTourism)])];

    state.provinceLayer?.clearLayers();
    state.provinceIconLayer?.clearLayers();
    state.provinceLabelLayer?.clearLayers();

    // 用真实中国省界做卡通填色；地图上的省名文字不显示，只保留每省代表性小图标。
    if (state.chinaProvinceGeojson) {
      renderRealProvinceBoundaries(provinceNames, selectedProvince);
      renderProvinceLandmarks(provinceNames, selectedProvince);
    } else {
      renderProvinceLandmarks(provinceNames, selectedProvince);

      if (!state.chinaGeojsonTried) {
        state.chinaGeojsonTried = true;
        loadChinaProvinceGeoJson();
      }
    }
  }

  function createResourceIcon(resource, active = false, selected = false) {
    const meta = categoryMeta[resource.category] || categoryMeta.other;
    const size = selected ? 28 : active ? 30 : resource.featured ? 24 : 18;
    const selectedClass = selected ? "selected" : "";
    const activeClass = active ? "focus" : "";

    return L.divIcon({
      className: "",
      html: `
        <div class="resource-marker ${activeClass} ${selectedClass}" style="--size:${size}px;--color:${meta.color}">
          <i>${selected ? "✓" : ""}</i>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });
  }

  function renderResourceMarkers(resources = state.resources, focusIds = new Set()) {
    state.resourceLayer.clearLayers();
    state.markers.clear();
    state.currentMarkerResources = resources;
    state.currentFocusIds = focusIds;

    resources.forEach((resource) => {
      const selected = state.selectedRoutePointIds.has(resource.id);
      const active = focusIds.has(resource.id);
      const marker = L.marker([resource.lat, resource.lng], {
        icon: createResourceIcon(resource, active, selected),
        zIndexOffset: selected ? 1200 : active ? 900 : 500,
      });

      marker.on("click", () => {
        if (state.mapClickMode === "select") {
          toggleRoutePointFromMap(resource);
          return;
        }

        showResourceDetail(resource);
      });

      marker.addTo(state.resourceLayer);
      state.markers.set(resource.id, marker);
    });
  }

  function rerenderCurrentMarkers() {
    renderResourceMarkers(
      state.currentMarkerResources.length ? state.currentMarkerResources : state.resources,
      state.currentFocusIds || new Set(),
    );
  }

  function showResourceDetail(resource) {
    const meta = categoryMeta[resource.category] || categoryMeta.other;
    const review = loadReview(resource);
    const isSelectedForRoute = state.selectedRoutePointIds.has(resource.id);
    state.currentDetailResource = resource;

    $("#detailPanel").innerHTML = `
      <div class="detail-heading">
        <span class="panel-kicker">RESOURCE DETAIL</span>
        <div class="detail-score-actions">
          <span class="review-chip fixed">综合评分 ${fixedOverallScore(resource)} / 5</span>
          <button class="my-review-btn" id="myReviewBtn" type="button">我的评价</button>
        </div>
      </div>
      <h2>${escapeHtml(resource.name)}</h2>
      <p>该点位于 <b>${escapeHtml(resource.province || "-")}</b>${resource.city ? ` · ${escapeHtml(resource.city)}` : ""}，是${escapeHtml(meta.label)}类红色研学资源。</p>
      <div class="visitor-score-preview">
        <span>游客推荐评分</span>
        <b>${touristScore(review)} / 5</b>
        ${renderStaticStars(visitorAverageValue(review))}
      </div>
      <div class="detail-grid">
        <div class="detail-row"><span>省份</span><b>${escapeHtml(resource.province || "-")}</b></div>
        <div class="detail-row"><span>城市</span><b>${escapeHtml(resource.city || "-")}</b></div>
        <div class="detail-row"><span>地址</span><b>${escapeHtml(resource.address || "-")}</b></div>
        <div class="detail-row"><span>类型</span><b>${escapeHtml(resource.type || meta.label)}</b></div>
        <div class="detail-row"><span>坐标</span><b>${escapeHtml(resource.lng)}, ${escapeHtml(resource.lat)}</b></div>
      </div>
      <div class="detail-route-actions">
        <button class="detail-route-action ${isSelectedForRoute ? "remove" : ""}" id="detailRouteActionBtn" type="button">
          ${isSelectedForRoute ? "从研学方案移除" : "加入研学方案"}
        </button>
        <button class="detail-route-mode" id="detailSelectModeBtn" type="button">切换到地图点选</button>
      </div>
    `;

    $("#myReviewBtn")?.addEventListener("click", () => {
      openReviewModal(resource, false);
    });

    $("#detailRouteActionBtn")?.addEventListener("click", () => {
      toggleRoutePointFromMap(resource, { keepDetail: true });
    });

    $("#detailSelectModeBtn")?.addEventListener("click", () => {
      updateMapClickMode("select");
      flash("已切换为加入路线模式");
    });

    renderKnowledgeLinks([resource]);
  }


  function routePointTypeLabel(resource) {
    const meta = categoryMeta[resource.category] || categoryMeta.other;

    return meta.label || "资源";
  }

  function findRouteResourceById(id) {
    return [...state.resources, ...state.allResources]
      .find((resource) => resource.id === id || resource.sourceId === id);
  }

  function getSelectedRoutePointIds() {
    return [...state.selectedRoutePointIds];
  }

  function updateMapClickMode(mode = state.mapClickMode) {
    state.mapClickMode = mode === "select" ? "select" : "detail";

    document.querySelectorAll("[data-map-click-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.mapClickMode === state.mapClickMode);
    });

    const mapWrap = document.querySelector(".tourism-map-wrap");
    mapWrap?.classList.toggle("select-mode", state.mapClickMode === "select");
    updateRoutePointHint();
  }

  function updateRoutePointHint() {
    const count = getSelectedRoutePointIds().length;
    const hint = $("#routePointHint");

    if (!hint) {
      return;
    }

    if (state.mapClickMode === "select") {
      hint.textContent = count
        ? `当前为加入路线模式：已选择 ${count} 个纪念点，继续点击地图资源点可增删；生成时会按天数智能补充和排序。`
        : "当前为加入路线模式：点击地图上的真实资源点加入研学方案，再次点击可取消。";
      return;
    }

    hint.textContent = count
      ? `当前为查看模式：点击地图资源点只查看介绍；已选择 ${count} 个纪念点，需要增删请切换到“加入路线”。`
      : "当前为查看模式：点击地图资源点只查看右侧介绍；需要加入路线时请切换到“加入路线”。";
  }

  function renderSelectedRoutePoints() {
    const wrap = $("#selectedRoutePointList");

    if (!wrap) {
      updateRoutePointHint();
      return;
    }

    const selected = getSelectedRoutePointIds()
      .map(findRouteResourceById)
      .filter(Boolean);

    if (!selected.length) {
      wrap.innerHTML = `<p class="route-point-empty">暂无自选纪念点，请在地图上点击资源点。</p>`;
      updateRoutePointHint();
      return;
    }

    wrap.innerHTML = selected.map((resource) => {
      const meta = categoryMeta[resource.category] || categoryMeta.other;

      return `
        <button class="selected-route-chip" type="button" data-remove-route-point="${escapeHtml(resource.id)}" title="点击移除 ${escapeHtml(resource.name)}" style="--point-color:${meta.color}">
          <i></i>
          <span>${escapeHtml(resource.name || "未命名点位")}</span>
          <em>${escapeHtml(resource.city || resource.province || routePointTypeLabel(resource))}</em>
          <b>×</b>
        </button>
      `;
    }).join("");

    updateRoutePointHint();
  }

  function toggleRoutePointFromMap(resource, options = {}) {
    if (!resource?.id) {
      return;
    }

    state.activePreset = "";

    if (state.selectedRoutePointIds.has(resource.id)) {
      state.selectedRoutePointIds.delete(resource.id);
      flash(`已移除：${resource.name}`);
    } else {
      state.selectedRoutePointIds.add(resource.id);
      flash(`已加入路线：${resource.name}`);
    }

    renderSelectedRoutePoints();
    rerenderCurrentMarkers();

    if (options.keepDetail || state.currentDetailResource?.id === resource.id) {
      showResourceDetail(resource);
    }
  }

  function removeSelectedRoutePoint(id) {
    state.activePreset = "";
    state.selectedRoutePointIds.delete(id);
    renderSelectedRoutePoints();
    rerenderCurrentMarkers();
  }

  function clearSelectedRoutePoints(options = {}) {
    if (!options.keepPreset) {
      state.activePreset = "";
    }
    state.selectedRoutePointIds.clear();
    renderSelectedRoutePoints();
    rerenderCurrentMarkers();
  }

  function fitBounds(resources) {
    const bounds = L.latLngBounds(resources.map((item) => [item.lat, item.lng]));

    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [52, 52],
      });
    }
  }

  function focusRouteBounds(resources) {
    const points = (resources || [])
      .filter((item) => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
      .map((item) => [item.lat, item.lng]);

    if (!points.length) {
      return;
    }

    const bounds = L.latLngBounds(points);

    if (bounds.isValid()) {
      state.map.fitBounds(bounds, {
        padding: [96, 96],
        maxZoom: 12,
        animate: true,
        duration: 0.9,
      });
    }
  }

  function setRouteProgress(value) {
    routeProgressValue = Math.max(0, Math.min(100, Number(value) || 0));
    const overlay = $("#analysisOverlay");
    const ring = overlay?.querySelector("#routeProgressRing");
    const text = overlay?.querySelector("#routeProgressText");
    const bar = overlay?.querySelector("#routeProgressBar");

    if (ring) {
      ring.style.setProperty("--route-progress", routeProgressValue.toFixed(0));
    }

    if (text) {
      text.textContent = `${Math.round(routeProgressValue)}%`;
    }

    if (bar) {
      bar.style.width = `${routeProgressValue}%`;
    }
  }

  function startRouteProgress() {
    clearInterval(routeProgressTimer);
    setRouteProgress(6);

    routeProgressTimer = setInterval(() => {
      const remaining = 94 - routeProgressValue;
      const step = Math.max(1, Math.min(7, remaining * 0.18));
      setRouteProgress(Math.min(94, routeProgressValue + step));
    }, 110);
  }

  function stopRouteProgress() {
    clearInterval(routeProgressTimer);
    routeProgressTimer = null;
    setRouteProgress(100);
  }

  function showAnalysis(show) {
    const overlay = $("#analysisOverlay");

    if (!overlay) {
      return;
    }

    if (show) {
      overlay.classList.add("show");
      startRouteProgress();
      return;
    }

    stopRouteProgress();
    setTimeout(() => {
      overlay.classList.remove("show");
      setRouteProgress(0);
    }, 180);
  }

  async function generateRoute() {
    showAnalysis(true);
    state.routeLayer.clearLayers();

    const params = new URLSearchParams();
    const theme = state.activeTheme || "meeting";
    const days = $("#daysSelect").value;
    const province = $("#provinceSelect").value;

    params.set("theme", theme);
    params.set("days", days);

    if (state.activePreset) {
      params.set("preset", state.activePreset);
    }

    const selectedPointIds = getSelectedRoutePointIds();

    if (selectedPointIds.length) {
      params.delete("preset");
      params.set("points", selectedPointIds.join(","));
      params.set("selectedResourceIds", selectedPointIds.join(","));
    }

    if (province) {
      params.set("province", province);
    }

    params.set("travelMode", selectedTravelMode());

    await new Promise((resolve) => setTimeout(resolve, 1150));

    const route = await fetchJson(`/api/tourism/study-route?${params.toString()}`);
    state.currentRoute = route;

    showAnalysis(false);
    renderStudyRoute(route);
    renderRelatedEvents(route.relatedEvents || []);
    renderCharts(route.charts || {});
    $("#routeDistance").textContent = route.totalDistanceKm || "--";

    renderProvinceTourismMap(route.provinceResources || route.resources, Boolean(selectedPointIds.length));
    renderResourceMarkers(
      route.provinceResources || route.resources,
      new Set(route.resources.map((item) => item.id)),
    );
    showArcRoute(route);
    focusRouteBounds(route.resources || []);
    renderTravelServicePlan(route);
    renderRouteReason(route);
    renderKnowledgeLinks(route.resources || []);
    flash("研学方案和空间路线已生成");
  }

  function renderStudyRoute(route) {
    $("#routePanel").innerHTML = `
      <span class="panel-kicker">ROUTE PLAN</span>
      <div class="route-summary">
        <h3>${route.title}</h3>
        <div class="route-tags">
          <span>范围：${route.province || route.resources[0]?.province || "自动匹配"}</span>
          <span>终点：${route.resources[route.resources.length - 1]?.name || "研学总结点"}</span>
          <span>${route.days} 天</span>
          <span>${route.theme.label}</span>
          ${route.selectedPointCount ? `<span>自选 ${route.selectedPointCount} 个点</span>` : ""}
          ${route.autoAddedCount ? `<span>智能补充 ${route.autoAddedCount} 个点</span>` : ""}
          <span>${route.weather.city} ${route.weather.temperature}</span>
        </div>
        <p><b>交通：</b>${route.transport}</p>
        <p><b>天气：</b>${route.weather.summary}${route.weather.advice}</p>
        <p><b>餐饮：</b>${route.dining}</p>
      </div>
      <div class="day-route-list">
        ${route.schedule.map(renderDaySchedule).join("")}
      </div>
    `;
  }

  function renderDaySchedule(day) {
    return `
      <section class="day-card" style="--day-color:${day.color}">
        <h4>${day.title}</h4>
        <p class="day-flow">${day.from} → ${day.to}</p>
        <div class="schedule-list">
          ${day.items
            .map((item) => {
              return `
                <div class="schedule-item ${item.sharedStart ? "shared-start" : ""}">
                  <time>${item.time}</time>
                  <div>
                    <b>${item.place}</b>
                    <p>${item.activity}</p>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `;
  }

  function curvePoints(start, end, heightFactor, side = 1, segmentIndex = 0) {
    const points = [];
    const steps = 42;
    const dLat = end.lat - start.lat;
    const dLng = end.lng - start.lng;
    const length = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
    const normalLat = -dLng / length;
    const normalLng = dLat / length;
    const offset = (heightFactor + (segmentIndex % 3) * 0.035) * side;
    const midLat = (start.lat + end.lat) / 2 + normalLat * offset;
    const midLng = (start.lng + end.lng) / 2 + normalLng * offset;

    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;

      points.push([
        a * start.lat + b * midLat + c * end.lat,
        a * start.lng + b * midLng + c * end.lng,
      ]);
    }

    return points;
  }

  function groupOfSegment(route, startResource, endResource) {
    const groups = route.dayGroups || [];

    return groups.find((group) => {
      const resources = group.resources || [];

      for (let index = 0; index < resources.length - 1; index += 1) {
        if (resources[index]?.id === startResource.id && resources[index + 1]?.id === endResource.id) {
          return true;
        }
      }

      return false;
    }) || groups[0] || { color: palette[0], height: 0.16, day: 1 };
  }

  function showArcRoute(route) {
    const resources = route.resources || [];

    state.routeLayer.clearLayers();

    for (let index = 0; index < resources.length - 1; index += 1) {
      const start = resources[index];
      const end = resources[index + 1];
      const group = groupOfSegment(route, start, end);
      const side = group.day % 2 === 0 ? -1 : 1;
      const height = 0.09 + Number(group.day || 1) * 0.075;
      const points = curvePoints(start, end, height, side, index);
      const shadowPoints = curvePoints(start, end, height * 0.62, side, index);

      L.polyline(shadowPoints, {
        color: "#5b3a21",
        weight: 9,
        opacity: 0.14,
        className: "arc-shadow",
        interactive: false,
      }).addTo(state.routeLayer);
      L.polyline(points, {
        color: group.color,
        weight: 6,
        opacity: 0.95,
        className: "arc-line floating-arc",
        interactive: false,
      }).addTo(state.routeLayer);
      L.polyline(points.slice(6, -6), {
        color: "#fff7dc",
        weight: 2,
        opacity: 0.74,
        className: "arc-highlight",
        interactive: false,
      }).addTo(state.routeLayer);

      const middle = points[Math.floor(points.length / 2)];
      L.marker(middle, {
        icon: L.divIcon({
          className: "",
          html: `<div class="segment-badge route-day-badge" style="--day-color:${group.color}">第${group.day || 1}天</div>`,
          iconSize: [48, 22],
          iconAnchor: [24, 11],
        }),
        interactive: false,
        zIndexOffset: 1250,
      }).addTo(state.routeLayer);
    }

    addRouteNameLabels(resources, route);
    addEndpointLabels(resources);
  }

  function dayMetaOfResource(route, resource) {
    return (route.dayGroups || []).find((group) => {
      return (group.resources || []).some((item) => item?.id === resource.id);
    }) || { day: 1, color: palette[0] };
  }

  function addRouteNameLabels(resources, route) {
    resources.forEach((resource, index) => {
      const group = dayMetaOfResource(route, resource);

      L.marker([resource.lat, resource.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="route-name-label day-name-label" style="--day-color:${group.color}"><span>第${group.day || 1}天</span>${escapeHtml(resource.name)}</div>`,
          iconSize: [176, 28],
          iconAnchor: [88, 38],
        }),
        interactive: true,
        zIndexOffset: 1300,
      })
        .on("click", () => {
          showResourceDetail(resource);
        })
        .addTo(state.routeLayer);
    });
  }

  function addEndpointLabels(resources) {
    const start = resources[0];
    const end = resources[resources.length - 1];

    if (!start || !end) {
      return;
    }

    [
      {
        resource: start,
        text: "起点",
        className: "start",
      },
      {
        resource: end,
        text: "终点",
        className: "end",
      },
    ].forEach((item) => {
      L.marker([item.resource.lat, item.resource.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="endpoint-label ${item.className}"><b>${item.text}</b><span>${item.resource.name}</span></div>`,
          iconSize: [112, 34],
          iconAnchor: [56, 42],
        }),
        interactive: true,
        zIndexOffset: 1600,
      })
        .on("click", () => {
          showResourceDetail(item.resource);
        })
        .addTo(state.routeLayer);
    });
  }

  function clearRoute() {
    state.routeLayer?.clearLayers();
    state.currentRoute = null;
    $("#routeReasonSection")?.classList.add("is-hidden");
    $("#routeDistance").textContent = "--";
  }

  function renderCharts(charts) {
    renderDonut(charts.categories || {});
    renderBubble(charts.cities || {});
    renderWordCloud(charts.words || {});
  }

  function renderDonut(data) {
    const labels = {
      site: "旧址",
      museum: "纪念馆",
      scenic: "景区",
      other: "其他",
    };
    const entries = Object.entries(data);
    const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0) || 1;
    let current = 0;
    const gradient = entries
      .map(([key, value], index) => {
        const start = current;
        const end = current + (Number(value) / total) * 100;

        current = end;
        return `${palette[index % palette.length]} ${start}% ${end}%`;
      })
      .join(",");

    $("#donutChart").innerHTML = `
      <div class="donut" style="background:conic-gradient(${gradient})">
        <b>${total}</b>
        <span>点位</span>
      </div>
      <div class="donut-legend">
        ${entries.map(([key, value]) => `<span><i></i>${labels[key] || key} ${value}</span>`).join("")}
      </div>
    `;
  }

  function renderBubble(data) {
    const entries = Object.entries(data);
    const max = Math.max(1, ...entries.map((entry) => Number(entry[1])));

    $("#cityChart").innerHTML = entries
      .map(([city, value], index) => {
        const size = 36 + (Number(value) / max) * 44;

        return `<span class="bubble" style="width:${size}px;height:${size}px;--bubble-color:${palette[index % palette.length]}">${city}<b>${value}</b></span>`;
      })
      .join("");
  }

  function renderWordCloud(words) {
    const entries = Object.entries(words);
    const max = Math.max(1, ...entries.map((entry) => Number(entry[1])));
    const fallback = entries.length ? entries : [["长征", 5], ["研学", 4], ["红军", 3], ["泸定桥", 3]];

    $("#wordCloud").innerHTML = fallback
      .map(([word, value], index) => {
        const size = 13 + (Number(value) / max) * 14;

        const rotate = [-8, 5, -3, 9, -11][index % 5];
        const offset = [0, 12, -8, 18, -14][index % 5];

        return `<span class="word" style="font-size:${size}px;color:${palette[index % palette.length]};transform:translateY(${offset}px) rotate(${rotate}deg)">${word}</span>`;
      })
      .join("");
  }

  function renderRelatedEvents(events) {
    const list = events.length
      ? events
      : [{ date: "1935", name: "飞夺泸定桥", event: "红军强渡大渡河后飞夺泸定桥，是长征转折进程中的重要节点。" }];

    $("#eventList").innerHTML = list
      .map((event) => {
        return `
          <div class="event-item">
            <b>${event.date || "历史节点"} · ${event.name}</b>
            <p>${event.event || event.type || ""}</p>
          </div>
        `;
      })
      .join("");
  }

  function bindRoutePresetCards() {
    document.querySelectorAll("[data-route-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const source = button.closest(".recommend-card") || button;
        const province = source.dataset.presetProvince || "";
        const theme = source.dataset.presetTheme || "meeting";
        const days = source.dataset.presetDays || "3";
        const preset = source.dataset.presetId || "";

        state.activeTheme = theme;
        state.activePreset = preset;
        updateMapClickMode("detail");

        if ($("#provinceSelect") && province) {
          $("#provinceSelect").value = province;
        }

        if ($("#themeSelect")) {
          $("#themeSelect").value = theme;
        }

        if ($("#daysSelect")) {
          $("#daysSelect").value = days;
        }

        clearSelectedRoutePoints({ keepPreset: true });

        generateRoute().catch((error) => {
          console.error(error);
          showAnalysis(false);
          flash("推荐路线生成失败");
        });
      });
    });
  }

  function selectedTravelMode() {
    return $("#travelModeSelect")?.value || "coach";
  }

  function travelModeInfo(mode = selectedTravelMode()) {
    const infos = {
      bus: {
        name: "研学大巴",
        traffic: "适合学校统一组织，点到点转场稳定，便于控制集合时间与讲解节奏。",
        road: "优先选择国省干线与景区接驳道路，避开连续山路夜间行驶。",
        food: "午餐以纪念馆周边团队餐或当地简餐为主，晚餐安排县城标准餐。",
        stay: "住宿优先选择县城研学团队酒店，满足安全、集合、停车和早出发需求。",
      },
      mixed: {
        name: "高铁 + 大巴",
        traffic: "跨省段使用高铁压缩长距离通勤，落地后以大巴串联纪念点。",
        road: "适合徐州出发到遵义、成都、延安等城市，再进入周边县域资源点。",
        food: "高铁段简餐，落地后安排城市餐饮与研学基地团队餐。",
        stay: "住宿靠近高铁站或核心纪念点，减少第二天早高峰转场压力。",
      },
      car: {
        name: "自驾调研",
        traffic: "适合小组调研，路线自由度高，可临时增加周边资源点。",
        road: "注意山区弯道、雨雪天气和景区停车容量，建议预留更多机动时间。",
        food: "可选择县城餐馆、服务区补给和景区周边简餐。",
        stay: "以县城连锁酒店或研学营地为主，晚间不安排长距离山路转场。",
      },
      walk: {
        name: "徒步体验段",
        traffic: "主转场仍需车辆保障，仅选择安全、短距离、可讲解的体验步道。",
        road: "徒步段用于理解长征行军艰难，不作为全程交通方式。",
        food: "徒步前准备饮水与便携补给，正餐回到县城或基地统一安排。",
        stay: "住宿靠近徒步终点或次日首站，避免体能消耗后继续远距离转场。",
      },
    };

    return infos[mode] || infos.bus;
  }

  function renderTravelServicePlan(route = null) {
    const panel = $("#travelServicePanel");

    if (!panel) {
      return;
    }

    const mode = travelModeInfo();
    const resources = route?.resources || [];
    const start = resources[0]?.name || "中国矿业大学（南湖校区）";
    const end = resources[resources.length - 1]?.name || "重点红色资源点";
    const distance = route?.totalDistanceKm ? `${route.totalDistanceKm} 公里` : "待生成后计算";

    panel.innerHTML = `
      <article>
        <b>出行方式</b>
        <span>${mode.name}</span>
        <p>${mode.traffic}</p>
      </article>
      <article>
        <b>道路数据</b>
        <span>${distance}</span>
        <p>${mode.road}</p>
      </article>
      <article>
        <b>餐饮规划</b>
        <span>${start} → ${end}</span>
        <p>${mode.food}</p>
      </article>
      <article>
        <b>住宿规划</b>
        <span>县城 / 研学基地优先</span>
        <p>${mode.stay}</p>
      </article>
    `;
  }

  function renderRouteReason(route = null) {
    const panel = $("#routeReasonPanel");
    const section = $("#routeReasonSection");

    if (!panel || !section || !route) {
      section?.classList.add("is-hidden");
      return;
    }

    section.classList.remove("is-hidden");

    const mode = travelModeInfo();
    const resources = route?.resources || [];
    const cities = [...new Set(resources.map((item) => item.city).filter(Boolean))];
    const places = resources.slice(0, 5).map((item) => item.name).join("、") || "核心纪念点";
    const theme = route?.theme?.label || "长征精神研学";

    panel.innerHTML = `
      <img src="/assets/img/longmarch-route-corner.png" alt="长征研学路线分析示意">
      <div>
        <b>${theme}路线研判</b>
        <p><strong>选择依据：</strong>围绕${places}组织学习，兼顾事件代表性、空间连续性和学生集体出行安全。</p>
        <p><strong>道路难点：</strong>${mode.road}</p>
        <p><strong>学习重点：</strong>理解理想信念、组织纪律、艰苦奋斗和团结协作在真实地理环境中的形成。</p>
        <p><strong>覆盖区域：</strong>${cities.length ? cities.join("、") : "生成路线后自动汇总城市"}。</p>
      </div>
    `;
  }

  function renderKnowledgeLinks(resources = []) {
    const panel = $("#knowledgeLinkList");

    if (!panel) {
      return;
    }

    const source = resources.length ? resources : state.resources.slice(0, 3);
    const items = source
      .slice(0, 5)
      .map((resource) => {
        const text = `${resource.name}${resource.type}${resource.address}`;
        const event = /遵义|会议|会址/.test(text)
          ? "遵义会议"
          : /泸定|大渡河|桥/.test(text)
            ? "飞夺泸定桥"
            : /雪山|夹金山|草地/.test(text)
              ? "翻越雪山草地"
              : "长征重要节点";
        const spirit = /会议|会址|遵义/.test(text)
          ? "实事求是"
          : /桥|战斗|渡/.test(text)
            ? "英勇斗争"
            : "艰苦奋斗";
        const task = /桥|河|渡/.test(text)
          ? "地形交通观察任务"
          : /馆|纪念/.test(text)
            ? "展陈信息提取任务"
            : "现场复盘讨论任务";

        return `${resource.name} → ${event} → ${spirit} → ${task}`;
      })
      .filter(Boolean);

    panel.innerHTML = items.length
      ? items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")
      : "<span>生成路线或点击资源点后显示关联链。</span>";
  }

  function bindEvents() {
    $("#applyFilterBtn").addEventListener("click", () => {
      loadResources().catch((error) => {
        console.error(error);
        flash("资源筛选失败");
      });
    });

    ["daysSelect", "provinceSelect", "categorySelect"].forEach((id) => {
      const control = $(`#${id}`);
      if (!control) {
        return;
      }
      control.addEventListener("change", () => {
        state.activePreset = "";
        clearRoute();
      });
    });

    $("#themeSelect")?.addEventListener("change", () => {
      state.activeTheme = $("#themeSelect").value || "meeting";
      state.activePreset = "";
      clearRoute();
    });

    $("#travelModeSelect")?.addEventListener("change", () => {
      renderTravelServicePlan(state.currentRoute);
      renderRouteReason(state.currentRoute);
    });

    document.querySelectorAll("[data-map-click-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        updateMapClickMode(button.dataset.mapClickMode);
      });
    });

    $("#selectedRoutePointList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-route-point]");
      if (!button) {
        return;
      }
      removeSelectedRoutePoint(button.dataset.removeRoutePoint);
    });

    $("#clearRoutePointsBtn")?.addEventListener("click", clearSelectedRoutePoints);

    $("#generateRouteBtn").addEventListener("click", () => {
      state.activePreset = "";
      generateRoute().catch((error) => {
        console.error(error);
        showAnalysis(false);
        flash("研学方案生成失败");
      });
    });

    bindRoutePresetCards();
    renderTravelServicePlan();
    renderKnowledgeLinks();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      initMap();
      bindEvents();
      await loadOptions();
      await loadResources();
      updateMapClickMode("detail");
    } catch (error) {
      console.error(error);
      flash("红色研学模块加载失败");
    }
  });
})();
