import { db } from './firebase.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Получаем товары из Firestore
async function getProducts() {
  const productsCol = collection(db, 'products');
  const snapshot = await getDocs(productsCol);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Работа с корзиной в localStorage
function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

// Флаг для пульсации один раз
let cartHasPulsed = false;

// Пульс корзины
function triggerCartPulse() {
  const cartIcon = document.getElementById('cart-icon');
  if (!cartHasPulsed) {
    cartIcon.classList.add('pulse');
    cartHasPulsed = true;
  }
}

// Добавление товара в корзину
function addToCart(product) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      img: product.img,
      hoverImg: product.hoverImg || product.img,
      qty: 1
    });
  }

  saveCart(cart);
  renderCartWidget();

  triggerCartPulse();
}

// Обновление количества товара
function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    const index = cart.findIndex(i => i.id === productId);
    cart.splice(index, 1);
  }
  saveCart(cart);
  renderCartWidget();
}

// Рендер виджета корзины
function renderCartWidget() {
  const cart = getCart();
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const goToCartBtn = document.getElementById('go-to-cart');
  const continueBtn = document.getElementById('continue-shopping');
  const dropdown = document.getElementById('cart-dropdown');

  if (!countEl || !itemsEl || !totalEl) return;

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = totalQty;

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  totalEl.textContent = `Итого: ${totalPrice.toFixed(2)} €`;

  itemsEl.innerHTML = '';
  if (cart.length === 0) {
    itemsEl.innerHTML = '<li>Корзина пуста</li>';
    if (goToCartBtn) goToCartBtn.style.display = 'none';
    if (continueBtn) continueBtn.style.display = 'none';
    dropdown.classList.remove('show');
  } else {
    if (goToCartBtn) goToCartBtn.style.display = 'block';
    if (continueBtn) continueBtn.style.display = 'block';
    cart.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${item.img}" alt="${item.name}">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-price">${item.price} €</span>
          <div class="cart-item-controls">
            <button class="qty-btn minus" data-id="${item.id}">-</button>
            <span class="cart-item-qty">${item.qty}</span>
            <button class="qty-btn plus" data-id="${item.id}">+</button>
          </div>
          <span class="cart-item-total">${(item.price * item.qty).toFixed(2)} €</span>
        </div>
      `;
      itemsEl.appendChild(li);
    });
  }

  // Обработчики кнопок количества
  document.querySelectorAll('.qty-btn').forEach(btn => {
    btn.onclick = null;
    const id = btn.dataset.id;
    btn.onclick = (e) => {
      e.stopPropagation();
      btn.classList.contains('plus') ? updateQty(id, 1) : updateQty(id, -1);
    };
  });
}

// Создание виджета корзины
function createCartWidget() {
  if (document.getElementById('cart-widget')) return;

  const widget = document.createElement('div');
  widget.id = 'cart-widget';
  widget.innerHTML = `
    <div id="cart-icon">🛒 <span id="cart-count">0</span></div>
    <div id="cart-dropdown" class="hidden">
      <ul id="cart-items"></ul>
      <div id="cart-total">Итого: 0 €</div>
      <button id="go-to-cart">Перейти в корзину</button>
      <button id="continue-shopping">Продолжить покупки</button>
    </div>
  `;
  document.body.appendChild(widget);

  const icon = document.getElementById('cart-icon');
  const dropdown = document.getElementById('cart-dropdown');

  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
    icon.classList.remove('pulse');
  });

  document.getElementById('go-to-cart').addEventListener('click', () => {
    window.location.href = '/cart';
  });

  document.getElementById('continue-shopping').addEventListener('click', () => {
    dropdown.classList.remove('show'); // просто закрывает корзину
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && !icon.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

  renderCartWidget();
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
  createCartWidget();

  const catalog = document.getElementById('catalog');
  if (catalog) {
    try {
      const products = await getProducts();
      catalog.innerHTML = '';

      products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
          <div class="product-image-container">
            <img class="main-img" src="${product.img || 'optimized_img/main-400.webp'}" alt="${product.name}">
            <img class="hover-img" src="${product.hoverImg || product.img || 'optimized_img/main-400.webp'}" alt="${product.name}">
          </div>
          <div class="card-content">
            <h4>${product.name}</h4>
            <p>${product.description}</p>
            <p class="price">${product.price} €</p>
            <button class="buy-btn" data-id="${product.id}">Добавить в корзину</button>
          </div>
        `;

        card.querySelector('.buy-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          addToCart(product);
        });

        catalog.appendChild(card);
      });
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    }
  }
});

// Экспорт функций
window.addToCart = addToCart;
window.getCart = getCart;
window.renderCartWidget = renderCartWidget;
