# Adele's Sparkle Brain — CogAT Form 7, Level 7 (1st grade) practice

Static site (no build step): `index.html`, `styles.css`, `app.js`, all questions in `data/questions.js`, images in `img/q/`.

Content (447 questions):
- `data/questions.js` — TestingMom CogAT Form 7/8 1st grade Complete Practice Test 1 (136 + 13 worked examples), images in `img/q/`.
- `data/questions-2.js` — TestingMom CogAT workbook + Practice Question Set (298, incl. 29 Odd One Out), images in `img/q2/`.
  Choices there carry explicit tap boxes (`left/right/top/bottom`) and a bubble size `r`.
Home: the Big 3 (Picture Analogies, Number Analogies, Figure Matrices), the other 7 sections (incl. Odd One Out), then Big 3 Mix and Everything Mix.

## Deploy to GitHub Pages
1. Create a new repo on GitHub and upload everything in this folder (except `.claude/`).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. After a minute the site is at `https://<your-username>.github.io/<repo-name>/`. Text that link to the iPad.
4. On the iPad: open in Safari → Share → **Add to Home Screen** for a full-screen app icon.

Secret code: `0406` (set in `app.js`, `SECRET_CODE`). This is a kid-proof gate, not real security —
the image files are still reachable by anyone who knows their exact URLs. `robots.txt` and `noindex`
meta tags ask search engines not to list the site.

## Settings (top of `app.js`)
- `SECTION_ROUND` — 10 questions per section round
- `MIX_ROUND` — 15 questions per mix round
- `WRONG_LOCK_MS` — minimum wait after a wrong answer (also waits for the hint to finish being read)
- `NEXT_DELAY_MS` — wait after a right answer before the next question

## Editing questions
Each question in `data/questions.js` has `answer` (0 = first bubble), `hint` (read aloud after a wrong answer;
Paper Folding has none), and for Sentence Completion a `prompt` that is spoken but never shown. Bump the `?v=` numbers
in `index.html` after editing so the iPad picks up the change right away.
