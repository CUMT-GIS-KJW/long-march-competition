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

      if (!input) {
        return;
      }

      IndexMap.toggleRouteLayer(input.dataset.routeLayer, input.checked);
    });

    $("#eventTypeButtons").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-event-type]");

      if (!button) {
        return;
      }

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

    $("#resourceLayerList").addEventListener("change", (event) => {
      if (event.target.id === "tourismLayerToggle") {
        if (event.target.checked) {
          IndexMap.state.tourismLayerGroup.addTo(IndexMap.state.map);
          return;
        }

        IndexMap.state.map.removeLayer(IndexMap.state.tourismLayerGroup);
        return;
      }

      if (event.target.matches("input[data-resource-id]")) {
        IndexMap.renderTourismMarkers();
      }
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

    $("#routeSelect").addEventListener("change", (event) => {
      IndexMap.setActiveRouteFilter(event.target.value);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindControls();

    IndexMap.initApp().catch((error) => {
      console.error(error);
      IndexMap.flash("地图初始化失败");
    });
  });
})();
