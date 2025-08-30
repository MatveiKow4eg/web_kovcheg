// Product page functionality
class ProductPage {
  constructor() {
    this.productData = null;
    this.productId = null;
    this.init();
  }

  init() {
    // Get product ID from URL parameters
    this.productId = this.getProductIdFromUrl();
    
    if (!this.productId) {
      this.showError('Не указан ID товара');
      return;
    }

    // Load product data
    this.loadProduct(this.productId);
  }

  getProductIdFromUrl() {
    // Check URL parameters (?id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const idFromQuery = urlParams.get('id');
    
    if (idFromQuery) {
      return idFromQuery;
    }

    // Check if URL path contains product ID (/products/123)
    const pathParts = window.location.pathname.split('/');
    const productsIndex = pathParts.indexOf('products');
    
    if (productsIndex !== -1 && pathParts[productsIndex + 1]) {
      return pathParts[productsIndex + 1];
    }

    return null;
  }

  async loadProduct(productId) {
    try {
      // Show loading state
      this.showLoading();

      // In real implementation, this would be an API call
      // For demo, we'll use the same data as catalog
      const product = await this.fetchProductData(productId);
      
      if (!product) {
        this.showError('Товар не найден');
        return;
      }

      this.productData = product;
      this.renderProduct();
      
    } catch (error) {
      console.error('Error loading product:', error);
      this.showError('Ошибка загрузки товара');
    }
  }

  async fetchProductData(productId) {
    // Mock data - in real app this would be API call
    const mockProducts = {
      '1': {
        id: 1,
        name: "Футболка Ковчег",
        description: "Качественная хлопковая футболка с логотипом лагеря. Изготовлена из 100% органического хлопка, обеспечивает комфорт на весь день. Идеально подходит для повседневной носки и активного отдыха.",
        price: 25,
        img: "https://plus.unsplash.com/premium_photo-1667030474693-6d0632f97029?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        features: [
          "100% органический хлопок",
          "Размеры: S, M, L, XL, XXL",
          "Машинная стирка при 30°C",
          "Логотип нанесен методом шелкографии",
          "Произведено в Эстонии"
        ]
      },
      '2': {
        id: 2,
        name: "Кружка с логотипом",
        description: "Керамическая кружка с символикой Ковчега. Объем 350 мл, подходит для горячих и холодных напитков. Устойчива к мытью в посудомоечной машине.",
        price: 18,
        img: "https://images.unsplash.com/photo-1514228742587-6b1558fcf93d?q=80&w=800&auto=format&fit=crop",
        features: [
          "Объем: 350 мл",
          "Керамика высокого качества",
          "Подходит для посудомоечной машины",
          "Устойчивый к выцветанию принт",
          "Эргономичная ручка"
        ]
      },
      '3': {
        id: 3,
        name: "Сумка-тоут",
        description: "Эко-сумка из натурального хлопка. Прочная и вместительная, идеально подходит для покупок, учебы или путешествий. Экологически чистый материал.",
        price: 22,
        img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800&auto=format&fit=crop",
        features: [
          "100% натуральный хлопок",
          "Размер: 38x42 см",
          "Длинные ручки для комфортной носки",
          "Выдерживает вес до 10 кг",
          "Экологически чистый материал"
        ]
      },
      '4': {
        id: 4,
        name: "Браслет дружбы",
        description: "Плетёный браслет в цветах лагеря. Изготовлен вручную из качественных нитей. Символ дружбы и единства участников лагеря.",
        price: 12,
        img: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=800&auto=format&fit=crop",
        features: [
          "Ручная работа",
          "Регулируемый размер",
          "Водостойкие нити",
          "Цвета лагеря Ковчег",
          "Символ дружбы и единства"
        ]
      },
      '5': {
        id: 5,
        name: "Блокнот Ковчег",
        description: "Тетрадь с мотивирующими цитатами и символикой лагеря. 100 листов в линейку, твердая обложка. Идеально для записей, планирования и творчества.",
        price: 15,
        img: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop",
        features: [
          "100 листов в линейку",
          "Твердая обложка",
          "Мотивирующие цитаты внутри",
          "Размер: A5 (14.8 x 21 см)",
          "Качественная бумага 80г/м²"
        ]
      },
      '6': {
        id: 6,
        name: "Кепка лагеря",
        description: "Бейсболка с вышивкой логотипа. Регулируемый размер, качественный материал. Защищает от солнца и подчеркивает принадлежность к лагерю.",
        price: 20,
        img: "https://images.unsplash.com/photo-1521369909029-2afed882baee?q=80&w=800&auto=format&fit=crop",
        features: [
          "Регулируемый размер",
          "100% хлопок",
          "Вышивка высокого качества",
          "Изогнутый козырек",
          "Защита от UV-лучей"
        ]
      }
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return mockProducts[productId] || null;
  }

  showLoading() {
    const contentContainer = document.getElementById('productContent');
    const loadingTemplate = contentContainer.querySelector('.loading');
    const productTemplate = document.getElementById('productTemplate');
    const errorTemplate = document.getElementById('errorTemplate');

    loadingTemplate.style.display = 'block';
    productTemplate.style.display = 'none';
    errorTemplate.style.display = 'none';
  }

  showError(message) {
    const contentContainer = document.getElementById('productContent');
    const loadingTemplate = contentContainer.querySelector('.loading');
    const productTemplate = document.getElementById('productTemplate');
    const errorTemplate = document.getElementById('errorTemplate');

    // Update error message if provided
    if (message) {
      const errorContent = errorTemplate.querySelector('.error-content p');
      if (errorContent) {
        errorContent.textContent = message;
      }
    }

    loadingTemplate.style.display = 'none';
    productTemplate.style.display = 'none';
    errorTemplate.style.display = 'block';
  }

  renderProduct() {
    const contentContainer = document.getElementById('productContent');
    const loadingTemplate = contentContainer.querySelector('.loading');
    const productTemplate = document.getElementById('productTemplate');
    const errorTemplate = document.getElementById('errorTemplate');

    // Hide loading and error states
    loadingTemplate.style.display = 'none';
    errorTemplate.style.display = 'none';
    
    // Show product template
    productTemplate.style.display = 'grid';

    // Fill in product data
    this.updateProductElements();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Update page title
    document.title = `${this.productData.name} | Ковчег`;
  }

  updateProductElements() {
    const product = this.productData;

    // Update image
    const productImage = document.getElementById('productImage');
    productImage.src = product.img;
    productImage.alt = product.name;

    // Update title
    const productTitle = document.getElementById('productTitle');
    productTitle.textContent = product.name;

    // Update price
    const productPrice = document.getElementById('productPrice');
    productPrice.textContent = `${product.price} €`;

    // Update description
    const productDescription = document.getElementById('productDescription');
    productDescription.textContent = product.description;

    // Update features
    const featuresList = document.getElementById('productFeatures');
    featuresList.innerHTML = '';
    
    if (product.features) {
      product.features.forEach(feature => {
        const li = document.createElement('li');
        li.textContent = feature;
        featuresList.appendChild(li);
      });
    }
  }

  setupEventListeners() {
    const buyButton = document.getElementById('buyButton');
    const addToCartButton = document.getElementById('addToCartButton');

    buyButton.addEventListener('click', () => {
      this.handleBuyClick();
    });

    addToCartButton.addEventListener('click', () => {
      this.handleAddToCartClick();
    });
  }

  handleBuyClick() {
    // In real app, this would redirect to payment or checkout
    alert(`Покупка товара: ${this.productData.name}\nСтоимость: ${this.productData.price} €\n\nВ реальном приложении здесь был бы переход к оплате.`);
  }

  handleAddToCartClick() {
    // In real app, this would add to cart state/localStorage
    alert(`Товар "${this.productData.name}" добавлен в корзину!\n\nВ реальном приложении здесь была бы корзина покупок.`);
    
    // Visual feedback
    const button = document.getElementById('addToCartButton');
    const originalText = button.textContent;
    button.textContent = 'Добавлено!';
    button.style.background = '#4CAF50';
    button.style.borderColor = '#4CAF50';
    button.style.color = 'white';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
      button.style.borderColor = '';
      button.style.color = '';
    }, 2000);
  }
}

// Initialize product page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProductPage();
});