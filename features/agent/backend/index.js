const { chatWithAgent } = require("./deepseek-agent");

function readRequestJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > 1024 * 1024) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");

      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Request JSON format is invalid"));
      }
    });

    request.on("error", reject);
  });
}

async function handleApi({ request, pathname, response, sendSuccess, sendError }) {
  if (pathname !== "/api/agent/chat") {
    return false;
  }

  if (request.method !== "POST") {
    sendError(response, 405, "Method Not Allowed");
    return true;
  }

  try {
    const payload = await readRequestJson(request);
    const result = await chatWithAgent(payload);
    sendSuccess(response, result);
  } catch (error) {
    sendError(response, error.statusCode || 500, error.message || "Agent request failed");
  }

  return true;
}

module.exports = {
  handleApi,
};
