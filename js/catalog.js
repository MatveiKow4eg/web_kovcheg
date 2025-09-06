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

  // Inject minimal styles for header and arrows
  const catStyle = document.createElement('style');
  catStyle.textContent = `
    .catalog-header{display:flex;align-items:center;justify-content:center;margin:8px 8px 12px 8px;position:relative;z-index:20}
    .catalog-title-wrap{display:flex;align-items:center;gap:8px}
    .catalog-title{font-family:'Inter',Arial,sans-serif;font-weight:900;letter-spacing:2px;font-size:18px;color:#111}
    .cat-arrow{background:#fff;border:1px solid #ddd;border-radius:999px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer}
    .cat-arrow:hover{background:#f2f2f2}
    .cat-arrow:disabled{opacity:.35;cursor:default;pointer-events:none}
    .cat-arrow{color:#111}
    .cat-arrow svg{width:24px;height:24px;pointer-events:none}
    .cat-arrow polyline{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .cat-arrow:focus-visible{outline:2px solid #111;outline-offset:2px}
  `;
  document.head.appendChild(catStyle);

  // Build header with title and arrows
  const sectionEl = catalog.parentElement;
  const header = document.createElement('div');
  header.className = 'catalog-header';
  header.innerHTML = `
    <div class="catalog-title-wrap">
      <button class="cat-arrow prev" aria-label="Previous">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-left"><title>Left</title><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="catalog-title">NEW</div>
      <button class="cat-arrow next" aria-label="Next">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-right"><title>Right</title><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `;
  sectionEl.insertBefore(header, catalog);

  const pageSize = 4;
  let page = 0;
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const prevBtn = header.querySelector('.prev');
  const nextBtn = header.querySelector('.next');
  function updateArrows(){
    // Всегда показываем стрелки; используем циклическую пагинацию
    prevBtn.style.display = '';
    nextBtn.style.display = '';
  }

  function buildCard(product){
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
      </div>`;

    const btn = card.querySelector('.image-buy-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.addToCart) window.addToCart(product); else addToCart(product);
    });

    const imgContainer = card.querySelector('.product-image-container');
    imgContainer.style.cursor = 'pointer';
    imgContainer.addEventListener('click', () => {
      window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
    });

    return card;
  }

  function renderPage(){
    catalog.innerHTML = '';
    const start = page * pageSize;
    const items = products.slice(start, start + pageSize);
    items.forEach(p => catalog.appendChild(buildCard(p)));
    updateArrows();
    if (window.renderCartWidget) window.renderCartWidget(); else updateCartIcon(getCart());
  }

  prevBtn.addEventListener('click', () => {
    page = (page - 1 + totalPages) % totalPages;
    renderPage();
  });
  nextBtn.addEventListener('click', () => {
    page = (page + 1) % totalPages;
    renderPage();
  });

  renderPage();

  // moved into renderPage()
});
