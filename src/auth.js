const crypto = require("node:crypto");

const { PRESET_SENSITIVITIES } = require("./analyzer");

const PASSWORD_KEY_LENGTH = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_ALLOWED_EMAIL_DOMAIN = "gmail.com";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function getAllowedEmailDomain() {
  return String(process.env.AUTH_ALLOWED_EMAIL_DOMAIN || DEFAULT_ALLOWED_EMAIL_DOMAIN).trim().toLowerCase();
}

function isAllowedRegistrationEmail(email) {
  const normalized = normalizeEmail(email);
  const allowedDomain = getAllowedEmailDomain();

  if (!isValidEmail(normalized)) {
    return false;
  }

  if (!allowedDomain) {
    return true;
  }

  return normalized.endsWith(`@${allowedDomain}`);
}

function sanitizePreferences(preferences) {
  const presetIds = Array.isArray(preferences && preferences.presets)
    ? preferences.presets.filter((id) => Object.prototype.hasOwnProperty.call(PRESET_SENSITIVITIES, id))
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

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, PASSWORD_KEY_LENGTH).toString("hex");

  return {
    salt,
    hash
  };
}

function verifyPassword(password, passwordSalt, passwordHash) {
  const nextHash = crypto.scryptSync(String(password || ""), passwordSalt, PASSWORD_KEY_LENGTH);
  const currentHash = Buffer.from(String(passwordHash || ""), "hex");

  if (currentHash.length !== nextHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(currentHash, nextHash);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashVerificationToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function isUserVerified(user) {
  if (!user) {
    return false;
  }

  if (user.emailVerifiedAt) {
    return true;
  }

  const hasLegacyVerificationFields =
    Object.prototype.hasOwnProperty.call(user, "verificationTokenHash") ||
    Object.prototype.hasOwnProperty.call(user, "verificationExpiresAt");

  return !hasLegacyVerificationFields;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: isUserVerified(user),
    preferences: sanitizePreferences(user.preferences),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

module.exports = {
  createVerificationToken,
  createSessionToken,
  getAllowedEmailDomain,
  hashPassword,
  hashVerificationToken,
  isAllowedRegistrationEmail,
  isUserVerified,
  isValidEmail,
  normalizeEmail,
  sanitizePreferences,
  sanitizeUser,
  verifyPassword
};
