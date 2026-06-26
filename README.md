# 红图绘长征 / Long March WebGIS

竞赛演示版按功能模块组织代码，每个功能目录同时包含前端与后端：

- `features/home/`：主地图、路线图层、事件播放、红色资源展示。
- `features/analysis/`：路线统计、地形剖面、缓冲区、节点和资源分析。
- `features/scene3d/`：Cesium 遵义会议核心三维场景。
- `features/agent/`：GIS 智能助手前端面板与后端对话接口。
- `features/shared/`：共享前端配置、数据服务、地图工具与后端公共工具。

数据文件保持在 `public/assets/data`，未随功能目录移动。

## 文档

- [GitHub 上传说明](docs/GitHub上传说明.md)
- [每个文件的作用](docs/文件作用说明.md)

## 运行

```powershell
cd "C:\Users\Kou Jiawei\Desktop\long-march-competition\long-march-competition"
npm.cmd start
```

打开 `http://localhost:8096`。如果 8096 被占用，可以临时换端口：

```powershell
$env:PORT="8097"
node server/app.js
```
