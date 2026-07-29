const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server/app");

let server;
let baseUrl;

test.before(async () => {
  server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("core pages and APIs remain available", async () => {
  const paths = [
    "/api/health",
    "/login.html",
    "/index.html",
    "/analysis.html",
    "/scene3d.html",
    "/tourism.html",
    "/api/events/timeline",
    "/api/analysis/summary",
    "/api/poetry-content",
  ];

  const responses = await Promise.all(paths.map((pathname) => fetch(baseUrl + pathname)));
  responses.forEach((response, index) => {
    assert.equal(response.status, 200, paths[index]);
  });
});

test("static resources support validation caching", async () => {
  const first = await fetch(
    `${baseUrl}/features/shared/frontend/app.css`,
    { headers: { "accept-encoding": "identity" } },
  );
  assert.equal(first.status, 200);
  assert.notEqual(first.headers.get("cache-control"), "no-store");
  const etag = first.headers.get("etag");
  assert.ok(etag);

  const second = await fetch(
    `${baseUrl}/features/shared/frontend/app.css`,
    { headers: { "if-none-match": etag } },
  );
  assert.equal(second.status, 304);

  const compressed = await fetch(
    `${baseUrl}/features/shared/frontend/app.css`,
    { headers: { "accept-encoding": "gzip" } },
  );
  assert.equal(compressed.status, 200);
  assert.equal(compressed.headers.get("content-encoding"), "gzip");
  assert.ok((await compressed.text()).length > 1000);
});

test("large route API responses are compressed and preserve their schema", async () => {
  const response = await fetch(
    `${baseUrl}/api/route-layers/route_hongyi_juntuan/features`,
    { headers: { "accept-encoding": "gzip" } },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-encoding"), "gzip");

  const payload = await response.json();
  assert.equal(payload.code, 200);
  assert.equal(payload.data.type, "FeatureCollection");
  assert.ok(payload.data.features.length > 0);
});

test("malformed request paths return 400 without stopping the server", async () => {
  const malformed = await fetch(`${baseUrl}/assets/%E0%A4%A`);
  assert.equal(malformed.status, 400);

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
});
