# 项目结构说明

整理日期：2026-06-30

## 当前结构

```text
long-march-competition/
├─ server/                         # Node HTTP 服务入口与页面/API 路由
├─ features/                       # 多页面功能模块，前端与后端按功能分组
│  ├─ home/                        # 二维 Leaflet 主地图、路线播放、事件筛选
│  ├─ analysis/                    # Leaflet 综合分析地图、ECharts 图表与分析交互
│  ├─ tourism/                     # Leaflet 红色研学/旅游资源地图
│  ├─ scene3d/                     # Cesium 三维 DEM 场景
│  ├─ poetry/                      # 诗词弹窗与诗词素材接口
│  ├─ agent/                       # GIS 智能助手面板与后端对话接口
│  ├─ login/                       # 登录页
│  └─ shared/                      # 公共配置、数据服务、地图工具、静态服务工具
├─ data/
│  ├─ json/                        # 事件、资源、分析结果、三维焦点等业务 JSON
│  ├─ routes/                      # 路线总表、路线图层配置和独立路线图层
│  └─ geojson/                     # 省界等 GeoJSON 数据
├─ assets/
│  ├─ images/                      # 页面图片、海报图、诗词图、研学路线图
│  ├─ icons/                       # SVG 图标等轻量图形资源
│  └─ fonts/                       # 预留字体资源目录
├─ gis-analysis/                   # GIS 统计/DEM 分析生成脚本和缓存
├─ scripts/                        # 数据转换与格式化脚本
└─ docs/                           # 项目说明文档
```

## 主要 JS 文件说明

| 文件 | 作用 |
| --- | --- |
| `server/app.js` | HTTP 服务入口，串联各功能后端 API 与静态文件服务。 |
| `features/shared/backend/data-store.js` | 后端统一数据读取入口，当前读取 `data/json`、`data/routes`、`data/geojson`。 |
| `features/shared/backend/static-files.js` | 静态资源映射，负责 `/features`、`/assets`、`/data` 等 URL 到新目录的解析。 |
| `features/shared/frontend/config.js` | 前端数据/API 路径、Leaflet 底图、地图中心和 DEM 配置。 |
| `features/shared/frontend/dom-utils.js` | 前端共享 DOM 查询与 HTML 转义工具。 |
| `features/shared/frontend/data-service.js` | 前端统一数据请求入口，API 失败时回退静态 JSON。 |
| `features/shared/frontend/map-utils.js` | 地图图标、弹窗、数值格式化等复用工具。 |
| `features/home/frontend/home-map.js` | 二维 Leaflet 主地图：初始化地图、加载路线图层、事件点、弹窗、筛选、播放。 |
| `features/home/frontend/home-ui.js` | 主页按钮、折叠面板、图例、播放控制等 UI 事件。 |
| `features/analysis/frontend/analysis-map.js` | 综合分析 Leaflet 地图：路线、事件、资源、缓冲区、难度等专题图层。 |
| `features/analysis/frontend/analysis-ui.js` | 分析页工具面板、图表、AI 解读、执行分析交互。 |
| `features/tourism/frontend/tourism.js` | 红色研学 Leaflet 地图：省界、资源点、路线规划、筛选和详情弹窗。 |
| `features/scene3d/frontend/scene3d.js` | Cesium 三维 DEM 场景，加载路线、事件点、测量与视角预设。 |

## Leaflet 地图关系

- 主页二维地图由 `home-map.js` 调用 `L.map()`、`L.tileLayer()`、`L.polyline()`、`L.marker()` 和 `L.layerGroup()`，底图仍使用 `APP_CONFIG.basemaps.ancient`，未替换为 Mapbox。
- 综合分析页由 `analysis-map.js` 初始化独立 Leaflet 地图，并保留山体阴影、路线、事件、资源、缓冲区和难度专题图层逻辑。
- 红色研学页由 `tourism.js` 初始化 Leaflet 地图，省界 GeoJSON 已改为优先读取 `/data/geojson/china-provinces.geojson`。
- 所有数据请求仍通过 `DataService` 或后端 API 统一进入，前端功能行为保持不变。

## 数据与资源

- `data/json/`：事件、资源、分析结果、三维焦点等业务 JSON。
- `data/routes/route-layer-config.json`：12 条路线图层配置。
- `data/routes/route-layers/`：12 个独立路线 GeoJSON FeatureCollection（文件后缀为 `.json`）。
- `data/geojson/china-provinces.geojson`：旅游页使用的本地中国省界数据。
- `assets/images/`：页面图片、诗词图片、主页海报图和研学路线示意图。
- `assets/icons/map-scroll.svg`：卷轴/地图风格 SVG 图标。

## 启动方式

```powershell
cd "C:\Users\Kou Jiawei\Desktop\long-march-competition\long-march-competition"
npm.cmd start
```

浏览器打开 `http://localhost:8096`。如 8096 端口被占用，可临时设置 `PORT` 后启动。

## 后续维护建议

- 新增业务 JSON 放入 `data/json/`，新增路线图层放入 `data/routes/route-layers/`，新增 GeoJSON 边界数据放入 `data/geojson/`。
- 新增图片使用 `/assets/images/...`，新增图标使用 `/assets/icons/...`。
- 不要在页面中直接恢复 `/assets/data` 或 `/assets/img` 旧路径。
- Leaflet 底图地址集中维护在 `features/shared/frontend/config.js`，不要在页面脚本中分散修改。
