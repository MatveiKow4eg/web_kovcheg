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
    cart.push({ ...product, qty: 1 });
  }
  saveCart(cart);
  updateCartIcon(cart);
}

// Обновление иконки корзины
function updateCartIcon(cart) {
  const countEl = document.getElementById('cart-count');
  if (!countEl) return;
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  countEl.textContent = totalQty;
}

// Инициализация каталога
document.addEventListener('DOMContentLoaded', async () => {
  const catalog = document.getElementById('catalog');
  if (!catalog) return;

  // Очистка каталога перед рендером
  catalog.innerHTML = '';

  const products = await getProducts();

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';

    card.innerHTML = `
      <div class="product-image-container">
        <img class="main-img" src="${product.img || 'optimized_img/main-400.webp'}" alt="${product.name}">
        <img class="hover-img" src="${product.hoverImg || product.img || 'optimized_img/main-400.webp'}" alt="${product.name}">
        <button class="buy-btn image-buy-btn" data-id="${product.id}">Добавить в корзину</button>
      </div>
      <div class="card-content">
        <p>${product.description}</p>
        <p class="price">${product.price} €</p>
      </div>
    `;

    const btn = card.querySelector('.image-buy-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.addToCart) {
        window.addToCart(product);
      } else {
        addToCart(product);
      }
    });

    const imgContainer = card.querySelector('.product-image-container');
    imgContainer.style.cursor = 'pointer';

    // Add swipe dots on mobile
    const dots = document.createElement('div');
    dots.className = 'slider-dots';
    dots.innerHTML = '<span class="dot is-active"></span><span class="dot"></span>';
    imgContainer.appendChild(dots);

    // Touch swipe toggle between main and hover image on mobile
    let startX = 0, deltaX = 0, swiping = false, altShown = false;
    imgContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      deltaX = 0;
      swiping = true;
    }, { passive: true });

    imgContainer.addEventListener('touchmove', (e) => {
      if (!swiping) return;
      deltaX = e.touches[0].clientX - startX;
    }, { passive: true });

    imgContainer.addEventListener('touchend', () => {
      if (!swiping) return;
      swiping = false;
      if (Math.abs(deltaX) > 30) {
        altShown = !altShown;
        imgContainer.classList.toggle('show-hover', altShown);
        const dotEls = dots.querySelectorAll('.dot');
        if (dotEls.length >= 2) {
          dotEls[0].classList.toggle('is-active', !altShown);
          dotEls[1].classList.toggle('is-active', altShown);
        }
        // prevent click navigation after swipe
        imgContainer.dataset.swiped = '1';
        setTimeout(() => { delete imgContainer.dataset.swiped; }, 60);
      }
      deltaX = 0;
    });

    imgContainer.addEventListener('click', () => {
      if (imgContainer.dataset.swiped === '1') return;
      window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
    });

    catalog.appendChild(card);
  });

  if (window.renderCartWidget) {
    window.renderCartWidget();
  } else {
    updateCartIcon(getCart());
  }
});
