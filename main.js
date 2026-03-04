/* ═══════════════════════════════════════════
   main.js — Orchestrator. Wires all modules together.
   Entry point: <script type="module" src="main.js">
═══════════════════════════════════════════ */

import { generateCopy } from "./gemini.js";
import { preloadImages } from "./images.js";
import { renderAll, showSkeletons, clearSlides, downloadAllAsZip, downloadAllAsVideo } from "./slides.js";

// ─── DOM REFS ─────────────────────────────────────────────
const generateBtn = document.getElementById("generate-btn");
const nicheSelect = document.getElementById("niche-select");
const errorMsg = document.getElementById("error-msg");
const globalActions = document.getElementById("global-actions");
const btnZip = document.getElementById("dl-zip-btn");
const btnVid = document.getElementById("dl-vid-btn");

let currentSlidesData = null;
let currentImageResults = null;

// ─── INIT ─────────────────────────────────────────────────
generateBtn.addEventListener("click", handleGenerate);

// Also allow Enter key on the select
nicheSelect.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleGenerate();
});

btnZip.addEventListener("click", async () => {
    if (!currentSlidesData) return;
    const orig = btnZip.textContent;
    btnZip.textContent = "📦 Zipping...";
    btnZip.disabled = true;
    try { await downloadAllAsZip(currentSlidesData, currentImageResults); }
    finally { btnZip.textContent = orig; btnZip.disabled = false; }
});

btnVid.addEventListener("click", async () => {
    if (!currentSlidesData) return;
    const orig = btnVid.textContent;
    btnVid.textContent = "🎬 Recording Video (11s)...";
    btnVid.disabled = true;
    try { await downloadAllAsVideo(currentSlidesData, currentImageResults); }
    finally { btnVid.textContent = orig; btnVid.disabled = false; }
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
        currentSlidesData = slidesData;
        currentImageResults = images;
        globalActions.style.display = "flex";
        console.log("[main] ✓ Render complete");

    } catch (err) {
        console.error("[main] Generation failed:", err);
        setError(err.message || "Something went wrong. Check the console.");
        clearSlides();
        globalActions.style.display = "none";
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
