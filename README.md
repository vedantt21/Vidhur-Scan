# Ingredient Screen

Initial website for screening pasted ingredient lists against preset dietary and religious sensitivities.

## What it does

- Paste an ingredient list into a website instead of reading labels manually.
- Take a label photo on a phone or upload an image, then let browser-side OCR parse it automatically.
- If `OPENAI_API_KEY` is configured, the app prefers OpenAI-assisted parsing for photos and text cleanup.
- Screen ingredients against preset rules for `vegetarian`, `vegan`, `halal`, and `kosher`.
- Add custom sensitivities using your own keyword lists.
- Save every analysis to a local file-backed store at `data/analyses.json`.
- Review recent submissions from the right-hand history panel.

## Quick Start

```bash
npm start
```

Then open `http://127.0.0.1:3000`.

This works with no API key. In that mode, photo parsing uses browser OCR.

## Optional OpenAI Setup

If you want better parsing quality, copy the example env file and add your own key:

```bash
cp .env.example .env
```

Then edit `.env` and set:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Then start the app normally:

```bash
npm start
```

You can also use shell env vars instead of `.env` if you prefer.

With the key configured, the server exposes AI photo parsing and AI text cleanup. Without it, the app falls back to local browser OCR for photos.

## Use It On Your Phone

```bash
npm run start:phone
```

Then open `http://<your-computer-lan-ip>:3000` from your phone on the same Wi-Fi network.

## Test it

```bash
npm test
```

## Notes

- A fresh clone should run immediately with `npm start`; OpenAI is optional.
- Persistence is implemented as a local JSON-backed store for the first step. This keeps the app dependency-free and easy to run.
- Image OCR is handled in the browser with `tesseract.js`, and the camera flow is mobile-friendly through the file input `capture` mode.
- OCR support now loads only when you actually choose a photo, so the initial page load stays local and lighter on phones.
- OpenAI parsing is optional and server-side. The app checks whether `OPENAI_API_KEY` is present and falls back cleanly when it is not.
- `.env.example` is committed for setup guidance. `.env` is ignored so local secrets do not get committed.
- The `start:phone` script binds the server to `0.0.0.0` so the site can be opened from a phone on the same local network.
- Users should still review the extracted text before saving, because OCR can misread curved packaging, glare, or stylized fonts.
- The matching engine is rule-based. It is useful for fast screening, but it does not replace halal/kosher certification or brand-level ingredient verification.
- The backend is structured so the storage layer can be swapped later for SQLite or Postgres without changing the browser UI.
