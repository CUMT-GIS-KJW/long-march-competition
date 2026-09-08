const test = require("node:test");
const assert = require("node:assert/strict");
const { acceptedEncoding } = require("../features/shared/backend/content-encoding");

test("compression respects quality preferences and explicit exclusions", () => {
  for (const [header, expected] of [
    ["", ""],
    ["gzip, br", "br"],
    ["br;q=0, gzip;q=0.5", "gzip"],
    ["br;q=0.3, gzip;q=0.8", "gzip"],
    ["br;q=0, gzip;q=0", ""],
    ["*;q=1, br;q=0", "gzip"],
    ["gzip;q=0.5, identity;q=1", ""],
    ["gzip;q=invalid", ""],
  ]) assert.equal(acceptedEncoding(header), expected, header);
});
