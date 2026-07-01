(function () {
  const $ = (selector) => document.querySelector(selector);

  function bindControls() {
    $("#scene3dEntry").addEventListener("click", () => {
      window.location.href = "/scene3d.html";
    });

    $("#resetViewBtn").addEventListener("click", () => {
      IndexMap.resetView();
    });

    $("#legendToggleBtn").addEventListener("click", () => {
      $("#mapLegend").classList.toggle("hidden");
    });

    document.querySelectorAll("[data-fold]").forEach((button) => {
      button.addEventListener("click", () => {
        document.getElementById(button.dataset.fold).classList.toggle("open");
      });
    });

    $("#routeLayerList").addEventListener("change", (event) => {
      const input = event.target.closest("input[data-route-layer]");
      if (!input) return;
      IndexMap.toggleRouteLayer(input.dataset.routeLayer, input.checked);
    });

    $("#eventTypeButtons").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-event-type]");
      if (!button) return;
      $("#eventTypeButtons").querySelectorAll("button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      IndexMap.setEventFilter(button.dataset.eventType);
    });

    $("#eventVisibilityBtn").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const visible = button.dataset.eventsVisible !== "true";
      button.dataset.eventsVisible = String(visible);
      button.textContent = visible ? "隐藏事件点" : "显示事件点";
      button.classList.toggle("is-off", !visible);
      IndexMap.setEventLayerVisible(visible);
    });

    $("#playEventsBtn").addEventListener("click", () => {
      IndexMap.playEventsTimeline();
    });

    $("#pauseBtn").addEventListener("click", () => {
      IndexMap.pauseAnimation();
    });

    $("#prevBtn").addEventListener("click", () => {
      IndexMap.playPrevious();
    });

    $("#nextBtn").addEventListener("click", () => {
      IndexMap.playNext();
    });

    $("#playRouteBtn").addEventListener("click", () => {
      IndexMap.playSelectedRoute();
    });

    $("#playAllRoutesBtn").addEventListener("click", () => {
      IndexMap.playAllRoutesChronologically();
    });

    $("#progressRange").addEventListener("input", (event) => {
      IndexMap.seekRouteProgress(event.target.value);
    });

    $("#routeSelect").addEventListener("change", (event) => {
      // 只用于播放，不直接影响事件过滤
    });

    // ★ 新增：诗歌点图层控制
    const poetryToggle = document.getElementById('poetryToggle');
    console.log('poetryToggle 元素:', poetryToggle);  // 调试日志
    
    if (poetryToggle) {
      poetryToggle.addEventListener('click', function() {
        const isVisible = this.dataset.visible === 'true';
        const newVisible = !isVisible;
        this.dataset.visible = String(newVisible);
        this.textContent = newVisible ? '隐藏诗词点' : '显示诗词点';
        this.classList.toggle('is-off', !newVisible);
        
        console.log('切换诗词点:', newVisible);  // 调试日志
        
        // ★ 确保 IndexMap 存在
        if (window.IndexMap && typeof IndexMap.togglePoetryLayer === 'function') {
          IndexMap.togglePoetryLayer(newVisible);
        } else {
          console.error('IndexMap.togglePoetryLayer 不存在');
        }
      });
    } else {
      console.error('找不到 #poetryToggle 元素');
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindControls();
    IndexMap.initApp().catch((error) => {
      console.error(error);
      IndexMap.flash("地图初始化失败");
    });
  });
})();
