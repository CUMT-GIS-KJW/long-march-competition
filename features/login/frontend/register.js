(function () {
    const form = document.getElementById("registerForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const message = document.getElementById("registerMessage");

    // API 地址
    const API_BASE = '/api/auth';

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const user = username.value.trim();
        const pass = password.value.trim();

        // 验证
        if (!user) {
            message.textContent = '请输入用户名';
            message.classList.add('error');
            username.focus();
            return;
        }

        if (user.length < 3 || user.length > 50) {
            message.textContent = '用户名长度必须在3-50个字符之间';
            message.classList.add('error');
            username.focus();
            return;
        }

        if (!pass) {
            message.textContent = '请输入密码';
            message.classList.add('error');
            password.focus();
            return;
        }

        if (pass.length < 6) {
            message.textContent = '密码长度至少6位';
            message.classList.add('error');
            password.focus();
            return;
        }

        message.textContent = '注册中...';
        message.classList.remove('error');

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });

            const result = await response.json();

            if (result.code === 200) {
                message.textContent = '✅ 注册成功！正在跳转登录...';
                message.classList.remove('error');
                
                setTimeout(() => {
                    window.location.href = '/features/login/frontend/index.html';
                }, 1500);
            } else {
                message.textContent = `❌ ${result.message}`;
                message.classList.add('error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            message.textContent = '❌ 网络连接失败';
            message.classList.add('error');
        }
    });

    // 输入时清除错误
    [username, password].forEach(input => {
        input.addEventListener('input', () => {
            if (message.classList.contains('error')) {
                message.classList.remove('error');
                message.textContent = '';
            }
        });
    });
})();