console.log('camp-program.js LOADED');

// Карусель программы
document.addEventListener('DOMContentLoaded', function() {
  // HEADER: бургер и меню
  const burger = document.querySelector('.burger');
  const nav = document.querySelector('.main-nav');

  if (burger && nav) {
    burger.addEventListener('click', function() {
      burger.classList.toggle('open');
      nav.classList.toggle('open');
      // Для теста — видно в консоли!
      console.log('burger:', burger.className, 'nav:', nav.className);
    });

    // Автоматически закрывать меню при выборе пункта
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', function() {
        nav.classList.remove('open');
        burger.classList.remove('open');
      });
    });
  } else {
    console.log('Не найден burger или nav');
  }

  // Карусель (программа лагеря)
  const track = document.getElementById('carousel-track');
  if (track) {
    const cards = Array.from(track.children);
    const visibleCards = 3;

    // Клонируем N первых карточек в конец
    for (let i = 0; i < visibleCards; i++) {
      const clone = cards[i].cloneNode(true);
      track.appendChild(clone);
    }

    let currentIndex = 0;
    let isTransitioning = false;

    function updateCarousel(animate = true) {
      const card = track.children[0];
      if (!card) return;
      const cardStyle = window.getComputedStyle(card);
      const cardWidth = card.offsetWidth + parseInt(cardStyle.marginLeft) + parseInt(cardStyle.marginRight);

      if (animate) {
        track.style.transition = 'transform 0.7s cubic-bezier(.55,0,.1,1)';
      } else {
        track.style.transition = 'none';
      }
      track.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
    }

    setInterval(() => {
      if (isTransitioning) return;
      currentIndex++;
      updateCarousel(true);

      // Проверка на клоны
      if (currentIndex === cards.length) {
        isTransitioning = true;
        setTimeout(() => {
          currentIndex = 0;
          updateCarousel(false);
          isTransitioning = false;
        }, 700);
      }
    }, 3500);

    window.addEventListener('resize', () => updateCarousel(false));
    updateCarousel(false);
  }

  // Анимация счёта (статистика)
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

  // scrolling-banner-wrapper
  const bannerTrack = document.getElementById("scroll-track");
  const clone = document.getElementById("scroll-track-clone");
  if (bannerTrack && clone) {
    clone.innerHTML = bannerTrack.innerHTML;

    let lastScrollY = 0;

    const animateBanner = () => {
      const scrollY = window.scrollY;
      const offset = scrollY * 0.5;

      const trackWidth = bannerTrack.offsetWidth;
      const translateX = -offset % trackWidth;

      bannerTrack.style.transform = `translateX(${translateX}px)`;
      clone.style.transform = `translateX(${translateX + trackWidth}px)`;

      lastScrollY = scrollY;
      requestAnimationFrame(animateBanner);
    };

    animateBanner();
  }

  // Скролл-хидер (прячем при скролле вниз)
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
