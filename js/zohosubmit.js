function handleZohoSubmit(e) {
  const form = e.target;
  const btn  = document.getElementById('zcWebOptin');
  const iframe = document.getElementById('zc_iframe');
  const success = document.getElementById('localSignupSuccess');

  if (!form || !btn || !iframe || !success) return true; // защита от ошибок

  // блокируем повторные клики
  btn.disabled = true;

  // Когда Zoho ответит в iframe — показываем "спасибо"
  const onLoad = () => {
    form.style.display = 'none';
    success.style.display = 'block';
  };
  iframe.addEventListener('load', onLoad, { once: true });

  return true; // важно: не отменяем submit
}
