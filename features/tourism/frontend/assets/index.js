const { URL } = require("url");
const { readDataFile } = require("../../shared/backend/data-store");

const SCHOOL = {
  name: "中国矿业大学（南湖校区）",
  province: "江苏省",
  city: "徐州市",
  lng: 117.145,
  lat: 34.216,
};

const FIELD = {
  place: "\u5730\u540d",
  event: "\u4e8b\u4ef6",
  date: "\u4e8b\u4ef6\u65e5",
  type: "\u4e8b\u4ef6\u7c7b",
  unit: "\u5173\u8054\u90e8",
  people: "\u961f\u4f0d\u603b",
};

const themes = [
  {
    value: "meeting",
    label: "长征转折会议主题",
    animated: true,
    keywords: ["会议", "会址", "转折", "泸定桥", "飞夺", "纪念馆", "红军"],
  },
  {
    value: "river",
    label: "渡江战斗主题",
    animated: false,
    keywords: ["渡", "江", "河", "桥", "战斗", "战役", "泸定"],
  },
  {
    value: "mountain",
    label: "雪山草地主题",
    animated: false,
    keywords: ["雪山", "草地", "冰川", "夹金山", "草原", "会师"],
  },
  {
    value: "museum",
    label: "纪念馆研学主题",
    animated: false,
    keywords: ["纪念馆", "博物馆", "纪念园", "展览馆", "旧址"],
  },
];

const palette = [
  "#F25F5C",
  "#FFB347",
  "#4DB6AC",
  "#7AC77B",
  "#5DADEC",
  "#B58BD5",
  "#F49AC2",
  "#F4D35E",
  "#9C89B8",
  "#F28482",
];

function getQuery(request) {
  return new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  ).searchParams;
}

function normalize(value) {
  return String(value || "").trim();
}

function categoryOf(resource) {
  const text = `${resource.name || ""} ${resource.type || ""} ${resource.address || ""}`;

  if (/纪念馆|博物馆|展览馆|纪念园/.test(text)) {
    return "museum";
  }

  if (/会址|旧址|遗址|故居|住居|纪念地/.test(text)) {
    return "site";
  }

  if (/景区|风景|景点|公园|桥|关/.test(text)) {
    return "scenic";
  }

  return "other";
}

function loadResources() {
  const seenIds = new Map();

  return readDataFile("resources.json")
    .map((resource, index) => {
      const cleanName = normalize(resource.name)
        .replace(/[（(]\s*暂停开放\s*[）)]/g, "")
        .replace(/暂停开放/g, "")
        .trim();
      const sourceId = resource.id || `tourism_${index + 1}`;
      const idCount = (seenIds.get(sourceId) || 0) + 1;
      seenIds.set(sourceId, idCount);

      return {
        ...resource,
        id: idCount === 1 ? sourceId : `${sourceId}_${idCount}`,
        sourceId,
        name: cleanName,
        lng: Number(resource.lng),
        lat: Number(resource.lat),
        province: resource.pname || resource.province || "",
        city: resource.cityname || resource.city || "",
        category: resource.category || categoryOf(resource),
      };
    })
    .filter((resource) => {
      return (
        resource.name &&
        Number.isFinite(resource.lng) &&
        Number.isFinite(resource.lat)
      );
    });
}

function loadEvents() {
  return readDataFile("events-important.json").features || [];
}

function filterResources(resources, query) {
  const province = normalize(query.get("province"));
  const category = normalize(query.get("category"));
  const keyword = normalize(query.get("keyword"));

  return resources.filter((resource) => {
    if (province && resource.province !== province) {
      return false;
    }

    if (category && category !== "all" && resource.category !== category) {
      return false;
    }

    if (keyword) {
      const text = `${resource.name} ${resource.address || ""} ${resource.type || ""} ${resource.city}`;

      return text.includes(keyword);
    }

    return true;
  });
}

function buildOptions(resources) {
  const provinces = [...new Set(resources.map((item) => item.province).filter(Boolean))].sort();
  const cities = [...new Set(resources.map((item) => item.city).filter(Boolean))].sort();

  return {
    school: SCHOOL,
    provinces,
    cities,
    categories: [
      { value: "all", label: "全部资源" },
      { value: "site", label: "革命旧址/遗址" },
      { value: "museum", label: "纪念馆/博物馆" },
      { value: "scenic", label: "红色景区" },
      { value: "other", label: "其他资源" },
    ],
    themes,
  };
}

function themeByValue(value) {
  return themes.find((theme) => theme.value === value) || themes[0];
}

function scoreForTheme(resource, theme, citySet) {
  const text = `${resource.name} ${resource.address || ""} ${resource.type || ""}`;
  let score = 0;

  if (citySet.has(resource.city)) {
    score += 90;
  }

  if (resource.city.includes("甘孜")) {
    score += theme.value === "meeting" ? 80 : 35;
  }

  if (resource.featured) {
    score += 30;
  }

  theme.keywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 24;
    }
  });

  if (/泸定桥|飞夺泸定桥|红军飞夺泸定桥纪念馆/.test(resource.name)) {
    score += theme.value === "meeting" ? 120 : 45;
  }

  if (/海螺沟|冰川|磨西/.test(resource.name)) {
    score += theme.value === "meeting" ? 42 : 24;
  }

  return score;
}

function uniqueByName(resources) {
  const seen = new Set();
  const result = [];

  resources.forEach((resource) => {
    if (seen.has(resource.name)) {
      return;
    }

    seen.add(resource.name);
    result.push(resource);
  });

  return result;
}

function chooseRouteProvince(resources, theme, requestedProvince) {
  if (requestedProvince) {
    return requestedProvince;
  }

  const preferredProvinceScore = {
    四川省: theme.value === "meeting" || theme.value === "mountain" ? 320 : 180,
    贵州省: theme.value === "meeting" ? 180 : 120,
    江西省: 120,
    陕西省: 90,
    甘肃省: 80,
  };
  const grouped = new Map();

  resources.forEach((resource) => {
    if (!resource.province) {
      return;
    }

    if (!grouped.has(resource.province)) {
      grouped.set(resource.province, []);
    }

    grouped.get(resource.province).push(resource);
  });

  const candidates = [...grouped.entries()].map(([province, items]) => {
    let score = preferredProvinceScore[province] || 0;

    items.forEach((resource) => {
      const text = `${resource.name || ""} ${resource.city || ""} ${resource.type || ""} ${resource.address || ""}`;

      score += 1 + (resource.featured ? 10 : 0);

      theme.keywords.forEach((keyword) => {
        if (text.includes(keyword)) {
          score += 4;
        }
      });

      if (/甘孜|雅安|阿坝|泸定|夹金山|大渡河|海螺沟/.test(text)) {
        score += theme.value === "meeting" || theme.value === "mountain" ? 30 : 12;
      }

      if (/泸定桥|飞夺泸定桥|红军飞夺泸定桥纪念馆/.test(text)) {
        score += 80;
      }
    });

    return { province, score };
  });

  return candidates.sort((left, right) => right.score - left.score)[0]?.province || "";
}

function distanceToCitySet(resource, citySet, centroids) {
  const targetCities = centroids.filter((city) => citySet.has(city.city));

  if (!targetCities.length) {
    return 0;
  }

  return Math.min(...targetCities.map((city) => distanceKm(resource, city)));
}


function parseSelectedResourceIds(query) {
  return normalize(query.get("points") || query.get("resourceIds"))
    .split(",")
    .map((item) => decodeURIComponent(item).trim())
    .filter(Boolean);
}

function normalizedRouteDays(value) {
  const day = Number(value || 3);
  const allowed = [1, 2, 3, 5, 7];

  return allowed.includes(day) ? day : 3;
}

function targetCountForDays(days, selectedCount = 0) {
  // 天数越长，系统自动补充的研学点越多；用户自选点不会被强行删减。
  const base = {
    1: 4,
    2: 6,
    3: 8,
    5: 13,
    7: 18,
  }[days] || Math.min(20, days + 6);

  return Math.max(base, selectedCount);
}

function provinceSummary(resources, fallback = "") {
  const provinces = [...new Set((resources || []).map((resource) => resource.province).filter(Boolean))];

  if (!provinces.length) {
    return fallback || "自动匹配";
  }

  if (provinces.length === 1) {
    return provinces[0];
  }

  return `多省联动（${provinces.slice(0, 3).join("、")}${provinces.length > 3 ? "等" : ""}）`;
}

function nearestDistanceToResources(resource, anchors) {
  const validAnchors = (anchors || []).filter((item) => item && item.id !== resource.id);

  if (!validAnchors.length) {
    return 0;
  }

  return Math.min(...validAnchors.map((anchor) => distanceKm(resource, anchor)));
}

function dominantProvince(resources) {
  const counts = new Map();

  resources.forEach((resource) => {
    if (!resource.province) {
      return;
    }

    counts.set(resource.province, (counts.get(resource.province) || 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "";
}

function chooseResources(resources, query) {
  const theme = themeByValue(query.get("theme"));
  const days = normalizedRouteDays(query.get("days"));
  const requestedProvince = normalize(query.get("province"));
  const selectedIds = parseSelectedResourceIds(query);
  const selectedById = uniqueByName(
    selectedIds
      .map((id) => resources.find((resource) => resource.id === id || resource.sourceId === id))
      .filter(Boolean),
  );
  const hasCustomSelection = selectedById.length > 0;

  // 自选纪念点时允许跨省组合；没有自选点时仍按省份/主题自动推荐。
  const autoProvince = requestedProvince || chooseRouteProvince(resources, theme, requestedProvince);
  const routePool = hasCustomSelection
    ? resources
    : autoProvince
      ? resources.filter((resource) => resource.province === autoProvince)
      : resources;

  const anchorPool = hasCustomSelection ? selectedById : routePool;
  const autoCities = chooseCities(routePool, theme, days, hasCustomSelection ? "" : autoProvince);
  const citySet = new Set([
    ...autoCities,
    ...selectedById.map((resource) => resource.city).filter(Boolean),
  ]);
  const cityCenters = cityCentroids(routePool);
  const targetCount = targetCountForDays(days, selectedById.length);

  const candidates = routePool
    .filter((resource) => !selectedById.some((selected) => selected.name === resource.name))
    .map((resource) => {
      const themeScore = scoreForTheme(resource, theme, citySet);
      const cityDistancePenalty = distanceToCitySet(resource, citySet, cityCenters) * 0.45;
      const anchorDistancePenalty = hasCustomSelection ? nearestDistanceToResources(resource, anchorPool) * 0.55 : 0;
      const sameProvinceBonus = hasCustomSelection && selectedById.some((item) => item.province === resource.province) ? 60 : 0;

      return {
        ...resource,
        score: themeScore + sameProvinceBonus + (resource.featured ? 20 : 0) - cityDistancePenalty - anchorDistancePenalty,
      };
    })
    .filter((resource) => {
      return hasCustomSelection || resource.score > 0 || citySet.has(resource.city) || resource.featured;
    })
    .sort((left, right) => right.score - left.score);

  let selected = hasCustomSelection
    ? uniqueByName(selectedById)
    : uniqueByName(candidates).slice(0, targetCount);

  if (!hasCustomSelection && theme.value === "meeting") {
    const mustNames = [
      "海螺沟冰川森林公园",
      "泸定县纪念碑公园",
      "泸定桥",
      "红军飞夺泸定桥纪念馆",
      "飞夺泸定桥炮兵阵地旧址",
    ];
    const must = mustNames
      .map((name) => routePool.find((resource) => resource.name.includes(name)))
      .filter(Boolean);

    selected = uniqueByName([...must, ...selected]).slice(0, targetCount);
  }

  if (selected.length < targetCount) {
    const fallbackCandidates = resources
      .filter((resource) => !selected.some((item) => item.name === resource.name))
      .map((resource) => {
        const themeScore = scoreForTheme(resource, theme, citySet);
        const sameProvinceBonus = selected.some((item) => item.province && item.province === resource.province) ? 50 : 0;
        const anchorPenalty = selected.length ? nearestDistanceToResources(resource, selected) * 0.35 : 0;

        return {
          ...resource,
          score: themeScore + sameProvinceBonus + (resource.featured ? 35 : 0) - anchorPenalty,
        };
      })
      .sort((left, right) => right.score - left.score);

    selected = uniqueByName([
      ...selected,
      ...candidates,
      ...fallbackCandidates,
    ]).slice(0, targetCount);
  }

  selected = orderByNearest(selected);

  const finalCities = [...new Set(selected.map((resource) => resource.city).filter(Boolean))];
  const finalProvince = hasCustomSelection
    ? provinceSummary(selected, requestedProvince || autoProvince)
    : autoProvince;

  return {
    days,
    theme,
    province: finalProvince,
    selectedCities: finalCities.length ? finalCities.slice(0, Math.max(1, Math.min(6, days))) : autoCities,
    resources: selected,
    customSelected: hasCustomSelection,
    selectedPointCount: selectedById.length,
    autoAddedCount: Math.max(0, selected.length - selectedById.length),
  };
}

function orderByNearest(resources) {
  if (resources.length <= 2) {
    return resources;
  }

  const remaining = [...resources];
  const startIndex = remaining.reduce((bestIndex, resource, index) => {
    if (index === 0) {
      return index;
    }

    const best = remaining[bestIndex];

    if (resource.lng < best.lng) {
      return index;
    }

    if (resource.lng === best.lng && resource.lat < best.lat) {
      return index;
    }

    return bestIndex;
  }, 0);
  const ordered = [remaining.splice(startIndex, 1)[0]];

  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    const nextIndex = remaining.reduce((bestIndex, resource, index) => {
      const best = remaining[bestIndex];

      return distanceKm(current, resource) < distanceKm(current, best)
        ? index
        : bestIndex;
    }, 0);

    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
}

function cityCentroids(resources) {
  const grouped = new Map();

  resources.forEach((resource) => {
    if (!resource.city) {
      return;
    }

    if (!grouped.has(resource.city)) {
      grouped.set(resource.city, []);
    }

    grouped.get(resource.city).push(resource);
  });

  return [...grouped.entries()].map(([city, items]) => {
    return {
      city,
      province: items[0].province,
      lat: items.reduce((sum, item) => sum + item.lat, 0) / items.length,
      lng: items.reduce((sum, item) => sum + item.lng, 0) / items.length,
      count: items.length,
    };
  });
}

function chooseCities(resources, theme, days, province) {
  const needed = days <= 2 ? 1 : days <= 3 ? 2 : days <= 5 ? 3 : 4;
  const centroids = cityCentroids(
    province
      ? resources.filter((resource) => resource.province === province)
      : resources,
  );
  const anchor =
    centroids.find((item) => item.city === "甘孜藏族自治州") ||
    centroids.find((item) => item.city === "雅安市") ||
    centroids[0];

  if (!anchor) {
    return ["甘孜藏族自治州"];
  }

  const preferred = ["甘孜藏族自治州", "雅安市", "阿坝藏族羌族自治州", "凉山彝族自治州", "遵义市"];

  return centroids
    .map((city) => {
      const distance = distanceKm(anchor, city);
      const preferredScore = preferred.includes(city.city) ? 220 - preferred.indexOf(city.city) * 18 : 0;
      const themeScore =
        theme.value === "meeting" && city.city === "甘孜藏族自治州"
          ? 220
          : 0;

      return {
        ...city,
        distance,
        score: preferredScore + themeScore + city.count * 2 - distance * 0.72,
      };
    })
    .filter((city, index) => index === 0 || city.distance <= 180 || needed === 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, needed)
    .map((item) => item.city);
}

function distanceKm(left, right) {
  const radius = 6371;
  const lat1 = (Number(left.lat) * Math.PI) / 180;
  const lat2 = (Number(right.lat) * Math.PI) / 180;
  const dLat = ((Number(right.lat) - Number(left.lat)) * Math.PI) / 180;
  const dLng = ((Number(right.lng) - Number(left.lng)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function splitByDays(resources, days) {
  const result = [];
  const total = resources.length;

  if (!total) {
    return result;
  }

  const actualDays = Math.max(1, days);
  const baseCount = Math.floor(total / actualDays);
  const remainder = total % actualDays;
  let cursor = 0;
  let previousEnd = null;

  for (let day = 1; day <= actualDays; day += 1) {
    let count = baseCount + (day <= remainder ? 1 : 0);

    // 极端情况下点位少于天数，也要保证每天有展示内容；优先复用上一日终点作为当天任务点。
    if (count <= 0) {
      count = cursor < total ? 1 : 0;
    }

    const dayVisits = resources.slice(cursor, Math.min(total, cursor + count));
    cursor += dayVisits.length;

    let items = dayVisits;
    let sharedStart = false;

    if (day > 1) {
      sharedStart = true;
      items = [previousEnd || resources[Math.max(0, cursor - 1)], ...dayVisits];
    }

    if (!items.length) {
      items = [previousEnd || resources[total - 1]];
    }

    previousEnd = dayVisits[dayVisits.length - 1] || items[items.length - 1] || previousEnd;

    result.push({
      day,
      title: `第 ${day} 天`,
      color: palette[(day - 1) % palette.length],
      height: [0.42, 0.58, 0.72, 0.86, 1.0, 1.14, 1.28][day - 1] || 0.72,
      resources: items,
      sharedStart,
    });
  }

  return result;
}

function minutesToClock(minutes) {
  const normalized = Math.max(0, Math.round(minutes));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function visitMinutes(resource, isFirstActual) {
  const text = `${resource.name || ""}${resource.type || ""}`;

  if (isFirstActual) {
    return 45;
  }

  if (/纪念馆|博物馆|展览馆|陈列馆/.test(text)) {
    return 70;
  }

  if (/会址|旧址|遗址|故居|战役|指挥部/.test(text)) {
    return 58;
  }

  if (/桥|渡|江|河|山|景区|公园|广场/.test(text)) {
    return 48;
  }

  return 52;
}

function travelMinutesByDistance(distance) {
  if (!Number.isFinite(distance)) {
    return 20;
  }

  // 近距离点位按步行/短驳处理，长距离点位按大巴移动处理。
  if (distance < 1.2) {
    return clamp(Math.round(distance * 18) + 8, 8, 25);
  }

  if (distance < 8) {
    return clamp(Math.round(distance * 6) + 10, 15, 55);
  }

  return clamp(Math.round(distance * 1.45) + 20, 35, 120);
}

function buildSchedule(dayGroups) {
  return dayGroups.map((group) => {
    const first = group.resources[0];
    const last = group.resources[group.resources.length - 1] || first;
    let currentMinute = 9 * 60;
    let actualIndex = 0;
    let previousActual = null;

    return {
      day: group.day,
      title: `${group.title}：${first?.city || "目的地"}现场研学`,
      from: first?.name || "集合点",
      to: last?.name || "总结点",
      color: group.color,
      height: group.height,
      sharedStart: group.sharedStart,
      items: group.resources.map((resource, index) => {
        const isSharedStart = group.sharedStart && index === 0;

        if (isSharedStart) {
          previousActual = resource;

          return {
            time: "承接",
            place: resource.name,
            city: resource.city,
            province: resource.province,
            sharedStart: true,
            activity: `从上一日终点 ${resource.name} 集合出发，不再单独安排参观时间，直接进入当日下一站。`,
          };
        }

        let travelDistance = 0;
        let travelMinutes = 0;

        if (previousActual) {
          travelDistance = distanceKm(previousActual, resource);
          travelMinutes = travelMinutesByDistance(travelDistance);
          currentMinute += travelMinutes;
        }

        const time = minutesToClock(currentMinute);
        const isFirstActual = actualIndex === 0 && !group.sharedStart;
        const stayMinutes = visitMinutes(resource, isFirstActual);
        currentMinute += stayMinutes;
        previousActual = resource;
        actualIndex += 1;

        return {
          time,
          place: resource.name,
          city: resource.city,
          province: resource.province,
          sharedStart: false,
          travelDistanceKm: Math.round(travelDistance * 10) / 10,
          travelMinutes,
          activity: `${travelMinutes ? `上一站约 ${Math.round(travelDistance * 10) / 10} km，预计 ${travelMinutes} 分钟衔接；` : ""}${buildActivity(resource, index)}建议停留约 ${stayMinutes} 分钟。`,
        };
      }),
    };
  });
}

function buildActivity(resource, index) {
  if (index === 0) {
    return `抵达${resource.name}，完成研学导入、任务卡发放和安全提示。`;
  }

  if (/纪念馆|博物馆|纪念园/.test(resource.name + resource.type)) {
    return "参观展陈，记录人物、时间、地点和长征精神关键词。";
  }

  if (/桥|渡|江|河/.test(resource.name)) {
    return "开展地形交通观察，讨论渡河、桥梁和行军决策。";
  }

  return "现场参观与小组讨论，补充绘制研学路线观察图。";
}

function buildWeather(theme, cities) {
  const city = cities[0] || "甘孜藏族自治州";

  if (theme.value === "mountain") {
    return {
      city,
      summary: "高原及山地天气多变，早晚温差明显。",
      temperature: "10-22℃",
      advice: "建议携带外套、防滑鞋、雨具和常用药品。",
    };
  }

  return {
    city,
    summary: "多云间晴，适合红色景区和纪念馆组合研学。",
    temperature: "16-28℃",
    advice: "建议提前预约重点场馆，户外点位注意补水与防晒。",
  };
}

function buildDining(cities) {
  const cityText = cities.join("、");

  if (cityText.includes("甘孜")) {
    return "建议在泸定县城或景区周边安排团餐，午餐控制在 60 分钟内，注意高原地区补水。";
  }

  if (cityText.includes("遵义")) {
    return "建议安排遵义羊肉粉、豆花面等地方简餐，结合遵义会议故事做餐前微课堂。";
  }

  return "建议选择正规团餐点，避开景区高峰时段，保证下午现场教学时间。";
}

function relatedEvents(resources, events) {
  const cityText = resources.map((resource) => resource.city).join(" ");
  const nameText = resources.map((resource) => resource.name).join(" ");

  return events
    .map((feature) => {
      const props = feature.properties || {};
      const text = `${props[FIELD.place] || ""} ${props[FIELD.event] || ""} ${props[FIELD.type] || ""}`;
      const hit =
        text.includes("泸定") ||
        text.includes("大渡河") ||
        text.includes("飞夺") ||
        cityText.includes(props[FIELD.place]) ||
        nameText.includes(props[FIELD.place]);

      return {
        hit,
        name: props[FIELD.place] || "长征事件",
        date: props[FIELD.date] || "",
        type: props[FIELD.type] || "历史事件",
        event: props[FIELD.event] || "",
        unit: props[FIELD.unit] || "",
        people: Number(props[FIELD.people] || 0),
      };
    })
    .filter((item) => item.hit)
    .slice(0, 8);
}

function chartData(resources, events) {
  const categories = {};
  const cities = {};
  const words = {};

  resources.forEach((resource) => {
    categories[resource.category] = (categories[resource.category] || 0) + 1;
    cities[resource.city] = (cities[resource.city] || 0) + 1;

    ["红军", "泸定桥", "纪念馆", "会址", "战斗", "研学", "雪山", "草地"].forEach((word) => {
      if (`${resource.name}${resource.type}`.includes(word)) {
        words[word] = (words[word] || 0) + 1;
      }
    });
  });

  return {
    categories,
    cities: Object.fromEntries(
      Object.entries(cities)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8),
    ),
    words,
    palette,
  };
}

function buildStudyRoute(resources, events, query) {
  const choice = chooseResources(resources, query);
  const groups = splitByDays(choice.resources, choice.days);
  const distance = choice.resources.slice(1).reduce((sum, resource, index) => {
    return sum + distanceKm(choice.resources[index], resource);
  }, 0);
  const related = relatedEvents(choice.resources, events);

  return {
    title: `${choice.province || "单省"} · ${choice.selectedCities.join("、")} ${choice.days} 天${choice.theme.label}${choice.customSelected ? "（自选纪念点）" : ""}研学方案`,
    school: SCHOOL,
    days: choice.days,
    theme: choice.theme,
    province: choice.province,
    selectedCities: choice.selectedCities,
    selectedPointCount: choice.selectedPointCount || 0,
    autoAddedCount: choice.autoAddedCount || 0,
    showRoute: true,
    transport: choice.customSelected
      ? "徐州出发：根据自选纪念点智能组合高铁/飞机/大巴衔接；同城点位以步行和短驳车串联，跨城点位按距离分天安排。"
      : "徐州出发：高铁/飞机抵达目的地城市，再乘大巴进入研学点位，市内以步行和短驳车衔接。",
    dining: buildDining(choice.selectedCities),
    weather: buildWeather(choice.theme, choice.selectedCities),
    totalDistanceKm: Math.round(distance),
    resources: choice.resources,
    dayGroups: groups,
    provinceResources: resources.filter((resource) => {
      return choice.resources.some((item) => item.province === resource.province);
    }),
    schedule: buildSchedule(groups),
    relatedEvents: related,
    charts: chartData(choice.resources, related),
  };
}

function handleResources({ request, response, sendSuccess }) {
  const query = getQuery(request);
  const resources = filterResources(loadResources(), query);
  const events = loadEvents();

  sendSuccess(response, {
    resources,
    total: resources.length,
    charts: chartData(resources, events),
  });

  return true;
}

function handleOptions({ response, sendSuccess }) {
  sendSuccess(response, buildOptions(loadResources()));

  return true;
}

function handleStudyRoute({ request, response, sendSuccess }) {
  const query = getQuery(request);

  sendSuccess(response, buildStudyRoute(loadResources(), loadEvents(), query));

  return true;
}

function handleApi(context) {
  if (context.pathname === "/api/tourism/resources") {
    return handleResources(context);
  }

  if (context.pathname === "/api/tourism/options") {
    return handleOptions(context);
  }

  if (context.pathname === "/api/tourism/study-route") {
    return handleStudyRoute(context);
  }

  return false;
}

module.exports = {
  handleApi,
};
