const cornerImages = {
  shiliuzi: "/assets/images/poetry/VCG211611345420.jpg",
  loushanguan: "/assets/images/poetry/VCG211620090490.png",
  changzheng: "/assets/images/poetry/VCG211634570806.jpg",
  kunlun: "/assets/images/poetry/VCG211643672387.jpg",
  liupanshan: "/assets/images/poetry/OIP.webp",
  pengdehuai: "/assets/images/poetry/O1CN01a4fN2C1f43yrCr9ya_!!533673952.jpg_q90.webp",
  xue: "/assets/images/poetry/VCG211444428325.jpg",
};
const defaultBackground = "/assets/images/poetry/source-bg.jpg";

const poems = [
  {
    id: "shiliuzi",
    title: "十六字令三首",
    author: "毛泽东",
    time: "1934年末至1935年初",
    place: "长征群山",
    position: "赣南、湘桂、黔北等长征初期山地行军区域",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.shiliuzi,
    intro:
      "这三首小令写于长征初期，通过对行军途中险峻群山的描绘，赞颂红军不畏艰险、勇往直前的精神，以及作为中国革命“擎天柱石”的担当。",
    text:
      "其一\n山，快马加鞭未下鞍。\n惊回首，离天三尺三。\n\n其二\n山，倒海翻江卷巨澜。\n奔腾急，万马战犹酣。\n\n其三\n山，刺破青天锷未残。\n天欲堕，赖以拄其间。",
  },
  {
    id: "loushanguan",
    title: "忆秦娥·娄山关",
    author: "毛泽东",
    time: "1935年2月",
    place: "娄山关",
    position: "贵州省遵义市桐梓县与汇川区交界",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.loushanguan,
    intro:
      "遵义会议后，红军取得娄山关大捷。这首词既描写战斗的悲壮与激烈，也抒发“而今迈步从头越”的豪情，标志着中国革命踏上新的征程。",
    text:
      "西风烈，长空雁叫霜晨月。\n霜晨月，马蹄声碎，喇叭声咽。\n\n雄关漫道真如铁，而今迈步从头越。\n从头越，苍山如海，残阳如血。",
  },
  {
    id: "changzheng",
    title: "七律·长征",
    author: "毛泽东",
    time: "1935年10月",
    place: "长征路线",
    position: "从江西瑞金到陕北吴起镇的战略转移路线",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.changzheng,
    intro:
      "中央红军胜利到达陕北后，毛泽东用这首诗高度概括长征的艰难历程，是长征诗词中最为经典、传播最广的一首律诗。",
    text:
      "红军不怕远征难，万水千山只等闲。\n五岭逶迤腾细浪，乌蒙磅礴走泥丸。\n金沙水拍云崖暖，大渡桥横铁索寒。\n更喜岷山千里雪，三军过后尽开颜。",
  },
  {
    id: "kunlun",
    title: "念奴娇·昆仑",
    author: "毛泽东",
    time: "1935年10月",
    place: "昆仑山",
    position: "青藏高原北缘，横亘中国西部的重要山系",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.kunlun,
    intro:
      "诗人以昆仑山为题，表达改造旧世界、实现“环球同此凉热”的远大理想和反对帝国主义的主题。",
    text:
      "横空出世，莽昆仑，阅尽人间春色。\n飞起玉龙三百万，搅得周天寒彻。\n夏日消溶，江河横溢，人或为鱼鳖。\n千秋功罪，谁人曾与评说？\n\n而今我谓昆仑：不要这高，不要这多雪。\n安得倚天抽宝剑，把汝裁为三截？\n一截遗欧，一截赠美，一截还东国。\n太平世界，环球同此凉热。",
  },
  {
    id: "liupanshan",
    title: "清平乐·六盘山",
    author: "毛泽东",
    time: "1935年10月",
    place: "六盘山",
    position: "宁夏回族自治区固原市隆德县、泾源县一带",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.liupanshan,
    intro:
      "红军翻越长征中最后一座大山六盘山时所作。“不到长城非好汉”的名句，展现了红军将士坚定的革命意志和必胜的信心。",
    text:
      "天高云淡，望断南飞雁。\n不到长城非好汉，屈指行程二万。\n\n六盘山上高峰，红旗漫卷西风。\n今日长缨在手，何时缚住苍龙？",
  },
  {
    id: "pengdehuai",
    title: "六言诗·给彭德怀同志",
    author: "毛泽东",
    time: "1935年10月",
    place: "吴起镇",
    position: "陕西省延安市吴起县",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.pengdehuai,
    intro:
      "在陕北吴起镇，彭德怀指挥红军击退追敌后，毛泽东以此诗赞扬彭德怀的骁勇善战。",
    text:
      "山高路远坑深，大军纵横驰奔。\n谁敢横刀立马？唯我彭大将军！",
  },
  {
    id: "xue",
    title: "沁园春·雪",
    author: "毛泽东",
    time: "1936年2月",
    place: "陕北雪原",
    position: "陕西北部黄土高原及红军东征相关区域",
    backgroundImage: defaultBackground,
    poetImage: cornerImages.xue,
    intro:
      "创作于红军东征时期，虽在长征胜利之后，但常被视为长征精神与诗人胸怀的延伸和升华，艺术成就极高。",
    text:
      "北国风光，千里冰封，万里雪飘。\n望长城内外，惟余莽莽；大河上下，顿失滔滔。\n山舞银蛇，原驰蜡象，欲与天公试比高。\n须晴日，看红装素裹，分外妖娆。\n\n江山如此多娇，引无数英雄竞折腰。\n惜秦皇汉武，略输文采；唐宗宋祖，稍逊风骚。\n一代天骄，成吉思汗，只识弯弓射大雕。\n俱往矣，数风流人物，还看今朝。",
  },
];

const wallLines = [
  ["shiliuzi", "山，刺破青天锷未残。天欲堕，赖以拄其间。"],
  ["loushanguan", "雄关漫道真如铁，而今迈步从头越。"],
  ["changzheng", "红军不怕远征难，万水千山只等闲。"],
  ["kunlun", "安得倚天抽宝剑，把汝裁为三截？"],
  ["liupanshan", "不到长城非好汉，屈指行程二万。"],
  ["pengdehuai", "谁敢横刀立马？唯我彭大将军！"],
  ["xue", "俱往矣，数风流人物，还看今朝。"],
].map(([poemId, text], index) => ({
  id: `line-${index + 1}`,
  poemId,
  text,
}));

function handleApi({ pathname, response, sendSuccess }) {
  if (pathname === "/api/poetry/long-march") {
    sendSuccess(response, {
      poems,
      wallLines,
    });
    return true;
  }

  return false;
}

module.exports = {
  handleApi,
};
