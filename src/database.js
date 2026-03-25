const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "ingredient-screen.sqlite");
const API_USAGE_FILE = path.join(DATA_DIR, "api-usage.toml");
const LEGACY_ANALYSES_FILE = path.join(DATA_DIR, "analyses.json");
const LEGACY_USERS_FILE = path.join(DATA_DIR, "users.json");
const LEGACY_SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const SQLITE_BUFFER_BYTES = 10 * 1024 * 1024;

let writeQueue = Promise.resolve();
let ensureStorePromise = null;

function sqlQuote(value) {
  if (value == null) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonText(value, fallback) {
  const target = value == null ? fallback : value;
  return JSON.stringify(target);
}

function escapeTomlString(value) {
  return `"${String(value == null ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/"/g, '\\"')}"`;
}

function buildSqlScript(sql) {
  return `PRAGMA foreign_keys=ON;\n${sql}`;
}

async function executeSqlRaw(sql, options = {}) {
  const args = [];

  if (options.json) {
    args.push("-json");
  }

  args.push(DB_FILE, buildSqlScript(sql));

  const { stdout } = await execFileAsync("sqlite3", args, {
    maxBuffer: SQLITE_BUFFER_BYTES
  });

  if (!options.json) {
    return stdout;
  }

  const trimmed = stdout.trim();
  return trimmed ? JSON.parse(trimmed) : [];
}

async function queryRowsRaw(sql) {
  return executeSqlRaw(sql, { json: true });
}

async function runWriteRaw(sql) {
  await executeSqlRaw(sql);
}

async function queryRows(sql) {
  await ensureStore();
  return queryRowsRaw(sql);
}

function enqueueWrite(task) {
  writeQueue = writeQueue.then(async () => {
    await ensureStore();
    return task();
  });

  return writeQueue;
}

async function ensureStore() {
  if (!ensureStorePromise) {
    ensureStorePromise = initializeStore();
  }

  return ensureStorePromise;
}

async function initializeStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  await runWriteRaw(`
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified_at TEXT,
      verification_token_hash TEXT,
      verification_expires_at TEXT,
      preferences_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      product_name TEXT,
      ingredients_text TEXT NOT NULL,
      ingredients_json TEXT NOT NULL,
      presets_json TEXT NOT NULL,
      custom_sensitivities_json TEXT NOT NULL,
      source_json TEXT,
      results_json TEXT NOT NULL,
      disclaimer TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_user_id_created_at ON analyses(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS api_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      status TEXT NOT NULL,
      http_status INTEGER,
      scope TEXT,
      barcode TEXT,
      food_id TEXT,
      user_id TEXT,
      request_key TEXT,
      duration_ms INTEGER,
      response_summary TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at ON api_call_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_call_logs_endpoint ON api_call_logs(endpoint);
  `);

  await migrateLegacyJsonIfNeeded();
  await syncApiUsageTomlRaw();
}

async function readLegacyArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function countRowsRaw(tableName) {
  const rows = await queryRowsRaw(`SELECT COUNT(*) AS count FROM ${tableName};`);
  return Number(rows[0] && rows[0].count ? rows[0].count : 0);
}

function buildUserUpsertSql(user) {
  return `
    INSERT INTO users (
      id,
      name,
      email,
      password_salt,
      password_hash,
      email_verified_at,
      verification_token_hash,
      verification_expires_at,
      preferences_json,
      created_at,
      updated_at
    ) VALUES (
      ${sqlQuote(user.id)},
      ${sqlQuote(user.name)},
      ${sqlQuote(user.email)},
      ${sqlQuote(user.passwordSalt)},
      ${sqlQuote(user.passwordHash)},
      ${sqlQuote(user.emailVerifiedAt)},
      ${sqlQuote(user.verificationTokenHash)},
      ${sqlQuote(user.verificationExpiresAt)},
      ${sqlQuote(jsonText(user.preferences, { presets: [] }))},
      ${sqlQuote(user.createdAt)},
      ${sqlQuote(user.updatedAt)}
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      password_salt = excluded.password_salt,
      password_hash = excluded.password_hash,
      email_verified_at = excluded.email_verified_at,
      verification_token_hash = excluded.verification_token_hash,
      verification_expires_at = excluded.verification_expires_at,
      preferences_json = excluded.preferences_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;
  `;
}

function buildSessionUpsertSql(session) {
  return `
    INSERT INTO sessions (
      token,
      user_id,
      created_at
    ) VALUES (
      ${sqlQuote(session.token)},
      ${sqlQuote(session.userId)},
      ${sqlQuote(session.createdAt)}
    )
    ON CONFLICT(token) DO UPDATE SET
      user_id = excluded.user_id,
      created_at = excluded.created_at;
  `;
}

function buildAnalysisUpsertSql(analysis) {
  return `
    INSERT INTO analyses (
      id,
      user_id,
      product_name,
      ingredients_text,
      ingredients_json,
      presets_json,
      custom_sensitivities_json,
      source_json,
      results_json,
      disclaimer,
      created_at
    ) VALUES (
      ${sqlQuote(analysis.id)},
      ${sqlQuote(analysis.userId)},
      ${sqlQuote(analysis.productName || null)},
      ${sqlQuote(analysis.ingredientsText || "")},
      ${sqlQuote(jsonText(analysis.ingredients, []))},
      ${sqlQuote(jsonText(analysis.presets, []))},
      ${sqlQuote(jsonText(analysis.customSensitivities, []))},
      ${sqlQuote(analysis.source ? jsonText(analysis.source, null) : null)},
      ${sqlQuote(jsonText(analysis.results, []))},
      ${sqlQuote(analysis.disclaimer || "")},
      ${sqlQuote(analysis.createdAt)}
    )
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      product_name = excluded.product_name,
      ingredients_text = excluded.ingredients_text,
      ingredients_json = excluded.ingredients_json,
      presets_json = excluded.presets_json,
      custom_sensitivities_json = excluded.custom_sensitivities_json,
      source_json = excluded.source_json,
      results_json = excluded.results_json,
      disclaimer = excluded.disclaimer,
      created_at = excluded.created_at;
  `;
}

async function migrateLegacyJsonIfNeeded() {
  const [userCount, sessionCount, analysisCount] = await Promise.all([
    countRowsRaw("users"),
    countRowsRaw("sessions"),
    countRowsRaw("analyses")
  ]);

  const scripts = [];

  if (userCount === 0) {
    const users = await readLegacyArray(LEGACY_USERS_FILE);

    if (users.length > 0) {
      scripts.push(...users.map(buildUserUpsertSql));
    }
  }

  if (sessionCount === 0) {
    const sessions = await readLegacyArray(LEGACY_SESSIONS_FILE);

    if (sessions.length > 0) {
      scripts.push(...sessions.map(buildSessionUpsertSql));
    }
  }

  if (analysisCount === 0) {
    const analyses = await readLegacyArray(LEGACY_ANALYSES_FILE);

    if (analyses.length > 0) {
      scripts.push(...analyses.map(buildAnalysisUpsertSql));
    }
  }

  if (scripts.length === 0) {
    return;
  }

  await runWriteRaw(`BEGIN IMMEDIATE TRANSACTION;\n${scripts.join("\n")}\nCOMMIT;`);
}

function parseJsonValue(value, fallback) {
  if (value == null || value === "") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    return fallback;
  }
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    preferences: parseJsonValue(row.preferences_json, { presets: [] }),
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at,
    verificationTokenHash: row.verification_token_hash,
    verificationExpiresAt: row.verification_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSessionRow(row) {
  if (!row) {
    return null;
  }

  return {
    token: row.token,
    userId: row.user_id,
    createdAt: row.created_at
  };
}

function mapAnalysisRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    productName: row.product_name || "",
    ingredientsText: row.ingredients_text || "",
    ingredients: parseJsonValue(row.ingredients_json, []),
    presets: parseJsonValue(row.presets_json, []),
    customSensitivities: parseJsonValue(row.custom_sensitivities_json, []),
    source: parseJsonValue(row.source_json, null),
    results: parseJsonValue(row.results_json, []),
    disclaimer: row.disclaimer || "",
    createdAt: row.created_at
  };
}

async function listRecentAnalyses(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const rows = await queryRows(`
    SELECT *
    FROM analyses
    WHERE user_id = ${sqlQuote(userId)}
    ORDER BY datetime(created_at) DESC
    LIMIT ${safeLimit};
  `);

  return rows.map(mapAnalysisRow);
}

function saveAnalysis(record) {
  return enqueueWrite(async () => {
    await runWriteRaw(buildAnalysisUpsertSql(record));
    return record;
  });
}

async function findUserByEmail(email) {
  const rows = await queryRows(`
    SELECT *
    FROM users
    WHERE email = ${sqlQuote(email)}
    LIMIT 1;
  `);

  return mapUserRow(rows[0]);
}

async function findUserById(userId) {
  const rows = await queryRows(`
    SELECT *
    FROM users
    WHERE id = ${sqlQuote(userId)}
    LIMIT 1;
  `);

  return mapUserRow(rows[0]);
}

async function findUserByVerificationTokenHash(verificationTokenHash) {
  const rows = await queryRows(`
    SELECT *
    FROM users
    WHERE verification_token_hash = ${sqlQuote(verificationTokenHash)}
    LIMIT 1;
  `);

  return mapUserRow(rows[0]);
}

function createUser(record) {
  return enqueueWrite(async () => {
    await runWriteRaw(buildUserUpsertSql(record));
    return record;
  });
}

function updateUser(userId, updater) {
  return enqueueWrite(async () => {
    const rows = await queryRowsRaw(`
      SELECT *
      FROM users
      WHERE id = ${sqlQuote(userId)}
      LIMIT 1;
    `);
    const currentUser = mapUserRow(rows[0]);

    if (!currentUser) {
      return null;
    }

    const nextUser = updater(currentUser);

    if (!nextUser) {
      return null;
    }

    await runWriteRaw(buildUserUpsertSql(nextUser));
    return nextUser;
  });
}

function createSession(record) {
  return enqueueWrite(async () => {
    await runWriteRaw(buildSessionUpsertSql(record));
    return record;
  });
}

async function findSessionByToken(token) {
  const rows = await queryRows(`
    SELECT *
    FROM sessions
    WHERE token = ${sqlQuote(token)}
    LIMIT 1;
  `);

  return mapSessionRow(rows[0]);
}

function deleteSession(token) {
  return enqueueWrite(async () => {
    await runWriteRaw(`
      DELETE FROM sessions
      WHERE token = ${sqlQuote(token)};
    `);
  });
}

function renderApiUsageToml({ totals, endpointCounts, recentCalls, generatedAt }) {
  const lines = [
    `generated_at = ${escapeTomlString(generatedAt)}`,
    `database = ${escapeTomlString(DB_FILE)}`,
    `report = ${escapeTomlString(API_USAGE_FILE)}`,
    `total_calls = ${Number(totals.totalCalls || 0)}`,
    `success_calls = ${Number(totals.successCalls || 0)}`,
    `error_calls = ${Number(totals.errorCalls || 0)}`,
    ""
  ];

  endpointCounts.forEach((entry) => {
    lines.push("[[endpoints]]");
    lines.push(`name = ${escapeTomlString(entry.endpoint)}`);
    lines.push(`count = ${Number(entry.count || 0)}`);
    lines.push("");
  });

  recentCalls.forEach((entry) => {
    lines.push("[[recent]]");
    lines.push(`id = ${Number(entry.id || 0)}`);
    lines.push(`provider = ${escapeTomlString(entry.provider)}`);
    lines.push(`endpoint = ${escapeTomlString(entry.endpoint)}`);
    lines.push(`status = ${escapeTomlString(entry.status)}`);
    lines.push(`http_status = ${Number(entry.http_status || 0)}`);
    lines.push(`scope = ${escapeTomlString(entry.scope || "")}`);
    lines.push(`barcode = ${escapeTomlString(entry.barcode || "")}`);
    lines.push(`food_id = ${escapeTomlString(entry.food_id || "")}`);
    lines.push(`request_key = ${escapeTomlString(entry.request_key || "")}`);
    lines.push(`duration_ms = ${Number(entry.duration_ms || 0)}`);
    lines.push(`created_at = ${escapeTomlString(entry.created_at)}`);
    lines.push(`response_summary = ${escapeTomlString(entry.response_summary || "")}`);
    lines.push("");
  });

  return `${lines.join("\n").trimEnd()}\n`;
}

async function syncApiUsageTomlRaw() {
  const [totalsRow] = await queryRowsRaw(`
    SELECT
      COUNT(*) AS totalCalls,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successCalls,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errorCalls
    FROM api_call_logs;
  `);
  const endpointCounts = await queryRowsRaw(`
    SELECT endpoint, COUNT(*) AS count
    FROM api_call_logs
    GROUP BY endpoint
    ORDER BY count DESC, endpoint ASC;
  `);
  const recentCalls = await queryRowsRaw(`
    SELECT
      id,
      provider,
      endpoint,
      status,
      http_status,
      scope,
      barcode,
      food_id,
      request_key,
      duration_ms,
      created_at,
      response_summary
    FROM api_call_logs
    ORDER BY id DESC
    LIMIT 25;
  `);
  const payload = renderApiUsageToml({
    totals: totalsRow || {},
    endpointCounts,
    recentCalls,
    generatedAt: new Date().toISOString()
  });

  await fs.writeFile(API_USAGE_FILE, payload, "utf8");
}

function logApiCall(entry) {
  return enqueueWrite(async () => {
    await runWriteRaw(`
      INSERT INTO api_call_logs (
        provider,
        endpoint,
        status,
        http_status,
        scope,
        barcode,
        food_id,
        user_id,
        request_key,
        duration_ms,
        response_summary,
        created_at
      ) VALUES (
        ${sqlQuote(entry.provider)},
        ${sqlQuote(entry.endpoint)},
        ${sqlQuote(entry.status)},
        ${entry.httpStatus == null ? "NULL" : Number(entry.httpStatus)},
        ${sqlQuote(entry.scope || null)},
        ${sqlQuote(entry.barcode || null)},
        ${sqlQuote(entry.foodId || null)},
        ${sqlQuote(entry.userId || null)},
        ${sqlQuote(entry.requestKey || null)},
        ${entry.durationMs == null ? "NULL" : Number(entry.durationMs)},
        ${sqlQuote(entry.responseSummary || null)},
        ${sqlQuote(entry.createdAt || new Date().toISOString())}
      );
    `);
    await syncApiUsageTomlRaw();
  });
}

module.exports = {
  createSession,
  createUser,
  deleteSession,
  ensureStore,
  findSessionByToken,
  findUserByEmail,
  findUserById,
  findUserByVerificationTokenHash,
  listRecentAnalyses,
  logApiCall,
  saveAnalysis,
  updateUser
};
