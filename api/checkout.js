import Stripe from "stripe";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore/lite";

// Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Firebase (server-side, через env-конфиг)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function toCents(eur) {
  return Math.round(Number(eur) * 100);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, shipping } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Empty cart" });
    }

    // 1) Валидация и подтягивание данных о товарах из Firestore
    const lineItems = [];
    const quoteItems = []; // для расчета доставки
    let productsSubtotalCents = 0;

    for (const raw of items) {
      const id = String(raw.id || "");
      const qty = Math.max(1, Math.min(99, Number(raw.qty || 1))); // 1..99
      if (!id) continue;

      let product;
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (!snap.exists()) continue;
        product = snap.data();
      } catch (e) {
        console.error("Firestore getDoc error for", id, e);
        continue;
      }
      const name = String(product.name || "Товар");
      const price = Number(product.price);
      const img = product.img ? String(product.img) : undefined;

      if (!Number.isFinite(price) || price <= 0) continue;

      const unit_amount = Math.round(price * 100);
      productsSubtotalCents += unit_amount * qty;

      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name,
            ...(img ? { images: [img] } : {}),
          },
          unit_amount,
        },
        quantity: qty,
      });

      quoteItems.push({ id, qty });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "No valid items" });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    // 2) Расчет/проверка стоимости доставк��
    let chosenOption = null;
    let shippingCents = 0;
    let shippingMeta = {};

    if (shipping && shipping.address && shipping.optionId) {
      // Запрос к нашему shipping-quote, используя серверный subtotal и товары
      const params = new URLSearchParams({
        address: String(shipping.address),
        subtotal: String((productsSubtotalCents / 100).toFixed(2)),
        items: JSON.stringify(quoteItems),
      });
      const quoteUrl = `${origin}/api/shipping-quote?${params.toString()}`;

      const resp = await fetch(quoteUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("shipping-quote failed:", resp.status, text);
        return res.status(400).json({ error: "shipping_quote_failed", status: resp.status, message: text });
      }

      const quote = await resp.json();
      chosenOption = (quote.options || []).find((o) => o.id === String(shipping.optionId));
      if (!chosenOption) {
        return res.status(400).json({ error: "shipping_option_invalid", options: quote.options });
      }

      const serverPrice = Number(chosenOption.price_eur || 0);
      const clientPrice = Number(shipping.price_eur || 0);

      // Если заявленная клиентом цена отличается от серверной > 0.01€, запрашиваем подтверждение на фронте
      if (Number.isFinite(clientPrice) && Math.abs(serverPrice - clientPrice) > 0.01) {
        return res.status(409).json({
          error: "shipping_price_changed",
          serverOption: chosenOption,
          options: quote.options,
          quote,
        });
      }

      shippingCents = toCents(serverPrice);
      shippingMeta = {
        shipping_method: String(chosenOption.id),
        shipping_option_label: String(chosenOption.label || chosenOption.id),
        shipping_address: String(quote.address || shipping.address || ""),
        shipping_lat: String(quote?.coords?.lat ?? shipping.lat ?? ""),
        shipping_lon: String(quote?.coords?.lon ?? shipping.lon ?? ""),
        shipping_price_cents: String(shippingCents),
        shipping_distance_km: String(quote?.distance_km ?? ""),
        shipping_weight_kg: String(quote?.total_weight_kg ?? ""),
      };

      if (chosenOption.id !== "pickup" && shippingCents > 0) {
        lineItems.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: `Доставка — ${chosenOption.label || chosenOption.id}`,
            },
            unit_amount: shippingCents,
          },
          quantity: 1,
        });
      }
    }

    // 3) Создание Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=1`,
      metadata: {
        item_ids: items.map((i) => i.id).join(","),
        ...shippingMeta,
      },
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
