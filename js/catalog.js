const catalog = document.getElementById('catalog');
const scrollTrack = document.getElementById('productsScrollTrack');
const scrollLeft = document.querySelector('.scroll-left');
const scrollRight = document.querySelector('.scroll-right');

// Mock product data - matches products.js for consistency
const scrollProducts = [
  {
    id: 1,
    name: "Футболка Ковчег",
    description: "Качественная хлопковая футболка с логотипом лагеря",
    price: 25,
    img: "https://plus.unsplash.com/premium_photo-1667030474693-6d0632f97029?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    overlay: "Популярное",
    features: [
      "100% органический хлопок",
      "Размеры: S, M, L, XL, XXL",
      "Машинная стирка при 30°C",
      "Логотип нанесен методом шелкографии",
      "Произведено в Эстонии"
    ]
  },
  {
    id: 2,
    name: "Кружка с логотипом",
    description: "Керамическая кружка с символикой Ковчега",
    price: 18,
    img: "https://images.unsplash.com/photo-1514228742587-6b1558fcf93d?q=80&w=800&auto=format&fit=crop",
    overlay: "Новинка",
    features: [
      "Объем: 350 мл",
      "Керамика высокого качества",
      "Подходит для посудомоечной машины",
      "Устойчивый к выцветанию принт",
      "Эргономичная ручка"
    ]
  },
  {
    id: 3,
    name: "Сумка-тоут",
    description: "Эко-сумка из натурального хлопка",
    price: 22,
    img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800&auto=format&fit=crop",
    overlay: null,
    features: [
      "100% натуральный хлопок",
      "Размер: 38x42 см",
      "Длинные ручки для комфортной носки",
      "Выдерживает вес до 10 кг",
      "Экологически чистый материал"
    ]
  },
  {
    id: 4,
    name: "Браслет дружбы",
    description: "Плетёный браслет в цветах лагеря",
    price: 12,
    img: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800&auto=format&fit=crop",
    overlay: "Скидка",
    features: [
      "Ручная работа",
      "Регулируемый размер",
      "Водостойкие нити",
      "Цвета лагеря Ковчег",
      "Символ дружбы и единства"
    ]
  },
  {
    id: 5,
    name: "Блокнот Ковчег",
    description: "Тетрадь с мотивирующими цитатами",
    price: 15,
    img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop",
    overlay: null,
    features: [
      "100 листов в линейку",
      "Твердая обложка",
      "Мотивирующие цитаты внутри",
      "Размер: A5 (14.8 x 21 см)",
      "Качественная бумага 80г/м²"
    ]
  },
  {
    id: 6,
    name: "Кепка лагеря",
    description: "Бейсболка с вышивкой логотипа",
    price: 20,
    img: "https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=800&auto=format&fit=crop",
    overlay: "Хит продаж",
    features: [
      "Регулируемый размер",
      "100% хлопок",
      "Вышивка высокого качества",
      "Изогнутый козырек",
      "Защита от UV-лучей"
    ]
  }
];

const products = [
  {
    id: 1,
    name: "Товар 1",
    description: "Описание товара 1",
    price: 10,
    img: "optimized_img/shop/product1.webp"
  },
  {
    id: 2,
    name: "Товар 2",
    description: "Описание товара 2",
    price: 15,
    img: "optimized_img/shop/product2.webp"
  },
  {
    id: 3,
    name: "Товар 3",
    description: "Описание товара 3",
    price: 20,
    img: "optimized_img/shop/product3.webp"
  }
];

// Scroll panel functionality
let currentScrollPosition = 0;
const cardWidth = 304; // 280px width + 24px gap
const visibleCards = 4;

function createScrollProductCard(product) {
  const card = document.createElement('div');
  card.className = 'scroll-product-card';
  card.style.cursor = 'pointer';
  card.innerHTML = `
    <div class="product-image">
      <img src="${product.img}" alt="${product.name}" loading="lazy">
      ${product.overlay ? `<div class="product-overlay">${product.overlay}</div>` : ''}
    </div>
    <div class="card-content">
      <h4>${product.name}</h4>
      <p class="description">${product.description}</p>
      <p class="price">${product.price} €</p>
    </div>
  `;
  
  // Add click handler to navigate to product page
  card.addEventListener('click', () => {
    window.location.href = `/products/${product.id}`;
  });
  
  return card;
}

function renderScrollProducts() {
  scrollProducts.forEach(product => {
    const card = createScrollProductCard(product);
    scrollTrack.appendChild(card);
  });
}

function updateScrollButtons() {
  const maxScroll = (scrollProducts.length - visibleCards) * cardWidth;
  scrollLeft.disabled = currentScrollPosition <= 0;
  scrollRight.disabled = currentScrollPosition >= maxScroll;
}

function scrollToPosition(position) {
  currentScrollPosition = Math.max(0, Math.min(position, (scrollProducts.length - visibleCards) * cardWidth));
  scrollTrack.style.transform = `translateX(-${currentScrollPosition}px)`;
  updateScrollButtons();
}

scrollLeft.addEventListener('click', () => {
  scrollToPosition(currentScrollPosition - cardWidth);
});

scrollRight.addEventListener('click', () => {
  scrollToPosition(currentScrollPosition + cardWidth);
});

// Handle responsive behavior
function handleResize() {
  const containerWidth = document.querySelector('.scroll-container').offsetWidth;
  const newVisibleCards = Math.floor((containerWidth - 80) / cardWidth);
  if (newVisibleCards !== visibleCards) {
    currentScrollPosition = 0;
    scrollToPosition(0);
  }
}

window.addEventListener('resize', handleResize);

// Initialize scroll panel
if (scrollTrack) {
  renderScrollProducts();
  updateScrollButtons();
}

// Original catalog functionality
if (catalog) {
  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.style.cursor = 'pointer';
    card.innerHTML = `
      <img src="${product.img}" alt="${product.name}">
      <div class="card-content">
        <h4>${product.name}</h4>
        <p>${product.description}</p>
        <p class="price">${product.price} €</p>
        <button class="buy-btn" data-id="${product.id}">Купить</button>
      </div>
    `;
    
    // Add click handler to navigate to product page
    card.addEventListener('click', (e) => {
      // Don't navigate if buy button was clicked
      if (e.target.classList.contains('buy-btn')) {
        e.stopPropagation();
        handleBuyButtonClick(product.id);
        return;
      }
      window.location.href = `/products/${product.id}`;
    });
    
    catalog.appendChild(card);
  });
}

// Handle buy button clicks for catalog cards
function handleBuyButtonClick(productId) {
  const product = products.find(p => p.id == productId);
  if (product) {
    alert(`Быстрая покупка: ${product.name}\nСтоимость: ${product.price} €\n\nВ реальном приложении здесь был бы переход к оплате.`);
  }
}
