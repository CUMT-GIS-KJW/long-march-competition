/**
 * PostgreSQL + PostGIS 接入占位。
 *
 * 当前电脑已经准备安装数据库软件，但还没有完成库、用户、PostGIS 扩展和 SHP 导入。
 * 因此 server/app.js 暂时使用 static-shp-adapter：
 *
 * 1. 前端仍然访问 /api/route-layers、/api/events 等正式接口。
 * 2. 后端当前从 public/assets/data/*.json 返回数据。
 * 3. 数据库配置完成后，只需要把这些接口的数据源换成 pg 查询。
 *
 * 数据库导入原则：
 * - 不合并路线 SHP。
 * - 不改原始字段名。
 * - 每个路线 SHP 独立导入一张表。
 * - route_layer_config 只保存图层配置和表名白名单。
 */
module.exports = {
  enabled: false,
  driver: "pg",
  database: "long_march_webgis",
  reason: "PostgreSQL/PostGIS 尚未完成配置，当前使用本地 SHP 适配 JSON。",
};
