(function () {
  const { query: $ } = window.DomUtils;
  let isSpeaking = false;

  function updateVoiceButton() {
    const button = $("#poetryVoiceBtn");
    if (!button) return;

    button.classList.toggle("is-speaking", isSpeaking);
    button.title = isSpeaking ? "停止朗读" : "播放朗读";
  }

  function stopVoice() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    isSpeaking = false;
    updateVoiceButton();
  }

  function speakCurrentPoem() {
    if (!("speechSynthesis" in window)) {
      window.IndexMap?.flash?.("当前浏览器不支持语音朗读");
      return;
    }

    if (isSpeaking) {
      stopVoice();
      return;
    }

    const title = $("#poetryDetailTitle")?.textContent || "";
    const meta = $("#poetryDetailMeta")?.textContent || "";
    const poem = $("#poetryDetailText")?.textContent || "";
    const story = $("#poetryPlaceStory")?.textContent || "";

    if (!poem) {
      window.IndexMap?.flash?.("没有可朗读的诗歌");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      `${title}。${meta}。${poem}。作品介绍：${story}`,
    );
    utterance.lang = "zh-CN";
    utterance.rate = 0.86;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    utterance.onend = () => {
      isSpeaking = false;
      updateVoiceButton();
    };
    utterance.onerror = utterance.onend;

    stopVoice();
    isSpeaking = true;
    updateVoiceButton();
    window.speechSynthesis.speak(utterance);
  }

  function closeModal() {
    stopVoice();
    window.IndexMap?.closePoetryModal?.();
  }

  function toggleAnalysis() {
    const detailPage = $("#poetryDetailPage");
    const nextVisible = !detailPage?.classList.contains("show-analysis");

    detailPage?.classList.toggle("show-analysis", nextVisible);
    const switchText = $("#poetrySwitchText");
    if (switchText) switchText.textContent = nextVisible ? "隐" : "析";
  }

  function moveBrush(event) {
    const cursor = $("#poetryBrushCursor");
    if (!cursor) return;

    cursor.style.left = `${event.clientX + 4}px`;
    cursor.style.top = `${event.clientY + 6}px`;
  }

  function bindEvents() {
    $("#poetryScrollEntry")?.addEventListener("click", () => {
      window.IndexMap?.openPoetryDetail?.("poem_001");
    });
    $("#poetryCloseBtn")?.addEventListener("click", closeModal);
    $("#poetryWallCloseBtn")?.addEventListener("click", closeModal);
    $("#poetryBackBtn")?.addEventListener("click", closeModal);
    $("#poetryPrevBtn")?.addEventListener("click", () => {
      window.IndexMap?.prevPoem?.();
    });
    $("#poetryNextBtn")?.addEventListener("click", () => {
      window.IndexMap?.nextPoem?.();
    });
    $("#poetrySwitchBtn")?.addEventListener("click", toggleAnalysis);
    $("#poetryVoiceBtn")?.addEventListener("click", speakCurrentPoem);
    $("#poetryModal")?.addEventListener("mousemove", moveBrush);

    document.addEventListener("keydown", (event) => {
      if (!$("#poetryModal")?.classList.contains("show")) return;

      if (event.key === "Escape") {
        closeModal();
      }

      if (
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        $("#poetryDetailPage")?.classList.contains("active")
      ) {
        event.preventDefault();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
