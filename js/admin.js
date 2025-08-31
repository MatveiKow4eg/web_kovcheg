// admin.js - админка с Firebase Auth + Firestore + Cloudinary (две картинки)
const loginForm = document.getElementById('loginForm');
const authSection = document.getElementById('authSection');
const adminSection = document.getElementById('adminSection');
const logoutBtn = document.getElementById('logoutBtn');
const productForm = document.getElementById('productForm');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('list');
const clearBtn = document.getElementById('clearBtn');

const CLOUD_NAME = 'do1v7twko';
const UPLOAD_PRESET = 'a7aogzsq';

const firebaseConfig = {
  apiKey: "AIzaSyDHNEIG6WOriQVmsxSJ9GkLQOluizstaYI",
  authDomain: "kovchegee.firebaseapp.com",
  projectId: "kovchegee",
  storageBucket: "kovchegee.firebasestorage.app",
  messagingSenderId: "576183567033",
  appId: "1:576183567033:web:52c9a991cb4038ba40d168",
  measurementId: "G-2G1M4MT7M6"
};

let auth, db;

// Инициализация Firebase
async function initFirebase() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js');
  const dbMod = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');

  initializeApp(firebaseConfig);
  auth = authMod.getAuth();
  db = dbMod.getFirestore();

  authMod.onAuthStateChanged(auth, user => {
    if (user) showAdmin();
    else showAuth();
  });
}

function showAuth() {
  authSection.hidden = false;
  adminSection.hidden = true;
}

function showAdmin() {
  authSection.hidden = true;
  adminSection.hidden = false;
  loadProducts();
}

// Вход/выход
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  status('Вход...');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const { signInWithEmailAndPassword, getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js');
    await signInWithEmailAndPassword(getAuth(), email, password);
    status('Вход выполнен');
  } catch (err) {
    console.error(err);
    status('Ошибка входа: ' + (err.message || err));
  }
});

logoutBtn.addEventListener('click', async () => {
  const { signOut, getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js');
  await signOut(getAuth());
  status('Выход выполнен');
});

// Загрузка в Cloudinary
async function uploadToCloudinary(file) {
  if (!file) return null;
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(url, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed: ' + res.statusText);
  const data = await res.json();
  return data.secure_url;
}

// Добавление нового товара
productForm.addEventListener('submit', async e => {
  e.preventDefault();
  status('Сохранение...');

  try {
    const name = document.getElementById('p_name').value.trim();
    const description = document.getElementById('p_description').value.trim();
    const price = parseFloat(document.getElementById('p_price').value) || 0;
    const overlay = document.getElementById('p_overlay').value.trim() || null;
    const mainFile = document.getElementById('p_file').files[0];
    const hoverFile = document.getElementById('p_hover_file').files[0];

    let imgUrl = '';
    let hoverImgUrl = '';

    if (mainFile) {
      status('Загрузка основной картинки...');
      imgUrl = await uploadToCloudinary(mainFile);
    }

    if (hoverFile) {
      status('Загрузка картинки для hover...');
      hoverImgUrl = await uploadToCloudinary(hoverFile);
    }

    const { addDoc, collection } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
    await addDoc(collection(db, 'products'), {
      name,
      description,
      price,
      overlay,
      img: imgUrl || '',
      hoverImg: hoverImgUrl || '',
      createdAt: new Date()
    });

    status('Товар сохранён');
    productForm.reset();
    loadProducts();

  } catch (err) {
    console.error(err);
    status('Ошибка: ' + (err.message || err));
  }
});

clearBtn.addEventListener('click', () => productForm.reset());

// Загрузка списка товаров
async function loadProducts() {
  listEl.innerHTML = '<li>Загрузка...</li>';
  try {
    const { collection, getDocs, doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
    const snap = await getDocs(collection(db, 'products'));
    listEl.innerHTML = '';

    snap.forEach(d => {
      const data = d.data();
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '12px';
      li.style.marginBottom = '10px';

      const mainImg = document.createElement('img');
      mainImg.src = data.img || 'optimized_img/main-400.webp';
      mainImg.alt = data.name || '';
      mainImg.style.width = '60px';
      mainImg.style.height = '60px';
      mainImg.style.objectFit = 'cover';
      mainImg.style.borderRadius = '6px';

      const hoverImg = document.createElement('img');
      hoverImg.src = data.hoverImg || '';
      hoverImg.alt = data.name + ' hover';
      hoverImg.style.width = '60px';
      hoverImg.style.height = '60px';
      hoverImg.style.objectFit = 'cover';
      hoverImg.style.borderRadius = '6px';
      hoverImg.style.opacity = '0.7';

      const meta = document.createElement('div');
      meta.style.flex = '1';
      meta.innerHTML = `
        <strong>${escapeHtml(data.name)}</strong>
        <div style="color:#6b7a74;font-size:0.9rem">${escapeHtml(data.description || '')}</div>
        <div style="font-weight:800;margin-top:6px">${data.price} €</div>
      `;

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Удалить';
      delBtn.className = 'muted';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Удалить товар?')) return;
        await deleteDoc(doc(db, 'products', d.id));
        loadProducts();
      });

      li.appendChild(mainImg);
      li.appendChild(hoverImg);
      li.appendChild(meta);
      li.appendChild(delBtn);
      listEl.appendChild(li);
    });

    if (!listEl.children.length) listEl.innerHTML = '<li>Нет товаров</li>';

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<li>Ошибка загрузки</li>';
  }
}

function status(txt) { statusEl.textContent = txt || ''; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Старт
initFirebase().catch(err => {
  console.error('Init Firebase failed', err);
  status('Не удалось инициализировать Firebase: ' + (err.message || err));
});
