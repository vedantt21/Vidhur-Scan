# Ingredient Screen

Initial website for screening pasted ingredient lists against preset dietary and religious sensitivities.

## What it does

- Paste an ingredient list into a website instead of reading labels manually.
- Upload a label photo and extract text into the ingredients box with browser-side OCR.
- Screen ingredients against preset rules for `vegetarian`, `vegan`, `halal`, and `kosher`.
- Add custom sensitivities using your own keyword lists.
- Save every analysis to a local file-backed store at `data/analyses.json`.
- Review recent submissions from the right-hand history panel.

## Run it

```bash
npm start
```

Then open `http://127.0.0.1:3000`.

## Test it

```bash
npm test
```

## Notes

- Persistence is implemented as a local JSON-backed store for the first step. This keeps the app dependency-free and easy to run.
- Image OCR is handled in the browser with `tesseract.js`, so users should still review the extracted text before saving.
- The matching engine is rule-based. It is useful for fast screening, but it does not replace halal/kosher certification or brand-level ingredient verification.
- The backend is structured so the storage layer can be swapped later for SQLite or Postgres without changing the browser UI.
