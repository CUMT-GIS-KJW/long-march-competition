(function () {
  const $ = (selector) => document.querySelector(selector);
  const panel = $("#agentPanel");
  const toggle = $("#agentToggle");
  const form = $("#agentForm");
  const input = $("#agentInput");
  const messages = $("#agentMessages");
  const windowEl = $(".agent-window");

  const apiKeyStorageKey = "long-march-deepseek-api-key";
  let sending = false;
  const history = [];

  function readApiKey() {
    return localStorage.getItem(apiKeyStorageKey) || "";
  }

  function writeApiKey(value) {
    const apiKey = String(value || "").trim();

    if (apiKey) {
      localStorage.setItem(apiKeyStorageKey, apiKey);
      return;
    }

    localStorage.removeItem(apiKeyStorageKey);
  }

  function createKeySettings() {
    const settings = document.createElement("div");
    const label = document.createElement("label");
    const keyInput = document.createElement("input");
    const saveButton = document.createElement("button");
    const clearButton = document.createElement("button");
    const status = document.createElement("span");

    settings.className = "agent-key-settings";
    label.className = "agent-key-label";
    label.textContent = "DeepSeek Key";
    keyInput.id = "agentApiKey";
    keyInput.type = "password";
    keyInput.placeholder = "填写后保存在本机浏览器";
    keyInput.autocomplete = "off";
    keyInput.value = readApiKey();
    saveButton.type = "button";
    saveButton.textContent = "保存";
    clearButton.type = "button";
    clearButton.textContent = "清除";
    status.className = "agent-key-status";
    status.textContent = keyInput.value ? "已保存" : "未填写";

    saveButton.addEventListener("click", () => {
      writeApiKey(keyInput.value);
      status.textContent = readApiKey() ? "已保存" : "未填写";
    });

    clearButton.addEventListener("click", () => {
      keyInput.value = "";
      writeApiKey("");
      status.textContent = "已清除";
    });

    keyInput.addEventListener("input", () => {
      writeApiKey(keyInput.value);
      status.textContent = readApiKey() ? "已保存" : "未填写";
    });

    settings.append(label, keyInput, saveButton, clearButton, status);
    windowEl.insertBefore(settings, messages);
  }

  function addMessage(role, text) {
    const item = document.createElement("div");
    item.className = `agent-message ${role}`;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function rememberMessage(role, content) {
    history.push({
      role,
      content,
    });

    if (history.length > 12) {
      history.splice(0, history.length - 12);
    }
  }

  function setLoading(isLoading) {
    form.classList.toggle("is-loading", isLoading);
    input.disabled = isLoading;
    form.querySelector("button").disabled = isLoading;
  }

  async function sendMessage(message) {
    if (sending) {
      return;
    }

    sending = true;
    setLoading(true);
    addMessage("user", message);
    rememberMessage("user", message);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          page: "index",
          history: history.slice(0, -1),
          apiKey: readApiKey(),
        }),
      });
      const result = await response.json();

      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || "智能助手请求失败");
      }

      addMessage("assistant", result.data.reply);
      rememberMessage("assistant", result.data.reply);
    } catch (error) {
      console.error(error);
      addMessage(
        "assistant",
        "智能助手暂时无法连接，请检查 DeepSeek Key 或网络后重试。",
      );
    } finally {
      sending = false;
      setLoading(false);
      input.focus();
    }
  }

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("open");

    if (isOpen) {
      input.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      panel.classList.remove("open");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
      return;
    }

    input.value = "";
    sendMessage(message);
  });

  addMessage(
    "assistant",
    "你好，我是长征 GIS 智能助手。可以问我历史节点、路线解读、空间分析或答辩讲解。",
  );

  createKeySettings();
})();
