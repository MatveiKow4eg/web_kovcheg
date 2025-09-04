import Stripe from "stripe";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore/lite";

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

// Shipping calc shared helpers (embedded to avoid HTTP call to protected Preview URL)
const WAREHOUSE_LAT = parseFloat(process.env.WAREHOUSE_LAT || "");
const WAREHOUSE_LON = parseFloat(process.env.WAREHOUSE_LON || "");
const GEOCODER_PROVIDER = (process.env.GEOCODER_PROVIDER || "nominatim").toLowerCase();

function _toNumber(n, def = 0) { const v = Number(n); return Number.isFinite(v) ? v : def; }
function _roundMoneyEUR(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }
function _normalizeAddressId(s) {
  return String(s || "").trim().toLowerCase()
    .replace(/[\s\n\r]+/g, " ")
    .replace(/[\/#?%&:*"'<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .slice(0, 300);
}
function _haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function _geocodeAddress(db, address){
  const normalizedId = _normalizeAddressId(address);
  const cacheRef = doc(db, "geocache", normalizedId);
  try {
    const snap = await getDoc(cacheRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.lat && data?.lon) {
        return { lat: Number(data.lat), lon: Number(data.lon), provider: data.provider || GEOCODER_PROVIDER, cached: true };
      }
    }
  } catch(e){ console.warn("geocache read error:", e); }

  if (GEOCODER_PROVIDER !== "nominatim") {
    const err = new Error("Unsupported geocoder provider"); err.status = 501; err.code = "geocoder_not_implemented"; throw err;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ee&limit=1&q=${encodeURIComponent(address)}`;
  const ua = process.env.GEOCODER_UA || `web-kovcheg/1.0 (${process.env.ADMIN_EMAILS || "no-admin"})`;
  const resp = await fetch(url, { headers: { "User-Agent": ua, "Accept": "application/json" } });
  if (resp.status === 429) { const err = new Error("Rate limited by geocoder"); err.status=429; err.code="geocode_rate_limited"; throw err; }
  if (!resp.ok) {
    const text = await resp.text().catch(()=>""); const err = new Error(`Geocoder failed ${resp.status}: ${text}`);
    err.status = 502; err.code = "geocode_failed"; throw err;
  }
  const arr = await resp.json();
  if (!Array.isArray(arr) || arr.length === 0) { const err = new Error("Address not found"); err.status=422; err.code="address_not_found"; throw err; }
  const best = arr[0]; const lat = parseFloat(best.lat); const lon = parseFloat(best.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { const err = new Error("Invalid geocoder coordinates"); err.status=502; err.code="geocode_invalid"; throw err; }
  try { await setDoc(cacheRef, { address: String(address), normalized: normalizedId, lat, lon, provider: GEOCODER_PROVIDER, createdAt: new Date().toISOString() }); } catch(e){ console.warn("geocache write error:", e); }
  return { lat, lon, provider: GEOCODER_PROVIDER, cached: false };
}
async function _loadShippingConfig(db){
  const ref = doc(db, "shipping_config", "default");
  try {
    const snap = await getDoc(ref); const data = snap.exists() ? snap.data() : {};
    return {
      base_eur: _toNumber(data.base_eur, 2),
      per_km_eur: _toNumber(data.per_km_eur, 0.5),
      per_kg_eur: _toNumber(data.per_kg_eur, 0.5),
      min_price_eur: _toNumber(data.min_price_eur, 3),
      free_over_eur: _toNumber(data.free_over_eur, 0),
      remote_zone_km: _toNumber(data.remote_zone_km, 60),
      remote_surcharge_eur: _toNumber(data.remote_surcharge_eur, 5),
      express_multiplier: _toNumber(data.express_multiplier, 1.5),
      pickup_enabled: data.pickup_enabled !== false,
      currency: (data.currency || "eur").toLowerCase(),
      weight_tiers: Array.isArray(data.weight_tiers)
        ? data.weight_tiers
            .map((t) => ({ max_kg: _toNumber(t.max_kg), price_eur: _toNumber(t.price_eur) }))
            .filter((t) => Number.isFinite(t.max_kg) && t.max_kg > 0 && Number.isFinite(t.price_eur) && t.price_eur >= 0)
            .sort((a, b) => a.max_kg - b.max_kg)
        : [],
      weight_overflow_per_kg_eur: _toNumber(data.weight_overflow_per_kg_eur, 0),
    };
  } catch(e){
    console.warn("shipping_config read error:", e);
    return { base_eur:2, per_km_eur:0.0, per_kg_eur:0.0, min_price_eur:0, free_over_eur:0, remote_zone_km:0, remote_surcharge_eur:0, express_multiplier:1.5, pickup_enabled:true, currency:"eur", weight_tiers:[{max_kg:2,price_eur:3.5},{max_kg:5,price_eur:4.5}], weight_overflow_per_kg_eur:0 };
  }
}
async function _resolveItemsWeight(db, items){
  const warnings = []; let totalWeight = 0; if (!Array.isArray(items)) return { totalWeightKg:0, warnings:["items_not_array"] };
  for (const raw of items){
    const id = String(raw?.id || ""); const qty = Math.max(1, Math.min(999, Number(raw?.qty || 1)));
    const w = Number(raw?.weight); if (Number.isFinite(w) && w >= 0) { totalWeight += w * qty; continue; }
    if (!id) { warnings.push("item_without_id"); continue; }
    try {
      const snap = await getDoc(doc(db, "products", id));
      if (!snap.exists()) { warnings.push(`product_not_found:${id}`); continue; }
      const data = snap.data(); const pw = Number(data.weight);
      if (Number.isFinite(pw) && pw >= 0) totalWeight += pw * qty; else warnings.push(`weight_missing:${id}`);
    } catch(e){ console.warn("product read error", id, e); warnings.push(`product_read_error:${id}`); }
  }
  return { totalWeightKg: Number(totalWeight.toFixed(3)), warnings };
}
async function calcServerShippingQuote({ address, subtotal, items }){
  if (!Number.isFinite(WAREHOUSE_LAT) || !Number.isFinite(WAREHOUSE_LON)) {
    const err = new Error("WAREHOUSE coordinates not configured"); err.status=500; throw err;
  }
  const cfg = await _loadShippingConfig(db);
  const geo = await _geocodeAddress(db, address);
  const distanceKm = _haversineKm(WAREHOUSE_LAT, WAREHOUSE_LON, geo.lat, geo.lon);
  const { totalWeightKg, warnings } = await _resolveItemsWeight(db, items);
  let basePrice;
  let standardBase;
  if (Array.isArray(cfg.weight_tiers) && cfg.weight_tiers.length > 0) {
    const tiers = cfg.weight_tiers;
    let tierPrice = null;
    for (const t of tiers) {
      if (totalWeightKg <= t.max_kg + 1e-9) { tierPrice = t.price_eur; break; }
    }
    if (tierPrice === null) {
      if (_toNumber(cfg.weight_overflow_per_kg_eur, 0) > 0) {
        const last = tiers[tiers.length - 1];
        const extraKg = Math.max(0, totalWeightKg - last.max_kg);
        tierPrice = last.price_eur + _toNumber(cfg.weight_overflow_per_kg_eur, 0) * extraKg;
      } else {
        tierPrice = tiers[tiers.length - 1].price_eur;
        warnings.push('weight_over_last_tier');
      }
    }
    standardBase = tierPrice;
    basePrice = tierPrice;
    warnings.push('weight_tier_pricing');
  } else {
    basePrice = cfg.base_eur + cfg.per_km_eur * distanceKm + cfg.per_kg_eur * totalWeightKg;
    if (cfg.remote_zone_km > 0 && distanceKm > cfg.remote_zone_km) basePrice += cfg.remote_surcharge_eur;
    basePrice = Math.max(basePrice, cfg.min_price_eur);
    standardBase = basePrice;
  }
  const standardPrice = subtotal >= cfg.free_over_eur ? 0 : standardBase;
  const options = [];
  const CAP_EUR = 4.5;
  const standardCapped = Math.min(CAP_EUR, standardPrice);
  options.push({ id:"standard", label:"Стандарт", price_eur: _roundMoneyEUR(standardCapped), eta_days:2 });
  const expressPrice = Math.max(standardPrice, basePrice) * cfg.express_multiplier;
  const expressCapped = Math.min(CAP_EUR, expressPrice);
  options.push({ id:"express", label:"Экспресс", price_eur: _roundMoneyEUR(expressCapped), eta_days:1 });
  if (cfg.pickup_enabled) options.push({ id:"pickup", label:"Самовывоз", price_eur: 0, eta_days:0 });
  return {
    address,
    coords: { lat: geo.lat, lon: geo.lon }, provider: geo.provider, cached: !!geo.cached,
    distance_km: Number(distanceKm.toFixed(3)), total_weight_kg: totalWeightKg,
    subtotal_eur: _roundMoneyEUR(subtotal), currency: cfg.currency,
    options, warnings,
  };
}

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
      let quote;
      try {
        quote = await calcServerShippingQuote({
          address: String(shipping.address),
          subtotal: productsSubtotalCents / 100,
          items: quoteItems,
        });
      } catch (e) {
        const status = Number(e?.status) || 400;
        const message = e?.message || String(e);
        console.error("shipping calc failed:", status, message);
        return res.status(400).json({ error: "shipping_quote_failed", status, message });
      }
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
      cancel_url: `${origin}/checkout?canceled=1`,
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
