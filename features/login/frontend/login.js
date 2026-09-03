(function () {
    const form = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const message = document.getElementById("loginMessage");

    // ========== 固定管理员账号（不存数据库） ==========
    const ADMIN_USER = 'admin';
    const ADMIN_PASS = '123456';

    // API 地址
    const API_BASE = '/api/auth';

    // ========== 页面加载时，清除所有登录状态 ==========
    // 这样每次打开登录页都是未登录状态，必须手动点击登录
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('loginType');

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const user = username.value.trim();
        const pass = password.value.trim();

        if (!user || !pass) {
            message.textContent = '请输入账号和密码';
            message.classList.add('error');
            return;
        }

        message.textContent = '登录中...';
        message.classList.remove('error');

        // ========== 1. 先检查固定管理员 ==========
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('username', 'admin');
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('loginType', 'admin');
            message.textContent = '✅ 管理员登录成功！';
            message.classList.remove('error');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 500);
            return;
        }

        // ========== 2. 普通用户：查数据库 ==========
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });

            const result = await response.json();

            if (result.code === 200) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('username', result.data.username);
                localStorage.setItem('isAdmin', 'false');
                localStorage.setItem('loginType', 'user');
                message.textContent = '✅ 登录成功！';
                message.classList.remove('error');
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 500);
            } else {
                message.textContent = `❌ ${result.message}`;
                message.classList.add('error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            message.textContent = '❌ 网络连接失败，请检查服务器';
            message.classList.add('error');
        }
    });

    // 输入时清除错误状态
    username.addEventListener('input', () => {
        if (message.classList.contains('error')) {
            message.classList.remove('error');
            message.textContent = '';
        }
    });

    password.addEventListener('input', () => {
        if (message.classList.contains('error')) {
            message.classList.remove('error');
            message.textContent = '';
        }
    });

    // ========== 完全移除自动跳转 ==========
    // 只有点击登录按钮成功后才会跳转
})();