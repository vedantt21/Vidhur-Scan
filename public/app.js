const NATIVE_USERS_STORAGE_KEY = "ingredient-screen.users";
const NATIVE_ANALYSES_STORAGE_KEY = "ingredient-screen.analyses";
const NATIVE_SESSION_STORAGE_KEY = "ingredient-screen.session";
const WEB_SESSION_TOKEN_STORAGE_KEY = "ingredient-screen.web-session-token";
const analysisRuntime = window.IngredientAnalysis;

const state = {
  presets: [],
  sessionToken: window.localStorage.getItem(WEB_SESSION_TOKEN_STORAGE_KEY) || "",
  currentUser: null,
  activeTab: "scan",
  customSensitivities: [],
  analyses: [],
  selectedImage: null,
  imagePreviewUrl: "",
  lastExtractionSource: null
};

const authScreen = document.querySelector("#auth-screen");
const appScreen = document.querySelector("#app-screen");
const authStatus = document.querySelector("#auth-status");
const authPreview = document.querySelector("#auth-preview");
const registerForm = document.querySelector("#register-form");
const loginForm = document.querySelector("#login-form");
const resendVerificationButton = document.querySelector("#resend-verification-button");
const registerPresetGrid = document.querySelector("#register-preset-grid");
const scanPresetGrid = document.querySelector("#scan-preset-grid");
const profilePresetGrid = document.querySelector("#profile-preset-grid");
const showRegisterButton = document.querySelector("#show-register-button");
const showLoginButton = document.querySelector("#show-login-button");
const headerKicker = document.querySelector("#header-kicker");
const headerTitle = document.querySelector("#header-title");
const headerSubtitle = document.querySelector("#header-subtitle");
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
const ingredientsTextInput = document.querySelector("#ingredients-text");
const imageInput = document.querySelector("#image-input");
const extractButton = document.querySelector("#extract-button");
const clearImageButton = document.querySelector("#clear-image-button");
const imagePreview = document.querySelector("#image-preview");
const ocrStatus = document.querySelector("#ocr-status");

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

  return {
    presets: [...new Set(presetIds)]
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
  const response = await fetch(url, options);
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
    if (isNativeApp()) {
      const name = String(payload.name || "").trim();
      const email = normalizeEmail(payload.email);
      const password = String(payload.password || "");
      const preferences = sanitizePreferences(payload.preferences);

      if (!name) {
        throw new Error("Name is required.");
      }

      if (!email) {
        throw new Error("Email is required.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Enter a valid email address.");
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
    if (isNativeApp()) {
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
    if (isNativeApp()) {
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
    if (isNativeApp()) {
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
    if (isNativeApp()) {
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
    if (isNativeApp()) {
      clearNativeSession();
      return;
    }

    await fetchJson("/api/auth/logout", {
      method: "POST",
      headers: createAuthHeaders(false)
    }).catch(() => {});
  },

  async updateProfile(payload) {
    if (isNativeApp()) {
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

    if (isNativeApp()) {
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

    if (isNativeApp()) {
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

function formatSource(source) {
  if (!source || !source.type) {
    return "Manual text";
  }

  if (source.type === "image_ocr") {
    return "Image OCR";
  }

  if (source.type === "image_selected") {
    return "Image attached";
  }

  return "Manual text";
}

function setInfoBanner(element, message) {
  element.textContent = message;
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
      ? "Create an account to save your profile and previous scans."
      : "Log in to load your saved screening defaults and scan history."
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
      kicker: "Your archive",
      title: "History",
      subtitle: "Open any previous scan to review the results again."
    },
    scan: {
      kicker: "Ready to scan",
      title: "Scan",
      subtitle: "Use your saved defaults or adjust them for this product."
    },
    profile: {
      kicker: "Your defaults",
      title: "Profile",
      subtitle: "Control the checks that should be ready every time you scan."
    }
  };
  const active = titles[state.activeTab];

  headerKicker.textContent = active.kicker;
  headerTitle.textContent = active.title;
  headerSubtitle.textContent = active.subtitle;
}

function setActiveTab(tab) {
  state.activeTab = tab;
  tabPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.tabPanel !== tab);
  });
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  updateHeader();
}

function setOcrStatus(message) {
  ocrStatus.className = "ocr-status";
  ocrStatus.textContent = message;
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
    setOcrStatus("No image selected. You can still paste ingredients manually below.");
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

function buildSourcePayload() {
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
    customList.textContent = "No custom sensitivities added yet.";
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
    statusBanner.textContent = "Choose sensitivities, paste ingredients, and run an analysis.";
    return;
  }

  resultsContainer.className = "results";
  resultsContainer.innerHTML = "";

  const productLabel = analysis.productName || "Unnamed product";
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
  const selectedPresets = state.currentUser ? sanitizePreferences(state.currentUser.preferences).presets : [];
  const labels = state.presets.filter((preset) => selectedPresets.includes(preset.id)).map((preset) => preset.label);

  if (labels.length === 0) {
    scanDefaultsNote.textContent = "No saved defaults yet. You can still choose sensitivities for each scan.";
    return;
  }

  scanDefaultsNote.textContent = `Saved defaults: ${labels.join(", ")}. They are preselected when you start a new scan.`;
}

function applyProfileDefaultsToScan() {
  const selectedIds = state.currentUser ? sanitizePreferences(state.currentUser.preferences).presets : [];
  renderPresetOptions(scanPresetGrid, "scan-preset", selectedIds);
}

function hydrateProfileForm() {
  if (!state.currentUser) {
    profileNameInput.value = "";
    profileEmailInput.value = "";
    renderPresetOptions(profilePresetGrid, "profile-preset", []);
    return;
  }

  profileNameInput.value = state.currentUser.name || "";
  profileEmailInput.value = state.currentUser.email || "";
  renderPresetOptions(
    profilePresetGrid,
    "profile-preset",
    sanitizePreferences(state.currentUser.preferences).presets
  );
  updateDefaultsNote();
}

function resetScanForm() {
  document.querySelector("#product-name").value = "";
  ingredientsTextInput.value = "";
  state.customSensitivities = [];
  state.lastExtractionSource = null;
  clearSelectedImage();
  renderCustomSensitivities();
  applyProfileDefaultsToScan();
  renderResults(null);
}

function fillFormFromAnalysis(analysis) {
  document.querySelector("#product-name").value = analysis.productName || "";
  ingredientsTextInput.value = analysis.ingredientsText || "";
  renderPresetOptions(scanPresetGrid, "scan-preset", Array.isArray(analysis.presets) ? analysis.presets : []);
  state.customSensitivities = Array.isArray(analysis.customSensitivities) ? analysis.customSensitivities : [];
  clearSelectedImage({ preserveStatus: true, preserveExtractionSource: true });
  state.lastExtractionSource = analysis.source || null;
  setOcrStatus(`Loaded saved analysis from ${formatSource(analysis.source)}.`);
  renderCustomSensitivities();
  renderResults(analysis);
}

function renderHistory() {
  if (state.analyses.length === 0) {
    historyContainer.className = "history empty-state";
    historyContainer.textContent = "No saved analyses yet.";
    return;
  }

  historyContainer.className = "history";
  historyContainer.innerHTML = "";

  state.analyses.forEach((analysis) => {
    const fragment = historyItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".history-item");
    const productLabel = analysis.productName || "Unnamed product";

    fragment.querySelector(".history-name").textContent = productLabel;
    fragment.querySelector(".history-meta").textContent =
      `${formatDate(analysis.createdAt)} · ${formatSource(analysis.source)}`;

    button.addEventListener("click", () => {
      fillFormFromAnalysis(analysis);
      setActiveTab("scan");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    historyContainer.appendChild(fragment);
  });
}

async function loadHistory() {
  state.analyses = await dataClient.listHistory();
  renderHistory();
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

  if (!isNativeApp()) {
    persistWebSessionToken(state.sessionToken);
  }

  showAppScreen();
  hydrateProfileForm();
  resetScanForm();
  setActiveTab("scan");
  setInfoBanner(profileStatus, "Update your default screening preferences here.");
  setInfoBanner(historyStatus, "Tap any saved scan to reload it into the scanner.");
}

async function handleAuthError(error) {
  if (error && error.status === 401) {
    state.currentUser = null;
    state.analyses = [];
    clearWebSessionToken();

    if (isNativeApp()) {
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

showRegisterButton.addEventListener("click", () => {
  setAuthMode("register");
});

showLoginButton.addEventListener("click", () => {
  setAuthMode("login");
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
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

  setOcrStatus("No image selected. You can still paste ingredients manually below.");
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
        presets: getCheckedValues("register-preset")
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
        presets: getCheckedValues("profile-preset")
      }
    });

    state.currentUser = payload.user;
    hydrateProfileForm();
    applyProfileDefaultsToScan();
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
  clearWebSessionToken();
  clearNativeSession();
  renderHistory();
  showAuthScreen();
  setAuthMode("login");
  setInfoBanner(authStatus, "Logged out. Sign in to continue.");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Analyzing...";

  try {
    const ingredientsText = ingredientsTextInput.value.trim();

    if (!ingredientsText) {
      throw new Error("Paste ingredients or extract them from an image first.");
    }

    const analysis = await dataClient.analyzeAndSave({
      productName: document.querySelector("#product-name").value,
      ingredientsText,
      presets: getCheckedValues("scan-preset"),
      customSensitivities: state.customSensitivities,
      source: buildSourcePayload()
    });

    renderResults(analysis);
    await loadHistory();
    setInfoBanner(historyStatus, "Saved. Tap any previous scan to load it again.");
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
  renderCustomSensitivities();
  renderResults(null);
  setAuthMode("register");
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
