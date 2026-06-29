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

    if (state.isSpeaking) {
      stopVoice();
      return;
    }

    const poem = state.poems[state.activeIndex];
    const utterance = new SpeechSynthesisUtterance(
      `${poem.title}。${poem.author}。${poem.time}。${poem.text}。作品介绍：${poem.intro}`,
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

    $("#poetryDetailTitle").textContent = `《${poem.title}》`;
    $("#poetryDetailMeta").textContent = `${poem.author} · ${poem.time}`;
    $("#poetryDetailText").textContent = poem.text;
    $("#poetryPlaceName").textContent = poem.place;
    $("#poetryPlacePosition").textContent = `位置：${poem.position}`;
    $("#poetryPlaceStory").textContent = poem.intro;
    $("#poetryModernImg").src = poem.backgroundImage;
    $("#poetryAncientImg").src = poem.backgroundImage;
    $("#poetryPoetImg").src = poem.poetImage;

    const analysisBox = ensureAnalysisBox();

    analysisBox.innerHTML = `
      <b>诗词解读</b>
      <p>${poem.intro}</p>
      <p>空间关联：${poem.place} 是长征叙事中的关键意象或地理节点，可与路线、事件点、地形起伏联动展示。</p>
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

    showWall();
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
    $("#poetryScrollEntry").addEventListener("click", () => {
      openModal().catch((error) => {
        console.error(error);
        if (window.IndexMap && typeof window.IndexMap.flash === "function") {
          window.IndexMap.flash("诗词数据加载失败");
        }
      });
    });

    $("#poetryCloseBtn").addEventListener("click", closeModal);
    $("#poetryWallCloseBtn").addEventListener("click", closeModal);
    $("#poetryBackBtn").addEventListener("click", showWall);

    $("#poetryList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-poem-id]");

      if (!button) {
        return;
      }

      showDetail(poemIndexById(button.dataset.poemId));
    });

    $("#poetryPrevBtn").addEventListener("click", () => {
      showDetail(state.activeIndex - 1);
    });

    $("#poetryNextBtn").addEventListener("click", () => {
      showDetail(state.activeIndex + 1);
    });

    $("#poetrySwitchBtn").addEventListener("click", () => {
      state.analysisVisible = !state.analysisVisible;
      renderDetail();
    });

    $("#poetryVoiceBtn").addEventListener("click", speakCurrentPoem);
    $("#poetryModal").addEventListener("mousemove", moveBrush);

    document.addEventListener("keydown", (event) => {
      if (!$("#poetryModal").classList.contains("show")) {
        return;
      }

      if (event.key === "Escape") {
        closeModal();
      }

      if (event.key === "ArrowLeft" && $("#poetryDetailPage").classList.contains("active")) {
        showDetail(state.activeIndex - 1);
      }

      if (event.key === "ArrowRight" && $("#poetryDetailPage").classList.contains("active")) {
        showDetail(state.activeIndex + 1);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
