// auth.js
(function() {
  const path = window.location.pathname;

  // Если мы уже на странице locked.html — ничего не делаем
  if (path === '/locked.html') return;

  // Проверяем куку
  if (!document.cookie.includes("auth_ok=1")) {
    const next = encodeURIComponent(path);
    window.location.href = "/locked.html?next=" + next;
  }
})();
