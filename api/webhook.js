import Stripe from "stripe";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Firebase init (server-side via env)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers["stripe-signature"];

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object; // Stripe.Checkout.Session

      // Получаем email покупателя и валюту/сумму
      const email = session?.customer_details?.email || null;
      const currency = (session?.currency || "eur").toLowerCase();
      const total = Number(session?.amount_total || 0) / 100;

      // Запрашиваем позиции заказа у Stripe
      let items = [];
      try {
        const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        items = (li?.data || []).map((it) => ({
          name: it?.description || (it?.price?.nickname) || "Товар",
          quantity: it?.quantity || 1,
          amount_total: Number(it?.amount_total ?? it?.amount_subtotal ?? 0) / 100,
          currency: (it?.currency || currency).toLowerCase(),
        }));
      } catch (e) {
        console.error("Failed to list line items:", e);
      }

      // Извлекаем shipping информацию из metadata
      const md = session?.metadata || {};
      const shipping = {
        method: md.shipping_method || null,
        option: md.shipping_option_label || null,
        address: md.shipping_address || null,
        lat: md.shipping_lat ? Number(md.shipping_lat) : null,
        lon: md.shipping_lon ? Number(md.shipping_lon) : null,
        price_eur: md.shipping_price_cents ? Number(md.shipping_price_cents) / 100 : 0,
        distance_km: md.shipping_distance_km ? Number(md.shipping_distance_km) : null,
        total_weight_kg: md.shipping_weight_kg ? Number(md.shipping_weight_kg) : null,
      };

      // Сохраняем заказ в Firestore
      try {
        const orderRef = doc(db, "orders", session.id);
        await setDoc(orderRef, {
          id: session.id,
          email,
          items,
          total,
          currency,
          createdAt: new Date().toISOString(),
          status: "paid",
          shipping,
        });
      } catch (e) {
        console.error("Firestore write error:", e);
      }

      // Отправляем письма через ZeptoMail (Zoho)
      try {
        const API_KEY = process.env.ZOHO_API_KEY;
        const FROM = process.env.ZOHO_FROM; // отправитель (адрес)
        const FROM_NAME = process.env.FROM_NAME || "Kovcheg";
        const ADMINS = String(process.env.ADMIN_EMAILS || "").split(/[,;\s]+/).filter(Boolean);

        if (!API_KEY || !FROM) {
          console.warn("Email not sent: ZOHO_API_KEY or ZOHO_FROM not configured");
        } else {
          const itemsHtml = items.length
            ? `<ul>` + items.map(i => `<li>${escapeHtml(i.name)} × ${i.quantity} — ${formatCurrency(i.amount_total, i.currency)}</li>`).join("") + `</ul>`
            : `<p>Состав заказа недоступен.</p>`;

          const shippingHtml = shipping?.method
            ? `<p><b>Доставка:</b> ${escapeHtml(shipping.option || shipping.method)} — ${formatCurrency(shipping.price_eur, currency)}<br>` +
              (shipping.address ? `Адрес: ${escapeHtml(shipping.address)}<br>` : "") +
              (Number.isFinite(shipping.distance_km) ? `Расстояние: ${shipping.distance_km} км<br>` : "") +
              (Number.isFinite(shipping.total_weight_kg) ? `Вес: ${shipping.total_weight_kg} кг` : "") +
              `</p>`
            : `<p>Доставка: не указана (возможно самовывоз)</p>`;

          // Письмо клиенту
          if (email) {
            await sendZeptoMail({
              apiKey: API_KEY,
              to: email,
              from: FROM,
              fromName: FROM_NAME,
              subject: "Ваш заказ успешно оплачен",
              html: `
                <h2>Спасибо за заказ!</h2>
                <p>Сумма: <b>${formatCurrency(total, currency)}</b></p>
                <p>Номер заказа: <b>${session.id}</b></p>
                ${shippingHtml}
                <h3>Состав заказа</h3>
                ${itemsHtml}
                <p>Мы скоро с вами свяжемся.</p>
              `,
            });
          }

          // Письмо админам (всем администраторам)
          if (ADMINS.length > 0) {
            for (const admin of ADMINS) {
              await sendZeptoMail({
                apiKey: API_KEY,
                to: admin,
                from: FROM,
                fromName: FROM_NAME,
                subject: `Новый заказ на ${formatCurrency(total, currency)}`,
                html: `
                  <h2>Новый заказ</h2>
                  <p><b>Клиент:</b> ${email ? escapeHtml(email) : "не указан"}</p>
                  <p><b>Сумма:</b> ${formatCurrency(total, currency)}</p>
                  <p><b>ID заказа:</b> ${session.id}</p>
                  ${shippingHtml}
                  <h3>Позиции</h3>
                  ${itemsHtml}
                `,
              });
            }
          }
        }
      } catch (e) {
        console.error("Email send error:", e);
      }
    }

    return res.json({ received: true });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return res.status(500).send("Internal Error");
  }
}

// ===== Helpers =====
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amount, currency = "eur") {
  try {
    return new Intl.NumberFormat("ru-EE", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${Number(amount).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

async function sendZeptoMail({ apiKey, to, from, fromName, subject, html }) {
  const resp = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      "Authorization": `Zoho-enczapikey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: fromName },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ZeptoMail error: ${resp.status} ${resp.statusText} - ${text}`);
  }
}
