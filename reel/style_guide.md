# Reel style guide — "Manga page come alive" (from DESIGN.md)

## Palette (90% of every frame = core five)
| Token | Hex | Reel use |
|---|---|---|
| ink | #0B0B0F | void, borders (8–12 px at 1080 w), text on light |
| paper | #F4EFE6 | panels, text on dark |
| volt | #FFE14D (hype #FFE600) | door light, price pills, accent highlighter |
| lav | #C9B8FF | product stage |
| door | #6D3BFF | door frame, fest scene |
Support: pink #FFB8DE · hype red #FF2D3D (max one per shot — the "ドン!" burst) · tones #1A1A20 #2B2B33 #6E6E78 #B9B5AC.
Arc accents (A/B): JJK #4B2BFF/#A78BFF · AoT #A39780/#C8102E · Demon Slayer #FF6A13/#12A5A0 · One Piece #1C6FE0/#F2C230 · Naruto #FF7A00/#1B2A4A · Beyond Anime #FFB8DE/#F4EFE6.
No gradients: shading = halftone/screentone dots; depth = hard offset shadows (12px 12px 0 ink), never blur/glow.

## Type
- Display: **Anton** caps, line-height 0.86, tracking −0.01em — headlines 150–260 px.
- SFX: **Bangers** (Latin) / **Dela Gothic One** (ドン ゴゴゴ バン) — skewX(−8°), ink stroke + hard offset.
- JP subtitles: **Noto Sans JP 900**.
- Labels/prices: **JetBrains Mono 700**, uppercase, tracked +0.14em.
- Body: DM Sans 500/700 (sparingly).
Accent word = volt highlighter block behind the word, rotated −2°.

## Motion personality
Punchy manga timing: anticipation → hard impact → hold.
Closed-form springs (x(t)=1−e^(−ζωt)(cos ω_d t + ζω/ω_d sin ω_d t)):
- snappy (stickers, pills): ω 22, ζ 0.45 (overshoot)
- cards/panels: ω 14, ζ 0.62
- big type: ω 11, ζ 1 (critically damped, no overshoot)
Impact frame: scale 1.08→1 + 2-frame shake + speed-line burst. Wipes: power3.inOut 0.25–0.4 s. Exits: expo.in.
Beat grid 120 BPM (0.5 s): every major change lands on a beat.

## Materials
Screentone dots, radial speed lines (seeded), ink splats (assets/textures), paper panels with ink borders, ticker bands at ±3°.
