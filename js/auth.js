// auth.js
(function() {
  const path = window.location.pathname;

  // Не выполняем скрипт на странице locked.html
  if (path.endsWith('/locked.html')) return;

  // Проверяем куку
  if (!document.cookie.includes("auth_ok=1")) {
    const next = encodeURIComponent(path);
    window.location.href = "/locked.html?next=" + next;
  }
})();
