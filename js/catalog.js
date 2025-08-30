const catalog = document.getElementById('catalog');

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

products.forEach(product => {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <img src="${product.img}" alt="${product.name}">
    <div class="card-content">
      <h4>${product.name}</h4>
      <p>${product.description}</p>
      <p class="price">${product.price} €</p>
      <button class="buy-btn" data-id="${product.id}">Купить</button>
    </div>
  `;
  catalog.appendChild(card);
});
