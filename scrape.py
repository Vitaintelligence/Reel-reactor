#!/usr/bin/env python3
"""
Maxify Reel Farm — Pinterest Image Scraper
==========================================
Scrapes Pinterest images into a structured SLIDESHOW_ASSETS bank
using pinscrape (pip install pinscrape).

Usage:
    python scrape.py                    # scrape everything
    python scrape.py --category hook    # scrape one category only
    python scrape.py --dry-run          # print plan without downloading

Output:
    public/SLIDESHOW_ASSETS/           <- all images, renamed
    image_library.json                 <- manifest for images.js
"""

import os
import sys
import json
import shutil
import argparse

# ─── PATHS ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(SCRIPT_DIR, "public", "SLIDESHOW_ASSETS")
LIBRARY_OUT = os.path.join(SCRIPT_DIR, "image_library.json")

# ─── IMAGE BANK ───────────────────────────────────────────────────────────────
# (folder_path, file_prefix, keywords_2_words_max, target_count)
# Keywords intentionally short (2 words) for better Pinterest results.
#
# Slides map:
#   HOOK (slide 1)       → 01_HOOK_IMAGES + 10_mirror_selfies + 10_mysterious
#   CONTEXT (slide 2)    → 03_LIFESTYLE + 11_luxury_male
#   SURPRISE (slide 3)   → 07_PHONE + 08_LONELY
#   ESCALATION (slide 4) → 05_POWER + 11_sigma_portraits
#   PAYOFF (slide 5)     → 09_BACKGROUND + 06_DARK
# ─────────────────────────────────────────────────────────────────────────────
IMAGE_BANK = [
    # ── SLIDESHOW_ASSETS root categories ────────────────────────────────────
    (
        "01_HOOK_IMAGES", "hook",
        ["girl crying"],
        40
    ),
    (
        "02_REACTION_IMAGES", "reaction",
        ["shocked face", "surprised girl", "reaction selfie"],
        15
    ),
    (
        "03_LIFESTYLE_IMAGES", "lifestyle",
        ["luxury lifestyle", "minimal lifestyle"],
        15
    ),
    (
        "04_RELATIONSHIP_IMAGES", "couple",
        ["couple portrait", "couple goals"],
        15
    ),
    (
        "05_POWER_STATUS_IMAGES", "status",
        ["luxury watch", "luxury car"],
        10
    ),
    (
        "06_DARK_AESTHETIC", "dark",
        ["dark portrait", "moody portrait"],
        10
    ),
    (
        "07_PHONE_SOCIAL_MEDIA", "phone",
        ["phone screen", "girl texting"],
        10
    ),
    (
        "08_LONELY_EMOTIONAL", "lonely",
        ["lonely girl", "sad portrait"],
        10
    ),
    (
        "09_BACKGROUND_TEXTURES", "bg",
        ["dark texture", "dark background"],
        5
    ),

    # ── 10_ATTRACTIVE_MODELS ─────────────────────────────────────────────────
    (
        "10_ATTRACTIVE_MODELS/mirror_selfies", "mirror",
        ["mirror selfie", "girl selfie"],
        5
    ),
    (
        "10_ATTRACTIVE_MODELS/soft_girl", "soft_girl",
        ["soft girl", "natural portrait"],
        5
    ),
    (
        "10_ATTRACTIVE_MODELS/luxury_model", "luxury_f",
        ["luxury model", "fashion model"],
        5
    ),
    (
        "10_ATTRACTIVE_MODELS/gym_model", "gym_girl",
        ["gym girl", "fitness girl"],
        5
    ),
    (
        "10_ATTRACTIVE_MODELS/mysterious_model", "mysterious",
        ["dark female", "shadow girl"],
        5
    ),

    # ── 11_MALE_SIGMA_MODELS ─────────────────────────────────────────────────
    (
        "11_MALE_SIGMA_MODELS/sigma_portraits", "sigma",
        ["sigma male", "cold portrait"],
        5
    ),
    (
        "11_MALE_SIGMA_MODELS/luxury_male", "luxury_m",
        ["man luxury", "suit portrait"],
        5
    ),
    (
        "11_MALE_SIGMA_MODELS/gym_sigma", "gym_male",
        ["gym male", "fitness male"],
        5
    ),
    (
        "11_MALE_SIGMA_MODELS/dark_sigma", "dark_sigma",
        ["dark male", "shadow male"],
        5
    ),
]

# ─── TARGET SUMMARY ───────────────────────────────────────────────────────────
# hook: 40 | reaction: 15 | lifestyle: 15 | couple: 15 | status: 10
# dark: 10  | phone: 10   | lonely: 10    | bg: 5
# models_f: 25 (5×5) | sigma_m: 20 (4×5)
# TOTAL: ~180 images → covers 1500+ unique slideshow combinations


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def print_plan():
    total = sum(row[3] for row in IMAGE_BANK)
    print("\n╔══════════════════════════════════════════════╗")
    print("║   Maxify Reel Farm — Scrape Plan             ║")
    print("╠══════════════════════════════════════════════╣")
    for folder, prefix, keywords, count in IMAGE_BANK:
        kw_str = " | ".join(f'"{k}"' for k in keywords)
        print(f"  {folder:<45} {count:>3} imgs   {kw_str}")
    print(f"\n  TOTAL: {total} images")
    print("╚══════════════════════════════════════════════╝\n")


def scrape_category(pinterest, folder_rel, prefix, keywords, count, dry_run=False):
    folder_abs = os.path.join(ASSETS_DIR, folder_rel)
    os.makedirs(folder_abs, exist_ok=True)

    if dry_run:
        print(f"  [DRY RUN] Would scrape {count} images into {folder_rel}/")
        return []

    per_kw   = max(2, (count // len(keywords)) + 3)   # +3 for buffer/dupes
    temp_dir = os.path.join(folder_abs, "_temp_download")
    os.makedirs(temp_dir, exist_ok=True)

    all_urls = []
    for kw in keywords:
        print(f"    Pinterest search: '{kw}' ({per_kw} targets)…")
        try:
            urls = pinterest.search(kw, per_kw)
            all_urls.extend(urls or [])
        except Exception as e:
            print(f"    ⚠ skipped '{kw}': {e}")

    # Deduplicate, cap at count + buffer
    unique_urls = list(dict.fromkeys(all_urls))[:count + 10]

    if not unique_urls:
        print(f"    ✗ No URLs found for {folder_rel}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return []

    print(f"    Downloading {len(unique_urls)} URLs…")
    try:
        pinterest.download(
            url_list=unique_urls,
            number_of_workers=5,
            output_folder=temp_dir
        )
    except Exception as e:
        print(f"    ⚠ Download error: {e}")

    # Collect downloaded images
    downloaded = sorted([
        f for f in os.listdir(temp_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    ])

    # Rename and move to final folder
    web_paths = []
    for i, fname in enumerate(downloaded[:count], start=1):
        ext = os.path.splitext(fname)[1].lower() or ".jpg"
        new_name = f"{prefix}_{i:02d}{ext}"
        src = os.path.join(temp_dir, fname)
        dst = os.path.join(folder_abs, new_name)

        # Skip if already exists
        if os.path.exists(dst):
            os.remove(src)
        else:
            shutil.move(src, dst)

        web_paths.append(f"/public/SLIDESHOW_ASSETS/{folder_rel}/{new_name}")

    # Remove temp dir
    shutil.rmtree(temp_dir, ignore_errors=True)
    print(f"    ✓ {len(web_paths)} images → {folder_rel}/")
    return web_paths


def build_library(all_paths: dict):
    """Write image_library.json for images.js to consume."""
    with open(LIBRARY_OUT, "w", encoding="utf-8") as f:
        json.dump(all_paths, f, indent=2)
    total = sum(len(v) for v in all_paths.values())
    print(f"\n✓ image_library.json written — {total} images indexed")


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Maxify Reel Farm Image Scraper")
    parser.add_argument("--category", help="Scrape one category only (partial folder name match)")
    parser.add_argument("--dry-run",  action="store_true", help="Show plan without downloading")
    args = parser.parse_args()

    print_plan()

    if args.dry_run:
        print("DRY RUN — no images will be downloaded.")
        for folder, prefix, keywords, count in IMAGE_BANK:
            scrape_category(None, folder, prefix, keywords, count, dry_run=True)
        return

    # Import pinscrape (only when actually running)
    try:
        from pinscrape import Pinterest
    except ImportError:
        print("✗ pinscrape not installed. Run: pip install pinscrape")
        sys.exit(1)

    pinterest = Pinterest()
    library   = {}

    for folder, prefix, keywords, count in IMAGE_BANK:
        cat_key = folder.split("/")[-1]

        # Filter to single category if requested
        if args.category and args.category.lower() not in folder.lower():
            continue

        print(f"\n▶ [{cat_key}] — targeting {count} images")
        paths = scrape_category(pinterest, folder, prefix, keywords, count)
        library[cat_key] = paths

    build_library(library)

    total = sum(len(v) for v in library.values())
    print(f"\n{'═'*50}")
    print(f"  Done! {total} images scraped and indexed.")
    print(f"  Run: vercel dev — then generate your reels.")
    print(f"{'═'*50}")


if __name__ == "__main__":
    main()
