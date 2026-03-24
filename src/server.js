const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { analyzeIngredients, listPresetSensitivities } = require("./analyzer");
const {
  createSession,
  createUser,
  deleteSession,
  ensureStore,
  findSessionByToken,
  findUserByEmail,
  findUserById,
  findUserByVerificationTokenHash,
  listRecentAnalyses,
  saveAnalysis,
  updateUser
} = require("./database");
const {
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
} = require("./auth");
const { sendVerificationEmail } = require("./mailer");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(process.cwd(), "public");
const VERIFICATION_WINDOW_MS = 1000 * 60 * 60 * 24;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;

    if (total > 1_000_000) {
      throw new Error("Request body too large.");
    }

    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

async function serveStaticFile(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream"
    });
    response.end(file);
  } catch (error) {
    sendJson(response, 404, { error: "Not found." });
  }
}

function getPublicOrigin(request) {
  const configuredOrigin = String(process.env.APP_ORIGIN || "").trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || "http";
  const host = request.headers.host || `${HOST}:${PORT}`;

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function createVerificationState() {
  const token = createVerificationToken();

  return {
    rawToken: token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(Date.now() + VERIFICATION_WINDOW_MS).toISOString()
  };
}

async function issueVerificationEmail(request, user) {
  const verificationState = createVerificationState();
  const updatedUser = await updateUser(user.id, (currentUser) => ({
    ...currentUser,
    verificationTokenHash: verificationState.tokenHash,
    verificationExpiresAt: verificationState.expiresAt,
    updatedAt: new Date().toISOString()
  }));
  const verificationUrl = `${getPublicOrigin(request)}/?verify=${verificationState.rawToken}`;
  const delivery = await sendVerificationEmail({
    email: updatedUser.email,
    name: updatedUser.name,
    verificationUrl
  });

  return {
    user: updatedUser,
    delivery
  };
}

function getBearerToken(request) {
  const header = request.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return "";
  }

  return header.slice("Bearer ".length).trim();
}

async function requireUser(request, response) {
  const token = getBearerToken(request);

  if (!token) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }

  const session = await findSessionByToken(token);

  if (!session) {
    sendJson(response, 401, { error: "Session expired. Please sign in again." });
    return null;
  }

  const user = await findUserById(session.userId);

  if (!user) {
    sendJson(response, 401, { error: "User account not found." });
    return null;
  }

  return {
    token,
    user
  };
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/sensitivities") {
    sendJson(response, 200, { sensitivities: listPresetSensitivities() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    const name = String(body.name || "").trim();
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const preferences = sanitizePreferences(body.preferences);

    if (!name) {
      sendJson(response, 400, { error: "Name is required." });
      return;
    }

    if (!email) {
      sendJson(response, 400, { error: "Email is required." });
      return;
    }

    if (!isValidEmail(email)) {
      sendJson(response, 400, { error: "Enter a valid email address." });
      return;
    }

    if (password.length < 6) {
      sendJson(response, 400, { error: "Password must be at least 6 characters." });
      return;
    }

    const existingUser = await findUserByEmail(email);

    if (existingUser && isUserVerified(existingUser)) {
      sendJson(response, 409, { error: "An account with that email already exists." });
      return;
    }

    const now = new Date().toISOString();
    const passwordRecord = hashPassword(password);
    let user;

    if (existingUser) {
      user = await updateUser(existingUser.id, (currentUser) => ({
        ...currentUser,
        name,
        preferences,
        passwordSalt: passwordRecord.salt,
        passwordHash: passwordRecord.hash,
        updatedAt: now
      }));
    } else {
      user = {
        id: crypto.randomUUID(),
        name,
        email,
        preferences,
        passwordSalt: passwordRecord.salt,
        passwordHash: passwordRecord.hash,
        emailVerifiedAt: null,
        verificationTokenHash: null,
        verificationExpiresAt: null,
        createdAt: now,
        updatedAt: now
      };

      await createUser(user);
    }

    try {
      const verification = await issueVerificationEmail(request, user);

      sendJson(response, existingUser ? 200 : 201, {
        requiresVerification: true,
        message: "Check your email for a verification link before logging in.",
        delivery: verification.delivery.delivery,
        previewUrl: verification.delivery.previewUrl
      });
    } catch (error) {
      sendJson(response, 500, {
        requiresVerification: true,
        error: "Your account was created, but the verification email could not be sent. Try again shortly."
      });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/resend-verification") {
    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      sendJson(response, 400, { error: "Enter a valid email address." });
      return;
    }

    const user = await findUserByEmail(email);

    if (!user || isUserVerified(user)) {
      sendJson(response, 200, {
        ok: true,
        message: "If that account exists and still needs verification, a new email has been sent."
      });
      return;
    }

    try {
      const verification = await issueVerificationEmail(request, user);

      sendJson(response, 200, {
        ok: true,
        message: "Verification email sent.",
        delivery: verification.delivery.delivery,
        previewUrl: verification.delivery.previewUrl
      });
    } catch (error) {
      sendJson(response, 500, { error: "Could not send the verification email. Try again shortly." });
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/verify-email") {
    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    const rawToken = String(body.token || "").trim();

    if (!rawToken) {
      sendJson(response, 400, { error: "Verification token is required." });
      return;
    }

    const verificationTokenHash = hashVerificationToken(rawToken);
    const user = await findUserByVerificationTokenHash(verificationTokenHash);

    if (!user) {
      sendJson(response, 400, { error: "That verification link is invalid or has already been used." });
      return;
    }

    if (!user.verificationExpiresAt || new Date(user.verificationExpiresAt).getTime() < Date.now()) {
      sendJson(response, 400, { error: "That verification link has expired. Request a new one." });
      return;
    }

    await updateUser(user.id, (currentUser) => ({
      ...currentUser,
      emailVerifiedAt: new Date().toISOString(),
      verificationTokenHash: null,
      verificationExpiresAt: null,
      updatedAt: new Date().toISOString()
    }));

    sendJson(response, 200, {
      verified: true,
      message: "Email verified. You can now log in."
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const user = await findUserByEmail(email);

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return;
    }

    if (!isUserVerified(user)) {
      sendJson(response, 403, {
        error: "Verify your email before logging in.",
        verificationRequired: true
      });
      return;
    }

    const session = {
      token: createSessionToken(),
      userId: user.id,
      createdAt: new Date().toISOString()
    };

    await createSession(session);
    sendJson(response, 200, { token: session.token, user: sanitizeUser(user) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/session") {
    const auth = await requireUser(request, response);

    if (!auth) {
      return;
    }

    sendJson(response, 200, { user: sanitizeUser(auth.user) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = getBearerToken(request);

    if (token) {
      await deleteSession(token);
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "PUT" && url.pathname === "/api/profile") {
    const auth = await requireUser(request, response);

    if (!auth) {
      return;
    }

    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    const nextName = String(body.name || "").trim();
    const nextPreferences = sanitizePreferences(body.preferences);

    if (!nextName) {
      sendJson(response, 400, { error: "Name is required." });
      return;
    }

    const updatedUser = await updateUser(auth.user.id, (currentUser) => ({
      ...currentUser,
      name: nextName,
      preferences: nextPreferences,
      updatedAt: new Date().toISOString()
    }));

    sendJson(response, 200, { user: sanitizeUser(updatedUser) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/analyses") {
    const auth = await requireUser(request, response);

    if (!auth) {
      return;
    }

    const analyses = await listRecentAnalyses(auth.user.id);
    sendJson(response, 200, { analyses });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/analyze") {
    const auth = await requireUser(request, response);

    if (!auth) {
      return;
    }

    let body;

    try {
      body = await readRequestBody(request);
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON payload." });
      return;
    }

    if (!body.ingredientsText || !String(body.ingredientsText).trim()) {
      sendJson(response, 400, { error: "Ingredients text is required." });
      return;
    }

    const analysis = analyzeIngredients(body);
    const record = {
      id: crypto.randomUUID(),
      userId: auth.user.id,
      createdAt: new Date().toISOString(),
      ...analysis
    };

    await saveAnalysis(record);
    sendJson(response, 201, { analysis: record });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

async function startServer() {
  await ensureStore();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    try {
      if (url.pathname.startsWith("/api/")) {
        await handleApi(request, response, url);
        return;
      }

      await serveStaticFile(url.pathname, response);
    } catch (error) {
      sendJson(response, 500, { error: "Internal server error." });
    }
  });

  server.on("error", (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });

  server.listen(PORT, HOST, () => {
    process.stdout.write(`Ingredient screen running at http://${HOST}:${PORT}\n`);
  });
}

startServer();
