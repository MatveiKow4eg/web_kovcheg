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
  renderCartWidget(); // Используем единую функцию обновления
}

// Обновление количества товара в корзине
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

// Единая функция обновления виджета корзины
function renderCartWidget() {
  const cart = getCart();
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const goToCartBtn = document.getElementById('go-to-cart');
  
  // Если виджет не найден, выходим
  if (!countEl) return;

  // Обновляем счетчик
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = totalQty;

  // Если нет элементов dropdown, значит мы не на странице с полным виджетом
  if (!itemsEl || !totalEl) return;

  // Обновляем итоговую сумму
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  totalEl.textContent = `Итого: ${totalPrice.toFixed(2)} €`;

  // Очищаем и заполняем список товаров
  itemsEl.innerHTML = '';
  
  if (cart.length === 0) {
    itemsEl.innerHTML = '<li>Корзина пуста</li>';
    if (goToCartBtn) goToCartBtn.style.display = 'none';
  } else {
    if (goToCartBtn) goToCartBtn.style.display = 'block';
    
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

    // Добавляем обработчики для кнопок +/-
    document.querySelectorAll('.qty-btn').forEach(btn => {
      btn.onclick = null; // Удаляем старые обработчики
      const id = btn.dataset.id;
      if (btn.classList.contains('plus')) {
        btn.onclick = () => updateQty(id, 1);
      } else if (btn.classList.contains('minus')) {
        btn.onclick = () => updateQty(id, -1);
      }
    });
  }
}

// Создание виджета корзины
function createCartWidget() {
  // Проверяем, не создан ли виджет уже
  if (document.getElementById('cart-widget')) return;
  
  const widget = document.createElement('div');
  widget.id = 'cart-widget';
  widget.innerHTML = `
    <div id="cart-icon">🛒 <span id="cart-count">0</span></div>
    <div id="cart-dropdown" class="hidden">
      <ul id="cart-items"></ul>
      <div id="cart-total">Итого: 0 €</div>
      <button id="go-to-cart">Перейти в корзину</button>
    </div>
  `;
  document.body.appendChild(widget);

  // Обработчик клика по иконке корзины
  document.getElementById('cart-icon').addEventListener('click', () => {
    document.getElementById('cart-dropdown').classList.toggle('hidden');
  });

  // Обработчик перехода в корзину
  document.getElementById('go-to-cart').addEventListener('click', () => {
    window.location.href = 'cart.html';
  });

  // Первоначальное заполнение виджета
  renderCartWidget();
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  // Создаем виджет корзины на всех страницах
  createCartWidget();

  // Если есть каталог, загружаем товары
  const catalog = document.getElementById('catalog');
  if (catalog) {
    try {
      const products = await getProducts();

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
            <button class="buy-btn" data-id="${product.id}">Купить</button>
          </div>
        `;

        const btn = card.querySelector('.buy-btn');
        btn.addEventListener('click', (e) => {
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

// Экспортируем функции для использования на других страницах
window.addToCart = addToCart;
window.getCart = getCart;
window.renderCartWidget = renderCartWidget;