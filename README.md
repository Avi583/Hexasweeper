# 🐝 Hexasweeper

A honeycomb twist on classic Minesweeper — hexagonal cells, a true beehive grid, and numbers from **0–6** (a hex cell has at most 6 neighbors).

Built with plain HTML, CSS, and JavaScript. No build step, no dependencies — just open it in a browser.

## Play

Click Link Here to Play on Web: https://avi583.github.io/Hexasweeper/

## Install as an app

Hexasweeper is a installable Progressive Web App (PWA) — it works fully offline once installed and launches like a native app, no browser chrome.

**Desktop (Chrome / Edge):**
1. Visit https://avi583.github.io/Hexasweeper/
2. Click the install icon in the address bar (or the three‑dot menu → *Cast, save, and share* → *Install page as app*).
3. Confirm — Hexasweeper is added to your Start Menu / Applications folder and opens in its own window from then on.

**Android (Chrome):**
1. Visit the site.
2. Tap the three‑dot menu → *Add to Home screen* → *Install*.

**iOS (Safari):**
1. Visit the site.
2. Tap the Share icon → *Add to Home Screen*.

Once installed, the app is cached by a service worker, so it continues to work without an internet connection.

> **Updating an install:** if you've installed an older version of the app and it shows a 404 or stale content after an update, uninstall it (`chrome://apps` → right‑click → *Remove*), open the site fresh in a browser tab, unregister the old service worker and clear site data (DevTools → *Application* → *Service Workers* / *Storage*), then reinstall.

## How to play

- **Left click** a hex to reveal it.
- **Right click** to flag/unflag a suspected mine.
- **Double‑click** a revealed number to "chord" — auto‑reveal its unflagged neighbors, if you've flagged exactly as many neighbors as the number shows.
- A revealed cell shows a number **0–6**: how many of its (up to six) neighboring hexes contain mines. Blank cells (0) auto‑flood‑reveal their neighbors.
- Clear every non‑mine cell to win. Hit a mine and the hive goes boom.
- The very first click is always safe — mines are placed after your first click, avoiding that cell and its immediate neighbors.

## Difficulty

| Preset | Grid | Mines |
|---|---|---|
| Beginner | 9 × 9 | 10 |
| Intermediate | 13 × 11 | 25 |
| Expert | 17 × 15 | 55 |
| Custom | your choice (4–30 per axis) | your choice |

## How the hex grid works

Hexasweeper uses **pointy-top hexagons** laid out in an **"odd-r" offset grid** (odd rows shifted half a hex to the right) — the classic honeycomb look, rendered as an SVG so every cell is a crisp, precisely-tiled hexagon.

Neighbor lookups (used for both mine counting and flood-fill reveal) convert each cell's offset coordinates to **axial coordinates**, apply the 6 fixed axial neighbor directions, then convert back. This avoids the usual bug-prone parity look-up tables for offset grids and guarantees every cell correctly reports up to 6 neighbors.

## Project structure

```
hexasweeper/
├── index.html          # markup & game shell
├── style.css           # honeycomb visual theme
├── script.js           # grid math, mine logic, rendering, game state
├── site.webmanifest    # PWA metadata & icon references
├── sw.js                # service worker — caches the app shell for offline play
├── LICENSE
├── README.md
└── Images/
    ├── favicon.ico
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png
    ├── android-chrome-192x192.png
    └── android-chrome-512x512.png
```

## License

GPL-3.0 — see LICENSE https://www.gnu.org/licenses/gpl-3.0.html for the full text.
