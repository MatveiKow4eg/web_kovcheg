import Stripe from "stripe";
import sgMail from "@sendgrid/mail";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { Readable } from "stream";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Firebase init
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

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
    console.error("❌ Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details.email;
    const amount = session.amount_total / 100;

    // ✅ Сохраняем заказ в Firestore
    const orderRef = doc(db, "orders", session.id);
    await setDoc(orderRef, {
      id: session.id,
      email,
      items: session.display_items || [], // ⚠️ может понадобиться передавать отдельно
      total: amount,
      createdAt: new Date().toISOString(),
      status: "paid",
    });

    // ✅ Письмо клиенту
    const customerMsg = {
      to: email,
      from: "noreply@yourdomain.com",
      subject: "Ваш заказ успешно оплачен 🎉",
      html: `
        <h2>Спасибо за заказ!</h2>
        <p>Сумма: <b>${amount} €</b></p>
        <p>Мы скоро отправим ваш товар 🚚</p>
      `,
    };

    // ✅ Письмо админу
    const adminMsg = {
      to: "admin@yourdomain.com",
      from: "noreply@yourdomain.com",
      subject: `Новый заказ на ${amount} €`,
      html: `
        <h2>Новый заказ</h2>
        <p>Клиент: ${email}</p>
        <p>Сумма: <b>${amount} €</b></p>
        <p>ID заказа: ${session.id}</p>
      `,
    };

    try {
      await sgMail.send(customerMsg);
      await sgMail.send(adminMsg);
      console.log("✅ Emails sent");
    } catch (err) {
      console.error("❌ SendGrid error:", err);
    }
  }

  res.json({ received: true });
}

// утилита для raw body
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
