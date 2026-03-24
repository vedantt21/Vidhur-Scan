const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.join(process.cwd(), "data");
const ANALYSES_FILE = path.join(DATA_DIR, "analyses.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  await Promise.all([ensureJsonFile(ANALYSES_FILE), ensureJsonFile(USERS_FILE), ensureJsonFile(SESSIONS_FILE)]);
}

async function ensureJsonFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, "[]\n", "utf8");
  }
}

async function readJsonFile(filePath) {
  await ensureStore();
  const raw = await fs.readFile(filePath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeJsonFile(filePath, records) {
  await ensureStore();
  const tempFile = `${filePath}.tmp`;
  const payload = JSON.stringify(records, null, 2);

  await fs.writeFile(tempFile, `${payload}\n`, "utf8");
  await fs.rename(tempFile, filePath);
}

async function readAnalyses() {
  return readJsonFile(ANALYSES_FILE);
}

async function readUsers() {
  return readJsonFile(USERS_FILE);
}

async function readSessions() {
  return readJsonFile(SESSIONS_FILE);
}

async function listRecentAnalyses(userId, limit = 20) {
  const analyses = await readAnalyses();
  return analyses
    .filter((analysis) => analysis.userId === userId)
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function saveAnalysis(record) {
  writeQueue = writeQueue.then(async () => {
    const analyses = await readAnalyses();
    analyses.push(record);
    await writeJsonFile(ANALYSES_FILE, analyses);
  });

  return writeQueue.then(() => record);
}

async function findUserByEmail(email) {
  const users = await readUsers();
  return users.find((user) => user.email === email) || null;
}

async function findUserById(userId) {
  const users = await readUsers();
  return users.find((user) => user.id === userId) || null;
}

async function findUserByVerificationTokenHash(verificationTokenHash) {
  const users = await readUsers();
  return users.find((user) => user.verificationTokenHash === verificationTokenHash) || null;
}

function createUser(record) {
  writeQueue = writeQueue.then(async () => {
    const users = await readUsers();
    users.push(record);
    await writeJsonFile(USERS_FILE, users);
  });

  return writeQueue.then(() => record);
}

function updateUser(userId, updater) {
  writeQueue = writeQueue.then(async () => {
    const users = await readUsers();
    const index = users.findIndex((user) => user.id === userId);

    if (index === -1) {
      return null;
    }

    const nextUser = updater(users[index]);

    if (!nextUser) {
      return null;
    }

    users[index] = nextUser;
    await writeJsonFile(USERS_FILE, users);
    return nextUser;
  });

  return writeQueue;
}

function createSession(record) {
  writeQueue = writeQueue.then(async () => {
    const sessions = await readSessions();
    sessions.push(record);
    await writeJsonFile(SESSIONS_FILE, sessions);
  });

  return writeQueue.then(() => record);
}

async function findSessionByToken(token) {
  const sessions = await readSessions();
  return sessions.find((session) => session.token === token) || null;
}

function deleteSession(token) {
  writeQueue = writeQueue.then(async () => {
    const sessions = await readSessions();
    const filtered = sessions.filter((session) => session.token !== token);
    await writeJsonFile(SESSIONS_FILE, filtered);
  });

  return writeQueue;
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
  saveAnalysis,
  updateUser
};
