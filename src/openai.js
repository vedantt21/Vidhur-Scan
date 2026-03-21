require("./load-env");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

const IMAGE_PARSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: {
      type: "string",
      description: "Short product name visible on the package, or an empty string if not visible."
    },
    ingredientsText: {
      type: "string",
      description: "A cleaned, comma-separated ingredient list preserving original order and parenthetical groupings."
    },
    notes: {
      type: "string",
      description: "Short note about uncertainty or unreadable sections, or an empty string."
    }
  },
  required: ["productName", "ingredientsText", "notes"]
};

const TEXT_CLEANUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    productName: {
      type: "string",
      description: "Product name if the text clearly contains it, otherwise an empty string."
    },
    ingredientsText: {
      type: "string",
      description: "A cleaned, comma-separated ingredient list preserving original order and parenthetical groupings."
    },
    notes: {
      type: "string",
      description: "Short note about uncertainty or unreadable sections, or an empty string."
    }
  },
  required: ["productName", "ingredientsText", "notes"]
};

function isOpenAIConfigured() {
  return Boolean(OPENAI_API_KEY);
}

function getParserStatus() {
  return {
    openaiConfigured: isOpenAIConfigured(),
    openaiModel: OPENAI_MODEL
  };
}

function extractTextFromResponsePayload(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload?.output)) {
    return "";
  }

  const chunks = [];

  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        chunks.push(contentItem.text);
      }

      if (contentItem?.type === "output_json" && contentItem.json) {
        chunks.push(JSON.stringify(contentItem.json));
      }
    }
  }

  return chunks.join("\n").trim();
}

function stripJsonCodeFences(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sanitizeExtractedIngredients(text) {
  return String(text || "")
    .replace(/^ingredients?\s*[:.-]?\s*/i, "")
    .replace(/\r/g, "")
    .replace(/\n+/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeExtractionResult(result) {
  const parsed = result && typeof result === "object" ? result : {};

  return {
    productName: String(parsed.productName || "").trim(),
    ingredientsText: sanitizeExtractedIngredients(parsed.ingredientsText),
    notes: String(parsed.notes || "").trim()
  };
}

function ensureImageDataUrl(imageDataUrl) {
  const value = String(imageDataUrl || "").trim();

  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)) {
    throw new Error("A base64 image data URL is required.");
  }

  return value;
}

async function createStructuredResponse({ input, schema, schemaName }) {
  if (!isOpenAIConfigured()) {
    throw new Error("OpenAI parsing is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        max_output_tokens: 500,
        input,
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            strict: true,
            schema
          }
        }
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        payload?.error?.message || payload?.message || `OpenAI request failed with status ${response.status}.`;
      throw new Error(message);
    }

    const outputText = extractTextFromResponsePayload(payload);

    if (!outputText) {
      throw new Error("OpenAI returned no structured output.");
    }

    return JSON.parse(stripJsonCodeFences(outputText));
  } finally {
    clearTimeout(timeout);
  }
}

async function parseIngredientsFromImage({ imageDataUrl, fileName = "" }) {
  const safeImageDataUrl = ensureImageDataUrl(imageDataUrl);
  const safeFileName = String(fileName || "").trim();
  const result = await createStructuredResponse({
    schema: IMAGE_PARSE_SCHEMA,
    schemaName: "ingredient_image_extraction",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You extract grocery ingredient lists from package photos. Return only what is visible. Do not invent or infer missing ingredients. Preserve ingredient order, keep parenthetical sub-ingredients grouped, remove nutrition facts and marketing text, and keep unclear text as close to the visible wording as possible."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Extract the product name if visible and the ingredient list from this label image. Return an empty productName if it is not clear."
          },
          {
            type: "input_image",
            image_url: safeImageDataUrl,
            detail: "auto"
          }
        ]
      }
    ]
  });

  return {
    ...normalizeExtractionResult(result),
    source: {
      type: "image_ai",
      fileName: safeFileName || null,
      extractionMethod: "openai.responses",
      model: OPENAI_MODEL
    }
  };
}

async function refineIngredientsText({ rawText = "", productName = "" }) {
  const safeRawText = String(rawText || "").trim();

  if (!safeRawText) {
    throw new Error("Text is required for AI cleanup.");
  }

  const result = await createStructuredResponse({
    schema: TEXT_CLEANUP_SCHEMA,
    schemaName: "ingredient_text_cleanup",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You clean noisy OCR or copied grocery ingredient text into a reliable ingredient list. Do not invent missing ingredients. Preserve order, keep parenthetical sub-ingredients grouped, and remove unrelated packaging or nutrition text."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Known product name: ${String(productName || "").trim() || "(unknown)"}\n\n` +
              `Raw label text:\n${safeRawText}`
          }
        ]
      }
    ]
  });

  return {
    ...normalizeExtractionResult(result),
    source: {
      type: "text_ai_refined",
      extractionMethod: "openai.responses",
      model: OPENAI_MODEL
    }
  };
}

module.exports = {
  isOpenAIConfigured,
  getParserStatus,
  extractTextFromResponsePayload,
  normalizeExtractionResult,
  parseIngredientsFromImage,
  refineIngredientsText
};
