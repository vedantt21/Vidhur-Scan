const { logApiCall } = require("./database");

const DEFAULT_CLIENT_ID = "1cb0e8135f3e4b1db4fb20c9995c229b";
const DEFAULT_SCOPE = "barcode";
const DEFAULT_REGION = "US";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_TIMEOUT_MS = 8000;
const TOKEN_URL = "https://oauth.fatsecret.com/connect/token";
const BARCODE_LOOKUP_URL = "https://platform.fatsecret.com/rest/food/barcode/find-by-id/v2";

const tokenCache = {
  accessToken: "",
  expiresAt: 0,
  scope: ""
};

function readFatSecretConfig() {
  return {
    clientId: String(process.env.FATSECRET_CLIENT_ID || DEFAULT_CLIENT_ID).trim(),
    clientSecret: String(process.env.FATSECRET_CLIENT_SECRET || "").trim(),
    scope: String(process.env.FATSECRET_SCOPE || DEFAULT_SCOPE).trim(),
    region: String(process.env.FATSECRET_REGION || DEFAULT_REGION).trim(),
    language: String(process.env.FATSECRET_LANGUAGE || DEFAULT_LANGUAGE).trim(),
    timeoutMs: Number(process.env.FATSECRET_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  };
}

function hasFatSecretCredentials() {
  const config = readFatSecretConfig();
  return Boolean(config.clientId && config.clientSecret);
}

function normalizeBarcode(value) {
  const digits = String(value || "").replace(/\D+/g, "");

  if (digits.length === 8 || digits.length === 12) {
    return digits.padStart(13, "0");
  }

  if (digits.length === 13) {
    return digits;
  }

  throw new Error("Enter an EAN-8, UPC-A, or GTIN-13 barcode.");
}

function withTimeout(signal, timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.any ? AbortSignal.any([signal].filter(Boolean).concat(AbortSignal.timeout(timeoutMs))) : AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      controller.abort();
    });
  }

  return controller.signal;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  return [value];
}

function toTernary(value) {
  const normalized = Number(value);

  if (normalized === 1 || normalized === 0 || normalized === -1) {
    return normalized;
  }

  return -1;
}

function normalizeNamedFlags(collection) {
  return asArray(collection)
    .map((entry) => ({
      name: String(entry && entry.name ? entry.name : "").trim(),
      value: toTernary(entry && entry.value)
    }))
    .filter((entry) => entry.name);
}

function normalizeServing(serving) {
  if (!serving || typeof serving !== "object") {
    return null;
  }

  return {
    servingId: String(serving.serving_id || "").trim(),
    description: String(serving.serving_description || "").trim(),
    calories: String(serving.calories || "").trim(),
    metricServingAmount: String(serving.metric_serving_amount || "").trim(),
    metricServingUnit: String(serving.metric_serving_unit || "").trim()
  };
}

function normalizeLookupPayload(payload, barcode) {
  const food = payload && payload.food ? payload.food : payload;
  const foodAttributes = food && food.food_attributes ? food.food_attributes : {};
  const preferences = normalizeNamedFlags(
    (foodAttributes.preferences && foodAttributes.preferences.preference) || foodAttributes.preference
  );
  const allergens = normalizeNamedFlags(
    (foodAttributes.allergens && foodAttributes.allergens.allergen) || foodAttributes.allergen
  );
  const servings = asArray((food.servings && food.servings.serving) || food.serving);
  const defaultServing = servings.find((entry) => Number(entry && entry.is_default) === 1) || servings[0] || null;

  return {
    barcode,
    foodId: String(food.food_id || "").trim(),
    servingId: defaultServing ? String(defaultServing.serving_id || "").trim() : "",
    foodName: String(food.food_name || "").trim(),
    brandName: String(food.brand_name || "").trim(),
    foodUrl: String(food.food_url || "").trim(),
    preferences,
    allergens,
    serving: normalizeServing(defaultServing)
  };
}

function getErrorSummary(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (payload.error && typeof payload.error === "object") {
    const code = payload.error.code != null ? String(payload.error.code) : "";
    const message = payload.error.message || payload.error.description || payload.error.title || "";
    return [code, message].filter(Boolean).join(": ");
  }

  if (payload.error_description) {
    return String(payload.error_description);
  }

  if (payload.message) {
    return String(payload.message);
  }

  return "";
}

function createApiError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatLookupSummary(lookup) {
  const label = [lookup.brandName, lookup.foodName].filter(Boolean).join(" ");
  return label || lookup.foodId || lookup.barcode;
}

async function requestAccessToken(userId = "") {
  const config = readFatSecretConfig();

  if (!config.clientSecret) {
    throw createApiError(
      "FatSecret barcode lookup is not configured yet. Add FATSECRET_CLIENT_SECRET before using barcode scans.",
      503
    );
  }

  if (tokenCache.accessToken && tokenCache.scope === config.scope && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const startedAt = Date.now();
  const requestBody = new URLSearchParams({ grant_type: "client_credentials" });

  if (config.scope) {
    requestBody.set("scope", config.scope);
  }

  let response;
  let payload = null;

  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: requestBody,
      signal: withTimeout(null, config.timeoutMs)
    });
    payload = await response.json().catch(() => null);
  } catch (error) {
    await logApiCall({
      provider: "fatsecret",
      endpoint: TOKEN_URL,
      status: "error",
      scope: config.scope,
      userId,
      durationMs: Date.now() - startedAt,
      responseSummary: error.message
    }).catch(() => {});
    throw createApiError("Could not reach FatSecret to request an access token.", 502);
  }

  const durationMs = Date.now() - startedAt;

  if (!response.ok || !payload || !payload.access_token) {
    await logApiCall({
      provider: "fatsecret",
      endpoint: TOKEN_URL,
      status: "error",
      httpStatus: response.status,
      scope: config.scope,
      userId,
      durationMs,
      responseSummary: getErrorSummary(payload) || response.statusText
    }).catch(() => {});

    throw createApiError(
      response.status === 401 || response.status === 403
        ? "FatSecret rejected the configured credentials. Check FATSECRET_CLIENT_SECRET and your allowed server IPs."
        : "FatSecret access token request failed.",
      response.status === 401 || response.status === 403 ? 502 : 500
    );
  }

  tokenCache.accessToken = payload.access_token;
  tokenCache.scope = config.scope;
  tokenCache.expiresAt = Date.now() + Number(payload.expires_in || 0) * 1000;

  await logApiCall({
    provider: "fatsecret",
    endpoint: TOKEN_URL,
    status: "success",
    httpStatus: response.status,
    scope: config.scope,
    userId,
    durationMs,
    responseSummary: `token:${Number(payload.expires_in || 0)}s`
  }).catch(() => {});

  return tokenCache.accessToken;
}

async function lookupFoodByBarcode({ barcode, userId = "" }) {
  const config = readFatSecretConfig();
  const normalizedBarcode = normalizeBarcode(barcode);
  const accessToken = await requestAccessToken(userId);
  const searchParams = new URLSearchParams({
    barcode: normalizedBarcode,
    format: "json",
    include_food_attributes: "true",
    flag_default_serving: "true"
  });

  if (config.region) {
    searchParams.set("region", config.region);
  }

  if (config.region && config.language) {
    searchParams.set("language", config.language);
  }

  const startedAt = Date.now();
  let response;
  let payload = null;

  try {
    response = await fetch(`${BARCODE_LOOKUP_URL}?${searchParams.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      signal: withTimeout(null, config.timeoutMs)
    });
    payload = await response.json().catch(() => null);
  } catch (error) {
    await logApiCall({
      provider: "fatsecret",
      endpoint: BARCODE_LOOKUP_URL,
      status: "error",
      httpStatus: 0,
      scope: config.scope,
      barcode: normalizedBarcode,
      userId,
      requestKey: `barcode:${normalizedBarcode}`,
      durationMs: Date.now() - startedAt,
      responseSummary: error.message
    }).catch(() => {});
    throw createApiError("Could not reach FatSecret to look up that barcode.", 502);
  }

  const durationMs = Date.now() - startedAt;
  const errorSummary = getErrorSummary(payload);

  if (!response.ok || !payload || (!payload.food && !payload.food_id)) {
    await logApiCall({
      provider: "fatsecret",
      endpoint: BARCODE_LOOKUP_URL,
      status: "error",
      httpStatus: response.status,
      scope: config.scope,
      barcode: normalizedBarcode,
      userId,
      requestKey: `barcode:${normalizedBarcode}`,
      durationMs,
      responseSummary: errorSummary || response.statusText
    }).catch(() => {});

    if (response.status === 404 || /\b211\b/.test(errorSummary)) {
      throw createApiError("No product match was found for that barcode. Use OCR or paste ingredients instead.", 404);
    }

    throw createApiError("FatSecret could not return a barcode match for that product.", 502);
  }

  const lookup = normalizeLookupPayload(payload, normalizedBarcode);

  await logApiCall({
    provider: "fatsecret",
    endpoint: BARCODE_LOOKUP_URL,
    status: "success",
    httpStatus: response.status,
    scope: config.scope,
    barcode: normalizedBarcode,
    foodId: lookup.foodId,
    userId,
    requestKey: `barcode:${normalizedBarcode}`,
    durationMs,
    responseSummary: formatLookupSummary(lookup)
  }).catch(() => {});

  return lookup;
}

module.exports = {
  hasFatSecretCredentials,
  lookupFoodByBarcode,
  normalizeBarcode,
  readFatSecretConfig
};
