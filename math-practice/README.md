# Math Adventure 🧮🚀

A colorful, **installable** arithmetic practice game for children aged
**6–9**. Written in **pure TypeScript**, works **fully offline** as a PWA, and
is **responsive** for phone and iPad (portrait & landscape).

![ages](https://img.shields.io/badge/ages-6--9-ff6bcb) ![pwa](https://img.shields.io/badge/PWA-offline-2ecc71) ![typescript](https://img.shields.io/badge/TypeScript-strict-4d9dff)

<p align="center"><img src="icons/icon-192.png" width="120" alt="Math Adventure icon"></p>

## How to play

- An equation appears at the top (it starts simple, like `3 + 4`).
- Tap the big **numpad** to enter the answer, then **✓** (or press `Enter`).
- **Wrong?** The mascot gives a gentle shake — try again, no penalty.
- **Right?** Confetti bursts 🎉, you earn a ⭐, and **the answer flies up to
  become the first number of the next problem.** So `3 + 4 = 7` is followed by
  `7 − 2 = …`, chaining forever. Answers never go above the max.

## Settings ⚙️

| Setting | Default | Notes |
| --- | --- | --- |
| **How high do we go?** | `20` | Slider 5–100. No answer ever exceeds this. |
| **Which math?** | ➕ ➖ | Toggle Plus, Minus, Times, Divide — pick one or more. |

Settings persist between visits (browser `localStorage`).

## Run it

Service workers (offline mode) need a real origin — `http://localhost` counts,
`file://` does not. A zero-dependency static server is included:

```bash
npm run build     # compile TypeScript → app.js + sw.js
npm run serve     # serve at http://localhost:8080
# or both at once:
npm start
```

Then open **http://localhost:8080**. To test offline: load it once, then turn
off the network (or use DevTools → Network → Offline) and reload — it still
runs. On a phone/iPad you can **Add to Home Screen** to install it.

> Opening `index.html` directly via `file://` still works as a plain game; only
> the offline/installable PWA features need the server.

## Progressive Web App

- **`manifest.webmanifest`** — name, colors, icons, `standalone` display.
- **`sw.ts` → `sw.js`** — a service worker that precaches the whole app shell
  (HTML, CSS, JS, manifest, icons) and serves it cache-first. The app has **no
  external dependencies**, so once cached it needs no network at all.
- Icons: a custom **SVG** (`icons/icon.svg`) plus rasterized PNGs for iOS /
  Android home screens, including a maskable 512×512.

## Responsive design

- **Phone portrait** — single column: equation up top, numpad along the bottom.
- **iPad / tablets** (`min-width: 700px`) — larger type, roomier buttons.
- **Landscape** (short viewports) — equation and numpad sit **side by side** so
  nothing is cut off.
- Honors `prefers-reduced-motion`, notch-safe via `viewport-fit=cover` +
  `env(safe-area-inset-*)`.

## Pure TypeScript

All logic is TypeScript compiled with `strict` mode (no bundler, no runtime
deps):

- `app.ts` → `app.js` — game logic (DOM lib). `tsconfig.json`
- `sw.ts` → `sw.js` — service worker (WebWorker lib). `tsconfig.sw.json`

The compiled `app.js` / `sw.js` are committed so the app runs as-is when
served; run `npm run build` after editing any `.ts`.

## Guaranteed-valid maths

The generator only ever produces problems whose answer is a **whole number in
`[0, max]`**:

- **Plus:** `a + b ≤ max`
- **Minus:** `a − b ≥ 0` (never negative)
- **Times:** `a × b ≤ max` (with `a, b ≥ 2`)
- **Divide:** only when `b` divides `a` evenly → a whole answer

Because each answer chains into the next problem, the generator picks a valid
move for the current number; if a number has no valid move (e.g. stuck at the
max with only Plus enabled), it restarts the chain from a fresh small number.

## Project layout

```
math-practice/
├── index.html              # markup + PWA <head>
├── styles.css              # kid-friendly styling, animations, responsive rules
├── app.ts  → app.js        # game logic (compiled)
├── sw.ts   → sw.js         # service worker (compiled)
├── manifest.webmanifest    # PWA manifest
├── icons/                  # icon.svg + generated PNGs
├── scripts/
│   ├── serve.cjs           # tiny static server for local testing
│   └── build-icons.cjs     # re-rasterize the SVG icon → PNGs
├── tsconfig.json           # app compile config
├── tsconfig.sw.json        # service-worker compile config
└── package.json
```
