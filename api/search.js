/* ═══════════════════════════════════════════
   api/search.js — Vercel Serverless Function
   Proxies Pinterest API search server-side so the
   browser doesn't hit Pinterest CORS restrictions.

   Call: GET /api/search?query=crying+girl+dark&slide=0
   Returns: { items: [...pin objects with media.images] }

   Set PINTEREST_TOKEN in Vercel → Project Settings → Environment Variables
═══════════════════════════════════════════ */

// Token injected at runtime via Vercel env — never hardcoded
const PINTEREST_TOKEN = process.env.PINTEREST_TOKEN || "";

export default async function handler(req, res) {
    // CORS headers so browser can call /api/search from the same origin
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (!PINTEREST_TOKEN) {
        return res.status(500).json({ error: "PINTEREST_TOKEN env var not set" });
    }

    const query = req.query?.query || "dark aesthetic portrait";
    const pageSize = 15;

    try {
        const pinterestRes = await fetch(
            `https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(query)}&page_size=${pageSize}`,
            {
                headers: {
                    "Authorization": `Bearer ${PINTEREST_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (!pinterestRes.ok) {
            const errBody = await pinterestRes.json().catch(() => ({}));
            return res.status(pinterestRes.status).json({
                error: errBody?.message || `Pinterest API error ${pinterestRes.status}`
            });
        }

        const data = await pinterestRes.json();
        return res.status(200).json(data);

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
