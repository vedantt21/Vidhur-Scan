const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createVerificationToken,
  hashPassword,
  hashVerificationToken,
  isUserVerified,
  isValidEmail,
  normalizeEmail,
  sanitizePreferences,
  verifyPassword
} = require("../src/auth");

test("normalizeEmail trims and lowercases email addresses", () => {
  assert.equal(normalizeEmail("  Example@Email.COM "), "example@email.com");
});

test("isValidEmail rejects malformed addresses", () => {
  assert.equal(isValidEmail("person@example.com"), true);
  assert.equal(isValidEmail("person@example"), false);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("hashPassword and verifyPassword accept the original password", () => {
  const passwordRecord = hashPassword("correct horse battery staple");

  assert.equal(verifyPassword("correct horse battery staple", passwordRecord.salt, passwordRecord.hash), true);
  assert.equal(verifyPassword("wrong password", passwordRecord.salt, passwordRecord.hash), false);
});

test("sanitizePreferences keeps only supported preset ids and removes duplicates", () => {
  assert.deepEqual(
    sanitizePreferences({
      presets: ["vegan", "invalid", "vegan", "halal"]
    }),
    {
      presets: ["vegan", "halal"]
    }
  );
});

test("verification tokens are hashed consistently and users report verified state correctly", () => {
  const token = createVerificationToken();
  const hashed = hashVerificationToken(token);

  assert.equal(typeof hashed, "string");
  assert.notEqual(hashed, token);
  assert.equal(hashVerificationToken(token), hashed);
  assert.equal(isUserVerified({ emailVerifiedAt: new Date().toISOString() }), true);
  assert.equal(isUserVerified({ verificationTokenHash: "x", verificationExpiresAt: "y" }), false);
  assert.equal(isUserVerified({}), true);
});
