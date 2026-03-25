# Ingredient Screen

Barcode-first dietary screening app with Gmail-based account creation, saved preferences, scan history, OCR fallback, and an Android-ready Capacitor shell.

## What changed

- Barcode lookup is now the primary scan path.
- OCR and pasted ingredient text remain available as backup when a barcode cannot be resolved or does not provide enough dietary detail.
- User, session, scan history, and API call tracking moved from JSON files to SQLite at `data/ingredient-screen.sqlite`.
- FatSecret barcode API calls are proxied server-side and summarized into `data/api-usage.toml`.
- Registration is restricted to `gmail.com` by default and can be changed with `AUTH_ALLOWED_EMAIL_DOMAIN`.
- The web app includes a static `public/app-config.js` file so a Capacitor Android shell can point at a hosted backend.

## Run it

```bash
npm install
cp .env.example .env
npm start
```

Open `http://127.0.0.1:3000`.

## Required environment

Barcode lookup needs a valid FatSecret client secret. The provided client id is already wired into `.env.example`.

```bash
APP_ORIGIN=http://127.0.0.1:3000
AUTH_ALLOWED_EMAIL_DOMAIN=gmail.com

FATSECRET_CLIENT_ID=1cb0e8135f3e4b1db4fb20c9995c229b
FATSECRET_CLIENT_SECRET=your_fatsecret_client_secret
FATSECRET_SCOPE=barcode
FATSECRET_REGION=US
FATSECRET_LANGUAGE=en
```

Optional email delivery for account verification:

```bash
SMTP_HOST=your.smtp.host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
MAIL_FROM="Ingredient Screen <no-reply@example.com>"
```

## Android path

The repo is prepared for a Capacitor Android shell, but the Android app should use a hosted backend for auth, SQLite-backed history, and server-side FatSecret requests.

1. Host this Node app somewhere reachable from the Android device.
2. Edit `public/app-config.js` before the Android build:

```js
window.IngredientScreenConfig = {
  apiBaseUrl: "https://your-hosted-api.example.com",
  useNativeLocalStorage: false
};
```

3. Run `npm install` so the declared Capacitor dev dependencies are available locally.
4. Run:

```bash
npm run android:add
npm run android:sync
npm run android:open
```

If `apiBaseUrl` is left blank, native builds fall back to on-device localStorage for auth/history and will not be able to use the FatSecret barcode API because those credentials must stay on the server.

## Data and tracking

- SQLite database: `data/ingredient-screen.sqlite`
- Generated API usage summary: `data/api-usage.toml`
- Legacy JSON files under `data/` are migrated into SQLite on first server start if the database is empty.

## FatSecret notes

- Barcode lookups use the official FatSecret barcode endpoint.
- The app only persists scan results, barcodes, and identifiers needed for history. The raw FatSecret response is treated as transient data.
- Vegan and vegetarian results can use FatSecret dietary flags and allergen metadata directly. Halal, kosher, and custom rules still fall back to ingredient text when barcode metadata is insufficient.

## Test it

```bash
npm test
```
