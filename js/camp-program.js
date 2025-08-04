console.log('camp-program.js LOADED');

document.addEventListener('DOMContentLoaded', function() {
  // ==== HEADER: бургер-меню ====
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.main-nav');

  if (burger && nav) {
    burger.addEventListener('click', function() {
      burger.classList.toggle('open');
      nav.classList.toggle('open');
      console.log('burger:', burger.className, 'nav:', nav.className);
    });

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', function() {
        nav.classList.remove('open');
        burger.classList.remove('open');
      });
    });
  } else {
    console.log('Не найден burger или nav');
  }

  // ==== КАРУСЕЛЬ ПРОГРАММЫ (drag/scroll с "бесконечной" лентой) ====
  const carousel = document.getElementById('carousel-track');
  if (carousel) {
    // Клонируем карточки только 1 раз
    const originalCards = Array.from(carousel.children);
    originalCards.forEach(card => {
      carousel.appendChild(card.cloneNode(true));
    });

    // Получение полной ширины одной карточки (учитывая margin)
    function getCardWidth() {
      const card = carousel.children[0];
      if (!card) return 0;
      const cardStyle = getComputedStyle(card);
      return card.offsetWidth +
        parseInt(cardStyle.marginLeft) +
        parseInt(cardStyle.marginRight);
    }

    // Drag/scroll логика
    let isDown = false, startX, scrollLeft;
    carousel.addEventListener('mousedown', (e) => {
      isDown = true;
      carousel.classList.add('dragging');
      startX = e.pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });
    carousel.addEventListener('mouseleave', () => {
      isDown = false;
      carousel.classList.remove('dragging');
    });
    carousel.addEventListener('mouseup', () => {
      isDown = false;
      carousel.classList.remove('dragging');
    });
    carousel.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - carousel.offsetLeft;
      const walk = (x - startX) * 1.5;
      carousel.scrollLeft = scrollLeft - walk;
      checkInfiniteScroll();
    });

    // Touch events (мобильные)
    carousel.addEventListener('touchstart', function(e) {
      isDown = true;
      startX = e.touches[0].pageX - carousel.offsetLeft;
      scrollLeft = carousel.scrollLeft;
    });
    carousel.addEventListener('touchend', function() {
      isDown = false;
    });
    carousel.addEventListener('touchmove', function(e) {
      if (!isDown) return;
      const x = e.touches[0].pageX - carousel.offsetLeft;
      const walk = (x - startX) * 1.2;
      carousel.scrollLeft = scrollLeft - walk;
      checkInfiniteScroll();
    });

    // "Бесконечная" прокрутка: прыжок в начало/конец, если дошли до конца/начала
    function checkInfiniteScroll() {
      const cardWidth = getCardWidth();
      const n = originalCards.length;
      // Переброс в начало, если ушли слишком вправо
      if (carousel.scrollLeft > n * cardWidth) {
        carousel.scrollLeft -= n * cardWidth;
      }
      // Переброс в конец, если ушли слишком влево
      if (carousel.scrollLeft < 0) {
        carousel.scrollLeft += n * cardWidth;
      }
    }

    // Если хочешь при старте быть не в самом начале, а чуть дальше (чтобы можно было листать и влево, и вправо):
    // carousel.scrollLeft = 1;

    // Если хочешь, чтобы при resize корректировалась позиция — можно реализовать window.addEventListener('resize', ...)
  }

  // ==== Анимация счёта (статистика) ====
  const counters = document.querySelectorAll('.count');
  const animateCount = (el) => {
    const target = +el.dataset.target;
    const numberSpan = el.querySelector('.number');
    let count = 0;
    const speed = Math.max(1, 2000 / target);

    const update = () => {
      count += 1;
      numberSpan.textContent = count;
      if (count < target) {
        setTimeout(update, speed);
      } else {
        numberSpan.textContent = target;
      }
    };
    update();
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(counter => {
    observer.observe(counter);
  });

  // ==== scrolling-banner-wrapper ====
  const bannerTrack = document.getElementById("scroll-track");
  const clone = document.getElementById("scroll-track-clone");
  if (bannerTrack && clone) {
    clone.innerHTML = bannerTrack.innerHTML;
    const animateBanner = () => {
      const scrollY = window.scrollY;
      const offset = scrollY * 0.5;
      const trackWidth = bannerTrack.offsetWidth;
      const translateX = -offset % trackWidth;
      bannerTrack.style.transform = `translateX(${translateX}px)`;
      clone.style.transform = `translateX(${translateX + trackWidth}px)`;
      requestAnimationFrame(animateBanner);
    };
    animateBanner();
  }

  // ==== Скролл-хидер ====
  let lastScrollY = window.scrollY;
  const header = document.querySelector('.main-header');
  window.addEventListener('scroll', () => {
    if (!header) return;
    if (window.scrollY > lastScrollY && window.scrollY > 80) {
      header.classList.add('hide-header');
    } else {
      header.classList.remove('hide-header');
    }
    lastScrollY = window.scrollY;
  });
});
