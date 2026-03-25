const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeBarcode } = require("../src/fatsecret");

test("normalizeBarcode pads UPC-A and EAN-8 values to GTIN-13", () => {
  assert.equal(normalizeBarcode("012345678905"), "0012345678905");
  assert.equal(normalizeBarcode("55123457"), "0000055123457");
  assert.equal(normalizeBarcode("0012345678905"), "0012345678905");
});

test("normalizeBarcode rejects unsupported lengths", () => {
  assert.throws(() => normalizeBarcode("12345"), /barcode/i);
});
