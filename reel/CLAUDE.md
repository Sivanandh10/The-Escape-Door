# Motion Studio Rules
(Playbook Part 11, p.108 — binding for everything in reel/**)

## Rendering
Every animation must be deterministic. Use window.seek(t).
The entire visual state must be calculated from time.
Do not use: setTimeout · CSS transitions · state-dependent animation ·
Math.random · uncontrolled requestAnimationFrame during rendering.
Use seeded randomness when randomness is required (mulberry32 in index.html).

## Visual style
Avoid generic AI motion graphics. Do not use: centered text over gradients ·
excessive glow · random particle effects · unnecessary borders ·
corner labels · everything fading in.
Use: strong typography · deliberate composition · smooth camera movement ·
spring-based animation · clear visual hierarchy.
Something visually meaningful should happen every 2-4 seconds.
Brand: take palette, fonts and easing from the website's DESIGN.md (see style_guide.md).
Manga panel borders are deliberate composition here (the brand's language), not decoration.

## Export
Render with Playwright + Chromium. H.264 · yuv420p · CRF 16.
`node reel/render.mjs` → reel/frames/*.png → reel/out/escape-door-reel-9x16.mp4
(+ procedural SFX from reel/sfx.mjs muxed in as AAC).

## Quality control (before final render)
1 contact sheet · 2 inspect frames · 3 phone readability · 4 animation
quality · 5 composition · 6 pacing · 7 sound sync.
Identify the 3 biggest problems. Fix them. Repeat until quality is high.
Log every loop in review_log.md (scores for the 10 categories).

## Project rules
- 9:16 safe area: important text inside x 60–960, y 250–1570 (IG/Reels UI overlays).
- Original art only: brand SVGs + product mockups from public/ (copied into assets/). No franchise logos/characters; collection names as text only.
- Facts only from src/lib/data (prices, bundles, fests). No invented claims.
- Fonts are local (assets/fonts, OFL) — rerun `node reel/scripts/fetch-fonts.mjs` after adding new Japanese characters.
