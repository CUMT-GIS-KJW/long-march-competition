const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.join(__dirname, "..");
const routeRoot = path.join(projectRoot, "data", "routes");

test("every configured route points to a valid FeatureCollection", () => {
  const configs = JSON.parse(
    fs.readFileSync(path.join(routeRoot, "route-layer-config.json"), "utf8"),
  );

  assert.ok(configs.length > 0);
  configs.forEach((config) => {
    const routePath = path.join(
      routeRoot,
      "route-layers",
      `${config.table_name}.json`,
    );
    assert.ok(fs.existsSync(routePath), routePath);

    const collection = JSON.parse(fs.readFileSync(routePath, "utf8"));
    assert.equal(collection.type, "FeatureCollection");
    assert.ok(Array.isArray(collection.features));
    assert.ok(collection.features.length > 0, routePath);
  });
});

test("display-sized image variants remain substantially smaller", () => {
  const pairs = [
    {
      source: "assets/images/home-poster/logal.png",
      display: "assets/images/home-poster/logal-display.png",
      maxRatio: 0.2,
    },
    {
      source: "assets/images/cpc-party-flag.png",
      display: "assets/images/cpc-party-flag-display.png",
      maxRatio: 0.2,
    },
    {
      source: "assets/images/home/map-background.png",
      display: "assets/images/home/map-background-display.jpg",
      maxRatio: 0.2,
    },
    {
      source: "assets/images/poetry/source-bg.jpg",
      display: "assets/images/poetry/source-bg-display.jpg",
      maxRatio: 0.5,
    },
    {
      source: "assets/images/poetry/location.png",
      display: "assets/images/poetry/location-display.png",
      maxRatio: 0.05,
    },
    {
      source: "assets/images/poetry/VCG211611345420.jpg",
      display: "assets/images/poetry/VCG211611345420-display.jpg",
      maxRatio: 0.35,
    },
    {
      source: "assets/images/poetry/VCG211444428325.jpg",
      display: "assets/images/poetry/VCG211444428325-display.jpg",
      maxRatio: 0.35,
    },
  ];

  pairs.forEach(({ source, display, maxRatio }) => {
    const sourceSize = fs.statSync(path.join(projectRoot, source)).size;
    const displaySize = fs.statSync(path.join(projectRoot, display)).size;
    assert.ok(displaySize < sourceSize * maxRatio, display);
  });
});
