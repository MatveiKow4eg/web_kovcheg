import { initializeApp as initAdminApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
  const parts = chunk(String(text || ''), 3800);
  for (let i = 0; i < parts.length; i++) {
    const body = { chat_id: chatId, text: parts[i], parse_mode: 'HTML', disable_web_page_preview: true, ...(i === 0 ? extra : {}) };
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`Telegram sendMessage failed: ${resp.status} ${resp.statusText} ${t}`);
    }
  }
}

async function tgSendDocument(chatId, filename, content, caption = ''){
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) form.append('caption', caption);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  form.append('document', blob, filename);
  const resp = await fetch(url, { method: 'POST', body: form });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Telegram sendDocument failed: ${resp.status} ${resp.statusText} ${t}`);
  }
}

function fmtCurrency(amount, currency = 'EUR') {
  try { return new Intl.NumberFormat('ru-EE', { style: 'currency', currency }).format(amount); }
  catch { return `${Number(amount).toFixed(2)} ${String(currency).toUpperCase()}`; }
}

function fmtDate(d) {
  try { return new Date(d).toLocaleString('ru-RU', { timeZone: 'Europe/Tallinn' }); } catch { return String(d); }
}

function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDateOnly(d){ try { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Tallinn', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)); } catch { return String(d); } }
function fmtTimeHM(d){ try { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit' }).format(new Date(d)); } catch { return ''; } }
function fmtWeekday(d){ try { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Tallinn', weekday: 'short' }).format(new Date(d)); } catch { return ''; } }

async function listOrders(arg = 10) {
  const opts = typeof arg === 'object' && arg !== null ? arg : { limit: arg };
  const limit = Math.max(1, Math.min(50, Number(opts.limit) || 10));
  let q = db.collection('orders').orderBy('createdAt', 'desc');
  if (opts.status && opts.status !== 'all') q = q.where('status', '==', String(opts.status));
  if (opts.beforeTs) q = q.where('createdAt', '<', new Date(Number(opts.beforeTs)));
  if (opts.periodStart) q = q.where('createdAt', '>=', new Date(Number(opts.periodStart)));
  if (opts.periodEnd) q = q.where('createdAt', '<', new Date(Number(opts.periodEnd)));
  const snap = await q.limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getOrder(id) {
  const doc = await db.collection('orders').doc(String(id)).get();
  if (!doc.exists) return null;
  const data = { id: doc.id, ...doc.data() };
  if (!data.orderNumber || !data.email_lower) {
    await ensureOrderNumberAndLower(doc.id, data);
    const doc2 = await db.collection('orders').doc(String(id)).get();
    return doc2.exists ? { id: doc2.id, ...doc2.data() } : data;
  }
  return data;
}

function chunk(str, n = 3800) {
  const res = []; let i = 0; while (i < str.length) { res.push(str.slice(i, i + n)); i += n; } return res;
}

async function tgAnswerCallbackQuery(callbackQueryId, text = '') {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text })
  });
}

async function tgEditMessageText(chatId, messageId, text, reply_markup) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
  let t = String(text || '');
  if (t.length > 3800) t = t.slice(0, 3800);
  const body = { chat_id: chatId, message_id: messageId, text: t, parse_mode: 'HTML', disable_web_page_preview: true };
  if (reply_markup) body.reply_markup = reply_markup;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) { const t = await resp.text().catch(()=> ''); console.warn('editMessageText failed', resp.status, t); }
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }
function maskEmail(email){
  const e = String(email || '').trim();
  if (!e || e === '-') return '-';
  const at = e.indexOf('@');
  if (at <= 0) return e.length > 1 ? e[0] + '***' : e;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const localMasked = local ? local[0] + '***' : '***';
  return `${localMasked}@${domain}`;
}

function statusBadge(status){
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return '💳';
  if (s === 'done') return '✅';
  if (s === 'shipped') return '📦';
  if (s === 'canceled') return '❌';
  return '';
}
function fmtDateKeyTallinn(d){
  try {
    const date = new Date(d);
    const y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric' }).format(date));
    const m = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', month: '2-digit' }).format(date));
    const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', day: '2-digit' }).format(date));
    return `${y}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}`;
  } catch { return ''; }
}
async function ensureOrderNumberAndLower(id, order){
  try {
    if (!id || !order) return;
    if (order.orderNumber && order.email_lower) return;
    const created = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt || new Date();
    const dateKey = fmtDateKeyTallinn(created);
    const ctrRef = db.collection('counters').doc(`order-${dateKey}`);
    const ordRef = db.collection('orders').doc(String(id));
    await db.runTransaction(async (tx) => {
      const [ctrSnap, ordSnap] = await Promise.all([tx.get(ctrRef), tx.get(ordRef)]);
      const data = ordSnap.exists ? ordSnap.data() : {};
      const needNumber = !data.orderNumber;
      let seq = ctrSnap.exists && typeof ctrSnap.data().seq === 'number' ? ctrSnap.data().seq : 0;
      if (needNumber) { seq += 1; tx.set(ctrRef, { seq, updatedAt: FieldValue.serverTimestamp() }, { merge: true }); }
      const patch = {};
      if (needNumber) patch.orderNumber = `${dateKey}-${String(seq).padStart(3,'0')}`;
      if (data.email && !data.email_lower) patch.email_lower = String(data.email).toLowerCase();
      if (data.phone && !data.phone_lower) patch.phone_lower = String(data.phone).toLowerCase();
      if (Object.keys(patch).length) tx.set(ordRef, patch, { merge: true });
    });
  } catch (e) { /* noop */ }
}

function shortId(id, n = 12){ const s = String(id||''); return s.slice(-Math.max(4, Math.min(48, n))); }

async function resolveOrderByShort(suffix){
  const suf = String(suffix||'');
  const snap = await db.collection('orders').orderBy('createdAt','desc').limit(50).get();
  for (const d of snap.docs){ if (String(d.id).endsWith(suf)) return { id: d.id, ...d.data() }; }
  return null;
}

function orderListKeyboard(orders, opts = {}){
  const rows = orders.map(o => {
    const sid = shortId(o.id, 12);
    const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
    const label = created ? `${fmtDateOnly(created)} ${fmtTimeHM(created)}` : `№${shortId(o.id, 6)}`;
    return [{ text: `ℹ️ ${label}`, callback_data: `order:${sid}` }];
  });
  const limit = Math.max(1, Math.min(50, Number(opts.limit) || 10));
  const last = orders[orders.length - 1];
  const lastCreated = last && (last.createdAt && last.createdAt.toDate ? last.createdAt.toDate() : last.createdAt);
  const beforeTs = lastCreated ? new Date(lastCreated).getTime() : '';
  const navRow = [];
  if (beforeTs) navRow.push({ text: '▶️ Далее', callback_data: `orders:next|b=${beforeTs}|l=${limit}` });
  navRow.push({ text: '🔄 Обновить', callback_data: 'orders:list' });
  rows.push(navRow);
  return { inline_keyboard: rows };
}

function orderDetailKeyboard(o){
  const done = String(o.status||'') === 'done';
  const sid = shortId(o.id, 12);
  return {
    inline_keyboard: [
      [{ text: done ? '↩️ Вернуть в оплачено' : '✅ Отметить выполненным', callback_data: `done:${sid}` }],
      [{ text: '⬅️ К списку', callback_data: 'orders:list' }],
    ]
  };
}

async function setOrderStatus(id, status){
  await db.collection('orders').doc(String(id)).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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

    // Inline buttons handler
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat?.id || '');
      const msgId = cq.message?.message_id;
      const data = String(cq.data || '');
      const isAdminCq = ADMIN_IDS.length > 0 && ADMIN_IDS.includes(chatId);
      if (!isAdminCq) {
        await tgAnswerCallbackQuery(cq.id, '⛔ Нет доступа');
        return res.status(200).json({ ok: true });
      }

      if (/^order:\s*(\S+)$/i.test(data)) {
        const suf = data.replace(/^order:\s*/i, '');
        const o = await resolveOrderByShort(suf);
        if (!o) { await tgAnswerCallbackQuery(cq.id, 'Заказ не найден'); return res.status(200).json({ ok: true }); }
        const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
        const dt = created ? fmtDate(created) : '-';
        const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
        const shipping = o.shipping || {};
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsLines = items.length
          ? items.map((it) => `• ${escapeHtml(it.name || 'Товар')} × ${it.quantity || 1} — ${fmtCurrency(it.amount_total || 0, String(it.currency || o.currency || 'EUR').toUpperCase())}`).join('\n')
          : '—';
        const shipStr = shipping.method === 'pickup' ? 'Самовывоз (0 €)' : `Доставка — ${fmtCurrency(shipping.price_eur || 0, String(o.currency || 'EUR').toUpperCase())}`;
        const addr = shipping.address ? `\n<b>Адрес:</b> ${escapeHtml(shipping.address)}\n<a href=\"https://maps.google.com/?q=${encodeURIComponent(shipping.address)}\">Открыть на карте</a>` : '';
        const body = `\n<b>Заказ:</b> №${shortId(o.id, 6)}\n<b>Дата:</b> ${dt}\n<b>Клиент:</b> ${escapeHtml(o.email || '-')}\n<b>Сумма:</b> ${total}\n<b>Статус:</b> ${statusBadge(o.status)} ${escapeHtml(o.status || '')}\n<b>Доставка:</b> ${shipStr}${addr}\n\n<b>Позиции:</b>\n${itemsLines}`;
        await tgEditMessageText(chatId, msgId, body, orderDetailKeyboard(o));
        await tgAnswerCallbackQuery(cq.id);
        return res.status(200).json({ ok: true });
      }

      if (/^done:\s*(\S+)$/i.test(data)) {
        const suf = data.replace(/^done:\s*/i, '');
        const o = await resolveOrderByShort(suf);
        if (!o) { await tgAnswerCallbackQuery(cq.id, 'Заказ не найден'); return res.status(200).json({ ok: true }); }
        const newStatus = String(o.status||'') === 'done' ? 'paid' : 'done';
        await setOrderStatus(o.id, newStatus);
        const updated = await getOrder(o.id);
        const created = updated.createdAt && updated.createdAt.toDate ? updated.createdAt.toDate() : updated.createdAt;
        const dt = created ? fmtDate(created) : '-';
        const total = fmtCurrency(updated.total || 0, String(updated.currency || 'EUR').toUpperCase());
        const shipping = updated.shipping || {};
        const items = Array.isArray(updated.items) ? updated.items : [];
        const itemsLines = items.length
          ? items.map((it) => `• ${escapeHtml(it.name || 'Товар')} × ${it.quantity || 1} — ${fmtCurrency(it.amount_total || 0, String(it.currency || updated.currency || 'EUR').toUpperCase())}`).join('\n')
          : '—';
        const shipStr = shipping.method === 'pickup' ? 'Самовывоз (0 €)' : `Доставка — ${fmtCurrency(shipping.price_eur || 0, String(updated.currency || 'EUR').toUpperCase())}`;
        const addr = shipping.address ? `\n<b>Адрес:</b> ${escapeHtml(shipping.address)}\n<a href=\"https://maps.google.com/?q=${encodeURIComponent(shipping.address)}\">Открыть на карте</a>` : '';
        const body = `\n<b>Заказ:</b> №${shortId(updated.id, 6)}\n<b>Дата:</b> ${dt}\n<b>Клиент:</b> ${escapeHtml(updated.email || '-')}\n<b>Сумма:</b> ${total}\n<b>Статус:</b> ${statusBadge(updated.status)} ${escapeHtml(updated.status || '')}\n<b>Доставка:</b> ${shipStr}${addr}\n\n<b>Позиции:</b>\n${itemsLines}`;
        await tgEditMessageText(chatId, msgId, body, orderDetailKeyboard(updated));
        await tgAnswerCallbackQuery(cq.id, 'Статус обновлён');
        return res.status(200).json({ ok: true });
      }

      if (data === 'orders:list' || data === 'orders:refresh') {
        const orders = await listOrders({ limit: 10 });
        if (!orders.length) {
          await tgEditMessageText(chatId, msgId, 'Заказов не найдено.');
          await tgAnswerCallbackQuery(cq.id);
          return res.status(200).json({ ok: true });
        }
        const groupMap = new Map();
        for (const o of orders) {
          const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
          const dateKey = created ? fmtDateOnly(created) : 'Без даты';
          const header = created ? `${fmtDateOnly(created)} (${fmtWeekday(created)})` : 'Без даты';
          if (!groupMap.has(dateKey)) groupMap.set(dateKey, { header, items: [] });
          const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
          const ship = o.shipping || {};
          const shipStr = ship.method === 'pickup' ? 'Самовывоз' : `Доставка ${fmtCurrency(ship.price_eur || 0, String(o.currency || 'EUR').toUpperCase())}`;
          const addrShort = ship.address ? String(ship.address).split(',')[0] : '';
          const timeStr = created ? fmtTimeHM(created) : '';
          const line = `• ${timeStr} — ${total}\n${escapeHtml(maskEmail(o.email))} | ${statusBadge(o.status)} ${escapeHtml(o.status || '')}\n${shipStr}${addrShort ? ' — ' + escapeHtml(addrShort) : ''}`;
          groupMap.get(dateKey).items.push(line);
        }
        const parts = [];
        for (const { header, items } of groupMap.values()) {
          parts.push(`<b>${header}</b>`);
          parts.push(items.join('\n\n'));
        }
        const textOut = `<b>Последние заказы (${orders.length})</b>\n\n` + parts.join('\n\n');
        await tgEditMessageText(chatId, msgId, textOut, orderListKeyboard(orders, { limit: 10 }));
        await tgAnswerCallbackQuery(cq.id);
        return res.status(200).json({ ok: true });
      }

      if (/^orders:next\|/.test(data)) {
        const m = data.match(/\bb=(\d+)\b/);
        const mL = data.match(/\bl=(\d+)\b/);
        const beforeTs = m ? Number(m[1]) : undefined;
        const limit = mL ? Number(mL[1]) : 10;
        const orders = await listOrders({ limit, beforeTs });
        if (!orders.length) {
          await tgAnswerCallbackQuery(cq.id, 'Больше нет записей');
          return res.status(200).json({ ok: true });
        }
        const groupMap = new Map();
        for (const o of orders) {
          const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
          const dateKey = created ? fmtDateOnly(created) : 'Без даты';
          const header = created ? `${fmtDateOnly(created)} (${fmtWeekday(created)})` : 'Без даты';
          if (!groupMap.has(dateKey)) groupMap.set(dateKey, { header, items: [] });
          const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
          const ship = o.shipping || {};
          const shipStr = ship.method === 'pickup' ? 'Самовывоз' : `Доставка ${fmtCurrency(ship.price_eur || 0, String(o.currency || 'EUR').toUpperCase())}`;
          const addrShort = ship.address ? String(ship.address).split(',')[0] : '';
          const timeStr = created ? fmtTimeHM(created) : '';
          const line = `• ${timeStr} — ${total}\n${escapeHtml(maskEmail(o.email))} | ${statusBadge(o.status)} ${escapeHtml(o.status || '')}\n${shipStr}${addrShort ? ' — ' + escapeHtml(addrShort) : ''}`;
          groupMap.get(dateKey).items.push(line);
        }
        const parts = [];
        for (const { header, items } of groupMap.values()) {
          parts.push(`<b>${header}</b>`);
          parts.push(items.join('\n\n'));
        }
        const textOut = `<b>Последние заказы (${orders.length})</b>\n\n` + parts.join('\n\n');
        await tgEditMessageText(chatId, msgId, textOut, orderListKeyboard(orders, { limit }));
        await tgAnswerCallbackQuery(cq.id);
        return res.status(200).json({ ok: true });
      }

      await tgAnswerCallbackQuery(cq.id);
      return res.status(200).json({ ok: true });
    }

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
      const orders = await listOrders({ limit });
      if (!orders.length) {
        await tgSend(chatId, 'Заказов не найдено.');
        return res.status(200).json({ ok: true });
      }
      const groupMap = new Map();
      for (const o of orders) {
        const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
        const dateKey = created ? fmtDateOnly(created) : 'Без даты';
        const header = created ? `${fmtDateOnly(created)} (${fmtWeekday(created)})` : 'Без даты';
        if (!groupMap.has(dateKey)) groupMap.set(dateKey, { header, items: [] });
        const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
        const timeStr = created ? fmtTimeHM(created) : '';
        const line = `• ${timeStr} — ${total}\n${escapeHtml(maskEmail(o.email))} | ${statusBadge(o.status)} ${escapeHtml(o.status || '')}`;
        groupMap.get(dateKey).items.push(line);
      }
      const parts = [];
      for (const { header, items } of groupMap.values()) {
        parts.push(`<b>${header}</b>`);
        parts.push(items.join('\n\n'));
      }
      const textOut = `<b>Последние заказы (${orders.length})</b>\n\n` + parts.join('\n\n');
      await tgSend(chatId, textOut, { reply_markup: orderListKeyboard(orders, { limit }) });
      return res.status(200).json({ ok: true });
    }

    const mFind = text.match(/^\/find\s+(.+)$/i);
    if (mFind) {
      const qraw = mFind[1].trim();
      const q = qraw.toLowerCase();
      const results = [];
      if (qraw.length) {
        const snapNum = await db.collection('orders').where('orderNumber','==', qraw).orderBy('createdAt', 'desc').limit(10).get().catch(()=>null);
        if (snapNum && !snapNum.empty) results.push(...snapNum.docs.map(d=>({ id: d.id, ...d.data() })));
      }
      if (results.length < 10) {
        const recent = await listOrders({ limit: 50 });
        const filtered = recent.filter(o => String(o.email||'').toLowerCase().includes(q) || String(o.orderNumber||'').toLowerCase().includes(q));
        for (const o of filtered) { if (results.length < 10) results.push(o); else break; }
      }
      if (!results.length) {
        await tgSend(chatId, 'Ничего не найдено.');
        return res.status(200).json({ ok: true });
      }
      const lines = results.map((o, i) => {
        const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
        const dt = created ? fmtDate(created) : '-';
        const total = fmtCurrency(o.total || 0, String(o.currency || 'EUR').toUpperCase());
        const num = o.orderNumber ? o.orderNumber : `№${shortId(o.id, 6)}`;
        return `${i + 1}. <b>${escapeHtml(num)}</b> — ${total}\n${escapeHtml(maskEmail(o.email))} | ${statusBadge(o.status)} ${escapeHtml(o.status || '')} | ${dt}`;
      });
      const textOut = `<b>Найденные заказы (${results.length})</b>\n\n` + lines.join('\n\n');
      await tgSend(chatId, textOut);
      return res.status(200).json({ ok: true });
    }

    const mExport = text.match(/^\/export(?:\s+(\d+))?$/i);
    if (mExport) {
      const limit = Math.max(1, Math.min(200, mExport[1] ? Number(mExport[1]) : 30));
      const orders = await listOrders({ limit });
      if (!orders.length) { await tgSend(chatId, 'Заказов не найдено.'); return res.status(200).json({ ok: true }); }
      const header = ['orderNumber','id','createdAt','email','status','total','currency','shipping_method','shipping_price_eur','address','itemsCount'];
      const rows = [header.join(';')];
      for (const o of orders) {
        const created = o.createdAt && o.createdAt.toDate ? o.createdAt.toDate() : o.createdAt;
        const dt = created ? fmtDate(created) : '';
        const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
        const ship = o.shipping || {};
        const vals = [
          String(o.orderNumber || '').replace(/;/g, ' '),
          String(o.id || '').replace(/;/g, ' '),
          String(dt).replace(/;/g, ' '),
          String(o.email || '').replace(/;/g, ' '),
          String(o.status || '').replace(/;/g, ' '),
          String(o.total || '').replace(/;/g, ' '),
          String((o.currency || 'EUR')).replace(/;/g, ' '),
          String(ship.method || '').replace(/;/g, ' '),
          String(ship.price_eur || '').replace(/;/g, ' '),
          String(ship.address || '').replace(/;/g, ' '),
          String(itemsCount)
        ];
        rows.push(vals.map(v => `"${v.replace(/"/g,'\\"')}"`).join(';'));
      }
      const csv = '\uFEFF' + rows.join('\n');
      const todayKey = fmtDateKeyTallinn(new Date());
      await tgSendDocument(chatId, `orders-${todayKey}.csv`, csv, `Экспорт ${orders.length} заказов`);
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
      const body = `\n<b>Заказ:</b> №${shortId(o.id, 6)}\n<b>Дата:</b> ${dt}\n<b>Клиент:</b> ${esc(o.email || '-')}\n<b>Сумма:</b> ${total}\n<b>Статус:</b> ${statusBadge(o.status)} ${esc(o.status || '')}\n<b>Доставка:</b> ${shipStr}${addr}\n\n<b>Позиции:</b>\n${itemsLines}`;
      await tgSend(chatId, body, { reply_markup: orderDetailKeyboard(o) });
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
