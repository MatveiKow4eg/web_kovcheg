import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Инициализация Firebase Admin SDK из переменной окружения с JSON сервис-аккаунта
function initAdmin() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set');
  const key = JSON.parse(raw);
  initializeApp({ credential: cert(key), projectId: key.project_id });
}

function parseAdminEmails() {
  const s = process.env.ADMIN_EMAILS || '';
  return s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    initAdmin();
    const adminEmails = parseAdminEmails();

    // Извлекаем Firebase ID токен из заголовка Authorization: Bearer <token>
    const authz = req.headers['authorization'] || '';
    const m = /^Bearer\s+(.+)$/.exec(authz);
    if (!m) return res.status(401).json({ error: 'Missing Bearer token' });

    const idToken = m[1];
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);

    // Проверка, что email в списке администраторов
    const email = (decoded.email || '').toLowerCase();
    if (!email || (adminEmails.length && !adminEmails.includes(email))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const db = getFirestore();

    // Загружаем все оплаченные заказы и агрегируем
    const snap = await db.collection('orders').get();

    let totalOrders = 0;
    let totalRevenue = 0;
    let totalQty = 0;
    const byItem = new Map();

    snap.forEach(doc => {
      const o = doc.data();
      if (!o || o.status !== 'paid') return;
      totalOrders += 1;
      totalRevenue += Number(o.total || 0);
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const name = String(it.name || 'Товар');
        const qty = Number(it.quantity || 0);
        const amount = Number(it.amount_total || 0);
        totalQty += qty;
        const prev = byItem.get(name) || { name, qty: 0, revenue: 0 };
        prev.qty += qty;
        prev.revenue += amount;
        byItem.set(name, prev);
      }
    });

    const items = Array.from(byItem.values()).sort((a, b) => b.revenue - a.revenue);

    return res.status(200).json({
      totalOrders,
      totalRevenue,
      totalQty,
      items,
    });
  } catch (e) {
    console.error('admin-orders error:', e);
    return res.status(500).json({ error: 'Internal Error' });
  }
}
