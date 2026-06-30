(function () {
  const poems = [
    {
      title: "十六字令三首",
      author: "毛泽东",
      time: "1934年末至1935年初",
      wallLine: "山，刺破青天锷未残，天欲堕，赖以拄其间。",
      place: "长征群山",
      position: "位置：赣南、湘桂、黔北等长征初期山地行军区域",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/red-army-march.jpg",
      story:
        "这三首小令写于长征初期，通过对险峻群山的描绘，展现红军快马加鞭、勇往直前的行军气势。山不只是自然阻隔，也是革命队伍必须穿越的考验。",
      text:
        "其一\n山，快马加鞭未下鞍。\n惊回首，离天三尺三。\n\n其二\n山，倒海翻江卷巨澜。\n奔腾急，万马战犹酣。\n\n其三\n山，刺破青天锷未残。\n天欲堕，赖以拄其间。",
    },
    {
      title: "忆秦娥·娄山关",
      author: "毛泽东",
      time: "1935年2月",
      wallLine: "雄关漫道真如铁，而今迈步从头越。",
      place: "娄山关",
      position: "位置：贵州省遵义市桐梓县与汇川区交界",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/zunyi.jpg",
      story:
        "遵义会议后，红军取得娄山关大捷。这首词以霜晨、马蹄、喇叭、雄关与残阳构成悲壮画面，也写出革命重新出发的豪情。",
      text:
        "西风烈，长空雁叫霜晨月。\n霜晨月，马蹄声碎，喇叭声咽。\n\n雄关漫道真如铁，而今迈步从头越。\n从头越，苍山如海，残阳如血。",
    },
    {
      title: "七律·长征",
      author: "毛泽东",
      time: "1935年10月",
      wallLine: "红军不怕远征难，万水千山只等闲。",
      place: "长征路线",
      position: "位置：从江西瑞金到陕北吴起镇的战略转移路线",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/red-army-march.jpg",
      story:
        "中央红军胜利到达陕北后，这首诗高度概括长征中的万水千山、金沙江、大渡河、岷山雪等关键空间意象，是长征精神最凝练的诗意表达。",
      text:
        "红军不怕远征难，万水千山只等闲。\n五岭逶迤腾细浪，乌蒙磅礴走泥丸。\n金沙水拍云崖暖，大渡桥横铁索寒。\n更喜岷山千里雪，三军过后尽开颜。",
    },
    {
      title: "念奴娇·昆仑",
      author: "毛泽东",
      time: "1935年10月",
      wallLine: "安得倚天抽宝剑，把汝裁为三截？",
      place: "昆仑山",
      position: "位置：青藏高原北缘，横亘中国西部的重要山系",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/xueshan.jpg",
      story:
        "诗人以昆仑山为宏大对象，把自然高寒与世界理想联系起来，表达改造旧世界、追求天下均衡与人民解放的胸怀。",
      text:
        "横空出世，莽昆仑，阅尽人间春色。\n飞起玉龙三百万，搅得周天寒彻。\n夏日消溶，江河横溢，人或为鱼鳖。\n千秋功罪，谁人曾与评说？\n\n而今我谓昆仑：不要这高，不要这多雪。\n安得倚天抽宝剑，把汝裁为三截？\n一截遗欧，一截赠美，一截还东国。\n太平世界，环球同此凉热。",
    },
    {
      title: "清平乐·六盘山",
      author: "毛泽东",
      time: "1935年10月",
      wallLine: "不到长城非好汉，屈指行程二万。",
      place: "六盘山",
      position: "位置：宁夏回族自治区固原市隆德县、泾源县一带",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/xueshan.jpg",
      story:
        "六盘山是长征后期的重要山地节点。诗中‘不到长城非好汉’写出红军跨越最后大山、奔向胜利的坚定意志。",
      text:
        "天高云淡，望断南飞雁。\n不到长城非好汉，屈指行程二万。\n\n六盘山上高峰，红旗漫卷西风。\n今日长缨在手，何时缚住苍龙？",
    },
    {
      title: "六言诗·给彭德怀同志",
      author: "毛泽东",
      time: "1935年10月",
      wallLine: "谁敢横刀立马？唯我彭大将军！",
      place: "吴起镇",
      position: "位置：陕西省延安市吴起县",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/red-army-march.jpg",
      story:
        "红军到达陕北吴起镇后，彭德怀率部击退追敌。诗句简洁有力，表现革命战争中将领的胆识与队伍的战斗精神。",
      text:
        "山高路远坑深，大军纵横驰奔。\n谁敢横刀立马？唯我彭大将军！",
    },
    {
      title: "沁园春·雪",
      author: "毛泽东",
      time: "1936年2月",
      wallLine: "俱往矣，数风流人物，还看今朝。",
      place: "陕北雪原",
      position: "位置：陕西北部黄土高原及红军东征相关区域",
      ancientImage: "/assets/icons/map-scroll.svg",
      modernImage: "/assets/images/xueshan.jpg",
      story:
        "这首词作于红军东征时期，虽在长征胜利之后，却常被视作长征精神与诗人胸怀的延伸。雪景、江山、英雄共同构成宏阔历史视野。",
      text:
        "北国风光，千里冰封，万里雪飘。\n望长城内外，惟余莽莽；大河上下，顿失滔滔。\n山舞银蛇，原驰蜡象，欲与天公试比高。\n须晴日，看红装素裹，分外妖娆。\n\n江山如此多娇，引无数英雄竞折腰。\n惜秦皇汉武，略输文采；唐宗宋祖，稍逊风骚。\n一代天骄，成吉思汗，只识弯弓射大雕。\n俱往矣，数风流人物，还看今朝。",
    },
  ];

  const $ = (selector) => document.querySelector(selector);

  let activeIndex = 0;
  let isModern = true;
  let isSpeaking = false;

  function stopVoice() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    isSpeaking = false;
    updateVoiceButton();
  }

  function speakCurrentPoem() {
    const poem = poems[activeIndex];

    if (!("speechSynthesis" in window)) {
      if (window.IndexMap && typeof window.IndexMap.flash === "function") {
        window.IndexMap.flash("当前浏览器不支持语音朗读");
      }

      return;
    }

    if (isSpeaking) {
      stopVoice();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      `${poem.title}。${poem.author}。${poem.time}。${poem.text}。作品介绍：${poem.story}`,
    );

    utterance.lang = "zh-CN";
    utterance.rate = 0.86;
    utterance.pitch = 0.92;
    utterance.volume = 1;

    utterance.onend = () => {
      isSpeaking = false;
      updateVoiceButton();
    };

    stopVoice();
    isSpeaking = true;
    updateVoiceButton();
    window.speechSynthesis.speak(utterance);
  }

  function updateVoiceButton() {
    const button = $("#poetryVoiceBtn");

    if (!button) {
      return;
    }

    button.classList.toggle("is-speaking", isSpeaking);
    button.title = isSpeaking ? "停止朗读" : "播放朗读";
  }

  function formatWallLine(poem) {
    return poem.wallLine.replace(/，/g, "，\n").replace(/。/g, "。\n");
  }

  function renderWall() {
    $("#poetryList").innerHTML = poems
      .map((poem, index) => {
        const centerClass = index === 3 ? " featured" : "";

        return `
          <button class="poetry-wall-item${centerClass}" type="button" data-poetry-index="${index}">
            <span>${formatWallLine(poem)}</span>
            <small>${poem.title}</small>
          </button>
        `;
      })
      .join("");
  }

  function renderDetail() {
    const poem = poems[activeIndex];

    $("#poetryDetailTitle").textContent = `《${poem.title}》`;
    $("#poetryDetailMeta").textContent = `${poem.author} · ${poem.time}`;
    $("#poetryDetailText").textContent = poem.text;
    $("#poetryPlaceName").textContent = poem.place;
    $("#poetryPlacePosition").textContent = poem.position;
    $("#poetryPlaceStory").textContent = poem.story;
    $("#poetryAncientImg").src = poem.ancientImage;
    $("#poetryModernImg").src = poem.modernImage;

    $("#poetryDetailPage").classList.toggle("show-modern", isModern);
    $("#poetrySwitchText").textContent = isModern ? "今" : "古";
    updateVoiceButton();
  }

  function showWall() {
    stopVoice();
    $("#poetryWallPage").classList.add("active");
    $("#poetryDetailPage").classList.remove("active");
    $("#poetryWindow").classList.remove("detail-mode");
  }

  function showDetail(index) {
    activeIndex = (index + poems.length) % poems.length;
    isModern = true;
    stopVoice();
    renderDetail();
    $("#poetryWallPage").classList.remove("active");
    $("#poetryDetailPage").classList.add("active");
    $("#poetryWindow").classList.add("detail-mode");

    setTimeout(() => {
      $("#poetryDetailPage").classList.add("show-modern");
    }, 320);
  }

  function openModal() {
    renderWall();
    $("#poetryModal").classList.add("show");
    $("#poetryModal").setAttribute("aria-hidden", "false");
    document.body.classList.add("poetry-cursor-active");
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

  function bindPoetry() {
    $("#poetryScrollEntry").addEventListener("click", openModal);
    $("#poetryCloseBtn").addEventListener("click", closeModal);
    $("#poetryWallCloseBtn").addEventListener("click", closeModal);
    $("#poetryBackBtn").addEventListener("click", showWall);

    $("#poetryList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-poetry-index]");

      if (!button) {
        return;
      }

      showDetail(Number(button.dataset.poetryIndex));
    });

    $("#poetryPrevBtn").addEventListener("click", () => {
      showDetail(activeIndex - 1);
    });

    $("#poetryNextBtn").addEventListener("click", () => {
      showDetail(activeIndex + 1);
    });

    $("#poetrySwitchBtn").addEventListener("click", () => {
      isModern = !isModern;
      renderDetail();
    });

    $("#poetryVoiceBtn").addEventListener("click", speakCurrentPoem);

    $("#poetryModal").addEventListener("mousemove", moveBrush);

    $("#poetryModal").addEventListener("click", (event) => {
      if (event.target.id === "poetryModal") {
        closeModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!$("#poetryModal").classList.contains("show")) {
        return;
      }

      if (event.key === "Escape") {
        closeModal();
      }

      if (event.key === "ArrowLeft" && $("#poetryDetailPage").classList.contains("active")) {
        showDetail(activeIndex - 1);
      }

      if (event.key === "ArrowRight" && $("#poetryDetailPage").classList.contains("active")) {
        showDetail(activeIndex + 1);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindPoetry);
})();
