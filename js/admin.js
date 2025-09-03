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
    const weightVal = document.getElementById('p_weight') ? document.getElementById('p_weight').value : '';
    const weight = weightVal === '' ? null : Math.max(0, parseFloat(weightVal));
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
      weight: Number.isFinite(weight) ? weight : null,
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
    const { collection, getDocs, doc, deleteDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
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
      const currentPrice = Number(data.price || 0).toFixed(2);
      const currentWeight = data.weight ?? '';
      meta.innerHTML = `
        <strong>${escapeHtml(data.name)}</strong>
        <div style="color:#6b7a74;font-size:0.9rem">${escapeHtml(data.description || '')}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
          <label style="font-weight:600">Цена:</label>
          <input type="number" step="0.01" min="0" value="${currentPrice}" style="width:110px;padding:6px 8px;border-radius:6px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" data-price-id="${d.id}" />
          <span>€</span>
          <button class="save-price" data-id="${d.id}" style="padding:6px 10px;border-radius:8px;border:0;background:#16a34a;color:#fff;font-weight:700;cursor:pointer">Сохранить</button>
          <span style="width:16px"></span>
          <label style="font-weight:600">Вес (кг):</label>
          <input type="number" step="0.01" min="0" value="${currentWeight}" placeholder="0.00" style="width:110px;padding:6px 8px;border-radius:6px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" data-weight-id="${d.id}" />
          <button class="save-weight" data-id="${d.id}" style="padding:6px 10px;border-radius:8px;border:0;background:#0ea5e9;color:#fff;font-weight:700;cursor:pointer">Сохранить вес</button>
        </div>
      `;

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Удалить';
      delBtn.className = 'muted';
      delBtn.addEventListener('click', async () => {
        if (!confirm('Удалить товар?')) return;
        await deleteDoc(doc(db, 'products', d.id));
        loadProducts();
      });

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Редактировать';
      editBtn.style.padding = '6px 10px';
      editBtn.style.borderRadius = '8px';
      editBtn.style.border = '0';
      editBtn.style.background = '#2563eb';
      editBtn.style.color = '#fff';
      editBtn.style.fontWeight = '700';
      editBtn.style.cursor = 'pointer';
      editBtn.addEventListener('click', () => openProductEditor(d.id, data));

      // Вставляем элементы в DOM до поиска кнопки сохранения
      li.appendChild(mainImg);
      li.appendChild(hoverImg);
      li.appendChild(meta);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      listEl.appendChild(li);

      // Теперь найдём кнопки и привяжем обработчики
      const saveBtn = li.querySelector('.save-price');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const input = li.querySelector(`input[data-price-id="${d.id}"]`);
          const val = parseFloat(input.value);
          if (!Number.isFinite(val) || val < 0.5) {
            alert('Цена должна быть не меньше 0.50 €');
            return;
          }
          saveBtn.disabled = true;
          try {
            await updateDoc(doc(db, 'products', d.id), { price: val });
            saveBtn.textContent = 'Готово';
            setTimeout(() => { saveBtn.textContent = 'Сохранить'; }, 2000);
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить цену');
          } finally {
            saveBtn.disabled = false;
          }
        });
      }

      const saveW = li.querySelector('.save-weight');
      if (saveW) {
        saveW.addEventListener('click', async () => {
          const input = li.querySelector(`input[data-weight-id="${d.id}"]`);
          let val = input.value.trim();
          if (val === '') val = null; else val = Math.max(0, parseFloat(val));
          if (val !== null && !Number.isFinite(val)) {
            alert('Некорректный вес');
            return;
          }
          saveW.disabled = true;
          try {
            await updateDoc(doc(db, 'products', d.id), { weight: val });
            saveW.textContent = 'Готово';
            setTimeout(() => { saveW.textContent = 'Сохранить вес'; }, 2000);
          } catch (e) {
            console.error(e);
            alert('Не удалось сохранить вес');
          } finally {
            saveW.disabled = false;
          }
        });
      }
    });

    if (!listEl.children.length) listEl.innerHTML = '<li>Нет товаров</li>';

  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<li>Ошибка загрузки</li>';
  }
}

function status(txt) { statusEl.textContent = txt || ''; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Редактор товара (модальное окно)
function openProductEditor(id, data){
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  });
  const modal = document.createElement('div');
  Object.assign(modal.style, {
    width: 'min(720px, 94vw)', background: '#0e0f12', color: '#e5e7eb', borderRadius: '10px', padding: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
  });
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h3 style="margin:0">Редактирование товара</h3>
      <button id="editClose" style="background:#e5e7eb;color:#111;padding:6px 10px;border:0;border-radius:8px;cursor:pointer">Закрыть</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div>
        <label>Название</label>
        <input id="e_name" type="text" style="width:100%;padding:8px;border-radius:8px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" />
      </div>
      <div>
        <label>Бейдж (overlay)</label>
        <input id="e_overlay" type="text" placeholder="Популярно�� / Новинка" style="width:100%;padding:8px;border-radius:8px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" />
      </div>
      <div style="grid-column:1 / -1">
        <label>Описание</label>
        <textarea id="e_description" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb"></textarea>
      </div>
      <div>
        <label>Цена (€)</label>
        <input id="e_price" type="number" step="0.01" min="0" style="width:100%;padding:8px;border-radius:8px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" />
      </div>
      <div>
        <label>Вес (кг)</label>
        <input id="e_weight" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:8px;border-radius:8px;border:1px solid #2a2d33;background:#0e0f12;color:#e5e7eb" />
      </div>
      <div>
        <label>Основное изображение</label>
        <div style="display:flex;align-items:center;gap:8px">
          <img id="e_img_prev" src="${escapeHtml(data.img || '')}" alt="preview" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #2a2d33;background:#111" onerror="this.style.display='none'" />
          <input id="e_img" type="file" accept="image/*" />
        </div>
      </div>
      <div>
        <label>Изображение при наведении (hover)</label>
        <div style="display:flex;align-items:center;gap:8px">
          <img id="e_hover_prev" src="${escapeHtml(data.hoverImg || '')}" alt="preview" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #2a2d33;background:#111" onerror="this.style.display='none'" />
          <input id="e_hover" type="file" accept="image/*" />
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px">
      <button id="editSave" style="background:#16a34a;color:#fff;padding:10px 14px;border:0;border-radius:8px;font-weight:800;cursor:pointer">Сохранить изменения</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Заполнить текущие значения
  modal.querySelector('#e_name').value = data.name || '';
  modal.querySelector('#e_description').value = data.description || '';
  modal.querySelector('#e_price').value = Number(data.price || 0).toFixed(2);
  modal.querySelector('#e_weight').value = data.weight ?? '';
  modal.querySelector('#e_overlay').value = data.overlay || '';

  const close = () => overlay.remove();
  modal.querySelector('#editClose').addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });

  modal.querySelector('#editSave').addEventListener('click', async () => {
    const name = modal.querySelector('#e_name').value.trim();
    const description = modal.querySelector('#e_description').value.trim();
    const price = parseFloat(modal.querySelector('#e_price').value);
    let weightVal = modal.querySelector('#e_weight').value.trim();
    const overlayTxt = modal.querySelector('#e_overlay').value.trim();
    const fMain = modal.querySelector('#e_img').files[0];
    const fHover = modal.querySelector('#e_hover').files[0];

    if (!name) { alert('Название обязательно'); return; }
    if (!Number.isFinite(price) || price < 0.5) { alert('Цена должна быть не меньше 0.50 €'); return; }
    let weight = null; if (weightVal !== '') { weight = Math.max(0, parseFloat(weightVal)); if (!Number.isFinite(weight)) { alert('Некорректный вес'); return; } }

    const saveBtn = modal.querySelector('#editSave');
    saveBtn.disabled = true; saveBtn.textContent = 'Сохранение...';

    try {
      let imgUrl = data.img || '';
      let hoverImgUrl = data.hoverImg || '';
      if (fMain) { imgUrl = await uploadToCloudinary(fMain); }
      if (fHover) { hoverImgUrl = await uploadToCloudinary(fHover); }

      const { updateDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js');
      const payload = {
        name,
        description,
        price,
        weight: weight === null ? null : weight,
        overlay: overlayTxt || null,
        img: imgUrl || '',
        hoverImg: hoverImgUrl || '',
        updatedAt: new Date(),
      };
      await updateDoc(doc(db, 'products', id), payload);
      close();
      loadProducts();
    } catch (e) {
      console.error(e);
      alert('Не удалось сохранить изменения');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Сохранить изменения';
    }
  });
}

// Старт
initFirebase().catch(err => {
  console.error('Init Firebase failed', err);
  status('Не удалось инициализировать Firebase: ' + (err.message || err));
});
