const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.join(__dirname, "..");

test("agent credentials stay outside tracked source files", () => {
  const agentSource = fs.readFileSync(
    path.join(projectRoot, "features", "agent", "backend", "deepseek-agent.js"),
    "utf8",
  );

  assert.match(agentSource, /process\.env\.DEEPSEEK_API_KEY/);
  assert.doesNotMatch(agentSource, /sk-[A-Za-z0-9_-]{16,}/);
});
