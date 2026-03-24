const crypto = require("node:crypto");

const { PRESET_SENSITIVITIES } = require("./analyzer");

const PASSWORD_KEY_LENGTH = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

function sanitizePreferences(preferences) {
  const presetIds = Array.isArray(preferences && preferences.presets)
    ? preferences.presets.filter((id) => Object.prototype.hasOwnProperty.call(PRESET_SENSITIVITIES, id))
    : [];

  return {
    presets: [...new Set(presetIds)]
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
  hashPassword,
  hashVerificationToken,
  isUserVerified,
  isValidEmail,
  normalizeEmail,
  sanitizePreferences,
  sanitizeUser,
  verifyPassword
};
