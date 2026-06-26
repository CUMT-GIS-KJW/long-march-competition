(function () {
  const typeNames = {
    event: "普通事件",
    battle: "战役战斗",
    meeting: "会议会师",
    crossing: "渡江天险",
    mountain: "雪山草地",
    resource: "红色资源",
  };

  function eventIcon(event) {
    const size = event.importance >= 5 ? 18 : event.importance === 4 ? 15 : 12;

    return L.divIcon({
      className: "lm-div-icon",
      html: `
        <span
          class="lm-marker ${event.type}"
          style="--size: ${size}px"
          title="${event.name}"
        >
          <i></i>
          <em></em>
        </span>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  function eventPopup(event) {
    const typeName = typeNames[event.type] || event.type;
    const location = `${event.province || ""} ${event.city || ""}`.trim();

    return `
      <div class="map-popup">
        <b>${event.name}</b>
        <time>${event.date || ""}</time>
        <span>${typeName}${location ? ` · ${location}` : ""}</span>
      </div>
    `;
  }

  window.MapUtils = {
    typeNames,
    eventIcon,
    eventPopup,
    formatNumber(value) {
      return Number(value).toLocaleString("zh-CN");
    },
  };
})();
