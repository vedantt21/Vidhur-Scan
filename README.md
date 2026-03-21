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

## Run it

```bash
npm start
```

Then open `http://127.0.0.1:3000`.

## Enable OpenAI Parsing

Create a local `.env` file:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
```

Then run:

```bash
npm start
```

You can still use shell env vars instead if you prefer:

```bash
export OPENAI_API_KEY=your_key_here
export OPENAI_MODEL=gpt-5.4-mini
npm start
```

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

- Persistence is implemented as a local JSON-backed store for the first step. This keeps the app dependency-free and easy to run.
- Image OCR is handled in the browser with `tesseract.js`, and the camera flow is mobile-friendly through the file input `capture` mode.
- OCR support now loads only when you actually choose a photo, so the initial page load stays local and lighter on phones.
- OpenAI parsing is optional and server-side. The app checks whether `OPENAI_API_KEY` is present and falls back cleanly when it is not.
- The `start:phone` script binds the server to `0.0.0.0` so the site can be opened from a phone on the same local network.
- Users should still review the extracted text before saving, because OCR can misread curved packaging, glare, or stylized fonts.
- The matching engine is rule-based. It is useful for fast screening, but it does not replace halal/kosher certification or brand-level ingredient verification.
- The backend is structured so the storage layer can be swapped later for SQLite or Postgres without changing the browser UI.
