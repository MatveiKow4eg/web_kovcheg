import { db } from './firebase.js';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Получаем товары из Firestore постранично
async function getProductsPage(pageSize = 12, cursor = null) {
  const productsCol = collection(db, 'products');
  let q = query(productsCol, orderBy('__name__'), limit(pageSize));
  if (cursor) {
    q = query(productsCol, orderBy('__name__'), startAfter(cursor), limit(pageSize));
  }
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const lastVisible = snapshot.docs[snapshot.docs.length - 1] || cursor;
  return { items, lastVisible };
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

  // Состояние пагинации
  let products = [];
  let lastDoc = null;
  const PAGE_SIZE = 12; // уменьшите/увеличьте при необходимости

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
  // hide scrollbars for desktop carousel + loader
  catStyle.textContent += `
    .is-carousel::-webkit-scrollbar{display:none}
    .is-carousel{scrollbar-width:none;-ms-overflow-style:none}
    .catalog-loader{display:flex;align-items:center;justify-content:center;min-height:360px;width:100%}
    .catalog-loader .logo{width:96px;height:96px;animation:catalog-spin 1.2s linear infinite;opacity:1}
    @keyframes catalog-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
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

  // Логотип загрузки до получения данных
  const loader = document.createElement('div');
  loader.className = 'catalog-loader';
  loader.innerHTML = `<img class="logo" src="/public/optimized_img/index_img/logo/logo_black-40.webp" alt="Загрузка..." />`;
  catalog.appendChild(loader);

  const prevBtn = header.querySelector('.prev');
  const nextBtn = header.querySelector('.next');
  function updateArrows(){
    const maxScroll = catalog.scrollWidth - catalog.clientWidth;
    const left = catalog.scrollLeft || 0;
    prevBtn.disabled = left <= 1;
    nextBtn.disabled = left >= maxScroll - 1;
  }

  function buildCard(product){
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-image-container">
        <img class="main-img" src="${product.img || 'optimized_img/main-400.webp'}" alt="${product.name}" loading="lazy" decoding="async" fetchpriority="low">
        <img class="hover-img" src="${product.hoverImg || product.img || 'optimized_img/main-400.webp'}" alt="${product.name}" loading="lazy" decoding="async" fetchpriority="low">
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

  function renderAll(){
    catalog.innerHTML = '';
    products.forEach(p => catalog.appendChild(buildCard(p)));
    if (window.renderCartWidget) window.renderCartWidget(); else updateCartIcon(getCart());
    applyLayout();
  }

  function applyLayout(){
    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    const needCarousel = isDesktop && products.length > 4;
    if (needCarousel) {
      catalog.classList.add('is-carousel');
      catalog.style.display = 'flex';
      catalog.style.overflowX = 'auto';
      catalog.style.overflowY = 'hidden';
      catalog.style.gap = '24px';
      catalog.style.scrollSnapType = 'x mandatory';
      catalog.style.padding = '6px 8px';
      catalog.style.scrollPaddingLeft = '8px';
      catalog.querySelectorAll('.product-card').forEach((card) => {
        card.style.flex = '0 0 calc((100% - 72px)/4)';
        card.style.maxWidth = 'calc((100% - 72px)/4)';
        card.style.minWidth = 'calc((100% - 72px)/4)';
        card.style.scrollSnapAlign = 'start';
      });
    } else {
      // revert to CSS grid/flex from stylesheets (mobile keeps its horizontal scroll)
      catalog.removeAttribute('style');
      catalog.classList.remove('is-carousel');
      catalog.querySelectorAll('.product-card').forEach((card) => {
        card.style.flex = '';
        card.style.maxWidth = '';
        card.style.minWidth = '';
        card.style.scrollSnapAlign = '';
      });
    }
    requestAnimationFrame(updateArrows);
  }

  function scrollStep(sign = 1) {
    const firstCard = catalog.querySelector('.product-card');
    if (!firstCard) return;
    const styles = getComputedStyle(catalog);
    const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;
    const step = Math.round(firstCard.getBoundingClientRect().width + gap);
    catalog.scrollBy({ left: sign * step, behavior: 'smooth' });
  }

  async function loadNextPage() {
    const { items, lastVisible } = await getProductsPage(PAGE_SIZE, lastDoc);
    lastDoc = lastVisible;
    products.push(...items);
    renderAll();
  }

  prevBtn.addEventListener('click', () => {
    scrollStep(-1);
  });
  nextBtn.addEventListener('click', () => {
    scrollStep(1);
  });

  catalog.addEventListener('scroll', () => {
    window.requestAnimationFrame(updateArrows);
  });
  window.addEventListener('resize', applyLayout);

  // Первая страница каталога
  try {
    await loadNextPage();
  } catch (e) {
    console.error('Ошибка загрузки каталога', e);
    catalog.innerHTML = '<div class="catalog-loader">Не удалось загрузить каталог</div>';
  } finally {
    if (typeof loader !== 'undefined' && loader && loader.parentNode) {
      try { loader.remove(); } catch(_) { loader.parentNode.removeChild(loader); }
    }
  }

  // moved into renderAll()
});
