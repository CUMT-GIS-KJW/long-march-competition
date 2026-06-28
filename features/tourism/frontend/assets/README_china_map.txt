卡通中国地图说明：

前端会优先读取 /assets/china-provinces.geojson。
如果该文件不存在，会自动尝试从 jsDelivr 与 DataV 线上加载中国省界 GeoJSON。
为了离线/稳定演示，建议把标准中国省界 GeoJSON 命名为 china-provinces.geojson，并放到项目 public/assets 或你的静态资源 /assets 目录下。
