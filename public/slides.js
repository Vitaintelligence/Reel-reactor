/* ═══════════════════════════════════════════
   slides.js — Card rendering + PNG download
   
   Architecture:
   • PREVIEW CARD: <img> as background (real Pinterest images, no CORS restriction)
   • DOWNLOAD: Canvas with text on dark gradient (always CORS-safe, reliable export)
   
   Import: import { renderAll, showSkeletons, clearSlides } from './slides.js';
═══════════════════════════════════════════ */

const W = 1080;
const H = 1920;
const FONT_FAMILY = "'Inter', -apple-system, sans-serif";

/* Per-slide layout: pill Y, headline Y, sub Y, font sizes */
const LAYOUTS = [
    { region: "top", pillY: 250, headY: 400, subY: 530, fontSize: 78, lh: 96, subSize: 42, subLh: 60 }, // HOOK
    { region: "middle", pillY: 780, headY: 930, subY: 1060, fontSize: 64, lh: 84, subSize: 42, subLh: 60 }, // CONTEXT
    { region: "middle", pillY: 780, headY: 930, subY: 1060, fontSize: 64, lh: 84, subSize: 42, subLh: 60 }, // SURPRISE
    { region: "middle", pillY: 780, headY: 930, subY: 1060, fontSize: 64, lh: 84, subSize: 42, subLh: 60 }, // ESCALATION
    { region: "bottom", pillY: 1280, headY: 1410, subY: 1540, fontSize: 58, lh: 76, subSize: 42, subLh: 60 }, // PAYOFF
];

/* ─── PUBLIC API ──────────────────────────────────────────────────── */

export function showSkeletons() {
    const strip = document.getElementById("slides-strip");
    _hideEmpty();
    strip.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const outer = document.createElement("div");
        outer.className = "slide-card-outer";
        const card = document.createElement("div");
        card.className = "slide-card skeleton";
        const label = document.createElement("div");
        label.className = "skeleton-label";
        label.textContent = `Slide ${i + 1}`;
        card.appendChild(label);
        outer.appendChild(card);
        strip.appendChild(outer);
    }
}

export function clearSlides() {
    const strip = document.getElementById("slides-strip");
    strip.innerHTML = "";
    _showEmpty();
}

/**
 * renderAll(slidesData, imageResults)
 * imageResults: array from images.js — each item is one of:
 *   { type: "local",    url: "/public/SLIDESHOW_ASSETS/..." } — scraped local image
 *   { type: "remote",   url: "https://pinimg.com/..."      } — Pinterest via proxy
 *   { type: "fallback", canvas: HTMLCanvasElement          } — dark gradient
 */
export async function renderAll(slidesData, imageResults) {
    await _ensureFonts();

    const strip = document.getElementById("slides-strip");
    _hideEmpty();
    strip.innerHTML = "";

    // Store for pinning later
    window._reelImages = imageResults;

    slidesData.forEach((slide, i) => {
        const imgResult = imageResults[i];

        /* ── Outer wrapper ── */
        const outer = document.createElement("div");
        outer.className = "slide-card-outer";

        /* ── Card ── */
        const card = document.createElement("div");
        card.className = "slide-card";

        /* --- BACKGROUND IMAGE --- */
        const hasImg = imgResult.type === "local" || imgResult.type === "remote";
        if (hasImg) {
            const bg = document.createElement("img");
            bg.className = "card-bg-img";
            bg.alt = "";
            bg.src = imgResult.url;
            bg.loading = "eager";
            bg.onerror = () => { bg.style.display = "none"; };
            card.appendChild(bg);
        } else {
            // Fallback canvas background
            const bgCanvas = imgResult.canvas;
            bgCanvas.className = "card-bg-canvas";
            card.appendChild(bgCanvas);
        }

        /* --- DARK SCRIM --- */
        const scrim = document.createElement("div");
        scrim.className = `card-scrim scrim-${LAYOUTS[i].region}`;
        card.appendChild(scrim);

        /* --- TEXT CONTENT --- */
        const content = document.createElement("div");
        content.className = `card-content content-${LAYOUTS[i].region}`;

        // Pill label
        const pill = document.createElement("div");
        pill.className = "card-pill";
        pill.textContent = slide.label;
        content.appendChild(pill);

        // Headline
        const h = document.createElement("div");
        h.className = "card-headline";
        h.textContent = slide.headline;
        content.appendChild(h);

        // Sub text
        const sub = document.createElement("div");
        sub.className = "card-sub";
        sub.textContent = slide.sub;
        content.appendChild(sub);

        card.appendChild(content);

        /* ── Download button ── */
        const dlBtn = document.createElement("button");
        dlBtn.className = "download-btn";
        dlBtn.textContent = `↓  Download Slide ${i + 1}`;
        dlBtn.addEventListener("click", () => downloadSlide(slide, i, imgResult));

        outer.appendChild(card);
        outer.appendChild(dlBtn);
        strip.appendChild(outer);
    });
}

/* ─── DOWNLOAD ────────────────────────────────────────────── */

/**
 * downloadSlide(slideData, index, imgResult)
 *
 * Strategy:
 * 1. Try to load the Pinterest image WITH crossOrigin=anonymous
 *    (works if the image CDN has CORS headers)
 * 2. If CORS fails → render text on dark gradient (always works)
 * 3. Export 1080x1920 PNG
 */
export function downloadSlide(slideData, index, imgResult) {
    const hasUrl = (imgResult?.type === "local" || imgResult?.type === "remote") && imgResult.url;

    if (hasUrl) {
        // local images are same-origin → CORS always works → full canvas with image
        // remote (Pinterest CDN) → try with CORS, fall back to gradient if blocked
        const testImg = new Image();
        testImg.crossOrigin = "anonymous";

        testImg.onload = () => {
            const canvas = _renderFullCanvas(slideData, index, testImg);
            _exportCanvas(canvas, index);
        };

        testImg.onerror = () => {
            // Remote CDN CORS blocked — use gradient fallback
            const canvas = _renderTextCanvas(slideData, index, null);
            _exportCanvas(canvas, index);
        };

        testImg.src = imgResult.url;
    } else {
        // Gradient fallback canvas
        const bgCanvas = imgResult?.canvas || null;
        const canvas = _renderFullCanvas(slideData, index, bgCanvas);
        _exportCanvas(canvas, index);
    }
}

/* ─── CANVAS RENDERING ────────────────────────────────────── */

function _renderFullCanvas(slideData, index, bgSource) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    const layout = LAYOUTS[index] || LAYOUTS[1];

    // 1. Background
    if (bgSource) {
        _drawBackground(ctx, bgSource);
    } else {
        _drawGradientBg(ctx);
    }

    // 2. Scrim
    _drawScrim(ctx, layout.region);

    // 3. Text
    _drawSlideText(ctx, slideData, layout);

    return canvas;
}

function _renderTextCanvas(slideData, index, bgCanvas) {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    const layout = LAYOUTS[index] || LAYOUTS[1];
    if (bgCanvas) {
        ctx.drawImage(bgCanvas, 0, 0, W, H);
    } else {
        _drawGradientBg(ctx);
    }
    _drawScrim(ctx, layout.region);
    _drawSlideText(ctx, slideData, layout);
    return canvas;
}

function _drawBackground(ctx, src) {
    const iw = src.naturalWidth || src.width || W;
    const ih = src.naturalHeight || src.height || H;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function _drawGradientBg(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#0f0c1a");
    grad.addColorStop(0.4, "#0d0d1e");
    grad.addColorStop(1, "#050508");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Red accent glow
    const glow = ctx.createRadialGradient(200, 1700, 0, 200, 1700, 900);
    glow.addColorStop(0, "rgba(255,60,60,0.13)");
    glow.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
}

function _drawScrim(ctx, region) {
    let grad;
    if (region === "top") {
        grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0.88)");
        grad.addColorStop(0.22, "rgba(0,0,0,0.72)");
        grad.addColorStop(0.52, "rgba(0,0,0,0.08)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
    } else if (region === "bottom") {
        grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.52, "rgba(0,0,0,0.08)");
        grad.addColorStop(0.72, "rgba(0,0,0,0.72)");
        grad.addColorStop(1, "rgba(0,0,0,0.92)");
    } else {
        grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(0.3, "rgba(0,0,0,0.08)");
        grad.addColorStop(0.42, "rgba(0,0,0,0.82)");
        grad.addColorStop(0.72, "rgba(0,0,0,0.82)");
        grad.addColorStop(0.85, "rgba(0,0,0,0.08)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
}

function _drawSlideText(ctx, slide, layout) {
    // Pill label
    _drawPill(ctx, slide.label, W / 2, layout.pillY);

    // Headline
    const headLineCount = _drawWrappedText(ctx, {
        text: slide.headline,
        x: W / 2,
        y: layout.headY,
        maxWidth: 900,
        fontSize: layout.fontSize,
        fontWeight: 800,
        color: "#000000",
        bgColor: "#ffffff",
        shadow: false,
        lineHeight: layout.lh
    });

    // Sub — shift down by extra lines
    const subY = layout.subY + Math.max(0, headLineCount - 1) * layout.lh;
    _drawWrappedText(ctx, {
        text: slide.sub,
        x: W / 2,
        y: subY,
        maxWidth: 860,
        fontSize: layout.subSize,
        fontWeight: 400,
        color: "rgba(255,255,255,0.82)",
        shadow: true,
        lineHeight: layout.subLh
    });
}

function _drawPill(ctx, text, cx, cy) {
    ctx.font = `700 32px ${FONT_FAMILY}`;
    const tw = ctx.measureText(text).width;
    const pw = tw + 60;
    const ph = 32 + 24;
    const px = cx - pw / 2;
    const py = cy - ph / 2;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    _rrPath(ctx, px, py, pw, ph, 40);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
}

function _drawWrappedText(ctx, opts) {
    const { text, x, y, maxWidth, fontSize, fontWeight, color, bgColor, shadow, lineHeight } = opts;
    ctx.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    if (shadow && !bgColor) {
        ctx.shadowColor = "rgba(0,0,0,0.85)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 3;
    }

    const paras = text.split("\n");
    const allLines = [];
    paras.forEach(para => {
        _wordWrap(ctx, para.trim(), maxWidth).forEach(line => {
            allLines.push(line);
        });
    });

    let maxLineWidth = 0;
    allLines.forEach(line => {
        const tw = ctx.measureText(line).width;
        if (tw > maxLineWidth) maxLineWidth = tw;
    });

    if (bgColor && allLines.length > 0) {
        const padX = 40;
        const padY = 24;
        const totalHeight = allLines.length * lineHeight;

        ctx.fillStyle = bgColor;
        ctx.shadowColor = "transparent";
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x - (maxLineWidth / 2) - padX / 2, y - padY / 2 + 6, maxLineWidth + padX, totalHeight - lineHeight + fontSize + padY, 16);
        } else {
            ctx.fillRect(x - (maxLineWidth / 2) - padX / 2, y - padY / 2 + 6, maxLineWidth + padX, totalHeight - lineHeight + fontSize + padY);
        }
        ctx.fill();

        if (shadow) {
            ctx.shadowColor = "rgba(0,0,0,0.85)";
            ctx.shadowBlur = 28;
            ctx.shadowOffsetY = 3;
        }
    }

    ctx.fillStyle = color;
    allLines.forEach((line, i) => {
        ctx.fillText(line, x, y + i * lineHeight);
    });

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    return allLines.length;
}

function _wordWrap(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current); current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
}

function _rrPath(ctx, x, y, w, h, r) {
    const rx = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + w - rx, y);
    ctx.arcTo(x + w, y, x + w, y + rx, rx);
    ctx.lineTo(x + w, y + h - rx);
    ctx.arcTo(x + w, y + h, x + w - rx, y + h, rx);
    ctx.lineTo(x + rx, y + h);
    ctx.arcTo(x, y + h, x, y + h - rx, rx);
    ctx.lineTo(x, y + rx);
    ctx.arcTo(x, y, x + rx, y, rx);
    ctx.closePath();
}

function _exportCanvas(canvas, index) {
    canvas.toBlob(blob => {
        if (!blob) { alert("Export failed — canvas could not be saved as PNG."); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `maxify-slide-${index + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, "image/png");
}

/* ─── FONT + DOM HELPERS ──────────────────────────────────── */

async function _ensureFonts() {
    try {
        await document.fonts.ready;
        const probe = document.createElement("canvas").getContext("2d");
        probe.font = `800 40px ${FONT_FAMILY}`;
        probe.measureText("M");
    } catch { /* non-fatal */ }
}

function _showEmpty() {
    const el = document.getElementById("empty-state");
    if (el) el.style.display = "";
}
function _hideEmpty() {
    const el = document.getElementById("empty-state");
    if (el) el.style.display = "none";
}

/* ─── GLOBAL EXPORT FUNCTIONS ─────────────────────────────── */

export async function downloadAllAsZip(slidesData, imageResults) {
    if (!window.JSZip) {
        alert("JSZip library not loaded. Check internet connection.");
        return;
    }
    const zip = new JSZip();

    for (let i = 0; i < 5; i++) {
        const bgSource = await _getBgSource(imageResults[i]);
        const canvas = _renderFullCanvas(slidesData[i], i, bgSource);
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
        zip.file(`maxify-slide-${i + 1}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "maxify-carousel.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadAllAsVideo(slidesData, imageResults) {
    // 1. Render all 5 canvases into memory
    const canvases = [];
    for (let i = 0; i < 5; i++) {
        const bgSource = await _getBgSource(imageResults[i]);
        canvases.push(_renderFullCanvas(slidesData[i], i, bgSource));
    }

    // 2. Setup recorder canvas
    const recCanvas = document.createElement("canvas");
    recCanvas.width = W;
    recCanvas.height = H;
    const ctx = recCanvas.getContext("2d");

    // TikTok psychological pacing (ms)
    // Hook (fast), Context (read time), Surprise (punchy), Escalation (hype), Payoff (linger)
    const timings = [2000, 2500, 1500, 2000, 3000];

    // Capture 30fps stream
    const stream = recCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };

    return new Promise((resolve) => {
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "maxify-reel.webm";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            resolve();
        };

        recorder.start();

        let startTime = null;
        function drawFrame(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;

            let cumulative = 0;
            let slideIndex = 4;
            let totalDuration = 0;
            timings.forEach(t => totalDuration += t);

            for (let i = 0; i < 5; i++) {
                cumulative += timings[i];
                if (elapsed <= cumulative) {
                    slideIndex = i;
                    break;
                }
            }

            ctx.drawImage(canvases[slideIndex], 0, 0);

            if (elapsed < totalDuration) {
                requestAnimationFrame(drawFrame);
            } else {
                recorder.stop();
            }
        }
        requestAnimationFrame(drawFrame);
    });
}

async function _getBgSource(imgResult) {
    const hasUrl = (imgResult?.type === "local" || imgResult?.type === "remote") && imgResult.url;
    if (hasUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = imgResult.url;
        });
    }
    return imgResult?.canvas || null;
}
