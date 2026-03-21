const test = require("node:test");
const assert = require("node:assert/strict");

const { extractTextFromResponsePayload, normalizeExtractionResult } = require("../src/openai");

test("extractTextFromResponsePayload prefers output_text when present", () => {
  const payload = {
    output_text: '{"ingredientsText":"Water, Salt","productName":"","notes":""}',
    output: []
  };

  assert.equal(extractTextFromResponsePayload(payload), payload.output_text);
});

test("extractTextFromResponsePayload collects text content from output items", () => {
  const payload = {
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: '{"ingredientsText":"Water, Salt","productName":"Soup","notes":""}'
          }
        ]
      }
    ]
  };

  assert.equal(
    extractTextFromResponsePayload(payload),
    '{"ingredientsText":"Water, Salt","productName":"Soup","notes":""}'
  );
});

test("normalizeExtractionResult strips ingredient prefixes and whitespace", () => {
  const normalized = normalizeExtractionResult({
    productName: "  Tomato Soup  ",
    ingredientsText: "Ingredients: Water,\n Tomato Paste, Salt",
    notes: "  Slight glare  "
  });

  assert.deepEqual(normalized, {
    productName: "Tomato Soup",
    ingredientsText: "Water, Tomato Paste, Salt",
    notes: "Slight glare"
  });
});
