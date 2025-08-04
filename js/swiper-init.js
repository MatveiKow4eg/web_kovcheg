document.addEventListener('DOMContentLoaded', function() {
new Swiper('.mySwiper', {
  loop: true,
  spaceBetween: 24,
  grabCursor: true,
  slidesPerView: 1.15,
  autoplay: {
    delay: 1200, // было 2500, стало быстрее
    disableOnInteraction: false,
    pauseOnMouseEnter: true,
  },
  speed: 600, // было 1300, анимация быстрее
  breakpoints: {
    650: { slidesPerView: 2 },
    900: { slidesPerView: 3 },
    1200: { slidesPerView: 4 }
  }
});
});
