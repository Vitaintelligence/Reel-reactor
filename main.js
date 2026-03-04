/* ═══════════════════════════════════════════
   main.js — Orchestrator. Wires all modules together.
   Entry point: <script type="module" src="main.js">
═══════════════════════════════════════════ */

import { generateCopy } from "./gemini.js";
import { preloadImages } from "./images.js";
import { renderAll, showSkeletons, clearSlides } from "./slides.js";

// ─── DOM REFS ─────────────────────────────────────────────
const generateBtn = document.getElementById("generate-btn");
const nicheSelect = document.getElementById("niche-select");
const errorMsg = document.getElementById("error-msg");

// ─── INIT ─────────────────────────────────────────────────
generateBtn.addEventListener("click", handleGenerate);

// Also allow Enter key on the select
nicheSelect.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGenerate();
});

// ─── MAIN FLOW ────────────────────────────────────────────

async function handleGenerate() {
    const niche = nicheSelect.value;

    // ── Step 1: Loading state
    setLoading(true);
    setError("");
    showSkeletons();

    try {
        // ── Step 2: Get AI copy (5 slides)
        console.log(`[main] Generating copy for niche: "${niche}"`);
        const slidesData = await generateCopy(niche);
        console.log("[main] ✓ Got slides data:", slidesData);

        // ── Step 3: Preload all 5 images in parallel
        console.log("[main] Preloading images…");
        const images = await preloadImages(slidesData);
        console.log(`[main] ✓ Images ready (${images.length})`);

        // ── Step 4: Render slides to DOM
        console.log("[main] Rendering slides…");
        await renderAll(slidesData, images);
        console.log("[main] ✓ Render complete");

    } catch (err) {
        console.error("[main] Generation failed:", err);
        setError(err.message || "Something went wrong. Check the console.");
        clearSlides();
    } finally {
        // ── Step 5: Reset button
        setLoading(false);
    }
}

// ─── UI HELPERS ───────────────────────────────────────────

function setLoading(isLoading) {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? "generating..." : "Generate Reel";
    if (isLoading) {
        generateBtn.classList.add("loading");
    } else {
        generateBtn.classList.remove("loading");
    }
}

function setError(msg) {
    errorMsg.textContent = msg;
}
