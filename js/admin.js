import { db } from './firebase.js';
import { collection, getDocs, orderBy, query, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const fmt = new Intl.NumberFormat('ru-EE', { style: 'currency', currency: 'EUR' });

async function loadOrdersAgg() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  let totalOrders = 0;
  let totalRevenue = 0;
  let totalQty = 0;
  const byItem = new Map(); // key: name, value: { qty, revenue }

  snap.forEach(d => {
    const o = d.data();
    if (!o || o.status !== 'paid') return;
    totalOrders += 1;
    const currency = (o.currency || 'eur').toUpperCase();
    totalRevenue += Number(o.total || 0);

    const items = Array.isArray(o.items) ? o.items : [];
    for (const it of items) {
      const name = String(it.name || 'Товар');
      const qty = Number(it.quantity || 0);
      const amount = Number(it.amount_total || 0);
      totalQty += qty;
      const prev = byItem.get(name) || { qty: 0, revenue: 0 };
      prev.qty += qty;
      prev.revenue += amount;
      byItem.set(name, prev);
    }
  });

  document.getElementById('stat-orders').textContent = String(totalOrders);
  document.getElementById('stat-revenue').textContent = fmt.format(totalRevenue);
  document.getElementById('stat-qty').textContent = String(totalQty);

  const tbody = document.querySelector('#sold-table tbody');
  tbody.innerHTML = '';
  for (const [name, v] of byItem.entries()) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${v.qty}</td>
      <td>${fmt.format(v.revenue)}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadProductsEditor() {
  const snap = await getDocs(collection(db, 'products'));
  const tbody = document.querySelector('#products-table tbody');
  tbody.innerHTML = '';
  snap.forEach(d => {
    const p = d.data();
    const id = d.id;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(p.name || '')}</td>
      <td><input class="input" type="number" step="0.01" min="0" value="${Number(p.price || 0).toFixed(2)}" data-id="${id}" /></td>
      <td><button class="btn ok" data-action="save" data-id="${id}">Сохранить</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-action="save"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = tbody.querySelector(`input[data-id="${CSS.escape(id)}"]`);
      const val = Number(input.value);
      if (!Number.isFinite(val) || val < 0.5) {
        alert('Цена должна быть не меньше 0.50 €');
        return;
      }
      btn.disabled = true;
      try {
        await updateDoc(doc(db, 'products', id), { price: val });
        btn.textContent = 'Готово';
        setTimeout(() => (btn.textContent = 'Сохранить'), 2000);
      } catch (e) {
        console.error('Update price error', e);
        alert('Не удалось сохранить цену');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

(async function init() {
  try {
    await loadOrdersAgg();
  } catch (e) {
    console.error('Load orders error', e);
  }
  try {
    await loadProductsEditor();
  } catch (e) {
    console.error('Load products error', e);
  }
})();
