# 清理与移动记录

整理日期：2026-06-30

## 移动清单

| 原始路径 | 新路径 | 原因 | 是否修改引用路径 |
| --- | --- | --- | --- |
| `public/assets/data/route-layer-config.json` | `data/routes/route-layer-config.json` | 路线图层配置归类到路线数据目录 | 是 |
| `public/assets/data/routes.json` | `data/routes/routes.json` | 总体路线数据归类到路线数据目录 | 是 |
| `public/assets/data/route-layers/route_hongershiwu_jun.json` | `data/routes/route-layers/route_hongershiwu_jun.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_honger_juntuan.json` | `data/routes/route-layers/route_honger_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongjiu_juntuan.json` | `data/routes/route-layers/route_hongjiu_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongliu_juntuan.json` | `data/routes/route-layers/route_hongliu_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongqi_juntuan.json` | `data/routes/route-layers/route_hongqi_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongsanshi_jun.json` | `data/routes/route-layers/route_hongsanshi_jun.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongsan_juntuan.json` | `data/routes/route-layers/route_hongsan_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongshiba_shi.json` | `data/routes/route-layers/route_hongshiba_shi.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongsi_juntuan.json` | `data/routes/route-layers/route_hongsi_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongwu_juntuan.json` | `data/routes/route-layers/route_hongwu_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_hongyi_juntuan.json` | `data/routes/route-layers/route_hongyi_juntuan.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/route-layers/route_zhongyang_zongdui.json` | `data/routes/route-layers/route_zhongyang_zongdui.json` | 独立路线图层归类到 data/routes/route-layers | 是 |
| `public/assets/data/analysis-buffer.json` | `data/json/analysis-buffer.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-difficulty.json` | `data/json/analysis-difficulty.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-elevation.json` | `data/json/analysis-elevation.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-node-types.json` | `data/json/analysis-node-types.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-province.json` | `data/json/analysis-province.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-route-compare.json` | `data/json/analysis-route-compare.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-routes.json` | `data/json/analysis-routes.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-stage.json` | `data/json/analysis-stage.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/analysis-summary.json` | `data/json/analysis-summary.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/events-important.json` | `data/json/events-important.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/events.json` | `data/json/events.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/resources.json` | `data/json/resources.json` | 业务 JSON 数据归类到 data/json | 是 |
| `public/assets/data/scene3d-focus.json` | `data/json/scene3d-focus.json` | 业务 JSON 数据归类到 data/json | 是 |
| `gis-analysis/cache/china-provinces.geojson` | `data/geojson/china-provinces.geojson` | GeoJSON 边界数据归类到 data/geojson | 是 |
| `public/assets/img/home/top-doves.png` | `assets/images/home/top-doves.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home/top-mountain-doves.png` | `assets/images/home/top-mountain-doves.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/bottom-left.png` | `assets/images/home-poster/bottom-left.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-all.png` | `assets/images/home-poster/event-all.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-battle.png` | `assets/images/home-poster/event-battle.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-join.png` | `assets/images/home-poster/event-join.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-meeting.png` | `assets/images/home-poster/event-meeting.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-mountain.png` | `assets/images/home-poster/event-mountain.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/event-river.png` | `assets/images/home-poster/event-river.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/logal.png` | `assets/images/home-poster/logal.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/map-mountains.png` | `assets/images/home-poster/map-mountains.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/nav-3d.png` | `assets/images/home-poster/nav-3d.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/nav-analysis.png` | `assets/images/home-poster/nav-analysis.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/nav-map.png` | `assets/images/home-poster/nav-map.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/nav-tourism.png` | `assets/images/home-poster/nav-tourism.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/right-flag.png` | `assets/images/home-poster/right-flag.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/slogan.png` | `assets/images/home-poster/slogan.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/home-poster/title-art.png` | `assets/images/home-poster/title-art.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/longmarch-route-corner.png` | `assets/images/longmarch-route-corner.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/arrow-left.png` | `assets/images/poetry/arrow-left.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/arrow-right.png` | `assets/images/poetry/arrow-right.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/brush.png` | `assets/images/poetry/brush.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/ink.gif` | `assets/images/poetry/ink.gif` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/location.png` | `assets/images/poetry/location.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/O1CN01a4fN2C1f43yrCr9ya_!!533673952.jpg_q90.webp` | `assets/images/poetry/O1CN01a4fN2C1f43yrCr9ya_!!533673952.jpg_q90.webp` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/OIP.webp` | `assets/images/poetry/OIP.webp` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/past-now.png` | `assets/images/poetry/past-now.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/scroll-closed.webp` | `assets/images/poetry/scroll-closed.webp` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/scroll-open.png` | `assets/images/poetry/scroll-open.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/source-bg-ink.png` | `assets/images/poetry/source-bg-ink.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/source-bg.jpg` | `assets/images/poetry/source-bg.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/source-poet-placeholder.png` | `assets/images/poetry/source-poet-placeholder.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/text-button-bg.png` | `assets/images/poetry/text-button-bg.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211353582315.jpg` | `assets/images/poetry/VCG211353582315.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211444428325.jpg` | `assets/images/poetry/VCG211444428325.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211458592604.jpg` | `assets/images/poetry/VCG211458592604.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211611345420.jpg` | `assets/images/poetry/VCG211611345420.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211620090490.png` | `assets/images/poetry/VCG211620090490.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211634570806.jpg` | `assets/images/poetry/VCG211634570806.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/VCG211643672387.jpg` | `assets/images/poetry/VCG211643672387.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/voice-off.png` | `assets/images/poetry/voice-off.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/poetry/voice-on.png` | `assets/images/poetry/voice-on.png` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/red-army-march.jpg` | `assets/images/red-army-march.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/xueshan.jpg` | `assets/images/xueshan.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/img/zunyi.jpg` | `assets/images/zunyi.jpg` | 图片资源归类到 assets/images | 是 |
| `public/assets/map-scroll.svg` | `assets/icons/map-scroll.svg` | 图标资源归类到 assets/icons | 是 |
| `features/tourism/frontend/assets/index.html` | `cleanup_review/duplicate/tourism-frontend-assets/index.html` | 正式旅游页面未引用的旧副本，移入 cleanup_review/duplicate 待人工复核 | 否，正式代码未引用 |
| `features/tourism/frontend/assets/index.js` | `cleanup_review/duplicate/tourism-frontend-assets/index.js` | 正式旅游页面未引用的旧副本，移入 cleanup_review/duplicate 待人工复核 | 否，正式代码未引用 |
| `features/tourism/frontend/assets/README_china_map.txt` | `cleanup_review/duplicate/tourism-frontend-assets/README_china_map.txt` | 正式旅游页面未引用的旧副本，移入 cleanup_review/duplicate 待人工复核 | 否，正式代码未引用 |
| `features/tourism/frontend/assets/tourism.css` | `cleanup_review/duplicate/tourism-frontend-assets/tourism.css` | 正式旅游页面未引用的旧副本，移入 cleanup_review/duplicate 待人工复核 | 否，正式代码未引用 |
| `features/tourism/frontend/assets/tourism.js` | `cleanup_review/duplicate/tourism-frontend-assets/tourism.js` | 正式旅游页面未引用的旧副本，移入 cleanup_review/duplicate 待人工复核 | 否，正式代码未引用 |

## cleanup_review 说明

| 分类 | 文件/目录 | 说明 | 需要人工确认 |
| --- | --- | --- | --- |
| duplicate | `cleanup_review/duplicate/tourism-frontend-assets/` | 该目录原为 `features/tourism/frontend/assets/`，包含旧版 `index.html`、`tourism.js`、`tourism.css`、`index.js` 和说明文件。正式入口没有引用该目录。 | 是 |
| backup | `cleanup_review/backup/` | 本次未发现明确备份文件。 | 否 |
| old_versions | `cleanup_review/old_versions/` | 本次未发现需归入旧版本的独立文件。 | 否 |
| test_files | `cleanup_review/test_files/` | 本次未发现需归入测试文件的独立文件。 | 否 |
| unused_assets | `cleanup_review/unused_assets/` | 本次未将资源判定为无用。 | 否 |
| uncertain | `cleanup_review/uncertain/` | 本次未发现无法判断用途且需要移动的正式文件。 | 否 |

## 已修复的引用路径

- `/assets/data/...` 改为 `/data/json/...` 或 `/data/routes/...`。
- `/assets/img/...` 改为 `/assets/images/...`。
- `/assets/map-scroll.svg` 改为 `/assets/icons/map-scroll.svg`。
- `/assets/china-provinces.geojson` 改为 `/data/geojson/china-provinces.geojson`。
- 后端 `data-store.js` 改为读取 `data/json`、`data/routes`、`data/geojson`。
- 静态服务 `static-files.js` 新增 `/assets/` 和 `/data/` 到新目录的映射。
- `gis-analysis/run-analysis.js` 和 `scripts/generate-static-shp-data.py` 输出路径改为新数据目录。

## 验证记录

- API 检查：`/api/health`、`/api/route-layers`、`/api/events/timeline`、`/api/resources`、`/api/analysis/summary`、`/api/scene3d/focus` 均返回 200。
- 静态资源检查：`/assets/images/home-poster/logal.png`、`/assets/icons/map-scroll.svg`、`/assets/images/poetry/ink.gif` 均返回 200。
- 数据文件检查：`/data/routes/route-layer-config.json`、`/data/routes/route-layers/route_zhongyang_zongdui.json`、`/data/json/events-important.json`、`/data/geojson/china-provinces.geojson` 均返回 200。
- 页面检查：主页、综合分析、红色旅游、三维场景均可打开；Leaflet 地图、路线、事件点、旅游省界、分析结果和 3D 场景均正常加载；控制台未发现 JavaScript error 或 404 日志。

## 后续人工确认

请重点确认 `cleanup_review/duplicate/tourism-frontend-assets/` 是否确认为旧副本。确认项目运行无误后，可由你手动删除 `cleanup_review/` 中确认无用的内容。
