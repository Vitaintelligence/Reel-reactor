/* ═══════════════════════════════════════════
   gemini.js — Gemini API (Google REST, no SDK)
   Import: import { generateCopy } from './gemini.js';
═══════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────────────
const OPENROUTER_KEY = "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";
const OR_MODEL = "google/gemini-2.5-flash";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// ─── PUBLIC ───────────────────────────────────────────────

/**
 * generateCopy(niche) → Promise<SlideData[]>
 * Returns array of 5 slide objects: { label, headline, sub, image_query }
 */
export async function generateCopy(niche) {
    if (!OPENROUTER_KEY || OPENROUTER_KEY.startsWith("PASTE")) {
        throw new Error("Add your OpenRouter API key inside gemini.js (OPENROUTER_KEY constant).");
    }

    let response;
    try {
        response = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + OPENROUTER_KEY,
                "HTTP-Referer": "https://clippers.glowrizz.club",
                "X-Title": "Maxify Reel Farm"
            },
            body: JSON.stringify({
                model: OR_MODEL,
                messages: [{ role: "user", content: buildPrompt(niche) }]
            })
        });
    } catch (networkErr) {
        throw new Error(`Network error — check your connection. (${networkErr.message})`);
    }

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody?.error?.message || `Gemini API error ${response.status}`;
        throw new Error(msg);
    }

    const data = await response.json();

    // Extract raw text from OpenRouter (OpenAI-compatible) response format
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
        const apiErr = data?.error?.message;
        throw new Error(apiErr ? `OpenRouter error: ${apiErr}` : "Empty response from AI.");
    }

    // Strip markdown fences if present
    const cleaned = raw.replace(/```json|```/gi, "").trim();

    // Parse JSON
    let slides;
    try {
        slides = JSON.parse(cleaned);
    } catch {
        // Try to extract a JSON array from somewhere in the response
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("Gemini response was not valid JSON. Try again.");
        try {
            slides = JSON.parse(match[0]);
        } catch {
            throw new Error("Could not parse Gemini response. Try again.");
        }
    }

    if (!Array.isArray(slides) || slides.length < 5) {
        throw new Error(`Expected 5 slides, got ${Array.isArray(slides) ? slides.length : 0}. Try again.`);
    }

    // Validate shape
    return slides.slice(0, 5).map((s, i) => ({
        label: String(s.label || `${i + 1}. slide`),
        headline: String(s.headline || ""),
        sub: String(s.sub || ""),
        image_query: String(s.image_query || "dark portrait aesthetic")
    }));
}

// ─── PRIVATE ──────────────────────────────────────────────

function buildPrompt(niche) {
    return `You are writing copy for a viral TikTok/Instagram slideshow for Maxify —
an AI looksmaxxing and rizz app. Niche: ${niche}.

Maxify features: AI facial scan, canthal tilt analysis, hunter eyes score,
jawline rating, face morphing, mog battles (vs friends + celebrities),
rizz engine (screenshot your chat → AI tells you what to say),
opener generator, The Dojo (looksmaxx theory, mewing, attraction science),
weekly tracking.

Write EXACTLY 5 slides. Voice: first person, lowercase, personal, authentic.
Like a real guy sharing what he learned. NOT corporate. NOT salesy.

PSYCHOLOGICAL STRUCTURE:
Slide 1 — HOOK: Forbidden knowledge or personal confession.
  Use: "i didn't know", "nobody told me", "this changed everything", "i found out"
  Create a loop the brain cannot close without swiping.
  Reference a specific Maxify feature indirectly (don't name the app yet).

Slide 2 — CONTEXT: Name the specific problem. Identity threat.
  Make them feel this is about THEM. Reference a real feature by name
  (canthal tilt, hunter eyes, jawline score, mog battle).
  Drop the enemy subtly: "every other app just gives you a number"

Slide 3 — SURPRISE: One brutal, specific, data-flavored claim.
  Engineered to trigger comments. Controversial but true.
  Example: "men with negative canthal tilt get 34% fewer matches on average"
  End with "agree or disagree?" or "comment your score"

Slide 4 — ESCALATION: Name Maxify. Show why it wins.
  Compare to what they've tried. Make them feel behind for not using it.
  "1000+ guys scanned this week"

Slide 5 — PAYOFF: Checklist format. Save bait.
  Give them a real framework to screenshot.
  End exactly with: "download maxify free — glowrizz.club"

For each slide return:
- label: pill text (e.g. "1. the scan that changed everything")
- headline: main text, lowercase, max 10 words
- sub: explanation text, lowercase, max 18 words
- image_query: 3-word Unsplash search (match the emotional role of each slide)

Slide image guidance:
  Slide 1 (HOOK): dramatic portrait, intense stare, high contrast
  Slide 2 (CONTEXT): confident lifestyle, minimal aesthetic, aspirational
  Slide 3 (SURPRISE): phone screen glow, close up face, mirror reflection
  Slide 4 (ESCALATION): status lifestyle minimal, men aesthetic dark
  Slide 5 (PAYOFF): dark minimal clean, calm dark aesthetic

Return ONLY valid JSON array, no markdown, no extra text:
[
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."}
]`;
}
