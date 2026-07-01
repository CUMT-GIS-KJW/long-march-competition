(function () {
  const $ = (selector) => document.querySelector(selector);

  const state = {
    poems: [],
    wallLines: [],
    activeIndex: 0,
    isSpeaking: false,
    analysisVisible: false,
  };

  async function fetchPoetryData() {
    const response = await fetch("/api/poetry/long-march");

    if (!response.ok) {
      throw new Error("poetry api failed");
    }

    const payload = await response.json();

    return payload.code === 200 ? payload.data : payload;
  }

  function poemIndexById(poemId) {
    return Math.max(
      0,
      state.poems.findIndex((poem) => poem.id === poemId),
    );
  }

  function formatWallText(text) {
    return text
      .replace(/，/g, "，")
      .replace(/。/g, "。")
      .replace(/？/g, "？");
  }

  function renderWall() {
    $("#poetryList").innerHTML = state.wallLines
      .map((line) => {
        const poem = state.poems.find((item) => item.id === line.poemId);
        const title = poem ? poem.title : "长征诗词";

        return `
          <button class="poetry-wall-item" type="button" data-poem-id="${line.poemId}">
            <span>${formatWallText(line.text)}</span>
            <small>${title}</small>
          </button>
        `;
      })
      .join("");
  }

  function setButtonEnabled(enabled) {
    [
      "#poetryWallCloseBtn",
      "#poetryCloseBtn",
      "#poetryBackBtn",
      "#poetryPrevBtn",
      "#poetryNextBtn",
      "#poetrySwitchBtn",
      "#poetryVoiceBtn",
    ].forEach((selector) => {
      const element = $(selector);

      if (element) {
        element.disabled = !enabled;
      }
    });
  }

  function stopVoice() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    state.isSpeaking = false;
    updateVoiceButton();
  }

  function updateVoiceButton() {
    const button = $("#poetryVoiceBtn");

    if (!button) {
      return;
    }

    button.classList.toggle("is-speaking", state.isSpeaking);
    button.title = state.isSpeaking ? "停止朗读" : "播放朗读";
  }

  function speakCurrentPoem() {
    if (!("speechSynthesis" in window)) {
      if (window.IndexMap && typeof window.IndexMap.flash === "function") {
        window.IndexMap.flash("当前浏览器不支持语音朗读");
      }

      return;
    }

    const titleText = $("#poetryDetailTitle")?.textContent || "";
    const metaText = $("#poetryDetailMeta")?.textContent || "";
    const poemText = $("#poetryDetailText")?.textContent || "";
    const storyText = $("#poetryPlaceStory")?.textContent || "";

    if (!poemText && (!state.poems.length || !state.poems[state.activeIndex])) {
      if (window.IndexMap && typeof window.IndexMap.flash === "function") {
        window.IndexMap.flash("没有可朗读的诗歌");
      }

      return;
    }

    if (state.isSpeaking) {
      stopVoice();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      `${titleText}。${metaText}。${poemText}。作品介绍：${storyText}`,
    );

    utterance.lang = "zh-CN";
    utterance.rate = 0.86;
    utterance.pitch = 0.92;
    utterance.volume = 1;

    utterance.onend = () => {
      state.isSpeaking = false;
      updateVoiceButton();
    };

    stopVoice();
    state.isSpeaking = true;
    updateVoiceButton();
    window.speechSynthesis.speak(utterance);
  }

  function ensureAnalysisBox() {
    let box = document.querySelector(".poetry-analysis");

    if (!box) {
      box = document.createElement("section");
      box.className = "poetry-analysis";
      $("#poetryDetailPage").appendChild(box);
    }

    return box;
  }

  function renderDetail() {
    const poem = state.poems[state.activeIndex];
    const title = poem.title || "长征诗词";
    const author = poem.author || "毛泽东";
    const time = poem.time || poem.year || "";
    const text = String(poem.text || "")
      .replace(/。/g, "。\n")
      .replace(/！/g, "！\n")
      .replace(/？/g, "？\n")
      .replace(/；/g, "；\n")
      .replace(/\n{2,}/g, "\n")
      .trim();
    const place = poem.place || (Array.isArray(poem.places) ? poem.places.join("、") : "长征沿线");
    const position = poem.position || (Array.isArray(poem.provinces) ? poem.provinces.join("、") : "");
    const intro = poem.intro || poem.description || "";
    const backgroundImage = poem.backgroundImage || poem.poetImage || "/assets/images/poetry/source-bg-ink.png";
    const poetImage = poem.poetImage || poem.backgroundImage || "/assets/images/poetry/source-poet-placeholder.png";

    $("#poetryDetailTitle").textContent = `《${title}》`;
    $("#poetryDetailMeta").textContent = `${author} · ${time}`;
    $("#poetryDetailText").textContent = text;
    $("#poetryPlaceName").textContent = place;
    $("#poetryPlacePosition").textContent = `位置：${position}`;
    $("#poetryPlaceStory").textContent = intro;
    $("#poetryModernImg").src = backgroundImage;
    $("#poetryAncientImg").src = "/assets/images/poetry/source-bg-ink.png";
    $("#poetryPoetImg").src = poetImage;

    const analysisBox = ensureAnalysisBox();

    analysisBox.innerHTML = `
      <b>诗词解读</b>
      <p>${intro}</p>
      <p>空间关联：${place} 是长征叙事中的关键意象或地理节点，可与路线、事件点、地形起伏联动展示。</p>
    `;

    $("#poetryDetailPage").classList.toggle("show-analysis", state.analysisVisible);
    $("#poetrySwitchText").textContent = state.analysisVisible ? "隐" : "析";
    updateVoiceButton();
  }

  function showWall() {
    stopVoice();
    state.analysisVisible = false;
    $("#poetryWallPage").classList.add("active");
    $("#poetryDetailPage").classList.remove("active");
    $("#poetryWindow").classList.remove("detail-mode");
    setButtonEnabled(true);
  }

  function showDetail(index) {
    state.activeIndex = (index + state.poems.length) % state.poems.length;
    state.analysisVisible = false;
    stopVoice();
    renderDetail();
    $("#poetryWallPage").classList.remove("active");
    $("#poetryDetailPage").classList.add("active");
    $("#poetryWindow").classList.add("detail-mode");
    setButtonEnabled(true);
  }

  async function openModal() {
    $("#poetryModal").classList.add("show");
    $("#poetryModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("poetry-cursor-active");
    setButtonEnabled(false);

    if (!state.poems.length) {
      const data = await fetchPoetryData();
      state.poems = data.poems || [];
      state.wallLines = data.wallLines || [];
      renderWall();
    }

    showDetail(0);
  }

  function closeModal() {
    stopVoice();
    $("#poetryModal").classList.remove("show");
    $("#poetryModal").setAttribute("aria-hidden", "true");
    document.body.classList.remove("poetry-cursor-active");
  }

  function moveBrush(event) {
    const cursor = $("#poetryBrushCursor");

    if (!cursor) {
      return;
    }

    cursor.style.left = `${event.clientX + 4}px`;
    cursor.style.top = `${event.clientY + 6}px`;
  }

  function bindEvents() {
    $("#poetryScrollEntry")?.addEventListener("click", () => {
      if (window.IndexMap && typeof window.IndexMap.openPoetryDetail === "function") {
        window.IndexMap.openPoetryDetail("poem_001");
        return;
      }

      openModal().catch((error) => {
        console.error(error);
        if (window.IndexMap && typeof window.IndexMap.flash === "function") {
          window.IndexMap.flash("诗词数据加载失败");
        }
      });
    });

    $("#poetryCloseBtn")?.addEventListener("click", closeModal);
    $("#poetryWallCloseBtn")?.addEventListener("click", closeModal);
    $("#poetryBackBtn")?.addEventListener("click", closeModal);

    $("#poetryList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-poem-id]");

      if (!button) {
        return;
      }

      showDetail(poemIndexById(button.dataset.poemId));
    });

    $("#poetryPrevBtn")?.addEventListener("click", () => {
      if (window.IndexMap && typeof window.IndexMap.flash === "function") {
        window.IndexMap.flash("当前点位仅展示对应诗词");
      }
    });

    $("#poetryNextBtn")?.addEventListener("click", () => {
      if (window.IndexMap && typeof window.IndexMap.flash === "function") {
        window.IndexMap.flash("当前点位仅展示对应诗词");
      }
    });

    $("#poetrySwitchBtn")?.addEventListener("click", () => {
      if (state.poems.length) {
        state.analysisVisible = !state.analysisVisible;
        renderDetail();
        return;
      }

      const detailPage = $("#poetryDetailPage");
      const nextVisible = !detailPage?.classList.contains("show-analysis");

      detailPage?.classList.toggle("show-analysis", nextVisible);
      $("#poetrySwitchText").textContent = nextVisible ? "隐" : "析";
    });

    $("#poetryVoiceBtn")?.addEventListener("click", speakCurrentPoem);
    $("#poetryModal")?.addEventListener("mousemove", moveBrush);

    document.addEventListener("keydown", (event) => {
      if (!$("#poetryModal").classList.contains("show")) {
        return;
      }

      if (event.key === "Escape") {
        closeModal();
      }

      if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        $("#poetryDetailPage").classList.contains("active")
      ) {
        event.preventDefault();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
