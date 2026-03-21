const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const { analyzeIngredients, listPresetSensitivities } = require("./analyzer");
const { ensureStore, listRecentAnalyses, saveAnalysis } = require("./database");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(process.cwd(), "public");

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

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/sensitivities") {
    sendJson(response, 200, { sensitivities: listPresetSensitivities() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/analyses") {
    const analyses = await listRecentAnalyses();
    sendJson(response, 200, { analyses });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/analyze") {
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
