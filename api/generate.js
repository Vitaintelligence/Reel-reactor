module.exports = async function handler(req, res) {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { niche, style } = req.body || {};
    if (!niche) {
        return res.status(400).json({ error: "Niche is required" });
    }

    const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
    if (!OPENROUTER_KEY) {
        return res.status(500).json({ error: "OPENROUTER_KEY is not configured in Vercel Environment Variables" });
    }

    const isAskOut = niche === "AskOut";
    const isCrafty = style === "crafty";

    // Aesthetic instruction block to be appended to any prompt
    const aestheticInstructions = isCrafty
        ? "AESTHETIC: 'Crafty' editorial magazine style. Voice must be slightly poetic, highly aesthetically pleasing but blunt. For image_query ALWAYS use queries like 'white magazine cutout', 'editorial aesthetic', 'paper texture collage'."
        : "AESTHETIC: Standard dark bold. Voice: first person, raw, authentic. For image_query use 3-word pollinations search matching the emotional role of each slide (e.g. 'dark moody aesthetic').";

    const prompt = isAskOut
        ? `You are writing copy for a highly viral TikTok/Instagram anonymous question loop for Maxify's "AskOut" feature.

AskOut is an anonymous curiosity engine and flirting game (NGL x TikTok). Users post prompts like "Rate me honestly" or "Would you date me?" and receive anonymous replies.

Write EXACTLY 5 slides. Voice: Gen-Z, authentic, dark aesthetic, curiosity-inducing.

PSYCHOLOGICAL STRUCTURE:
Slide 1 — HOOK (Brutal curiosity trigger to stop the scroll)
  Example: "girls, be brutally honest" or "someone said i'm unattractive"

Slide 2 — CONTEXT (Emotional framing)
  Example: "my friends say i look intimidating" or "is this a red flag?"

Slide 3 — REVEAL (Drop a controversial or specific personal statement)
  Example: "i've never asked a girl out before. comment your first impression."

Slide 4 — INTERACTION (The actual AskOut question)
  Example: "would you go on a date with me?" or "rate me honestly (1-10)"

Slide 5 — CTA (The Viral Loop)
  Must end with: "answer anonymously on maxify — glowrizz.club"

For each slide return:
- label: tiny pill text context (e.g. "1. the hook")
- headline: main text, lowercase, max 10 words, bold
- sub: explanation text, lowercase, max 18 words
- image_query: 3-word pollinations search (For AskOut ALWAYS use queries like "dark neon aesthetic", "mysterious silhouette", "phone screen glow")

Return ONLY valid JSON array:
[
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
   ...
]`
        : `You are writing copy for a viral TikTok/Instagram slideshow for Maxify —
an AI looksmaxxing and rizz app. Niche: ${niche}.

Maxify features: AI facial scan, canthal tilt analysis, hunter eyes score,
jawline rating, face morphing, mog battles (vs friends + celebrities),
rizz engine (screenshot your chat → AI tells you what to say),
opener generator, The Dojo (looksmaxx theory, mewing, attraction science),
weekly tracking.

Write EXACTLY 5 slides. NOT corporate. NOT salesy.
${aestheticInstructions}

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
- image_query: 3-word pollinations search (match the emotional role of each slide)

Return ONLY valid JSON array, no markdown, no extra text:
[
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."},
  {"label":"...","headline":"...","sub":"...","image_query":"..."}
]`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "HTTP-Referer": "https://clippers.glowrizz.club",
                "X-Title": "Maxify Reel Farm"
            },
            body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            return res.status(response.status).json({
                error: errBody?.error?.message || `OpenRouter API error ${response.status}`
            });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: `Network error: ${err.message}` });
    }
}
