const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const projectRoot = path.join(__dirname, "..");

function readProjectFile(...parts) {
  return fs.readFileSync(path.join(projectRoot, ...parts), "utf8");
}

test("DeepSeek credentials stay on the server", () => {
  const agentSource = readProjectFile(
    "features",
    "agent",
    "backend",
    "deepseek-agent.js",
  );
  const agentUiSource = readProjectFile(
    "features",
    "agent",
    "frontend",
    "agent-ui.js",
  );

  assert.match(agentSource, /process\.env\.DEEPSEEK_API_KEY/);
  assert.doesNotMatch(agentSource, /sk-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(agentSource, /payload\?\.apiKey/);
  assert.doesNotMatch(agentUiSource, /localStorage\.setItem/);
  assert.doesNotMatch(agentUiSource, /apiKey\s*:/);
});

test("environment files are ignored except for the placeholder example", () => {
  const gitignore = readProjectFile(".gitignore");
  const envExample = readProjectFile(".env.example");

  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(envExample, /^DEEPSEEK_API_KEY=your_deepseek_api_key$/m);
  assert.doesNotMatch(envExample, /sk-[A-Za-z0-9_-]{16,}/);
});

test("agent ignores client-supplied credentials", async (t) => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalFetch = global.fetch;
  let authorization = "";

  process.env.DEEPSEEK_API_KEY = "server-only-test-key";
  global.fetch = async (url, options) => {
    authorization = options.headers.Authorization;

    return {
      ok: true,
      async json() {
        return { choices: [{ message: { content: "测试回复" } }] };
      },
    };
  };

  t.after(() => {
    global.fetch = originalFetch;

    if (originalKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = originalKey;
    }
  });

  const { chatWithAgent } = require("../features/agent/backend/deepseek-agent");
  const result = await chatWithAgent({
    message: "测试",
    apiKey: "client-supplied-test-key",
  });

  assert.equal(result.reply, "测试回复");
  assert.equal(authorization, "Bearer server-only-test-key");
});
