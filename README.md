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

## Run in Android Studio

Use the Android shell only with a reachable Node backend. Barcode lookup, Gmail auth flow, saved history, and API tracking all depend on the server.

### Prerequisites

- Android Studio installed with an emulator image
- Node dependencies installed with `npm install`
- `.env` created from `.env.example`
- FatSecret secret filled in locally

### Local emulator workflow

1. Start the backend so the emulator can reach it:

```bash
npm run preview:phone
```

That runs the server on `0.0.0.0:3000`.

2. Edit `public/app-config.js` for the Android emulator:

```js
window.IngredientScreenConfig = {
  apiBaseUrl: "http://10.0.2.2:3000",
  useNativeLocalStorage: false
};
```

`10.0.2.2` is the Android emulator alias for your host machine. If you use a real Android phone on the same Wi-Fi, replace it with your computer's LAN IP such as `http://192.168.1.50:3000`.

3. Generate the Android project once:

```bash
npm run android:add
```

4. Sync web assets and Capacitor config into Android every time you change the app:

```bash
npm run android:sync
```

5. Open the Android project in Android Studio:

```bash
npm run android:open
```

6. In Android Studio:

- Wait for Gradle sync to finish.
- Select an emulator or connected device.
- Press `Run`.

### Important files for Android Studio

- `public/app-config.js`
  Set `apiBaseUrl` and `useNativeLocalStorage: false` for Android builds that should use the backend.
- `capacitor.config.json`
  `server.cleartext` is enabled so the emulator can call a local `http://10.0.2.2:3000` backend during development.
- `.env`
  Keep your FatSecret secret here on the server side only.

### Production note

`server.cleartext` is meant for local Android development over HTTP. When you move to a real hosted HTTPS backend, point `public/app-config.js` at the HTTPS URL and change `capacitor.config.json` `server.cleartext` back to `false`.

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
