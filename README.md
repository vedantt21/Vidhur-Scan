# Ingredient Screen

Ingredient screening app for pasted ingredient lists, label-photo OCR, user accounts, saved default sensitivities, and scan history.

## What it does

- Paste an ingredient list instead of reading labels manually.
- Upload a label photo and extract text into the ingredients box with browser-side OCR.
- Create an account, log in, and save your default screening preferences.
- Screen ingredients against preset rules for `vegetarian`, `vegan`, `halal`, and `kosher`.
- Add custom sensitivities using your own keyword lists.
- Save every analysis and review previous scans from the bottom `History` tab.
- Run as a browser app today and as an iOS-ready app shell with the same screening logic.

## Run it

```bash
npm install
npm start
```

Then open `http://127.0.0.1:3000`.

To simulate the native iOS app code path in a Linux browser, open:

```text
http://127.0.0.1:3000/?native=1
```

That forces the on-device storage flow used by the iOS app shell, so you can verify that the app still works without the Node API handling auth, profile defaults, analysis, or history.

## Email verification

New accounts must verify their email before they can log in.

- With SMTP configured, the app sends a real verification email.
- Without SMTP configured, the app falls back to a verification preview link in the UI so local development still works.

Copy `.env.example` to `.env` and set these if you want real email delivery:

```bash
APP_ORIGIN=http://127.0.0.1:3000
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
MAIL_FROM="Ingredient Screen <no-reply@example.com>"
```

To test the responsive app from a phone on the same network:

```bash
npm run preview:phone
```

Then open `http://<your-computer-ip>:3000` on the device.

## iOS path

The repo is now set up for an iOS/native shell without changing the screening behavior:

- Web/server mode keeps using the current Node backend and file-backed history store at `data/analyses.json`.
- Native iOS mode uses the same analysis engine in the webview and stores saved analyses on-device.
- The web assets are packaged from `public/` via `capacitor.config.json`.

What you can verify on Linux:

- The same UI loads correctly at phone sizes.
- The native app code path works by visiting `/?native=1`.
- Accounts, default preferences, and analyses save and reload from on-device browser storage instead of the Node JSON store.
- OCR, form submission, results rendering, and history replay still work in the packaged-web flow.

What you cannot verify on Linux:

- Real WKWebView behavior on iOS.
- Camera/photo-permission edge cases specific to iPhone.
- Xcode signing, packaging, and App Store build issues.

On a macOS machine with Xcode installed, the typical next steps are:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios
npm run ios:sync
npm run ios:open
```

This environment cannot generate or open the Xcode project because the Apple toolchain is not available here, but the app shell configuration is in place.

## Test it

```bash
npm test
```

## Notes

- Web mode stores users, sessions, and analyses in local JSON files under `data/`.
- Native iOS mode uses on-device browser storage instead of the server-side JSON files because there is no Node server inside the app bundle.
- Image OCR is handled in the browser with `tesseract.js`, so users should still review the extracted text before saving.
- The matching engine is rule-based. It is useful for fast screening, but it does not replace halal/kosher certification or brand-level ingredient verification.
- The backend and native runtime share the same analysis code, so the matching behavior stays aligned across web and iOS.
