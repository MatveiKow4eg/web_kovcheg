// Инициализация после загрузки DOM — защищает от ошибок чтения null
document.addEventListener('DOMContentLoaded', () => {
  const catalog = document.getElementById('catalog');
  const scrollTrack = document.getElementById('productsScrollTrack');
  const scrollLeft = document.querySelector('.scroll-left');
  const scrollRight = document.querySelector('.scroll-right');

  const defaultImg = 'optimized_img/main-400.webp'; // запасная картинка

  // --- ДАННЫЕ ---
  const scrollProducts = [
    {
      id: 1,
      name: "Футболка Ковчег",
      description: "Качественная хлопковая футболка с логотипом лагеря",
      price: 25,
      img: "https://plus.unsplash.com/premium_photo-1667030474693-6d0632f97029?q=80&w=687&auto=format&fit=crop",
      overlay: "Популярное"
    },
    {
      id: 2,
      name: "Кружка с логотипом",
      description: "Керамическая кружка с символикой Ковчега",
      price: 18,
      img: "https://images.unsplash.com/photo-1514228742587-6b1558fcf93d?q=80&w=800&auto=format&fit=crop",
      overlay: "Новинка"
    },
    {
      id: 3,
      name: "Сумка-тоут",
      description: "Эко-сумка из натурального хлопка",
      price: 22,
      img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800&auto=format&fit=crop",
      overlay: null
    },
    {
      id: 4,
      name: "Браслет дружбы",
      description: "Плетёный браслет в цветах лагеря",
      price: 12,
      img: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800&auto=format&fit=crop",
      overlay: "Скидка"
    },
    {
      id: 5,
      name: "Блокнот Ковчег",
      description: "Тетрадь с мотивирующими цитатами",
      price: 15,
      img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop",
      overlay: null
    },
    {
      id: 6,
      name: "Кепка лагеря",
      description: "Бейсболка с вышивкой логотипа",
      price: 20,
      img: "https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=800&auto=format&fit=crop",
      overlay: "Хит продаж"
    }
  ];

  const products = [
    { id: 1, name: "Товар 1", description: "Описание товара 1", price: 10, img: "optimized_img/shop/product1.webp" },
    { id: 2, name: "Товар 2", description: "Описание товара 2", price: 15, img: "optimized_img/shop/product2.webp" },
    { id: 3, name: "Товар 3", description: "Описание товара 3", price: 20, img: "optimized_img/shop/product3.webp" }
  ];

  // Утилита создаёт <img> с запасным src при ошибке
  function makeImg(src, alt = '') {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.loading = 'lazy';
    img.onerror = () => {
      if (img.src !== defaultImg) {
        console.warn('Image failed, using fallback:', src);
        img.src = defaultImg;
      }
    };
    return img;
  }

  // --- СКРОЛЛ-ПАНЕЛЬ ---
  let currentScrollPosition = 0;
  const cardWidth = 304;
  const visibleCards = 4;

  function createScrollProductCard(product) {
    const card = document.createElement('div');
    card.className = 'scroll-product-card';
    card.style.cursor = 'pointer';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'product-image';
    imgWrap.appendChild(makeImg(product.img, product.name));
    if (product.overlay) {
      const ov = document.createElement('div');
      ov.className = 'product-overlay';
      ov.textContent = product.overlay;
      imgWrap.appendChild(ov);
    }

    const content = document.createElement('div');
    content.className = 'card-content';
    content.innerHTML = `<h4>${product.name}</h4><p class="description">${product.description}</p><p class="price">${product.price} €</p>`;

    card.appendChild(imgWrap);
    card.appendChild(content);

    card.addEventListener('click', () => {
      window.location.href = `/products/${product.id}`;
    });

    return card;
  }

  function renderScrollProducts() {
    if (!scrollTrack) return;
    scrollTrack.style.display = 'flex';
    scrollProducts.forEach(p => scrollTrack.appendChild(createScrollProductCard(p)));
  }

  function updateScrollButtons(scrollLeftEl, scrollRightEl) {
    if (!scrollLeftEl || !scrollRightEl) return;
    const maxScroll = Math.max(0, (scrollProducts.length - visibleCards) * cardWidth);
    scrollLeftEl.disabled = currentScrollPosition <= 0;
    scrollRightEl.disabled = currentScrollPosition >= maxScroll;
  }

  function scrollToPosition(position) {
    if (!scrollTrack) return;
    const max = Math.max(0, (scrollProducts.length - visibleCards) * cardWidth);
    currentScrollPosition = Math.max(0, Math.min(position, max));
    scrollTrack.style.transform = `translateX(-${currentScrollPosition}px)`;
    updateScrollButtons(scrollLeft, scrollRight);
  }

  if (scrollLeft) {
    scrollLeft.addEventListener('click', () => scrollToPosition(currentScrollPosition - cardWidth));
  }
  if (scrollRight) {
    scrollRight.addEventListener('click', () => scrollToPosition(currentScrollPosition + cardWidth));
  }

  window.addEventListener('resize', () => {
    const container = document.querySelector('.scroll-container');
    if (!container) return;
    const containerWidth = container.offsetWidth;
    const newVisible = Math.floor((containerWidth - 80) / cardWidth);
    if (newVisible !== visibleCards) {
      currentScrollPosition = 0;
      scrollToPosition(0);
    }
  });

  if (scrollTrack) {
    renderScrollProducts();
    updateScrollButtons(scrollLeft, scrollRight);
  }

  // --- КАТАЛОГ ---
  function renderCatalog() {
    if (!catalog) return;
    products.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.style.cursor = 'pointer';

      const imgEl = makeImg(product.img, product.name);
      const content = document.createElement('div');
      content.className = 'card-content';
      content.innerHTML = `<h4>${product.name}</h4><p>${product.description}</p><p class="price">${product.price} €</p>`;

      const btn = document.createElement('button');
      btn.className = 'buy-btn';
      btn.type = 'button';
      btn.dataset.id = product.id;
      btn.textContent = 'Купить';

      content.appendChild(btn);
      card.appendChild(imgEl);
      card.appendChild(content);

      card.addEventListener('click', (e) => {
        if (e.target === btn || e.target.classList.contains('buy-btn')) {
          e.stopPropagation();
          handleBuyButtonClick(product.id);
          return;
        }
        window.location.href = `/products/${product.id}`;
      });

      catalog.appendChild(card);
    });
  }

  function handleBuyButtonClick(productId) {
    const product = products.find(p => p.id == productId);
    if (product) {
      alert(`Быстрая покупка: ${product.name}\nСтоимость: ${product.price} €`);
    }
  }

  renderCatalog();
});