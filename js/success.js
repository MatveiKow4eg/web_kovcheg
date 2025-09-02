(function () {
  try {
    // Очистим локальную корзину, так как заказ оплачен
    localStorage.removeItem('cart');

    // Отобразим часть ID сессии как номер заказа
    const p = new URLSearchParams(window.location.search);
    const sid = p.get('session_id');
    if (sid) {
      const short = sid.slice(-10);
      const el = document.getElementById('order-info');
      if (el) {
        el.textContent = `Номер заказа: ${short}`;
        el.hidden = false;
      }
    }
  } catch (e) {
    console.warn('Success page init error:', e);
  }
})();
