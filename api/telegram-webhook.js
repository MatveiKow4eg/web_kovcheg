import { initializeApp as initAdminApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin init
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
if (!getApps().length) {
  initAdminApp({ credential: cert(sa), projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID });
}
const db = getFirestore();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = String(process.env.TELEGRAM_ADMIN_CHAT_IDS || '')
  .split(/[,\s]+/)
  .filter(Boolean)
  .map((x) => (isNaN(Number(x)) ? x : String(Number(x))));

async function tgSend(chatId, text, extra = {}) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Telegram sendMessage failed: ${resp.status} ${resp.statusText} ${t}`);
  }
}

function fmtCurrency(amount, currency = 'EUR') {
  try { return new Intl.NumberFormat('ru-EE', { style: 'currency', currency }).format(amount); }
  catch { return `${Number(amount).toFixed(2)} ${String(currency).toUpperCase()}`; }
}

function fmtDate(d) {
  try { return new Date(d).toLocaleString('ru-RU'); } catch { return String(d); }
}

async function listOrders(limit = 10) {
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(Math.max(1, Math.min(50, limit))).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getOrder(id) {
  const doc = await db.collection('orders').doc(String(id)).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

function chunk(str, n = 3800) {
  const res = []; let i = 0; while (i < str.length) { res.push(str.slice(i, i + n)); i += n; } return res;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, hint: 'Set this URL as Telegram webhook via setWebhook' });
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!BOT_TOKEN) {
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
    }

    const update = req.body || {};
    const msg = update.message || update.edited_message || null;
    if (!msg) {
      return res.status(200).json({ ok: true });
    }

    const chatIdRaw = msg.chat && msg.chat.id != null ? msg.chat.id : null;
    const chatId = chatIdRaw != null ? String(chatIdRaw) : null;
    const text = String(msg.text || '').trim();

    // Публичные команды
    if (/^\/(start|help)\b/i.test(text)) {
      await tgSend(chatId, 'Команды:\n• /orders [N] — последние N заказов (по умолчанию 10)\n• /order &lt;id&gt; — детали заказа по ID');
      return res.status(200).json({ ok: true });
    }

    const isAdmin = ADMIN_IDS.length === 0 ? false : ADMIN_IDS.includes(chatId);
    if (!isAdmin) {
      await tgSend(chatId, '⛔ Доступ ограничен.');
      return res.status(200).json({ ok: true });
    }

    const mOrders = text.match(/^\/orders(?:\s+(\d+))?$/i);
    if (mOrders) {
      const limit = mOrders[1] ? Number(mOrders[1]) : 10;
      const orders = await listOrders(limit);
      if (!orders.length) {
        await tgSend(chatId, 'Заказов не найдено.');
        return res.status(200).json({ ok: true });
      }
      const lines = orders.map((o, i) => {
        const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
        const dt = created ? fmtDate(created) : '-';
        const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
        return `${i + 1}. <b>${(o.id || '').replace(/[&<>"']/g, '')}</b> — ${total}\n${(o.email || '-').replace(/[&<>"']/g, '')} | ${(o.status || '').replace(/[&<>"']/g, '')} | ${dt}`;
      });
      const textOut = `<b>Последние заказы (${orders.length})</b>\n\n` + lines.join('\n\n');
      for (const part of chunk(textOut)) { await tgSend(chatId, part); }
      return res.status(200).json({ ok: true });
    }

    const mOrder = text.match(/^\/order\s+(\S+)$/i);
    if (mOrder) {
      const id = mOrder[1];
      const o = await getOrder(id);
      if (!o) {
        await tgSend(chatId, `Заказ <b>${id}</b> не найден.`);
        return res.status(200).json({ ok: true });
      }
      const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
      const dt = created ? fmtDate(created) : '-';
      const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
      const shipping = o.shipping || {};
      const items = Array.isArray(o.items) ? o.items : [];
      const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');
      const itemsLines = items.length
        ? items.map((it) => `• ${esc(it.name || 'Товар')} × ${it.quantity || 1} — ${fmtCurrency(it.amount_total || 0, String(it.currency || o.currency || 'EUR').toUpperCase())}`).join('\n')
        : '—';
      const shipStr = shipping.method === 'pickup'
        ? 'Самовывоз (0 €)'
        : `Доставка — ${fmtCurrency(shipping.price_eur || 0, String(o.currency || 'EUR').toUpperCase())}`;
      const addr = shipping.address ? `\n<b>Адрес:</b> ${esc(shipping.address)}\n<a href=\"https://maps.google.com/?q=${encodeURIComponent(shipping.address)}\">Открыть на карте</a>` : '';
      const body = `\n<b>Заказ:</b> ${esc(o.id)}\n<b>Дата:</b> ${dt}\n<b>Клиент:</b> ${esc(o.email || '-')}\n<b>Сумма:</b> ${total}\n<b>Доставка:</b> ${shipStr}${addr}\n\n<b>Позиции:</b>\n${itemsLines}`;
      for (const part of chunk(body)) { await tgSend(chatId, part); }
      return res.status(200).json({ ok: true });
    }

    // Unknown command fallback
    await tgSend(chatId, 'Неизвестная команда. Напишите /help');
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('telegram-webhook error:', e);
    return res.status(200).json({ ok: true });
  }
}
