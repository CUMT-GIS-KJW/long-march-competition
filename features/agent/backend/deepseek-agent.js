const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "deepseek-chat";
const MAX_HISTORY_MESSAGES = 12;
const MAX_PAGE_CONTEXT_CHARS = 5000;

function normalizeMessage(value) {
  return String(value || "").trim();
}

function normalizeApiKey(value) {
  return String(value || "").trim();
}

function getApiKey() {
  return normalizeApiKey(process.env.DEEPSEEK_API_KEY);
}

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePageContext(value) {
  if (!value) {
    return "";
  }

  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return normalizeMessage(text).slice(0, MAX_PAGE_CONTEXT_CHARS);
}

function buildSystemPrompt(pageContext) {
  const basePrompt =
    "你是一个简洁、可靠的中文 AI 助手。请直接回答用户问题。";

  if (!pageContext) {
    return basePrompt;
  }

  return `${basePrompt}

当前页面提供了以下 GIS 分析上下文。用户询问分析结果、图表含义、空间关系或结论时，请优先依据这些上下文解释；不要编造上下文中没有的具体数值。

${pageContext}`;
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

async function callDeepSeek({ message, history, pageContext }) {
  const apiKey = getApiKey();
  const contextText = normalizePageContext(pageContext);

  if (!apiKey) {
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
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(contextText),
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
    const message =
      response.status === 401 || response.status === 403
        ? "DeepSeek 身份验证失败，请检查服务器环境变量"
        : "DeepSeek 请求失败，请稍后重试";

    throw createHttpError(message, response.status >= 500 ? 502 : response.status);
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
    pageContext: payload?.pageContext,
  });

  return {
    reply,
    provider: "deepseek",
  };
}

module.exports = {
  chatWithAgent,
};
