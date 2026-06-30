(function () {
  if (localStorage.getItem("isLoggedIn") === "true") {
    return;
  }

  if (window.location.pathname !== "/login.html") {
    window.location.href = "/login.html";
  }
})();
