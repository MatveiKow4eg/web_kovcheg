document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('show-cards-btn');
  var cardsBlock = document.getElementById('about-cards');
  var cards = cardsBlock ? cardsBlock.querySelectorAll('.about-card') : [];
  if (btn && cardsBlock) {
    btn.addEventListener('click', function () {
      cardsBlock.style.display = 'grid';
      btn.style.display = 'none';
      // Плавное появление карточек с задержкой
      cards.forEach(function(card, i) {
        setTimeout(function() {
          card.classList.add('visible');
        }, i * 120); // задержка между карточками (в мс)
      });
    });
  }
});








document.addEventListener('DOMContentLoaded', function() {
  const carousel = document.getElementById('themesCarousel');
  if (!carousel) return;

  // Дублируем карточки для бесконечной ленты
  carousel.innerHTML += carousel.innerHTML;

  // Останавливаем автопрокрутку при свайпе/клике
  let isDown = false, startX, scrollLeft;

  carousel.addEventListener('mousedown', (e) => {
    isDown = true;
    carousel.style.animationPlayState = 'paused';
    startX = e.pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
  });
  carousel.addEventListener('mouseleave', () => {
    isDown = false;
    carousel.style.animationPlayState = 'running';
  });
  carousel.addEventListener('mouseup', () => {
    isDown = false;
    carousel.style.animationPlayState = 'running';
  });
  carousel.addEventListener('mousemove', (e) => {
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.5;
    carousel.scrollLeft = scrollLeft - walk;
  });

  // Touch events для мобильных
  carousel.addEventListener('touchstart', function(e){
    isDown = true;
    carousel.style.animationPlayState = 'paused';
    startX = e.touches[0].pageX - carousel.offsetLeft;
    scrollLeft = carousel.scrollLeft;
  });
  carousel.addEventListener('touchend', function(){
    isDown = false;
    carousel.style.animationPlayState = 'running';
  });
  carousel.addEventListener('touchmove', function(e){
    if(!isDown) return;
    const x = e.touches[0].pageX - carousel.offsetLeft;
    const walk = (x - startX) * 1.2;
    carousel.scrollLeft = scrollLeft - walk;
  });
});










document.querySelectorAll('.faq-question').forEach(btn => {
  btn.onclick = function() {
    const item = btn.parentElement;
    item.classList.toggle('open');
    // закрывать другие открытые
    document.querySelectorAll('.faq-item').forEach(other => {
      if (other !== item) other.classList.remove('open');
    });
  }
});