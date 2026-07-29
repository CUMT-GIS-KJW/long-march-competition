const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const projectRoot = path.join(__dirname, "..");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("core pages keep unique IDs and critical interaction controls", () => {
  const pageContracts = {
    "features/home/frontend/index.html": [
      "map",
      "resetViewBtn",
      "legendToggleBtn",
      "routeLayerList",
      "eventTypeButtons",
      "eventVisibilityBtn",
      "playEventsBtn",
      "pauseBtn",
      "prevBtn",
      "nextBtn",
      "playRouteBtn",
      "playAllRoutesBtn",
      "progressRange",
      "routeSelect",
      "poetryToggle",
      "poetryModal",
    ],
    "features/analysis/frontend/index.html": [
      "analysisMap",
      "toolList",
      "routeSelect",
      "runAnalysis",
      "analysisModal",
    ],
    "features/tourism/frontend/index.html": [
      "tourismMap",
      "applyFilterBtn",
      "provinceSelect",
      "categorySelect",
      "generateRouteBtn",
      "knowledgeGraphModal",
      "agentForm",
    ],
    "features/scene3d/frontend/index.html": [
      "cesiumContainer",
      "terrainExaggeration",
      "measureToggle",
      "clearMeasureBtn",
    ],
  };

  Object.entries(pageContracts).forEach(([relativePath, requiredIds]) => {
    const source = readProjectFile(relativePath);
    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map(
      (match) => match[1],
    );
    const duplicateIds = [...new Set(ids.filter((id, index) => {
      return ids.indexOf(id) !== index;
    }))];

    assert.deepEqual(duplicateIds, [], `${relativePath} has duplicate IDs`);
    requiredIds.forEach((id) => {
      assert.ok(ids.includes(id), `${relativePath} is missing #${id}`);
    });
  });
});

test("home controls keep their click and input behavior", async () => {
  class FakeElement {
    constructor(id) {
      this.id = id;
      this.dataset = {};
      this.textContent = "";
      this.listeners = new Map();
      this.classList = {
        toggle: () => {},
      };
    }

    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }

    dispatch(type, overrides = {}) {
      const handler = this.listeners.get(type);

      handler?.call(this, {
        currentTarget: this,
        target: this,
        ...overrides,
      });
    }

    querySelectorAll() {
      return [];
    }
  }

  const ids = [
    "scene3dEntry",
    "resetViewBtn",
    "legendToggleBtn",
    "mapLegend",
    "routeLayerList",
    "eventTypeButtons",
    "eventVisibilityBtn",
    "playEventsBtn",
    "pauseBtn",
    "prevBtn",
    "nextBtn",
    "playRouteBtn",
    "playAllRoutesBtn",
    "progressRange",
    "routeSelect",
    "poetryToggle",
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
  const documentListeners = new Map();
  const calls = [];
  const indexMap = {
    flash: (value) => calls.push(["flash", value]),
    initApp: async () => calls.push(["initApp"]),
    pauseAnimation: () => calls.push(["pauseAnimation"]),
    playAllRoutesChronologically: () => calls.push(["playAllRoutesChronologically"]),
    playEventsTimeline: () => calls.push(["playEventsTimeline"]),
    playNext: () => calls.push(["playNext"]),
    playPrevious: () => calls.push(["playPrevious"]),
    playSelectedRoute: () => calls.push(["playSelectedRoute"]),
    resetView: () => calls.push(["resetView"]),
    seekRouteProgress: (value) => calls.push(["seekRouteProgress", value]),
    setEventFilter: (value) => calls.push(["setEventFilter", value]),
    setEventLayerVisible: (value) => calls.push(["setEventLayerVisible", value]),
    togglePoetryLayer: (value) => calls.push(["togglePoetryLayer", value]),
    toggleRouteLayer: async (key, visible) => {
      calls.push(["toggleRouteLayer", key, visible]);
    },
  };
  const document = {
    addEventListener: (type, handler) => documentListeners.set(type, handler),
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      return selector.startsWith("#") ? elements.get(selector.slice(1)) || null : null;
    },
    querySelectorAll: () => [],
  };
  const window = {
    DomUtils: {
      query: document.querySelector,
    },
    IndexMap: indexMap,
    location: {
      href: "",
    },
  };

  vm.runInNewContext(readProjectFile("features/home/frontend/home-ui.js"), {
    console,
    document,
    IndexMap: indexMap,
    window,
  });
  documentListeners.get("DOMContentLoaded")();
  await Promise.resolve();

  elements.get("resetViewBtn").dispatch("click");
  elements.get("playEventsBtn").dispatch("click");
  elements.get("pauseBtn").dispatch("click");
  elements.get("prevBtn").dispatch("click");
  elements.get("nextBtn").dispatch("click");
  elements.get("playRouteBtn").dispatch("click");
  elements.get("playAllRoutesBtn").dispatch("click");
  elements.get("progressRange").dispatch("input", {
    target: { value: "42" },
  });
  elements.get("eventVisibilityBtn").dispatch("click");
  elements.get("poetryToggle").dispatch("click");
  elements.get("routeLayerList").dispatch("change", {
    target: {
      checked: true,
      closest: () => ({
        checked: true,
        dataset: { routeLayer: "route_test" },
      }),
    },
  });
  await Promise.resolve();

  [
    ["initApp"],
    ["resetView"],
    ["playEventsTimeline"],
    ["pauseAnimation"],
    ["playPrevious"],
    ["playNext"],
    ["playSelectedRoute"],
    ["playAllRoutesChronologically"],
    ["seekRouteProgress", "42"],
    ["setEventLayerVisible", true],
    ["togglePoetryLayer", true],
    ["toggleRouteLayer", "route_test", true],
  ].forEach((expectedCall) => {
    assert.ok(
      calls.some((call) => {
        return JSON.stringify(call) === JSON.stringify(expectedCall);
      }),
      `missing call ${JSON.stringify(expectedCall)}`,
    );
  });
});

test("tourism marker selection keeps incremental updates", () => {
  const source = readProjectFile("features/tourism/frontend/tourism.js");

  assert.match(source, /function updateResourceMarker\(id\)/);
  assert.match(source, /marker\.setIcon\(createResourceIcon/);
  assert.match(source, /updateResourceMarker\(resource\.id\)/);
  assert.doesNotMatch(source, /function rerenderCurrentMarkers/);
});
