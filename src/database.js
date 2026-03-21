const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "analyses.json");

let writeQueue = Promise.resolve();

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch (error) {
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

async function readAnalyses() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

async function writeAnalyses(analyses) {
  await ensureStore();
  const tempFile = `${DATA_FILE}.tmp`;
  const payload = JSON.stringify(analyses, null, 2);

  await fs.writeFile(tempFile, `${payload}\n`, "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

async function listRecentAnalyses(limit = 20) {
  const analyses = await readAnalyses();
  return analyses
    .slice()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function saveAnalysis(record) {
  writeQueue = writeQueue.then(async () => {
    const analyses = await readAnalyses();
    analyses.push(record);
    await writeAnalyses(analyses);
  });

  return writeQueue.then(() => record);
}

module.exports = {
  ensureStore,
  listRecentAnalyses,
  saveAnalysis
};
