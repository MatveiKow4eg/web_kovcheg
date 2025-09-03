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

function normalizeKey(s, limit) {
  return (String(s || "").trim().toLowerCase().replace(/[\s\n\r]+/g, " ").slice(0, 200) + `|${limit||5}`)
    .replace(/[^a-z0-9_\-\|]+/gi, "_");
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(10, Math.max(1, parseInt(req.query.limit || '5', 10)));
    if (q.length < 2) return res.status(400).json({ error: 'query_too_short' });

    // Try cache
    const key = normalizeKey(q, limit);
    const cacheRef = doc(db, 'geosuggest', key);
    try {
      const snap = await getDoc(cacheRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.list)) {
          return res.status(200).json({ suggestions: data.list, cached: true });  
        }
      }
    } catch (e) {
      // Permission errors possible; ignore
      console.warn('geosuggest read error:', e);
    }

    const ua = process.env.GEOCODER_UA || `web-kovcheg/1.0 (${process.env.ADMIN_EMAILS || 'no-admin'})`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ee&limit=${limit}&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    if (resp.status === 429) return res.status(429).json({ error: 'rate_limited' });
    if (!resp.ok) {
      const text = await resp.text().catch(()=> '');
      return res.status(502).json({ error: 'geocoder_failed', message: `${resp.status}: ${text}` });
    }
    const arr = await resp.json();
    const list = Array.isArray(arr) ? arr.map((it) => {
      const addr = it.address || {};
      const streetParts = [];
      if (addr.road) streetParts.push(addr.road);
      if (addr.house_number) streetParts.push(addr.house_number);
      const street = streetParts.join(' ').trim();
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
      const zip = addr.postcode || '';
      return {
        label: it.display_name,
        components: { street, city, zip },
        coords: { lat: parseFloat(it.lat), lon: parseFloat(it.lon) },
      };
    }) : [];

    // Save cache (best effort)
    try {
      await setDoc(cacheRef, { q, limit, list, createdAt: new Date().toISOString() });
    } catch (e) {
      console.warn('geosuggest write error:', e);
    }

    return res.status(200).json({ suggestions: list, cached: false });
  } catch (e) {
    console.error('address-suggest error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
