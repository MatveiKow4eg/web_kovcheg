import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore/lite";

// Firebase (server-side via env)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Environment
const WAREHOUSE_LAT = parseFloat(process.env.WAREHOUSE_LAT || "");
const WAREHOUSE_LON = parseFloat(process.env.WAREHOUSE_LON || "");
const GEOCODER_PROVIDER = (process.env.GEOCODER_PROVIDER || "nominatim").toLowerCase();

// Helpers
function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

function normalizeAddressId(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\n\r]+/g, " ")
    .replace(/[\/#?%&:*"'<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .slice(0, 300);
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function geocodeAddress(address) {
  const warnings = [];
  const ensureEstonia = (s) => (/estonia/i.test(s) ? s : `${s}, Estonia`);
  const repl = (s) => s
    .replace(/\btn\.?\b/gi, " tänav ")
    .replace(/\bmnt\.?\b/gi, " maantee ")
    .replace(/\bpst\.?\b/gi, " puiestee ")
    .replace(/\s+/g, " ").trim();
  const stripMaakond = (s) => s.replace(/,?\s*[A-Za-zÄÖÜÕäöüõ\- ]+\s+maakond/gi, "");

  // Parse components heuristically
  const parts = String(address).split(',').map(p => p.trim()).filter(Boolean);
  const zipMatch = String(address).match(/\b\d{5}\b/);
  const zip = zipMatch ? zipMatch[0] : '';
  let street = parts[0] || '';
  // Find potential city: prefer a part that isn't Estonia/maakond and has letters
  let city = parts.find(p => !/estonia/i.test(p) && !/maakond/i.test(p) && /[A-Za-zÄÖÜÕäöüõ]/.test(p) && !/\d{5}/.test(p)) || '';

  // Heuristic: when no commas and format like "Aniisi 11 Saue 76505"
  if (!city && zip && street && parts.length === 1) {
    const cleaned = repl(stripMaakond(street));
    const noZip = cleaned.replace(new RegExp(`\\b${zip}\\b`), '').trim();
    const tokens = noZip.split(/\s+/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (/[A-Za-zÄÖÜÕäöüõ\-]/.test(t) && !/\d/.test(t)) {
        city = t;
        const idx = noZip.lastIndexOf(city);
        const streetGuess = noZip.slice(0, idx).trim();
        if (streetGuess) { street = streetGuess; warnings.push('address_zip_city_heuristic'); }
        break;
      }
    }
  }

  // Build candidate queries (free text and structured)
  const candidates = [];
  const original = ensureEstonia(address);
  const normalized = ensureEstonia(stripMaakond(repl(address)));
  candidates.push({ type: 'q', q: original });
  if (normalized.toLowerCase() !== original.toLowerCase()) candidates.push({ type: 'q', q: normalized });

  // Reorder "ZIP City" if both present
  if (zip && city) {
    const streetClean = street ? repl(stripMaakond(street)) : '';
    candidates.push({ type: 'q', q: ensureEstonia(`${streetClean}, ${zip} ${city}`) });
  }

  // Structured
  const streetStruct = street ? repl(stripMaakond(street)) : '';
  const cityStruct = city ? repl(stripMaakond(city)) : '';
  if (streetStruct || cityStruct || zip) {
    candidates.push({ type: 'struct', street: streetStruct, city: cityStruct, postalcode: zip });
  }

  // Try cache by original normalized key first
  const normalizedId = normalizeAddressId(address);
  const cacheRef = doc(db, "geocache", normalizedId);
  try {
    const snap = await getDoc(cacheRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.lat && data?.lon) {
        return { lat: Number(data.lat), lon: Number(data.lon), provider: data.provider || GEOCODER_PROVIDER, cached: true, warnings };
      }
    }
  } catch (e) {
    console.warn("geocache read error:", e);
  }

  if (GEOCODER_PROVIDER !== "nominatim") {
    throw Object.assign(new Error("Unsupported geocoder provider in this prototype"), { status: 501, code: "geocoder_not_implemented" });
  }

  const ua = process.env.GEOCODER_UA || `web-kovcheg/1.0 (${process.env.ADMIN_EMAILS || "no-admin"})`;
  const doSearch = async (cand) => {
    let url;
    if (cand.type === 'q') {
      url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ee&limit=1&q=${encodeURIComponent(cand.q)}`;
    } else {
      const sp = new URLSearchParams({ format: 'json', addressdetails: '1', country: 'Estonia', limit: '1' });
      if (cand.street) sp.append('street', cand.street);
      if (cand.city) sp.append('city', cand.city);
      if (cand.postalcode) sp.append('postalcode', cand.postalcode);
      url = `https://nominatim.openstreetmap.org/search?${sp.toString()}`;
    }
    const resp = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    if (resp.status === 429) {
      const e = new Error('Rate limited by geocoder'); e.status = 429; e.code = 'geocode_rate_limited'; throw e;
    }
    if (!resp.ok) {
      const text = await resp.text().catch(()=>"");
      const e = new Error(`Geocoder failed ${resp.status}: ${text}`); e.status = 502; e.code = 'geocode_failed'; throw e;
    }
    const arr = await resp.json();
    return Array.isArray(arr) && arr.length ? arr[0] : null;
  };

  let best = null;
  for (let i = 0; i < candidates.length; i++) {
    best = await doSearch(candidates[i]);
    if (best) {
      if (i > 0) warnings.push('address_fallback_used');
      break;
    }
  }

  // Fallbacks: try postalcode alone, then city alone
  if (!best && zip) {
    best = await doSearch({ type: 'q', q: ensureEstonia(zip) });
    if (best) warnings.push('address_postal_fallback');
  }
  if (!best && city) {
    best = await doSearch({ type: 'q', q: ensureEstonia(city) });
    if (best) warnings.push('address_city_fallback');
  }

  if (!best) {
    throw Object.assign(new Error("Address not found"), { status: 422, code: "address_not_found" });
  }

  const lat = parseFloat(best.lat);
  const lon = parseFloat(best.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw Object.assign(new Error("Invalid geocoder coordinates"), { status: 502, code: "geocode_invalid" });
  }

  try {
    await setDoc(cacheRef, {
      address: String(address),
      normalized: normalizedId,
      lat,
      lon,
      provider: GEOCODER_PROVIDER,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("geocache write error:", e);
  }

  return { lat, lon, provider: GEOCODER_PROVIDER, cached: false, warnings };
}

async function loadShippingConfig() {
  const ref = doc(db, "shipping_config", "default");
  try {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    return {
      base_eur: toNumber(data.base_eur, 2),
      per_km_eur: toNumber(data.per_km_eur, 0.5),
      per_kg_eur: toNumber(data.per_kg_eur, 0.5),
      min_price_eur: toNumber(data.min_price_eur, 3),
      free_over_eur: toNumber(data.free_over_eur, 0),
      remote_zone_km: toNumber(data.remote_zone_km, 60),
      remote_surcharge_eur: toNumber(data.remote_surcharge_eur, 5),
      express_multiplier: toNumber(data.express_multiplier, 1.5),
      pickup_enabled: data.pickup_enabled !== false,
      currency: (data.currency || "eur").toLowerCase(),
    };
  } catch (e) {
    console.warn("shipping_config read error:", e);
    return {
      base_eur: 2,
      per_km_eur: 0.5,
      per_kg_eur: 0.5,
      min_price_eur: 3,
      free_over_eur: 0,
      remote_zone_km: 60,
      remote_surcharge_eur: 5,
      express_multiplier: 1.5,
      pickup_enabled: true,
      currency: "eur",
    };
  }
}

async function resolveItemsWeight(items) {
  // items: [{ id, qty, weight? }]
  const warnings = [];
  let totalWeight = 0;
  if (!Array.isArray(items)) return { totalWeightKg: 0, warnings: ["items_not_array"] };

  for (const raw of items) {
    const id = String(raw?.id || "");
    const qty = Math.max(1, Math.min(999, Number(raw?.qty || 1)));
    const w = Number(raw?.weight);
    if (Number.isFinite(w) && w >= 0) {
      totalWeight += w * qty;
      continue;
    }
    if (!id) { warnings.push("item_without_id"); continue; }
    try {
      const snap = await getDoc(doc(db, "products", id));
      if (!snap.exists()) {
        warnings.push(`product_not_found:${id}`);
        continue;
      }
      const data = snap.data();
      const pw = Number(data.weight);
      if (Number.isFinite(pw) && pw >= 0) {
        totalWeight += pw * qty;
      } else {
        warnings.push(`weight_missing:${id}`);
      }
    } catch (e) {
      console.warn("product read error", id, e);
      warnings.push(`product_read_error:${id}`);
    }
  }
  return { totalWeightKg: Number(totalWeight.toFixed(3)), warnings };
}

function roundMoneyEUR(v) {
  // Round to 2 decimals with typical banker's rounding
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!Number.isFinite(WAREHOUSE_LAT) || !Number.isFinite(WAREHOUSE_LON)) {
    return res.status(500).json({ error: "WAREHOUSE coordinates not configured" });
  }

  try {
    const address = String(req.query.address || "").trim();
    if (!address) {
      return res.status(400).json({ error: "address_required" });
    }

    const subtotal = Number(req.query.subtotal || 0);
    let items = [];
    try {
      const itemsParam = req.query.items;
      if (typeof itemsParam === "string" && itemsParam.length > 0) {
        items = JSON.parse(itemsParam);
      } else if (Array.isArray(itemsParam)) {
        // If query has repeated items[]=... entries (not expected here)
        items = itemsParam.map((i) => JSON.parse(i));
      }
    } catch (e) {
      return res.status(400).json({ error: "invalid_items_json" });
    }

    const cfg = await loadShippingConfig();

    // Geocode
    const geo = await geocodeAddress(address);
    const distanceKm = haversineKm(WAREHOUSE_LAT, WAREHOUSE_LON, geo.lat, geo.lon);

    // Weight
    const { totalWeightKg, warnings: weightWarnings } = await resolveItemsWeight(items);
    const warnings = [...(geo.warnings || []), ...weightWarnings];

    // Base formula
    let basePrice = cfg.base_eur + cfg.per_km_eur * distanceKm + cfg.per_kg_eur * totalWeightKg;

    if (cfg.remote_zone_km > 0 && distanceKm > cfg.remote_zone_km) {
      basePrice += cfg.remote_surcharge_eur;
    }

    basePrice = Math.max(basePrice, cfg.min_price_eur);

    // Free shipping threshold applies to standard only
    const standardPrice = subtotal >= cfg.free_over_eur ? 0 : basePrice;

    const options = [];

    options.push({
      id: "standard",
      label: "Стандарт",
      price_eur: roundMoneyEUR(standardPrice),
      eta_days: 2,
    });

    const expressPrice = Math.max(standardPrice, basePrice) * cfg.express_multiplier;
    options.push({
      id: "express",
      label: "Экспресс",
      price_eur: roundMoneyEUR(expressPrice),
      eta_days: 1,
    });

    if (cfg.pickup_enabled) {
      options.push({ id: "pickup", label: "Самовывоз", price_eur: 0, eta_days: 0 });
    }

    return res.status(200).json({
      address,
      coords: { lat: geo.lat, lon: geo.lon },
      provider: geo.provider,
      cached: !!geo.cached,
      distance_km: Number(distanceKm.toFixed(3)),
      total_weight_kg: totalWeightKg,
      subtotal_eur: roundMoneyEUR(subtotal),
      currency: cfg.currency,
      options,
      warnings,
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    const code = err?.code || "internal_error";
    console.error("shipping-quote error:", err);
    return res.status(status).json({ error: code, message: err.message || String(err) });
  }
}
