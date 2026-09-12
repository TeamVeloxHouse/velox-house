# Impara! — Learn Italian 🇮🇹

A free, offline, gamified Italian learning app in the style of Duolingo — built
as a self-contained Progressive Web App (no build step, no server, no tracking).
All progress is stored privately on your device.

## Run it / put it on your phone

**Easiest (no hosting):**
1. Open `index.html` in any browser.

**On your phone (installable, works offline):**
The app needs to be served over `http(s)` for the service worker + "Add to Home
Screen" to work. Two simple options:

- **Local test:** from this folder run `python3 -m http.server 8080`, then open
  `http://<your-computer-ip>:8080/` on your phone (same Wi-Fi).
- **Free hosting:** drag the `italian-app` folder onto [Netlify Drop](https://app.netlify.com/drop)
  or push to GitHub Pages. Then on your phone open the URL →
  **Share → Add to Home Screen** (iOS) or **⋮ → Install app** (Android).

Once installed it launches full-screen like a native app and works with no
internet connection.

## Features
- Skill-tree **lesson path** across CEFR levels **A1 → C1** (beginner to advanced)
- Exercise types: multiple choice, word-bank translation, type-in, **listening**
  (text-to-speech), and **match pairs**
- **XP, daily goal ring, streaks, hearts, and crown levels** (up to 5 per lesson)
- **Spaced repetition** (SM-2) — a "Practice weak words" mode reviews what you're
  forgetting, drawn from everything you've seen
- Italian **audio** via the device's speech synthesis (normal + slow)
- Dark mode, offline caching, fully private (localStorage only)

## Adding more content
Everything is data-driven. To add lessons, just edit `js/course.js` — add items
(`{it, en}`) or full `sentences` (`{it, en}`) to a lesson, or add new units /
sections. Exercises are generated automatically; no other file needs changing.

### File map
- `js/course.js` — all curriculum content
- `js/engine.js` — progress/state, spaced repetition, exercise generation, audio
- `js/app.js` — UI, lesson player, navigation
- `css/styles.css` — styling (original design)
- `sw.js` / `manifest.webmanifest` — offline + installability
