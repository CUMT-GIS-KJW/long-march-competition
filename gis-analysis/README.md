# GIS 分析脚本说明

这个文件夹用于把项目中的 GIS 分析计算独立出来，页面代码不需要直接承担数据处理。

## 运行方式

在项目根目录执行：

```bash
npm run gis:analysis
```

脚本会读取：

- `data/routes/route-layer-config.json`
- `data/routes/route-layers/*.json`
- `data/json/events-important.json`
- `data/json/resources.json`

并重新生成：

- `data/json/analysis-summary.json`
- `data/json/analysis-province.json`
- `data/json/analysis-elevation.json`
- `data/json/analysis-buffer.json`
- `data/json/analysis-stage.json`
- `data/json/analysis-node-types.json`
- `data/json/analysis-routes.json`

## 当前实现

- 路线统计：使用 Haversine 球面距离计算路线长度。
- 省域统计：首次运行时下载公开中国省级边界 GeoJSON，将路线段中点、事件点和资源点落入省界面后统计。
- 地形剖面：使用 3D 页面同源的 AWS Terrain Tiles Terrarium DEM 瓦片采样；无法联网时使用关键地形控制点插值兜底。
- 缓冲分析：计算事件点、资源点到路线的最近距离，统计 5km、10km、20km 覆盖数量。
- 阶段统计：按事件阶段统计事件数量，并按事件占比分配路线里程。
- 路线级结果：为每条独立路线生成 `summary/province/elevation/buffer/stage/nodeTypes/resourceTypes`，前端按当前选择路线展示。

## 数据来源与缓存

- 省级边界：`https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json`
- DEM：`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`

下载后的数据会缓存在 `gis-analysis/cache/`，后续运行优先使用缓存。

## 代码优化点

- 省界判断增加边界框预筛，先排除不可能落入的省份，再执行点面关系判断。
- DEM 瓦片增加内存缓存，同一次运行中相同瓦片不会重复解析。
- 点位距离计算增加无效坐标过滤，避免少量脏数据导致脚本中断。
- 省界公开数据下载失败时，会退回已有点位参考统计；缓存存在时优先使用缓存。

## 后续升级

如果补充正式省界数据或 DEM 栅格，可以在这个目录中增加严格版本：

- 省域统计：改为路线与省界面叠加。
- 地形剖面：改为从 DEM 栅格按路线采样。
- 热点分析：改为核密度或网格聚合后输出 GeoJSON。
