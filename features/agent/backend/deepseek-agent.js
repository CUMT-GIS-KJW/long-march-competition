const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "deepseek-chat";
const MAX_HISTORY_MESSAGES = 12;

function normalizeMessage(value) {
  return String(value || "").trim();
}

function normalizeApiKey(value) {
  return String(value || "").trim();
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item) => {
      return (
        item &&
        (item.role === "user" || item.role === "assistant") &&
        normalizeMessage(item.content)
      );
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => {
      return {
        role: item.role,
        content: normalizeMessage(item.content),
      };
    });
}

async function callDeepSeek({ message, history, apiKey }) {
  const resolvedApiKey = normalizeApiKey(apiKey) || process.env.DEEPSEEK_API_KEY;

  if (!resolvedApiKey) {
    throw createHttpError("DeepSeek API Key 未配置", 500);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolvedApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: "你是一个简洁、可靠的中文 AI 助手。请直接回答用户问题。",
          },
          ...history,
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0.5,
        stream: false,
      }),
    });
  } catch (error) {
    throw createHttpError(
      "无法连接 DeepSeek API，请检查网络、代理或防火墙设置",
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw createHttpError(await response.text(), response.status);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw createHttpError("DeepSeek 返回内容为空", 502);
  }

  return reply;
}

async function chatWithAgent(payload) {
  const message = normalizeMessage(payload?.message);

  if (!message) {
    throw createHttpError("请输入问题", 400);
  }

  const reply = await callDeepSeek({
    message,
    history: normalizeHistory(payload?.history),
    apiKey: payload?.apiKey,
  });

  return {
    reply,
    provider: "deepseek",
  };
}

module.exports = {
  chatWithAgent,
};
