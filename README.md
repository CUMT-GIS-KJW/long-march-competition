# 红图绘长征 · WebGIS 测绘技能大赛项目

竞赛演示版采用两个核心页面：

- `index.html`：Leaflet 三军路线、连续路线动画、动态时间轴和节点详情。
- `analysis.html`：路线统计、地形剖面、缓冲、节点和红色资源分析。
- `scene3d.html`：Cesium 遵义会议核心三维场景。

## 运行

```powershell
cd F:\开发\long-march-competition
npm start
```

打开 `http://localhost:8096`。当前使用结构化 JSON，接口由 `server/app.js` 提供；后续可接 MySQL、PostGIS 或 GeoScene REST 服务。默认使用 8096 端口，以避开 GeoScene Portal/Tomcat 常用的 8080 端口。
