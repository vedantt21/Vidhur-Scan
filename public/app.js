const NATIVE_USERS_STORAGE_KEY = "ingredient-screen.users";
const NATIVE_ANALYSES_STORAGE_KEY = "ingredient-screen.analyses";
const NATIVE_SESSION_STORAGE_KEY = "ingredient-screen.session";
const WEB_SESSION_TOKEN_STORAGE_KEY = "ingredient-screen.web-session-token";
const analysisRuntime = window.IngredientAnalysis;
const clientConfig = window.IngredientScreenConfig || {};

const state = {
  presets: [],
  sessionToken: window.localStorage.getItem(WEB_SESSION_TOKEN_STORAGE_KEY) || "",
  currentUser: null,
  activeTab: "scan",
  customSensitivities: [],
  analyses: [],
  selectedImage: null,
  imagePreviewUrl: "",
  lastExtractionSource: null,
  activeBarcodeLookup: null,
  selectedHistoryAnalysisId: "",
  runtimeConfig: {
    auth: {
      allowedEmailDomain: "gmail.com"
    },
    integrations: {
      barcodeLookupEnabled: false,
      barcodeProvider: "FatSecret"
    }
  }
};

const authScreen = document.querySelector("#auth-screen");
const appScreen = document.querySelector("#app-screen");
const authStatus = document.querySelector("#auth-status");
const authPreview = document.querySelector("#auth-preview");
const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const resendVerificationButton = document.querySelector("#resend-verification-button");
const registerPresetGrid = document.querySelector("#register-preset-grid");
const profilePresetGrid = document.querySelector("#profile-preset-grid");
const showRegisterButton = document.querySelector("#show-register-button");
const showLoginButton = document.querySelector("#show-login-button");
const appContent = document.querySelector(".app-content");
const headerKicker = document.querySelector("#header-kicker");
const headerTitle = document.querySelector("#header-title");
const headerSubtitle = document.querySelector("#header-subtitle");
const currentCheckingContainer = document.querySelector("#current-checking");
const fallbackTools = document.querySelector(".fallback-tools");
const newScanButton = document.querySelector("#new-scan-button");
const scanDefaultsNote = document.querySelector("#scan-defaults-note");
const historyStatus = document.querySelector("#history-status");
const historyContainer = document.querySelector("#history");
const historyItemTemplate = document.querySelector("#history-item-template");
const profileStatus = document.querySelector("#profile-status");
const profileForm = document.querySelector("#profile-form");
const profileNameInput = document.querySelector("#profile-name");
const profileEmailInput = document.querySelector("#profile-email");
const logoutButton = document.querySelector("#logout-button");
const navButtons = Array.from(document.querySelectorAll(".nav-button"));
const tabPanels = Array.from(document.querySelectorAll("[data-tab-panel]"));
const form = document.querySelector("#analysis-form");
const customList = document.querySelector("#custom-list");
const customLabelInput = document.querySelector("#custom-label");
const customTermsInput = document.querySelector("#custom-terms");
const customItemTemplate = document.querySelector("#custom-item-template");
const resultsContainer = document.querySelector("#results");
const statusBanner = document.querySelector("#status-banner");
const submitButton = document.querySelector("#submit-button");
const registerEmailHint = document.querySelector("#register-email-hint");
const barcodeInput = document.querySelector("#barcode-input");
const barcodeImageInput = document.querySelector("#barcode-image-input");
const lookupBarcodeButton = document.querySelector("#lookup-barcode-button");
const clearBarcodeButton = document.querySelector("#clear-barcode-button");
const barcodeStatus = document.querySelector("#barcode-status");
const barcodeResult = document.querySelector("#barcode-result");
const ingredientsTextInput = document.querySelector("#ingredients-text");
const imageInput = document.querySelector("#image-input");
const extractButton = document.querySelector("#extract-button");
const clearImageButton = document.querySelector("#clear-image-button");
const imagePreview = document.querySelector("#image-preview");
const ocrStatus = document.querySelector("#ocr-status");
const TAB_ORDER = ["history", "scan", "profile"];
const TAB_SWITCH_ANIMATION = {
  duration: 280,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)"
};
const TAB_SWIPE_THRESHOLD = 72;
const tabSwipeState = {
  active: false,
  startX: 0,
  startY: 0
};

function isNativeApp() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("native") === "1") {
    return true;
  }

  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === "function") {
    try {
      return window.Capacitor.isNativePlatform();
    } catch (error) {
      return false;
    }
  }

  return window.location.protocol === "capacitor:" || /Capacitor/i.test(window.navigator.userAgent);
}

function getApiBaseUrl() {
  return String(clientConfig.apiBaseUrl || "").trim().replace(/\/+$/, "");
}

function resolveApiUrl(url) {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl || /^https?:\/\//i.test(url)) {
    return url;
  }

  return `${baseUrl}${url}`;
}

function useLocalNativeStorage() {
  return isNativeApp() && clientConfig.useNativeLocalStorage !== false && !getApiBaseUrl();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return entities[character];
  });
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJsonStorage(key, fallback = []) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = JSON.parse(raw || JSON.stringify(fallback));
    return parsed == null ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readStoredUsers() {
  const users = readJsonStorage(NATIVE_USERS_STORAGE_KEY, []);
  return Array.isArray(users) ? users : [];
}

function writeStoredUsers(users) {
  writeJsonStorage(NATIVE_USERS_STORAGE_KEY, users);
}

function readStoredAnalyses() {
  const analyses = readJsonStorage(NATIVE_ANALYSES_STORAGE_KEY, []);
  return Array.isArray(analyses) ? analyses : [];
}

function writeStoredAnalyses(analyses) {
  writeJsonStorage(NATIVE_ANALYSES_STORAGE_KEY, analyses);
}

function readNativeSession() {
  const session = readJsonStorage(NATIVE_SESSION_STORAGE_KEY, null);
  return session && typeof session === "object" ? session : null;
}

function writeNativeSession(session) {
  writeJsonStorage(NATIVE_SESSION_STORAGE_KEY, session);
}

function clearNativeSession() {
  window.localStorage.removeItem(NATIVE_SESSION_STORAGE_KEY);
}

function persistWebSessionToken(token) {
  state.sessionToken = token;
  window.localStorage.setItem(WEB_SESSION_TOKEN_STORAGE_KEY, token);
}

function clearWebSessionToken() {
  state.sessionToken = "";
  window.localStorage.removeItem(WEB_SESSION_TOKEN_STORAGE_KEY);
}

function sanitizePreferences(preferences) {
  const allowed = new Set(state.presets.map((preset) => preset.id));
  const presetIds = Array.isArray(preferences && preferences.presets)
    ? preferences.presets.filter((id) => allowed.has(id))
    : [];
  const customSensitivities = Array.isArray(preferences && preferences.customSensitivities)
    ? preferences.customSensitivities
        .map((entry) => {
          const label = String(entry && entry.label ? entry.label : "").trim();
          const terms = Array.isArray(entry && entry.terms)
            ? entry.terms.map((term) => String(term || "").trim()).filter(Boolean)
            : [];

          return {
            label,
            terms
          };
        })
        .filter((entry) => entry.label && entry.terms.length > 0)
    : [];

  return {
    presets: [...new Set(presetIds)],
    customSensitivities
  };
}

function isLocalUserVerified(user) {
  if (!user) {
    return false;
  }

  if (user.emailVerifiedAt) {
    return true;
  }

  return !("verificationTokenHash" in user) && !("verificationExpiresAt" in user);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: isLocalUserVerified(user),
    preferences: sanitizePreferences(user.preferences),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function hashLocalPassword(password, salt = createId()) {
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await window.crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${password}`));
    const hash = Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

    return {
      salt,
      hash
    };
  }

  return {
    salt,
    hash: `${salt}:${password}`
  };
}

async function verifyLocalPassword(password, salt, passwordHash) {
  const next = await hashLocalPassword(password, salt);
  return next.hash === passwordHash;
}

async function hashLocalVerificationToken(token) {
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await window.crypto.subtle.digest("SHA-256", encoder.encode(String(token || "")));

    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `fallback:${token}`;
}

function listStoredAnalysesForUser(userId, limit = 20) {
  return readStoredAnalyses()
    .filter((analysis) => analysis.userId === userId)
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function registerServiceWorker() {
  const canRegister =
    "serviceWorker" in navigator && (window.location.protocol === "http:" || window.location.protocol === "https:");

  if (!canRegister) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(resolveApiUrl(url), options);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.error || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return payload;
}

function createAuthHeaders(includeContentType = true) {
  const headers = {};
  const token = state.sessionToken || window.localStorage.getItem(WEB_SESSION_TOKEN_STORAGE_KEY) || "";

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

const dataClient = {
  async listPresets() {
    if (!analysisRuntime) {
      throw new Error("Analysis runtime failed to load.");
    }

    return analysisRuntime.listPresetSensitivities();
  },

  async register(payload) {
    if (useLocalNativeStorage()) {
      const name = String(payload.name || "").trim();
      const email = normalizeEmail(payload.email);
      const password = String(payload.password || "");
      const preferences = sanitizePreferences(payload.preferences);
      const allowedDomain = state.runtimeConfig.auth.allowedEmailDomain || "gmail.com";

      if (!name) {
        throw new Error("Name is required.");
      }

      if (!email) {
        throw new Error("Email is required.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
      }

      if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
        throw new Error(`Use a ${allowedDomain} address to create an account.`);
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const users = readStoredUsers();
      const existingUser = users.find((user) => user.email === email);

      if (existingUser && isLocalUserVerified(existingUser)) {
        throw new Error("An account with that email already exists.");
      }

      const passwordRecord = await hashLocalPassword(password);
      const now = new Date().toISOString();
      const verificationToken = createId();
      const verificationTokenHash = await hashLocalVerificationToken(verificationToken);
      const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
      const nextUser = existingUser
        ? {
            ...existingUser,
            name,
            preferences,
            passwordSalt: passwordRecord.salt,
            passwordHash: passwordRecord.hash,
            emailVerifiedAt: null,
            verificationTokenHash,
            verificationExpiresAt,
            updatedAt: now
          }
        : {
            id: createId(),
            name,
            email,
            preferences,
            passwordSalt: passwordRecord.salt,
            passwordHash: passwordRecord.hash,
            emailVerifiedAt: null,
            verificationTokenHash,
            verificationExpiresAt,
            createdAt: now,
            updatedAt: now
          };

      if (existingUser) {
        const existingIndex = users.findIndex((user) => user.id === existingUser.id);
        users[existingIndex] = nextUser;
      } else {
        users.push(nextUser);
      }

      writeStoredUsers(users);

      return {
        requiresVerification: true,
        message: "Check the preview link below to verify this local account before logging in.",
        delivery: "preview",
        previewUrl: `${window.location.origin}${window.location.pathname}?native=1&verify=${verificationToken}`
      };
    }

    return fetchJson("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  },

  async login(payload) {
    if (useLocalNativeStorage()) {
      const email = normalizeEmail(payload.email);
      const password = String(payload.password || "");
      const user = readStoredUsers().find((entry) => entry.email === email);

      if (!user || !(await verifyLocalPassword(password, user.passwordSalt, user.passwordHash))) {
        throw new Error("Invalid email or password.");
      }

      if (!isLocalUserVerified(user)) {
        const error = new Error("Verify your email before logging in.");
        error.verificationRequired = true;
        throw error;
      }

      const session = {
        token: createId(),
        userId: user.id
      };

      writeNativeSession(session);

      return {
        token: session.token,
        user: publicUser(user)
      };
    }

    return fetchJson("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  },

  async resendVerification(payload) {
    if (useLocalNativeStorage()) {
      const email = normalizeEmail(payload.email);
      const users = readStoredUsers();
      const userIndex = users.findIndex((entry) => entry.email === email);

      if (userIndex === -1 || isLocalUserVerified(users[userIndex])) {
        return {
          ok: true,
          message: "If that account exists and still needs verification, a new email has been sent."
        };
      }

      const verificationToken = createId();

      users[userIndex] = {
        ...users[userIndex],
        verificationTokenHash: await hashLocalVerificationToken(verificationToken),
        verificationExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        updatedAt: new Date().toISOString()
      };
      writeStoredUsers(users);

      return {
        ok: true,
        message: "Verification preview refreshed.",
        delivery: "preview",
        previewUrl: `${window.location.origin}${window.location.pathname}?native=1&verify=${verificationToken}`
      };
    }

    return fetchJson("/api/auth/resend-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  },

  async verifyEmail(payload) {
    if (useLocalNativeStorage()) {
      const rawToken = String(payload.token || "").trim();
      const tokenHash = await hashLocalVerificationToken(rawToken);
      const users = readStoredUsers();
      const userIndex = users.findIndex((entry) => entry.verificationTokenHash === tokenHash);

      if (userIndex === -1) {
        throw new Error("That verification link is invalid or has already been used.");
      }

      if (
        !users[userIndex].verificationExpiresAt ||
        new Date(users[userIndex].verificationExpiresAt).getTime() < Date.now()
      ) {
        throw new Error("That verification link has expired. Request a new one.");
      }

      users[userIndex] = {
        ...users[userIndex],
        emailVerifiedAt: new Date().toISOString(),
        verificationTokenHash: null,
        verificationExpiresAt: null,
        updatedAt: new Date().toISOString()
      };
      writeStoredUsers(users);

      return {
        verified: true,
        message: "Email verified. You can now log in."
      };
    }

    return fetchJson("/api/auth/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  },

  async getSession() {
    if (useLocalNativeStorage()) {
      const session = readNativeSession();

      if (!session) {
        return null;
      }

      const user = readStoredUsers().find((entry) => entry.id === session.userId);

      if (!user) {
        clearNativeSession();
        return null;
      }

      return {
        token: session.token,
        user: publicUser(user)
      };
    }

    const token = state.sessionToken || window.localStorage.getItem(WEB_SESSION_TOKEN_STORAGE_KEY);

    if (!token) {
      return null;
    }

    const payload = await fetchJson("/api/auth/session", {
      headers: createAuthHeaders(false)
    });

    return {
      token,
      user: payload.user
    };
  },

  async logout() {
    if (useLocalNativeStorage()) {
      clearNativeSession();
      return;
    }

    await fetchJson("/api/auth/logout", {
      method: "POST",
      headers: createAuthHeaders(false)
    }).catch(() => {});
  },

  async updateProfile(payload) {
    if (useLocalNativeStorage()) {
      const session = readNativeSession();

      if (!session) {
        throw new Error("Please sign in again.");
      }

      const users = readStoredUsers();
      const index = users.findIndex((entry) => entry.id === session.userId);

      if (index === -1) {
        clearNativeSession();
        throw new Error("Please sign in again.");
      }

      users[index] = {
        ...users[index],
        name: String(payload.name || "").trim(),
        preferences: sanitizePreferences(payload.preferences),
        updatedAt: new Date().toISOString()
      };

      writeStoredUsers(users);
      return {
        user: publicUser(users[index])
      };
    }

    return fetchJson("/api/profile", {
      method: "PUT",
      headers: createAuthHeaders(true),
      body: JSON.stringify(payload)
    });
  },

  async listHistory() {
    if (!state.currentUser) {
      return [];
    }

    if (useLocalNativeStorage()) {
      return listStoredAnalysesForUser(state.currentUser.id);
    }

    const payload = await fetchJson("/api/analyses", {
      headers: createAuthHeaders(false)
    });

    return payload.analyses || [];
  },

  async analyzeAndSave(payload) {
    if (!state.currentUser) {
      throw new Error("Please sign in before saving scans.");
    }

    if (useLocalNativeStorage()) {
      const analysis = analysisRuntime.analyzeIngredients(payload);
      const record = {
        id: createId(),
        userId: state.currentUser.id,
        createdAt: new Date().toISOString(),
        ...analysis
      };
      const analyses = readStoredAnalyses();

      analyses.push(record);
      writeStoredAnalyses(analyses);
      return record;
    }

    const result = await fetchJson("/api/analyze", {
      method: "POST",
      headers: createAuthHeaders(true),
      body: JSON.stringify(payload)
    });

    return result.analysis;
  },

  async lookupBarcode(barcode) {
    if (useLocalNativeStorage()) {
      throw new Error(
        "Barcode API lookup requires a hosted backend because FatSecret credentials must stay server-side."
      );
    }

    const payload = await fetchJson("/api/barcode/lookup", {
      method: "POST",
      headers: createAuthHeaders(true),
      body: JSON.stringify({ barcode })
    });

    return payload.lookup;
  },

  async getRuntimeConfig() {
    if (useLocalNativeStorage()) {
      return state.runtimeConfig;
    }

    return fetchJson("/api/runtime-config", {
      headers: createAuthHeaders(false)
    });
  }
};

function statusLabel(status) {
  if (status === "not_allowed") {
    return "Flagged";
  }

  if (status === "caution") {
    return "Review";
  }

  return "Clear";
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function normalizeBarcodeText(value) {
  return String(value || "").replace(/\D+/g, "");
}

function formatLookupName(lookup) {
  if (!lookup) {
    return "";
  }

  return [lookup.brandName, lookup.foodName].filter(Boolean).join(" ").trim();
}

function formatSource(source) {
  if (!source || !source.type) {
    return "Manual text";
  }

  if (source.type === "barcode_api") {
    return source.fallbackUsed ? "Barcode + text backup" : "Barcode API";
  }

  if (source.type === "image_ocr") {
    return "Image OCR";
  }

  if (source.type === "image_selected") {
    return "Image attached";
  }

  return "Manual text";
}

function formatAnalysisLabel(analysis) {
  if (analysis && analysis.productName) {
    return analysis.productName;
  }

  if (analysis && analysis.source && analysis.source.type === "barcode_api" && analysis.source.barcode) {
    return `Barcode ${analysis.source.barcode}`;
  }

  return "Saved scan";
}

function setBarcodeStatus(message, className = "ocr-status") {
  barcodeStatus.className = className;
  barcodeStatus.textContent = message;
}

function updateRuntimeHints() {
  const allowedDomain = state.runtimeConfig.auth.allowedEmailDomain || "gmail.com";
  const barcodeEnabled = Boolean(state.runtimeConfig.integrations.barcodeLookupEnabled);

  registerEmailHint.textContent = `Use a ${allowedDomain} address for account creation.`;
  document.querySelector("#register-email").setAttribute("placeholder", `you@${allowedDomain}`);

  if (barcodeEnabled) {
    lookupBarcodeButton.disabled = false;
    barcodeImageInput.disabled = false;
    setBarcodeStatus("No barcode lookup yet. Scan a barcode or type the number to start there.", "ocr-status empty-state");
    return;
  }

  if (useLocalNativeStorage()) {
    lookupBarcodeButton.disabled = true;
    barcodeImageInput.disabled = true;
    setBarcodeStatus(
      "Barcode API is disabled in local-only native mode. Point app-config.js at a hosted backend to enable it.",
      "ocr-status"
    );
    return;
  }

  lookupBarcodeButton.disabled = true;
  barcodeImageInput.disabled = true;
  setBarcodeStatus(
    "Barcode lookup is not configured on the server yet. Add FATSECRET_CLIENT_SECRET to enable it.",
    "ocr-status"
  );
}

function setInfoBanner(element, message) {
  element.textContent = message;
}

function getDashboardGreeting() {
  if (!state.currentUser) {
    return "Hello. What are you scanning today?";
  }

  const name = String(state.currentUser.name || "").trim().split(/\s+/)[0] || "there";
  return `Hello ${name} What are you scanning today?`;
}

function setAuthPreview(previewUrl, label = "Open verification preview") {
  if (!previewUrl) {
    authPreview.classList.add("hidden");
    authPreview.innerHTML = "";
    return;
  }

  authPreview.classList.remove("hidden");
  authPreview.innerHTML = `
    <strong>Verification preview</strong>
    <p><a href="${escapeHtml(previewUrl)}">${escapeHtml(label)}</a></p>
  `;
}

function setStatusBanner(message) {
  statusBanner.className = "status-banner active";
  statusBanner.textContent = message;
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function renderPresetOptions(container, inputName, selectedIds) {
  const selected = new Set(selectedIds || []);
  container.innerHTML = "";

  state.presets.forEach((preset) => {
    const label = document.createElement("label");
    label.className = "preset-option";
    label.innerHTML = `
      <input type="checkbox" name="${inputName}" value="${escapeHtml(preset.id)}" ${selected.has(preset.id) ? "checked" : ""} />
      <div>
        <strong>${escapeHtml(preset.label)}</strong>
        <p>${escapeHtml(preset.summary)}</p>
      </div>
    `;
    container.appendChild(label);
  });
}

function setAuthMode(mode) {
  const showRegister = mode === "register";

  registerForm.classList.toggle("hidden", !showRegister);
  loginForm.classList.toggle("hidden", showRegister);
  showRegisterButton.classList.toggle("active", showRegister);
  showLoginButton.classList.toggle("active", !showRegister);
  setAuthPreview(null);
  setInfoBanner(
    authStatus,
    showRegister
      ? "Create a Gmail-based account to save your profile and previous scans."
      : "Log in to load your saved screening defaults, barcode history, and backup OCR scans."
  );
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function updateHeader() {
  const titles = {
    history: {
      kicker: "Archive",
      title: "History",
      subtitle: "Review what was flagged in your saved scans."
    },
    scan: {
      kicker: "Dashboard",
      title: getDashboardGreeting(),
      subtitle: "Current checks are below. Tap the camera button to scan."
    },
    profile: {
      kicker: "Profile",
      title: "Profile",
      subtitle: "Manage the checks that run every time you scan."
    }
  };
  const active = titles[state.activeTab];

  headerKicker.textContent = active.kicker;
  headerTitle.textContent = active.title;
  headerSubtitle.textContent = active.subtitle;
  newScanButton.classList.toggle("hidden", state.activeTab === "scan");
  newScanButton.textContent = "Dashboard";
}

function tabOrderIndex(tab) {
  const index = TAB_ORDER.indexOf(tab);
  return index === -1 ? 0 : index;
}

function getAdjacentTab(currentTab, step) {
  const nextIndex = tabOrderIndex(currentTab) + step;

  if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) {
    return "";
  }

  return TAB_ORDER[nextIndex];
}

function setActiveTab(tab, options = {}) {
  const { animate = true } = options;
  const previousTab = state.activeTab;
  const nextPanel = tabPanels.find((panel) => panel.dataset.tabPanel === tab);
  const previousPanel = tabPanels.find((panel) => panel.dataset.tabPanel === previousTab);

  state.activeTab = tab;

  if (
    animate &&
    nextPanel &&
    previousPanel &&
    nextPanel !== previousPanel &&
    !previousPanel.classList.contains("hidden")
  ) {
    const direction = tabOrderIndex(tab) < tabOrderIndex(previousTab) ? -1 : 1;
    const panelWidth = nextPanel.getBoundingClientRect().width || appContent.getBoundingClientRect().width || 360;
    const travelDistance = Math.max(44, Math.round(panelWidth * 0.18));

    tabPanels.forEach((panel) => {
      if (panel !== nextPanel && panel !== previousPanel) {
        panel.classList.add("hidden");
      }
    });

    nextPanel.classList.remove("hidden");
    nextPanel.animate(
      [
        { opacity: 0.65, transform: `translateX(${direction * travelDistance}px) scale(0.985)` },
        { opacity: 1, transform: "translateX(0) scale(1)" }
      ],
      TAB_SWITCH_ANIMATION
    );
    previousPanel
      .animate(
        [
          { opacity: 1, transform: "translateX(0) scale(1)" },
          { opacity: 0.58, transform: `translateX(${-direction * travelDistance}px) scale(0.985)` }
        ],
        TAB_SWITCH_ANIMATION
      )
      .finished.finally(() => {
        previousPanel.classList.add("hidden");
      });
  } else {
    tabPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.tabPanel !== tab);
    });
  }

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  appScreen.dataset.activeTab = tab;
  updateHeader();
}

function shouldIgnoreTabSwipe(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, summary, a, [contenteditable='true']"));
}

function resetTabSwipe() {
  tabSwipeState.active = false;
  tabSwipeState.startX = 0;
  tabSwipeState.startY = 0;
}

function handleTabSwipeEnd(event) {
  if (!tabSwipeState.active || !event.changedTouches || event.changedTouches.length === 0) {
    resetTabSwipe();
    return;
  }

  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - tabSwipeState.startX;
  const deltaY = touch.clientY - tabSwipeState.startY;
  const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

  if (horizontalIntent && Math.abs(deltaX) >= TAB_SWIPE_THRESHOLD) {
    const targetTab = getAdjacentTab(state.activeTab, deltaX < 0 ? 1 : -1);

    if (targetTab) {
      setActiveTab(targetTab);
    }
  }

  resetTabSwipe();
}

function setOcrStatus(message) {
  ocrStatus.className = "ocr-status";
  ocrStatus.textContent = message;
}

function renderFlagRows(title, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  const chips = items
    .map((item) => {
      const valueLabel = item.value === 1 ? "yes" : item.value === 0 ? "no" : "unknown";
      const toneClass = item.value === 1 ? "good" : item.value === 0 ? "flagged" : "unknown";

      return `<span class="flag-chip ${toneClass}">${escapeHtml(item.name)}: ${escapeHtml(valueLabel)}</span>`;
    })
    .join("");

  return `
    <div class="barcode-meta-group">
      <strong>${escapeHtml(title)}</strong>
      <div class="flag-chip-row">${chips}</div>
    </div>
  `;
}

function renderBarcodeLookup() {
  if (!state.activeBarcodeLookup) {
    barcodeResult.className = "barcode-result empty-state";
    barcodeResult.textContent = "No barcode product loaded.";
    return;
  }

  const lookup = state.activeBarcodeLookup;
  const displayName = formatLookupName(lookup) || (lookup.barcode ? `Barcode ${lookup.barcode}` : "Barcode match");
  const servingText =
    lookup.serving && lookup.serving.description
      ? `${lookup.serving.description}${lookup.serving.calories ? ` · ${lookup.serving.calories} kcal` : ""}`
      : "Serving detail unavailable";

  barcodeResult.className = "barcode-result";
  barcodeResult.innerHTML = `
    <article class="barcode-card">
      <div class="barcode-head">
        <div>
          <p class="eyebrow">Live barcode match</p>
          <h4>${escapeHtml(displayName)}</h4>
        </div>
        <span class="barcode-pill">${escapeHtml(lookup.barcode || "No code")}</span>
      </div>
      <div class="barcode-meta">
        <div class="barcode-meta-group">
          <strong>Food ID</strong>
          <p>${escapeHtml(lookup.foodId || "Unavailable")}</p>
        </div>
        <div class="barcode-meta-group">
          <strong>Serving</strong>
          <p>${escapeHtml(servingText)}</p>
        </div>
      </div>
      ${renderFlagRows("Dietary profile", lookup.preferences)}
      ${renderFlagRows("Allergens", lookup.allergens)}
    </article>
  `;
}

appContent.addEventListener(
  "touchstart",
  (event) => {
    if (!appScreen || appScreen.classList.contains("hidden") || event.touches.length !== 1) {
      resetTabSwipe();
      return;
    }

    if (shouldIgnoreTabSwipe(event.target)) {
      resetTabSwipe();
      return;
    }

    const touch = event.touches[0];
    tabSwipeState.active = true;
    tabSwipeState.startX = touch.clientX;
    tabSwipeState.startY = touch.clientY;
  },
  { passive: true }
);

appContent.addEventListener(
  "touchend",
  (event) => {
    handleTabSwipeEnd(event);
  },
  { passive: true }
);

appContent.addEventListener(
  "touchcancel",
  () => {
    resetTabSwipe();
  },
  { passive: true }
);

function clearBarcodeLookup(options = {}) {
  const { preserveInput = false, preserveStatus = false } = options;

  state.activeBarcodeLookup = null;
  barcodeImageInput.value = "";

  if (!preserveInput) {
    barcodeInput.value = "";
  }

  if (!preserveStatus) {
    updateRuntimeHints();
  }

  renderBarcodeLookup();
}

function resetImagePreviewUrl() {
  if (!state.imagePreviewUrl) {
    return;
  }

  URL.revokeObjectURL(state.imagePreviewUrl);
  state.imagePreviewUrl = "";
}

function renderImagePreview() {
  if (!state.selectedImage) {
    resetImagePreviewUrl();
    imagePreview.className = "image-preview empty-state";
    imagePreview.textContent = "No label photo selected.";
    return;
  }

  resetImagePreviewUrl();
  state.imagePreviewUrl = URL.createObjectURL(state.selectedImage);
  imagePreview.className = "image-preview";
  imagePreview.innerHTML = `
    <div class="image-preview-card">
      <div>
        <strong>${escapeHtml(state.selectedImage.name)}</strong>
        <p>${Math.round(state.selectedImage.size / 1024)} KB</p>
      </div>
      <img src="${state.imagePreviewUrl}" alt="Selected ingredient label" />
    </div>
  `;
}

function clearSelectedImage(options = {}) {
  const { preserveStatus = false, preserveExtractionSource = false } = options;

  state.selectedImage = null;

  if (!preserveExtractionSource) {
    state.lastExtractionSource = null;
  }

  imageInput.value = "";
  renderImagePreview();

  if (!preserveStatus) {
    setOcrStatus("No image selected. Barcode lookup is still the primary flow.");
  }
}

function extractCandidateIngredients(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const markerMatch = cleaned.match(/ingredients?\s*[:.-]?\s*([\s\S]+)/i);
  let workingText = markerMatch ? markerMatch[1] : cleaned;

  const stopMarkers = [/nutrition facts/i, /allergy advice/i, /contains:/i, /distributed by/i, /storage:/i];

  for (const marker of stopMarkers) {
    const match = workingText.match(marker);

    if (match && typeof match.index === "number") {
      workingText = workingText.slice(0, match.index);
    }
  }

  return workingText
    .replace(/\n+/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function detectBarcodeFromFile(file) {
  if (!file) {
    throw new Error("Choose a barcode image first.");
  }

  if (typeof window.BarcodeDetector !== "function") {
    throw new Error("This browser does not support barcode detection from images.");
  }

  const detector = new window.BarcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e"]
  });
  const bitmap = await createImageBitmap(file);

  try {
    const results = await detector.detect(bitmap);

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error("No barcode was detected in that image.");
    }

    const rawValue = results[0] && results[0].rawValue ? results[0].rawValue : "";
    const digits = normalizeBarcodeText(rawValue);

    if (!digits) {
      throw new Error("A barcode was detected, but the value could not be read.");
    }

    return digits;
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}

function buildSourcePayload() {
  if (state.activeBarcodeLookup) {
    return {
      type: "barcode_api",
      provider: state.runtimeConfig.integrations.barcodeProvider || "FatSecret",
      barcode: state.activeBarcodeLookup.barcode || null,
      foodId: state.activeBarcodeLookup.foodId || null,
      servingId: state.activeBarcodeLookup.servingId || null,
      lookupMode: "barcode",
      fallbackUsed: Boolean(ingredientsTextInput.value.trim())
    };
  }

  if (state.lastExtractionSource) {
    return state.lastExtractionSource;
  }

  if (state.selectedImage) {
    return {
      type: "image_selected",
      fileName: state.selectedImage.name
    };
  }

  return {
    type: "manual_text"
  };
}

async function extractTextFromImage() {
  if (!state.selectedImage) {
    setOcrStatus("Choose an image first.");
    return;
  }

  if (!window.Tesseract) {
    setOcrStatus("OCR library failed to load. You can still paste ingredients manually.");
    return;
  }

  extractButton.disabled = true;
  clearImageButton.disabled = true;
  setOcrStatus("Reading label photo...");

  try {
    const result = await window.Tesseract.recognize(state.selectedImage, "eng", {
      logger(message) {
        if (message.status === "recognizing text") {
          setOcrStatus(`Reading label photo... ${Math.round(message.progress * 100)}%`);
        }
      }
    });
    const extractedText = extractCandidateIngredients(result.data.text);

    if (!extractedText) {
      throw new Error("No readable ingredient text was found in the image.");
    }

    ingredientsTextInput.value = extractedText;
    state.lastExtractionSource = {
      type: "image_ocr",
      fileName: state.selectedImage.name,
      extractionMethod: "tesseract.js"
    };
    setOcrStatus("Text extracted. Review it, correct it if needed, then analyze and save.");
    setStatusBanner("OCR finished. Review the extracted ingredients before saving.");
  } catch (error) {
    setOcrStatus(error.message || "Could not extract text from the image.");
  } finally {
    extractButton.disabled = false;
    clearImageButton.disabled = false;
  }
}

function renderCustomSensitivities() {
  if (state.customSensitivities.length === 0) {
    customList.className = "custom-list empty-state";
    customList.textContent = "No custom checks added yet.";
    return;
  }

  customList.className = "custom-list";
  customList.innerHTML = "";

  state.customSensitivities.forEach((entry, index) => {
    const fragment = customItemTemplate.content.cloneNode(true);
    const root = fragment.querySelector(".custom-item");

    fragment.querySelector(".custom-label").textContent = entry.label;
    fragment.querySelector(".custom-terms").textContent = entry.terms.join(", ");
    fragment.querySelector(".remove-custom").addEventListener("click", () => {
      state.customSensitivities.splice(index, 1);
      renderCustomSensitivities();
    });

    customList.appendChild(fragment);
    root.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 220, easing: "ease-out" }
    );
  });
}

function updateHomeGreeting() {
  updateHeader();
}

function renderCurrentChecking() {
  const preferences = state.currentUser ? sanitizePreferences(state.currentUser.preferences) : { presets: [], customSensitivities: [] };
  const presetCards = state.presets
    .filter((preset) => preferences.presets.includes(preset.id))
    .map(
      (preset) => `
        <div class="check-chip">
          <strong>${escapeHtml(preset.label)}</strong>
          <span>${escapeHtml(preset.summary)}</span>
        </div>
      `
    );
  const customCards = preferences.customSensitivities.map(
    (entry) => `
      <div class="check-chip check-chip-custom">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(entry.terms.join(", "))}</span>
      </div>
    `
  );
  const cards = presetCards.concat(customCards);

  if (cards.length === 0) {
    currentCheckingContainer.className = "current-checking empty-state";
    currentCheckingContainer.textContent = "No checks configured yet. Add them in Profile.";
    return;
  }

  currentCheckingContainer.className = "current-checking";
  currentCheckingContainer.innerHTML = cards.join("");
}

function createFinding(finding) {
  const item = document.createElement("div");
  item.className = "finding";
  item.innerHTML = `
    <strong>${escapeHtml(finding.ingredient)}</strong>
    <p>Matched <code>${escapeHtml(finding.matchedTerm)}</code>. ${escapeHtml(finding.reason)}</p>
  `;
  return item;
}

function renderResults(analysis) {
  if (!analysis) {
    resultsContainer.className = "results empty-results";
    resultsContainer.textContent = "";
    statusBanner.className = "status-banner";
    statusBanner.textContent = "Scan a product from the dashboard and the flagged result will appear here.";
    return;
  }

  resultsContainer.className = "results";
  resultsContainer.innerHTML = "";

  const productLabel = formatAnalysisLabel(analysis);
  const blockedCount = analysis.results.reduce((sum, entry) => sum + entry.blockedFindings.length, 0);
  const cautionCount = analysis.results.reduce((sum, entry) => sum + entry.cautionFindings.length, 0);

  statusBanner.className = "status-banner active";
  statusBanner.textContent =
    `${productLabel}: ${blockedCount} flagged ingredient match${blockedCount === 1 ? "" : "es"} and ` +
    `${cautionCount} caution match${cautionCount === 1 ? "" : "es"}. ${analysis.disclaimer}`;

  if (analysis.results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Select at least one preset or add a custom sensitivity to produce results.";
    resultsContainer.appendChild(empty);
    return;
  }

  analysis.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = `result-card ${result.status}`;
    card.style.animationDelay = `${index * 80}ms`;

    card.innerHTML = `
      <div class="result-head">
        <div>
          <div class="result-title">${escapeHtml(result.label)}</div>
          <p class="result-summary">${escapeHtml(result.summary)}</p>
        </div>
        <span class="status-pill ${result.status}">${statusLabel(result.status)}</span>
      </div>
    `;

    if (result.blockedFindings.length > 0) {
      const section = document.createElement("section");
      section.className = "finding-group";
      section.innerHTML = "<h3>Flagged matches</h3>";
      const list = document.createElement("div");
      list.className = "finding-list";
      result.blockedFindings.forEach((finding) => list.appendChild(createFinding(finding)));
      section.appendChild(list);
      card.appendChild(section);
    }

    if (result.cautionFindings.length > 0) {
      const section = document.createElement("section");
      section.className = "finding-group";
      section.innerHTML = "<h3>Needs verification</h3>";
      const list = document.createElement("div");
      list.className = "finding-list";
      result.cautionFindings.forEach((finding) => list.appendChild(createFinding(finding)));
      section.appendChild(list);
      card.appendChild(section);
    }

    if (result.blockedFindings.length === 0 && result.cautionFindings.length === 0) {
      const clear = document.createElement("div");
      clear.className = "finding-group";
      clear.innerHTML =
        '<div class="empty-state">No blocked or caution matches were detected for this sensitivity using the current rules.</div>';
      card.appendChild(clear);
    }

    resultsContainer.appendChild(card);
  });
}

function updateDefaultsNote() {
  const preferences = state.currentUser ? sanitizePreferences(state.currentUser.preferences) : { presets: [], customSensitivities: [] };
  const selectedPresets = preferences.presets;
  const labels = state.presets.filter((preset) => selectedPresets.includes(preset.id)).map((preset) => preset.label);
  const customCount = preferences.customSensitivities.length;

  if (labels.length === 0 && customCount === 0) {
    scanDefaultsNote.textContent = "No saved checks yet. Add them in Profile.";
    return;
  }

  const parts = [];

  if (labels.length > 0) {
    parts.push(labels.join(", "));
  }

  if (customCount > 0) {
    parts.push(`${customCount} custom`);
  }

  scanDefaultsNote.textContent = `Current checks: ${parts.join(" + ")}.`;
}

function applyProfileDefaultsToScan() {
  const preferences = state.currentUser ? sanitizePreferences(state.currentUser.preferences) : { presets: [], customSensitivities: [] };

  state.customSensitivities = preferences.customSensitivities;
  renderCustomSensitivities();
  updateDefaultsNote();
  renderCurrentChecking();
}

function hydrateProfileForm() {
  if (!state.currentUser) {
    profileNameInput.value = "";
    profileEmailInput.value = "";
    renderPresetOptions(profilePresetGrid, "profile-preset", []);
    state.customSensitivities = [];
    renderCustomSensitivities();
    updateHomeGreeting();
    renderCurrentChecking();
    return;
  }

  const preferences = sanitizePreferences(state.currentUser.preferences);

  profileNameInput.value = state.currentUser.name || "";
  profileEmailInput.value = state.currentUser.email || "";
  renderPresetOptions(profilePresetGrid, "profile-preset", preferences.presets);
  state.customSensitivities = preferences.customSensitivities;
  renderCustomSensitivities();
  updateHomeGreeting();
  applyProfileDefaultsToScan();
}

function resetScanForm() {
  document.querySelector("#product-name").value = "";
  ingredientsTextInput.value = "";
  state.customSensitivities = [];
  state.lastExtractionSource = null;
  fallbackTools.open = false;
  clearSelectedImage();
  clearBarcodeLookup();
  renderCustomSensitivities();
  applyProfileDefaultsToScan();
}

function selectHistoryAnalysis(analysisId) {
  state.selectedHistoryAnalysisId = analysisId || "";
  const selectedAnalysis = state.analyses.find((analysis) => analysis.id === state.selectedHistoryAnalysisId) || null;

  renderResults(selectedAnalysis);
  updateHistorySelectionStyles();
  resultsContainer.scrollTop = 0;
  const selectedButton = Array.from(historyContainer.querySelectorAll(".history-item")).find(
    (button) => button.dataset.analysisId === state.selectedHistoryAnalysisId
  );

  if (selectedButton) {
    selectedButton.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }
}

function syncSelectedHistoryAnalysis() {
  if (state.analyses.length === 0) {
    state.selectedHistoryAnalysisId = "";
    renderResults(null);
    return;
  }

  const exists = state.analyses.some((analysis) => analysis.id === state.selectedHistoryAnalysisId);

  if (!exists) {
    state.selectedHistoryAnalysisId = state.analyses[0].id;
  }

  selectHistoryAnalysis(state.selectedHistoryAnalysisId);
}

function updateHistorySelectionStyles() {
  Array.from(historyContainer.querySelectorAll(".history-item")).forEach((button) => {
    button.classList.toggle("selected", button.dataset.analysisId === state.selectedHistoryAnalysisId);
  });
}

function renderHistory() {
  if (state.analyses.length === 0) {
    historyContainer.className = "history empty-state";
    historyContainer.textContent = "No saved analyses yet.";
    renderResults(null);
    return;
  }

  historyContainer.className = "history";
  historyContainer.innerHTML = "";

  state.analyses.forEach((analysis) => {
    const fragment = historyItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".history-item");
    const productLabel = formatAnalysisLabel(analysis);
    const blockedCount = analysis.results.reduce((sum, entry) => sum + entry.blockedFindings.length, 0);
    const cautionCount = analysis.results.reduce((sum, entry) => sum + entry.cautionFindings.length, 0);
    const summaryElement = fragment.querySelector(".history-summary");
    button.dataset.analysisId = analysis.id;

    fragment.querySelector(".history-name").textContent = productLabel;
    fragment.querySelector(".history-meta").textContent =
      `${formatDate(analysis.createdAt)} · ${formatSource(analysis.source)}`;
    summaryElement.textContent = blockedCount > 0 ? `${blockedCount} flagged` : cautionCount > 0 ? `${cautionCount} caution` : "Clear";
    summaryElement.className = `history-summary ${blockedCount > 0 ? "flagged" : cautionCount > 0 ? "caution" : "clear"}`;

    button.addEventListener("click", () => {
      selectHistoryAnalysis(analysis.id);
      updateHistorySelectionStyles();
    });

    historyContainer.appendChild(fragment);
  });

  updateHistorySelectionStyles();
}

async function loadHistory() {
  state.analyses = await dataClient.listHistory();
  renderHistory();
  syncSelectedHistoryAnalysis();
}

async function loadRuntimeConfig() {
  const runtimeConfig = await dataClient.getRuntimeConfig();

  state.runtimeConfig = {
    auth: {
      allowedEmailDomain:
        (runtimeConfig &&
          runtimeConfig.auth &&
          typeof runtimeConfig.auth.allowedEmailDomain === "string" &&
          runtimeConfig.auth.allowedEmailDomain.trim()) ||
        "gmail.com"
    },
    integrations: {
      barcodeLookupEnabled: Boolean(
        runtimeConfig && runtimeConfig.integrations && runtimeConfig.integrations.barcodeLookupEnabled
      ),
      barcodeProvider:
        (runtimeConfig &&
          runtimeConfig.integrations &&
          runtimeConfig.integrations.barcodeProvider &&
          String(runtimeConfig.integrations.barcodeProvider).trim()) ||
        "FatSecret"
    }
  };

  updateRuntimeHints();
}

async function loadPresets() {
  state.presets = await dataClient.listPresets();
  renderPresetOptions(registerPresetGrid, "register-preset", []);
  applyProfileDefaultsToScan();
  hydrateProfileForm();
}

function applyAuthenticatedState(authPayload) {
  state.currentUser = authPayload.user;
  state.sessionToken = authPayload.token || state.sessionToken;
  setAuthPreview(null);

  if (!useLocalNativeStorage()) {
    persistWebSessionToken(state.sessionToken);
  }

  showAppScreen();
  hydrateProfileForm();
  resetScanForm();
  setActiveTab("scan", { animate: false });
  setInfoBanner(profileStatus, "Update your default screening preferences here.");
  setInfoBanner(historyStatus, "Tap any saved scan to review what was flagged.");
}

async function handleAuthError(error) {
  if (error && error.status === 401) {
    state.currentUser = null;
    state.analyses = [];
    clearWebSessionToken();

    if (useLocalNativeStorage()) {
      clearNativeSession();
    }

    showAuthScreen();
    setAuthMode("login");
    setInfoBanner(authStatus, "Your session expired. Please log in again.");
    return true;
  }

  return false;
}

async function consumeVerificationFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("verify");

  if (!token) {
    return;
  }

  try {
    const payload = await dataClient.verifyEmail({ token });

    showAuthScreen();
    setAuthMode("login");
    setInfoBanner(authStatus, payload.message || "Email verified. You can now log in.");
  } catch (error) {
    showAuthScreen();
    setAuthMode("login");
    setInfoBanner(authStatus, error.message || "Could not verify that email address.");
  } finally {
    url.searchParams.delete("verify");

    if (!url.searchParams.get("native")) {
      url.searchParams.delete("native");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

function buildAnalysisPayload() {
  const preferences = state.currentUser ? sanitizePreferences(state.currentUser.preferences) : { presets: [], customSensitivities: [] };

  return {
    productName: document.querySelector("#product-name").value,
    ingredientsText: ingredientsTextInput.value.trim(),
    presets: preferences.presets,
    customSensitivities: preferences.customSensitivities,
    source: buildSourcePayload(),
    barcodeLookup: state.activeBarcodeLookup
  };
}

async function runAnalysisAndRefresh(options = {}) {
  const { openHistory = false } = options;
  const ingredientsText = ingredientsTextInput.value.trim();

  if (!ingredientsText && !state.activeBarcodeLookup) {
    throw new Error("Start with a barcode, or use OCR / pasted ingredients as the backup path.");
  }

  const analysis = await dataClient.analyzeAndSave(buildAnalysisPayload());

  await loadHistory();
  selectHistoryAnalysis(analysis.id);
  updateHistorySelectionStyles();
  setInfoBanner(historyStatus, "Saved. Your latest scan is selected below with the flagged result open.");

  if (openHistory) {
    setActiveTab("history");
    selectHistoryAnalysis(analysis.id);
  }

  return analysis;
}

async function lookupBarcodeAndAnalyze() {
  const rawBarcode = normalizeBarcodeText(barcodeInput.value);

  if (!rawBarcode) {
    throw new Error("Enter a barcode or scan one from the camera first.");
  }

  lookupBarcodeButton.disabled = true;
  clearBarcodeButton.disabled = true;
  setBarcodeStatus("Looking up barcode...");

  try {
    const lookup = await dataClient.lookupBarcode(rawBarcode);

    state.activeBarcodeLookup = lookup;
    barcodeInput.value = lookup.barcode || rawBarcode;
    renderBarcodeLookup();
    setBarcodeStatus("Barcode matched. Running analysis with your current preferences.");
    await runAnalysisAndRefresh({ openHistory: true });
  } catch (error) {
    state.activeBarcodeLookup = null;
    renderBarcodeLookup();
    setBarcodeStatus(
      error.message || "Barcode lookup failed. Use OCR or paste ingredients as the backup path.",
      "ocr-status"
    );
    throw error;
  } finally {
    lookupBarcodeButton.disabled = false;
    clearBarcodeButton.disabled = false;
  }
}

showRegisterButton.addEventListener("click", () => {
  setAuthMode("register");
});

showLoginButton.addEventListener("click", () => {
  setAuthMode("login");
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.tab === "scan") {
      setActiveTab("scan");

      if (!state.runtimeConfig.integrations.barcodeLookupEnabled) {
        fallbackTools.open = true;
        setBarcodeStatus("Barcode scan is unavailable here. Use the backup tools below.", "ocr-status");
        return;
      }

      barcodeImageInput.click();
      return;
    }

    setActiveTab(button.dataset.tab);
  });
});

document.querySelector("#add-custom").addEventListener("click", () => {
  const label = customLabelInput.value.trim();
  const terms = customTermsInput.value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

  if (!label || terms.length === 0) {
    return;
  }

  state.customSensitivities.push({ label, terms });
  customLabelInput.value = "";
  customTermsInput.value = "";
  renderCustomSensitivities();
});

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files || [];
  state.selectedImage = file || null;
  state.lastExtractionSource = null;
  renderImagePreview();

  if (state.selectedImage) {
    setOcrStatus(`Selected ${state.selectedImage.name}. Extract text when ready.`);
    return;
  }

  setOcrStatus("No image selected. Barcode lookup is still the primary flow.");
});

barcodeInput.addEventListener("input", () => {
  if (state.activeBarcodeLookup && normalizeBarcodeText(barcodeInput.value) !== state.activeBarcodeLookup.barcode) {
    state.activeBarcodeLookup = null;
    renderBarcodeLookup();
    setBarcodeStatus("Barcode value changed. Run a new lookup when ready.");
  }
});

barcodeImageInput.addEventListener("change", async () => {
  const [file] = barcodeImageInput.files || [];

  if (!file) {
    return;
  }

  lookupBarcodeButton.disabled = true;
  clearBarcodeButton.disabled = true;
  setBarcodeStatus("Detecting barcode from camera image...");

  try {
    const detectedBarcode = await detectBarcodeFromFile(file);
    barcodeInput.value = detectedBarcode;
    setBarcodeStatus(`Detected barcode ${detectedBarcode}. Running lookup now.`);
    await lookupBarcodeAndAnalyze();
  } catch (error) {
    setBarcodeStatus(error.message || "Could not detect a barcode in that image.");
  } finally {
    barcodeImageInput.value = "";
    lookupBarcodeButton.disabled = false;
    clearBarcodeButton.disabled = false;
  }
});

lookupBarcodeButton.addEventListener("click", () => {
  lookupBarcodeAndAnalyze().catch(async (error) => {
    if (!(await handleAuthError(error))) {
      setStatusBanner(error.message || "Barcode lookup failed.");
    }
  });
});

clearBarcodeButton.addEventListener("click", () => {
  clearBarcodeLookup();
  setStatusBanner("Barcode cleared. You can scan another product from the dashboard.");
});

extractButton.addEventListener("click", () => {
  extractTextFromImage().catch((error) => {
    setOcrStatus(error.message || "Could not extract text from the image.");
  });
});

clearImageButton.addEventListener("click", () => {
  clearSelectedImage();
});

newScanButton.addEventListener("click", () => {
  resetScanForm();
  setActiveTab("scan");
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = document.querySelector("#register-submit");

  submitter.disabled = true;
  submitter.textContent = "Creating...";

  try {
    const registerResult = await dataClient.register({
      name: document.querySelector("#register-name").value,
      email: document.querySelector("#register-email").value,
      password: document.querySelector("#register-password").value,
      preferences: {
        presets: getCheckedValues("register-preset"),
        customSensitivities: []
      }
    });

    registerForm.reset();
    renderPresetOptions(registerPresetGrid, "register-preset", []);
    setAuthMode("login");
    setInfoBanner(
      authStatus,
      registerResult.message || "Check your email for a verification link before logging in."
    );
    setAuthPreview(registerResult.previewUrl || null);
  } catch (error) {
    setInfoBanner(authStatus, error.message);
  } finally {
    submitter.disabled = false;
    submitter.textContent = "Create account";
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = document.querySelector("#login-submit");

  submitter.disabled = true;
  submitter.textContent = "Logging in...";

  try {
    const authPayload = await dataClient.login({
      email: document.querySelector("#login-email").value,
      password: document.querySelector("#login-password").value
    });

    applyAuthenticatedState(authPayload);
    await loadHistory();
  } catch (error) {
    if (error.verificationRequired) {
      setAuthPreview(null);
    }
    setInfoBanner(authStatus, error.message);
  } finally {
    submitter.disabled = false;
    submitter.textContent = "Log in";
  }
});

resendVerificationButton.addEventListener("click", async () => {
  resendVerificationButton.disabled = true;
  resendVerificationButton.textContent = "Sending...";

  try {
    const payload = await dataClient.resendVerification({
      email: document.querySelector("#login-email").value
    });

    setInfoBanner(authStatus, payload.message || "Verification email sent.");
    setAuthPreview(payload.previewUrl || null, "Open verification link");
  } catch (error) {
    setInfoBanner(authStatus, error.message || "Could not send the verification email.");
  } finally {
    resendVerificationButton.disabled = false;
    resendVerificationButton.textContent = "Resend verification email";
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = document.querySelector("#save-profile-button");

  submitter.disabled = true;
  submitter.textContent = "Saving...";

  try {
    const payload = await dataClient.updateProfile({
      name: profileNameInput.value,
      preferences: {
        presets: getCheckedValues("profile-preset"),
        customSensitivities: state.customSensitivities
      }
    });

    state.currentUser = payload.user;
    hydrateProfileForm();
    setInfoBanner(profileStatus, "Profile updated. New scans will use your saved defaults.");
  } catch (error) {
    if (!(await handleAuthError(error))) {
      setInfoBanner(profileStatus, error.message);
    }
  } finally {
    submitter.disabled = false;
    submitter.textContent = "Save profile";
  }
});

logoutButton.addEventListener("click", async () => {
  await dataClient.logout();
  state.currentUser = null;
  state.analyses = [];
  state.customSensitivities = [];
  state.selectedHistoryAnalysisId = "";
  clearWebSessionToken();
  clearNativeSession();
  renderHistory();
  renderResults(null);
  showAuthScreen();
  setAuthMode("login");
  setInfoBanner(authStatus, "Logged out. Sign in to continue.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Analyzing...";

  try {
    await runAnalysisAndRefresh({ openHistory: true });
  } catch (error) {
    if (!(await handleAuthError(error))) {
      setStatusBanner(error.message);
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Analyze and save";
  }
});

async function bootstrap() {
  registerServiceWorker();
  renderBarcodeLookup();
  renderCustomSensitivities();
  renderResults(null);
  setAuthMode("register");
  await loadRuntimeConfig();
  await loadPresets();
  await consumeVerificationFromUrl();

  try {
    const session = await dataClient.getSession();

    if (!session) {
      showAuthScreen();
      return;
    }

    applyAuthenticatedState(session);
    await loadHistory();
  } catch (error) {
    clearWebSessionToken();
    clearNativeSession();
    showAuthScreen();
    setInfoBanner(authStatus, "Sign in to load your defaults and previous scans.");
  }
}

bootstrap().catch((error) => {
  setInfoBanner(authStatus, `Failed to load app data: ${error.message}`);
  showAuthScreen();
});
