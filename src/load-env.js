const fs = require("node:fs");
const path = require("node:path");

function stripWrappingQuotes(value) {
  const trimmed = String(value || "").trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function loadEnvFile(filePath = path.join(process.cwd(), ".env")) {
  let raw = "";

  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return;
  }

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1));

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      return;
    }

    process.env[key] = value;
  });
}

loadEnvFile();

module.exports = {
  loadEnvFile
};
