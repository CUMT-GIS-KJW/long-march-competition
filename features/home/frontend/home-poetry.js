(function () {
  const $ = (selector) => document.querySelector(selector);

  // ★ 关闭弹窗
  function closeModal() {
    if (window.IndexMap && typeof window.IndexMap.closePoetryModal === 'function') {
      window.IndexMap.closePoetryModal();
    } else {
      const modal = document.getElementById('poetryModal');
      if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('poetry-cursor-active');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  }

  // ★ 上一首
  function prevPoem() {
    if (window.IndexMap && typeof window.IndexMap.prevPoem === 'function') {
      window.IndexMap.prevPoem();
    }
  }

  // ★ 下一首
  function nextPoem() {
    if (window.IndexMap && typeof window.IndexMap.nextPoem === 'function') {
      window.IndexMap.nextPoem();
    }
  }

  // ★ 语音朗读
  let isSpeaking = false;

  function stopVoice() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
    updateVoiceButton();
  }

  function updateVoiceButton() {
    const button = document.getElementById('poetryVoiceBtn');
    if (!button) return;
    button.classList.toggle('is-speaking', isSpeaking);
    button.title = isSpeaking ? '停止朗读' : '播放朗读';
  }

  function speakCurrentPoem() {
    const titleEl = document.getElementById('poetryDetailTitle');
    const metaEl = document.getElementById('poetryDetailMeta');
    const textEl = document.getElementById('poetryDetailText');
    const storyEl = document.getElementById('poetryPlaceStory');
    
    if (!titleEl || !textEl) {
      if (window.IndexMap && typeof window.IndexMap.flash === 'function') {
        window.IndexMap.flash('没有可朗读的诗歌');
      }
      return;
    }

    if (!('speechSynthesis' in window)) {
      if (window.IndexMap && typeof window.IndexMap.flash === 'function') {
        window.IndexMap.flash('当前浏览器不支持语音朗读');
      }
      return;
    }

    if (isSpeaking) {
      stopVoice();
      return;
    }

    const title = titleEl.textContent || '';
    const meta = metaEl.textContent || '';
    const text = textEl.textContent || '';
    const story = storyEl ? storyEl.textContent : '';

    const utterance = new SpeechSynthesisUtterance(
      `${title}。${meta}。${text}。作品介绍：${story}`
    );

    utterance.lang = 'zh-CN';
    utterance.rate = 0.86;
    utterance.pitch = 0.92;
    utterance.volume = 1;

    utterance.onend = () => {
      isSpeaking = false;
      updateVoiceButton();
    };

    utterance.onerror = () => {
      isSpeaking = false;
      updateVoiceButton();
    };

    stopVoice();
    isSpeaking = true;
    updateVoiceButton();
    window.speechSynthesis.speak(utterance);
  }

  // ★ 切换古今视图
  let isModern = true;

  function toggleView() {
    isModern = !isModern;
    const detailPage = document.getElementById('poetryDetailPage');
    if (detailPage) {
      detailPage.classList.toggle('show-modern', isModern);
    }
    const switchText = document.getElementById('poetrySwitchText');
    if (switchText) {
      switchText.textContent = isModern ? '今' : '古';
    }
  }

  // ★ 暴露给外部
  window.Poetry = {
    close: closeModal,
    prev: prevPoem,
    next: nextPoem,
    speak: speakCurrentPoem,
    toggleView: toggleView,
    stopVoice: stopVoice,
  };

  // ★ 绑定按钮事件
  document.addEventListener('DOMContentLoaded', function() {
    // 关闭按钮
    const closeBtn = document.getElementById('poetryCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }
    
    // ★★★ 返回按钮 - 直接关闭，不经过卷轴墙 ★★★
    const backBtn = document.getElementById('poetryBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        closeModal();  // 直接关闭
      });
    }
    
    // 上一首
    const prevBtn = document.getElementById('poetryPrevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        prevPoem();
      });
    }
    
    // 下一首
    const nextBtn = document.getElementById('poetryNextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        nextPoem();
      });
    }

    // 语音朗读
    const voiceBtn = document.getElementById('poetryVoiceBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        speakCurrentPoem();
      });
    }

    // 古今切换
    const switchBtn = document.getElementById('poetrySwitchBtn');
    if (switchBtn) {
      switchBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleView();
      });
    }
    
    // 点击背景关闭
    const modal = document.getElementById('poetryModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeModal();
        }
      });
    }
    
    // ESC键关闭
    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('poetryModal');
      if (!modal || !modal.classList.contains('show')) return;
      
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    });

    // 键盘左右切换
    document.addEventListener('keydown', function(e) {
      const modal = document.getElementById('poetryModal');
      if (!modal || !modal.classList.contains('show')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPoem();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPoem();
      }
    });

    console.log('✅ Poetry 模块已加载');
  });
})();