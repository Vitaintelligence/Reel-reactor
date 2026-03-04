/* ═══════════════════════════════════════════════════════════════════
   images.js — Smart Image Selection Engine
   ═══════════════════════════════════════════════════════════════════
   Architecture:
   ┌─────────────────────────────────────────────────────────────┐
   │  image_library.json (173 local images, scraped)             │
   │         ↓  fetched once, cached in memory                   │
   │  SLIDE_POOLS — weighted category mapping per slide role      │
   │         ↓  picks best match, random within pool             │
   │  ImageResult[] → slides.js renders as <img> or canvas       │
   └─────────────────────────────────────────────────────────────┘

   Priority chain:
     1. Local image library  (instant, CORS-free, owned)
     2. Pinterest API proxy  (/api/search, Vercel function)
     3. Dark gradient canvas (always works, looks great)

   Export: preloadImages(slidesData) → Promise<ImageResult[]>
═══════════════════════════════════════════════════════════════════ */

// ─── SLIDE ROLE → CATEGORY POOLS ──────────────────────────────────────────
// Each slide role draws from a PRIMARY pool first (most relevant images),
// then supplements from SECONDARY if primary is exhausted.
//
// Slot indices match slide positions:
//   0 = HOOK        1 = CONTEXT     2 = SURPRISE
//   3 = ESCALATION  4 = PAYOFF
// ──────────────────────────────────────────────────────────────────────────
const SLIDE_POOLS = [
    {
        // HOOK — Emotional stop-scroll. Face-first, high arousal.
        primary: ["01_HOOK_IMAGES", "02_REACTION_IMAGES"],
        secondary: ["mirror_selfies", "mysterious_model", "08_LONELY_EMOTIONAL"]
    },
    {
        // CONTEXT — Authority, status, lifestyle aspiration.
        primary: ["03_LIFESTYLE_IMAGES", "05_POWER_STATUS_IMAGES"],
        secondary: ["luxury_model", "luxury_male", "soft_girl"]
    },
    {
        // SURPRISE — Real, relatable, personal moment.
        primary: ["07_PHONE_SOCIAL_MEDIA", "08_LONELY_EMOTIONAL"],
        secondary: ["soft_girl", "02_REACTION_IMAGES", "04_RELATIONSHIP_IMAGES"]
    },
    {
        // ESCALATION — Transformation, power, discipline.
        primary: ["sigma_portraits", "gym_sigma", "gym_model"],
        secondary: ["05_POWER_STATUS_IMAGES", "luxury_male", "dark_sigma"]
    },
    {
        // PAYOFF — Clean, calm, aspirational. Let copy breathe.
        primary: ["06_DARK_AESTHETIC", "09_BACKGROUND_TEXTURES"],
        secondary: ["dark_sigma", "mysterious_model", "11_MALE_SIGMA_MODELS"]
    }
];

// ─── MODULE STATE ──────────────────────────────────────────────────────────
let _library = null;   // Loaded once, cached for the session
let _loadPromise = null;  // Shared promise so parallel calls don't double-fetch

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/**
 * preloadImages(slidesData) → Promise<ImageResult[]>
 *
 * Returns one ImageResult per slide:
 *   { type: "local",    url: "/static_assets/..." }        — local scraped image
 *   { type: "remote",   url: "https://pinimg..." }  — Pinterest via proxy
 *   { type: "fallback", canvas: HTMLCanvasElement } — dark gradient
 */
export async function preloadImages(slidesData) {
    const library = await _getLibrary();

    return Promise.all(
        slidesData.map((slide, i) => _pickImage(library, i, slide.image_query))
    );
}

// ─── LIBRARY LOADER ───────────────────────────────────────────────────────

async function _getLibrary() {
    if (_library) return _library;
    if (_loadPromise) return _loadPromise;

    _loadPromise = fetch("/image_library.json")
        .then(r => {
            if (!r.ok) throw new Error(`image_library.json not found (${r.status})`);
            return r.json();
        })
        .then(data => {
            _library = data;
            const total = Object.values(data).reduce((s, v) => s + v.length, 0);
            console.log(`[images] Library loaded — ${total} images across ${Object.keys(data).length} categories`);
            return data;
        })
        .catch(err => {
            console.warn("[images] Library load failed:", err.message, "— using Pinterest proxy only");
            _library = {};
            return {};
        });

    return _loadPromise;
}

// ─── SMART SELECTOR ───────────────────────────────────────────────────────

async function _pickImage(library, slideIndex, aiHint) {
    const pool = SLIDE_POOLS[slideIndex] || SLIDE_POOLS[0];
    const allCats = [...pool.primary, ...pool.secondary];

    // Build a weighted candidate list
    // Primary gets 3× weight, secondary gets 1× weight
    const candidates = [];
    for (const cat of pool.primary) { const imgs = library[cat] || []; candidates.push(...imgs, ...imgs, ...imgs); }
    for (const cat of pool.secondary) { const imgs = library[cat] || []; candidates.push(...imgs); }

    if (candidates.length > 0) {
        // Pick a random candidate, avoiding the last 5 used (history-aware)
        const chosen = _randomFrom(candidates);
        console.log(`[images] Slide ${slideIndex + 1} ← local "${_catName(chosen)}"`);
        return { type: "local", url: chosen };
    }

    // Library empty for this role → try Pinterest proxy
    console.warn(`[images] Slide ${slideIndex + 1} — no local images for [${allCats.join(", ")}], trying proxy`);
    return _fetchProxy(slideIndex, aiHint);
}

// ─── PINTEREST PROXY FALLBACK ─────────────────────────────────────────────

const ROLE_QUERIES = [
    ["crying girl", "girl shocked"],
    ["luxury lifestyle", "man status"],
    ["girl phone", "sad portrait"],
    ["sigma male", "gym male"],
    ["dark portrait", "dark background"]
];

async function _fetchProxy(slideIndex, aiHint) {
    const options = ROLE_QUERIES[slideIndex] || ROLE_QUERIES[0];
    const query = aiHint
        ? `${aiHint} dark`
        : options[Math.floor(Math.random() * options.length)];

    try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Proxy ${res.status}`);
        const data = await res.json();
        const pins = (data.items || []).filter(p => p.media?.images);
        if (!pins.length) throw new Error("No pins");

        const pin = pins[Math.floor(Math.random() * Math.min(10, pins.length))];
        const imgs = pin.media.images;
        const url = imgs["1200x"]?.url || imgs.original?.url || imgs["750x"]?.url;
        if (!url) throw new Error("No URL");

        console.log(`[images] Slide ${slideIndex + 1} ← Pinterest proxy "${query}"`);
        return { type: "remote", url, pinId: pin.id };

    } catch (err) {
        console.warn(`[images] Slide ${slideIndex + 1} — proxy failed (${err.message}), using gradient`);
        return { type: "fallback", canvas: _gradient() };
    }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

// Session pick history to avoid repeat images in one generate
const _recentPicks = new Set();

function _randomFrom(arr) {
    // Filter out recently picked items when possible
    const fresh = arr.filter(u => !_recentPicks.has(u));
    const pool = fresh.length > 0 ? fresh : arr;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    _recentPicks.add(pick);
    if (_recentPicks.size > 30) {
        // Expire oldest 10
        const iter = _recentPicks.values();
        for (let i = 0; i < 10; i++) _recentPicks.delete(iter.next().value);
    }
    return pick;
}

function _catName(url) {
    const parts = url.split("/");
    return parts[parts.length - 2] || "?";
}

function _gradient() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");

    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, "#0f0c1a");
    grad.addColorStop(0.4, "#0d0d1e");
    grad.addColorStop(1, "#050508");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const glow = ctx.createRadialGradient(200, 1700, 0, 200, 1700, 900);
    glow.addColorStop(0, "rgba(255,60,60,0.13)");
    glow.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1920);

    return canvas;
}
