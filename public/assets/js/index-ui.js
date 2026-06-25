(function () {
  let events = [];
  let routeConfigs = [];
  let routePlaying = false;
  let eventPlaying = false;
  let resourcesVisible = false;
  let activeEventIndex = -1;
  let eventTimer = 0;
  let eventTimeline = [];
  let eventTimelineIndex = 0;

  const $ = (selector) => document.querySelector(selector);
  const timelineList = $("#timelineList");
  const toast = $("#toast");

  function flash(message) {
    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
    }, 1600);
  }

  function renderRouteLayers(configs) {
    const container = $("#routeSwitches");

    container.innerHTML = configs
      .map((config) => {
        const checked = config.default_visible ? "checked" : "";

        return `
          <div class="route-layer-item" data-layer-key="${config.layer_key}">
            <label>
              <input type="checkbox" data-route="${config.layer_key}" ${checked}>
              <span class="route-swatch" style="background:${config.color}"></span>
              <b>${config.layer_name}</b>
            </label>
            <div class="route-layer-actions">
              <button data-action="play-route" data-route="${config.layer_key}">播放</button>
              <button data-action="zoom-route" data-route="${config.layer_key}">定位</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderTimeline(items) {
    if (!items.length) {
      timelineList.innerHTML =
        '<div class="loading">当前筛选条件下暂无事件点</div>';
      $("#eventCount").textContent = "0";
      return;
    }

    timelineList.innerHTML = items
      .map((event) => {
        return `
          <button class="timeline-card" data-id="${event.id}">
            <span class="timeline-rail">
              <i></i>
            </span>
            <span class="timeline-card-content">
              <time>${event.date}</time>
              <b>${event.name}</b>
              <small>${event.stage} · ${event.tag}</small>
            </span>
          </button>
        `;
      })
      .join("");

    $("#eventCount").textContent = String(items.length);

    timelineList.querySelectorAll(".timeline-card").forEach((element) => {
      element.addEventListener("click", () => {
        const event = events.find((item) => item.id === element.dataset.id);
        stopEventAnimation();
        selectEvent(event, true);
      });
    });
  }

  function updateTimelineAxis(currentIndex) {
    const cards = Array.from(
      timelineList.querySelectorAll(".timeline-card"),
    );

    cards.forEach((card) => {
      const globalIndex = events.findIndex((event) => {
        return event.id === card.dataset.id;
      });

      card.classList.toggle("completed", globalIndex < currentIndex);
      card.classList.toggle("active", globalIndex === currentIndex);
      card.classList.toggle("upcoming", globalIndex > currentIndex);
    });

    const activeCard = timelineList.querySelector(".timeline-card.active");

    if (activeCard) {
      activeCard.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  function getEventMedia(event) {
    if (event.type === "mountain") {
      return "assets/img/xueshan.jpg";
    }

    if (event.name.includes("遵义")) {
      return "assets/img/zunyi.jpg";
    }

    return "assets/img/red-army-march.jpg";
  }

  function starText(importance) {
    return "★".repeat(importance) + "☆".repeat(5 - importance);
  }

  function updateEventDetail(event) {
    $("#detailEmpty").hidden = true;
    $("#detailContent").hidden = false;
    $("#detailTag").textContent = `${event.tag} · 事件点`;
    $("#detailImportance").textContent = starText(event.importance);
    $("#detailDate").textContent = event.date;
    $("#detailName").textContent = event.name;
    $("#detailLocation").textContent = `${event.stage} · ${event.province}`;
    $("#detailMedia").src = getEventMedia(event);
    $("#detailMedia").alt = `${event.name}图像资料`;
    $("#detailDescription").textContent = event.description;
    $("#detailQuote").textContent = event.quote || "";
    $("#detailCoordinate").textContent =
      `${event.lat.toFixed(3)}° N, ${event.lng.toFixed(3)}° E`;
    $("#detailFigures").innerHTML = event.figures
      .map((figure) => {
        return `
          <div class="detail-figure">
            <b>${figure.value}</b>
            <span>${figure.label}</span>
          </div>
        `;
      })
      .join("");

    $("#detailSceneButton").hidden = !event.name.includes("遵义");
  }

  function updateRouteDetail(route, segment) {
    const properties = segment?.properties || {};

    $("#detailEmpty").hidden = true;
    $("#detailContent").hidden = false;
    $("#detailTag").textContent = "单路线动画 · 按 _order";
    $("#detailImportance").textContent = route.name;
    $("#detailDate").textContent =
      `${properties.start_date || "起始时间未录入"} — ${properties.end_date || "结束时间未录入"}`;
    $("#detailName").textContent =
      `${properties.corps_name || route.name} · 第 ${properties._order ?? "-"} 段`;
    $("#detailLocation").textContent = properties.stage_name || "路线阶段未录入";
    $("#detailMedia").src = "assets/img/red-army-march.jpg";
    $("#detailMedia").alt = "路线行军图像资料";
    $("#detailDescription").textContent =
      properties.descript || properties.descriptio || "该路线段暂无说明字段。";
    $("#detailQuote").textContent =
      "当前为路线动画模式：只按本路线图层自己的 _order 播放，不混入事件日。";
    $("#detailCoordinate").textContent = "WGS84 · 原始 SHP 几何";
    $("#detailFigures").innerHTML = `
      <div class="detail-figure">
        <b>${properties._order ?? "-"}</b>
        <span>_order</span>
      </div>
      <div class="detail-figure">
        <b>${properties.Shape_Leng ?? "-"}</b>
        <span>Shape_Leng</span>
      </div>
      <div class="detail-figure">
        <b>${route.name}</b>
        <span>当前图层</span>
      </div>
      <div class="detail-figure">
        <b>独立播放</b>
        <span>动画模式</span>
      </div>
    `;

    $("#detailSceneButton").hidden = true;
  }

  function selectEvent(event, focusMap = true) {
    if (!event) {
      return;
    }

    activeEventIndex = events.findIndex((item) => item.id === event.id);
    IndexMap.activateEvent(event, focusMap);
    updateTimelineAxis(activeEventIndex);
    updateEventDetail(event);
    $("#currentNode").textContent = `${event.date} · ${event.name}`;
  }

  function stopRouteAnimation() {
    routePlaying = false;
    $("#playBtn").textContent = "继续路线";
    IndexMap.state.animator?.pause();
  }

  function stopEventAnimation() {
    eventPlaying = false;
    clearInterval(eventTimer);
    $("#eventPlayBtn").textContent = "按事件播放";
  }

  function handleRouteProgress(detail) {
    $("#progressRange").value = String(Math.round(detail.progress * 100));
    $("#currentNode").textContent =
      `${detail.route.name} · _order ${detail.segment?.properties?._order ?? "-"}`;

    updateRouteDetail(detail.route, detail.segment);
  }

  function eventIdFromFeature(feature) {
    return `event-${feature.properties?.["\u4e8b\u4ef6\u7f16"]}`;
  }

  async function startEventAnimation() {
    stopRouteAnimation();

    if (!eventTimeline.length) {
      const collection = await DataService.getEventTimeline();
      eventTimeline = collection.features
        .map((feature) => {
          const id = eventIdFromFeature(feature);

          return events.find((event) => {
            return event.id === id;
          });
        })
        .filter(Boolean);
    }

    if (!eventTimeline.length) {
      flash("事件时间轴暂无数据");
      return;
    }

    eventPlaying = true;
    $("#eventPlayBtn").textContent = "暂停事件";

    const playNext = () => {
      const event = eventTimeline[eventTimelineIndex];
      selectEvent(event, true);

      $("#progressRange").value = String(
        Math.round(((eventTimelineIndex + 1) / eventTimeline.length) * 100),
      );

      eventTimelineIndex += 1;

      if (eventTimelineIndex >= eventTimeline.length) {
        stopEventAnimation();
        eventTimelineIndex = 0;
        flash("事件时间轴播放完成");
      }
    };

    playNext();
    eventTimer = setInterval(playNext, 1450);
  }

  document.addEventListener("mapready", (event) => {
    events = event.detail.events;
    routeConfigs = event.detail.routeConfigs;

    renderRouteLayers(routeConfigs);
    renderTimeline(events);
    selectEvent(events[0], false);

    $("#serviceState").textContent =
      `${routeConfigs.length} 条独立路线图层 · ${events.length} 个事件点`;
  });

  document.addEventListener("filterchange", (event) => {
    renderTimeline(event.detail);
    updateTimelineAxis(activeEventIndex);
  });

  document.addEventListener("eventselect", (event) => {
    stopEventAnimation();
    selectEvent(event.detail, true);
  });

  document.addEventListener("routeprogress", (event) => {
    handleRouteProgress(event.detail);
  });

  document.addEventListener("routecomplete", (event) => {
    routePlaying = false;
    $("#playBtn").textContent = "继续路线";
    $("#progressRange").value = "100";
    flash(`${event.detail.name} 播放完成`);
  });

  $("#typeFilters").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-type]");

    if (!button) {
      return;
    }

    $("#typeFilters").querySelectorAll("button").forEach((item) => {
      item.classList.toggle("on", item === button);
    });

    IndexMap.applyFilters();
  });

  $("#stageFilter").addEventListener("change", () => {
    IndexMap.applyFilters();
  });

  $("#playBtn").addEventListener("click", () => {
    if (!IndexMap.state.animator) {
      flash("请先在左侧选择某条路线并点击播放");
      return;
    }

    stopEventAnimation();
    routePlaying = !routePlaying;
    $("#playBtn").textContent = routePlaying ? "暂停路线" : "继续路线";

    if (routePlaying) {
      IndexMap.state.animator.play();
      return;
    }

    IndexMap.state.animator.pause();
  });

  $("#eventPlayBtn").addEventListener("click", () => {
    if (eventPlaying) {
      stopEventAnimation();
      return;
    }

    startEventAnimation().catch((error) => {
      console.error(error);
      flash("事件时间轴播放失败");
    });
  });

  $("#resetBtn").addEventListener("click", () => {
    stopEventAnimation();
    stopRouteAnimation();
    activeEventIndex = -1;
    eventTimelineIndex = 0;
    $("#progressRange").value = "0";
    IndexMap.state.animator?.reset();
    IndexMap.reset();
    selectEvent(events[0], false);
  });

  $("#progressRange").addEventListener("input", (event) => {
    stopEventAnimation();
    IndexMap.state.animator?.seek(Number(event.target.value) / 100);
  });

  $("#speedSelect").addEventListener("change", (event) => {
    IndexMap.state.animator?.setSpeed(event.target.value);
    flash(`路线播放速度已调整为 ${event.target.value}×`);
  });

  $("#resetView").addEventListener("click", () => {
    IndexMap.reset();
  });

  $("#basemapBtn").addEventListener("click", () => {
    $("#basemapMenu").classList.toggle("open");
  });

  $("#basemapMenu").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-map]");

    if (!button) {
      return;
    }

    IndexMap.setBase(button.dataset.map);
    $("#basemapMenu").classList.remove("open");
  });

  $("#resourceToggle").addEventListener("click", () => {
    resourcesVisible = !resourcesVisible;
    $("#resourceToggle").classList.toggle("active", resourcesVisible);
    IndexMap.toggleResources(resourcesVisible);
    flash(resourcesVisible ? "红色资源图层已加载" : "红色资源图层已关闭");
  });

  $("#nodeNav").addEventListener("click", () => {
    $("#timelineList").scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    flash("事件动画使用事件日排序，和路线 _order 分开");
  });

  $("#routeSwitches").addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-route]");

    if (!checkbox) {
      return;
    }

    IndexMap.toggleRoute(checkbox.dataset.route, checkbox.checked);
  });

  $("#routeSwitches").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const layerKey = button.dataset.route;

    if (button.dataset.action === "zoom-route") {
      IndexMap.zoomToRoute(layerKey);
      return;
    }

    stopEventAnimation();
    routePlaying = true;
    $("#playBtn").textContent = "暂停路线";
    $("#progressRange").value = "0";

    IndexMap.playRoute(layerKey).catch((error) => {
      console.error(error);
      routePlaying = false;
      $("#playBtn").textContent = "继续路线";
      flash("路线播放失败");
    });
  });

  $("#detailSceneButton").addEventListener("click", () => {
    location.href = "scene3d.html";
  });
})();
