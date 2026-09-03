const http = require("http");
const { URL } = require("url");
const { handleApi: handleAgentApi } = require("../features/agent/backend");
const { handleApi: handleAnalysisApi } = require("../features/analysis/backend");
const { handleApi: handleHomeApi } = require("../features/home/backend");
const { handleApi: handlePoetryApi } = require("../features/poetry/backend");
const { handleApi: handleScene3dApi } = require("../features/scene3d/backend");
const { handleApi: handleTourismApi } = require("../features/tourism/backend");
const { loadEnvFile } = require("../features/shared/backend/env");
const { PROJECT_ROOT } = require("../features/shared/backend/data-store");
const { send, sendError, sendSuccess } = require("../features/shared/backend/http");
const { serveStatic } = require("../features/shared/backend/static-files");

// 新增：数据库和登录
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
// 注意：原生的 http 模块无法直接使用 express-session，原生写法需要自己实现 token 或 session，这里暂时注释掉防止报错
// const session = require('express-session');

// 加载环境变量
loadEnvFile(PROJECT_ROOT);

const PORT = Number(process.env.PORT || 8096);

// ========== 新增：数据库连接 ==========
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',  // 改成你的MySQL密码
  database: 'red_map_db',
  waitForConnections: true,
  connectionLimit: 10
});
const promisePool = pool.promise();

// ========== 新增：初始化数据库表 ==========
async function initDB() {
  try {
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ 数据库表初始化完成');
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
  }
}
initDB();

// ========== 新增：登录注册路由 ==========
// 修改 1：修改函数的接收参数，直接解构 context 对象
async function handleLoginRoutes({ request: req, response: res, pathname }) {
  // 只处理 /api/auth/* 路径
  if (!pathname.startsWith('/api/auth/')) return false;

  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 解析 POST 请求体
  function parseBody() {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch { resolve({}); }
      });
    });
  }

  // 注册接口
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { username, password } = await parseBody();
    if (!username || !password) {
      res.end(JSON.stringify({ code: 400, message: '用户名和密码不能为空' }));
      return true;
    }
    try {
      // 检查用户是否存在
      const [existing] = await promisePool.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length > 0) {
        res.end(JSON.stringify({ code: 409, message: '用户名已存在' }));
        return true;
      }
      // 加密密码并保存
      const hash = await bcrypt.hash(password, 10);
      await promisePool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
      res.end(JSON.stringify({ code: 200, message: '注册成功' }));
    } catch (err) {
      res.end(JSON.stringify({ code: 500, message: '服务器错误' }));
    }
    return true;
  }

  // 登录接口
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, password } = await parseBody();
    if (!username || !password) {
      res.end(JSON.stringify({ code: 400, message: '用户名和密码不能为空' }));
      return true;
    }
    try {
      const [users] = await promisePool.query('SELECT * FROM users WHERE username = ?', [username]);
      if (users.length === 0) {
        res.end(JSON.stringify({ code: 401, message: '用户名或密码错误' }));
        return true;
      }
      const valid = await bcrypt.compare(password, users[0].password_hash);
      if (!valid) {
        res.end(JSON.stringify({ code: 401, message: '用户名或密码错误' }));
        return true;
      }
      // 登录成功
      res.end(JSON.stringify({ 
        code: 200, 
        message: '登录成功',
        data: { username: users[0].username }
      }));
    } catch (err) {
      res.end(JSON.stringify({ code: 500, message: '服务器错误' }));
    }
    return true;
  }

  return false;
}

// ========== API 处理器列表（加入登录路由） ==========
const apiHandlers = [
  handleLoginRoutes,  // 登录路由放在最前面
  handleAgentApi,
  handleHomeApi,
  handlePoetryApi,
  handleTourismApi,
  handleAnalysisApi,
  handleScene3dApi,
];

async function serveApi(request, response, pathname) {
  const context = {
    request,
    pathname,
    response,
    sendError,
    sendSuccess,
  };

  for (const handler of apiHandlers) {
    // 修改 2：原本这里传的是 context，但其它 handler 可能也是直接接收对象，所以改为解构传递即可
    // 确保传入的是 context 对象
    if (await handler(context)) {
      return true;
    }
  }
  return false;
}

function sendRequestError(response, error) {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (error instanceof URIError) {
    sendError(response, 400, "Malformed request path");
    return;
  }
  console.error(error);
  sendError(response, 500, "Internal Server Error");
}

async function handleRequest(request, response) {
  try {
    const url = new URL(
      request.url,
      `http://${request.headers.host || "localhost"}`,
    );

    if (request.method === "OPTIONS") {
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      send(response, 204, "");
      return;
    }

    if (url.pathname === "/api/health") {
      sendSuccess(response, {
        service: "Long March WebGIS",
        dataMode: "static-shp-adapter",
        featureLayout: "features/{feature}/frontend + backend",
      });
      return;
    }

    if (await serveApi(request, response, url.pathname)) {
      return;
    }

    serveStatic(request, response, url.pathname, send);
  } catch (error) {
    sendRequestError(response, error);
  }
}

function createServer() {
  return http.createServer((request, response) => {
    handleRequest(request, response);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Long March WebGIS: http://localhost:${PORT}`);
    console.log(`登录接口: http://localhost:${PORT}/api/auth/login`);
    console.log(`注册接口: http://localhost:${PORT}/api/auth/register`);
  });
}

module.exports = {
  createServer,
  serveApi,
};