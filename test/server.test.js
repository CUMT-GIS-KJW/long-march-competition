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
    "/",
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

test("static validators respect ETag precedence, lists and wildcard matching", async () => {
  const url = `${baseUrl}/features/shared/frontend/app.css`;
  const first = await fetch(url, { method: "HEAD" });
  const etag = first.headers.get("etag");
  for (const value of [`"other", ${etag}`, "*", etag.replace(/^W\//, "")]) {
    const response = await fetch(url, { headers: { "if-none-match": value } });
    assert.equal(response.status, 304);
    assert.equal(response.headers.get("vary"), "Accept-Encoding");
  }
  const changed = await fetch(url, { headers: {
    "if-none-match": '"stale"',
    "if-modified-since": first.headers.get("last-modified"),
  } });
  assert.equal(changed.status, 200);
  await changed.arrayBuffer();
});

test("static and API responses honor disabled compression", async () => {
  for (const path of ["/features/shared/frontend/app.css", "/api/route-layers/route_hongyi_juntuan/features"]) {
    const response = await fetch(baseUrl + path, { headers: {
      "accept-encoding": "br;q=0, gzip;q=0",
    } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-encoding"), null);
    assert.equal(response.headers.get("vary"), "Accept-Encoding");
    assert.ok((await response.text()).length > 1024);
  }
});

test("static HEAD returns metadata without a body and rejects POST", async () => {
  const url = `${baseUrl}/features/shared/frontend/app.css`;
  const head = await fetch(url, { method: "HEAD", headers: { "accept-encoding": "identity" } });
  assert.equal(head.status, 200);
  assert.ok(Number(head.headers.get("content-length")) > 1024);
  assert.equal(await head.text(), "");
  const post = await fetch(url, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET, HEAD, OPTIONS");
  await post.text();
});
