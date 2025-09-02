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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Empty cart" });
    }

    // 1) Валидация и подтягивание данных о товарах из Firestore
    const lineItems = [];
    for (const raw of items) {
      const id = String(raw.id || "");
      const qty = Math.max(1, Math.min(99, Number(raw.qty || 1))); // ограничим 1..99
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

      lineItems.push({
        price_data: {
          currency: "eur",
          product_data: {
            name,
            ...(img ? { images: [img] } : {}),
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: qty,
      });
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "No valid items" });
    }

    // 2) Создание Checkout Session
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      // Stripe сам собирает email покупателя
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=1`,
      metadata: {
        // Можем передать список ID для отладки
        item_ids: items.map((i) => i.id).join(","),
      },
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
