(function () {
  const form = document.getElementById("loginForm");
  const username = document.getElementById("username");
  const password = document.getElementById("password");
  const message = document.getElementById("loginMessage");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const user = username.value.trim() || "admin";
    const pass = password.value.trim() || "123456";

    if (user === "admin" && pass === "123456") {
      sessionStorage.setItem("longMarchLoggedIn", "true");
      message.classList.remove("error");
      message.textContent = "登录成功，正在进入二维主地图……";

      setTimeout(() => {
        window.location.href = "/index.html";
      }, 450);

      return;
    }

    message.classList.add("error");
    message.textContent = "账号或密码不正确。比赛演示账号：admin / 123456";
  });
})();
