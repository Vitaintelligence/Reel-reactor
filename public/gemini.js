/* ═══════════════════════════════════════════
   gemini.js — Calls Vercel API proxy
   Import: import { generateCopy } from './gemini.js';
═══════════════════════════════════════════ */

// ─── CONFIG ───────────────────────────────────────────────
const ENDPOINT = "/api/generate";

// ─── PUBLIC ───────────────────────────────────────────────

/**
 * generateCopy(niche) → Promise<SlideData[]>
 * Returns array of 5 slide objects: { label, headline, sub, image_query }
 */
export async function generateCopy(niche, style = "default") {
    let response;
    try {
        response = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ niche, style })
        });
    } catch (networkErr) {
        throw new Error(`Network error — check your connection. (${networkErr.message})`);
    }

    if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const msg = errBody?.error || `API error ${response.status}`;
        throw new Error(msg);
    }

    const data = await response.json();

    // Extract raw text from OpenRouter (OpenAI-compatible) response format
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
        const apiErr = data?.error?.message || data?.error;
        throw new Error(apiErr ? `AI error: ${apiErr}` : "Empty response from AI.");
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
        if (!match) throw new Error("AI response was not valid JSON. Try again.");
        try {
            slides = JSON.parse(match[0]);
        } catch {
            throw new Error("Could not parse AI response. Try again.");
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
