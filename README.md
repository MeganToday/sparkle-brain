# Adele's Sparkle Brain — CCAT 7 / CogAT practice

Static site (no build step): `index.html`, `styles.css`, `app.js`, question banks in `data/`, images in `img/`.

## Deploy to GitHub Pages
1. Create a new repo on GitHub and upload everything in this folder (except `.claude/`).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. After a minute the site is at `https://<your-username>.github.io/<repo-name>/`. Text that link to the iPad.
4. On the iPad: open in Safari → Share → **Add to Home Screen** for a full-screen app icon.

Secret code: `0406` (set in `app.js`, `SECRET_CODE`). This is a kid-proof gate, not real security —
the image files are still reachable by anyone who knows their exact URLs. `robots.txt` and `noindex`
meta tags ask search engines not to list the site.

## Settings (top of `app.js`)
- `QUESTIONS_PER_ROUND` — 10
- `WRONG_LOCK_MS` — minimum wait after a wrong answer (also waits for the hint to finish being read)
- `NEXT_DELAY_MS` — wait after a right answer before the next question

## Adding a question type
Add a `data/<type-id>.js` file that registers `window.QUESTION_BANKS['<type-id>']` (same shape as
`figure-classification.js`), include it in `index.html`, and the matching home tile turns on automatically.
