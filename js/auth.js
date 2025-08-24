// auth.js
(function() {
  // Проверяем, есть ли кука auth_ok=1
  if (!document.cookie.includes("auth_ok=1")) {
    // Добавляем параметр next, чтобы после логина вернуться
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = "/locked.html?next=" + next;
  }
})();
