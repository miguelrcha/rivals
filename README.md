# rivals — 8-bit landing page

A pixel/8-bit styled landing page built with Next.js (App Router) + TypeScript.
All icons (brackets, rocket, bulb, static clusters) are hand-authored pixel
bitmaps rendered through a small `PixelArt` component — no image assets.

## Stack
- Next.js 16 (App Router), TypeScript
- Plain CSS (no framework) — see `src/app/site.css`
- Fonts: **Silkscreen** (pixel display) + **Space Mono** (body), loaded from Google Fonts

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
npm start
```

## Structure

```
src/
  app/
    layout.tsx      root layout, fonts + metadata
    page.tsx         assembles the sections
    globals.css      resets, color tokens, fonts
    site.css         navbar/hero/buttons/sections styling
  components/
    PixelArt.tsx        ASCII-bitmap -> CSS grid renderer
    pixel-patterns.ts   bitmap data for every icon
    PixelRocket.tsx      composite rocket (body + fins + flame)
    PixelButton.tsx      retro drop-shadow button
    Navbar.tsx, Hero.tsx, Features.tsx, Stats.tsx, CtaBand.tsx, Footer.tsx
```
