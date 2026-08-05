# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, offline-first PWA that simulates and calculates Split Range Valve behavior
(control-valve mode where one controller signal drives two or three valves in
opposing/sequential/mixed patterns — an industrial process-control concept). Thai-language UI.

No build step, no npm, no bundler — plain HTML/CSS/JS served as-is (or via GitHub Pages).

## Running locally

The service worker requires HTTP(S) (won't register under `file://`, though the app
still works without it). Serve the directory with any static server, e.g.:

    python3 -m http.server 8000

No lint, no test suite, no package.json exist in this repo — there is nothing to `npm install`/`npm run`.

## Architecture

- `index.html` — single page, all UI markup (appbar, mode selector, SVG chart, valve
  rows, MV input dock, bottom nav, two bottom-sheet overlays for the reverse-calculator
  and help). Loads `css/fonts.css`, `css/style.css`, and `js/app.js` (defer) — no other
  scripts, no CDNs, no external libraries (no Tailwind/Chart.js/Firebase/framework of any kind).
- `js/app.js` — single flat script (not modularized), organized by comment-delimited
  sections in this order: state → core math → input helpers → simulator render → SVG
  chart renderer → MV input event wiring → mode selection → theme → bottom
  sheets/nav → reverse calculator → service-worker registration → init.
  - `forward(type, mv)` and `reverse(type, valve, desiredOpening)` are the domain core:
    given a mode type and MV (0-100), compute each valve's % open, and the inverse.
    All three split-range modes (M-type/opposing, N-type/sequential, M+N/mixed) live here.
  - The line chart is hand-rolled inline SVG (`drawChart()`), not a charting library.
  - Only persisted state is the theme choice (`localStorage['srv-theme']`). No backend,
    no IndexedDB, no auth — this app does not follow the multi-module
    IndexedDB/Firestore architecture used in some of the author's other projects.
- `css/style.css` — theme system via CSS custom properties, switched by
  `:root[data-theme="light|dark"]` (toggled on `<html>` by JS, persisted to localStorage).
- `sw.js` — cache-first service worker. `CACHE = 'srv-v1'` lists every asset explicitly.
  **Bump the `CACHE` version string whenever any cached asset changes** — otherwise
  users with the PWA already installed will keep serving stale files indefinitely
  (the activate handler only evicts caches whose name no longer matches `CACHE`).
- `mockup/ui-mockup-v1.html` — an older static design mockup, not wired to `js/app.js`;
  reference only, not the live app.
- `brand-kit.html` (untracked, not part of this app) — a separate personal
  badge/attribution-snippet generator ("SOICODER — Brand Kit") the author drops into
  various projects. Unrelated to the valve simulator; don't touch or reference it
  unless specifically asked to.

## Deployment

GitHub Pages, manual setup (Settings → Pages → Deploy from branch → `main` / root).
No CI/CD, no build artifacts — Pages serves the repo files directly.
