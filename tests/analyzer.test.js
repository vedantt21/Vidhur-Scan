const test = require("node:test");
const assert = require("node:assert/strict");

const { analyzeIngredients } = require("../src/analyzer");

test("vegetarian flags gelatin and vegan flags dairy", () => {
  const analysis = analyzeIngredients({
    productName: "Marshmallow candy",
    ingredientsText: "Sugar, Gelatin, Milk solids, Natural Flavor",
    presets: ["vegetarian", "vegan"]
  });

  const vegetarian = analysis.results.find((result) => result.id === "vegetarian");
  const vegan = analysis.results.find((result) => result.id === "vegan");

  assert.equal(vegetarian.status, "not_allowed");
  assert.match(vegetarian.blockedFindings[0].ingredient, /Gelatin/i);

  assert.equal(vegan.status, "not_allowed");
  assert.ok(vegan.blockedFindings.some((finding) => /Milk solids/i.test(finding.ingredient)));
});

test("halal marks ambiguous emulsifiers as caution", () => {
  const analysis = analyzeIngredients({
    ingredientsText: "Potatoes, Seasoning, Emulsifier (E471), Natural Flavour",
    presets: ["halal"]
  });

  const halal = analysis.results.find((result) => result.id === "halal");

  assert.equal(halal.status, "caution");
  assert.ok(halal.cautionFindings.some((finding) => /E471/i.test(finding.ingredient)));
});

test("custom sensitivities use keyword matches", () => {
  const analysis = analyzeIngredients({
    ingredientsText: "Tomatoes, Garlic Powder, Salt",
    customSensitivities: [
      {
        label: "No garlic",
        terms: ["garlic", "onion"]
      }
    ]
  });

  const custom = analysis.results.find((result) => result.id === "custom:No garlic");

  assert.equal(custom.status, "not_allowed");
  assert.equal(custom.blockedFindings[0].matchedTerm, "garlic");
});

test("vegan does not flag common plant milks as dairy", () => {
  const analysis = analyzeIngredients({
    ingredientsText: "Water, Coconut Milk, Oat Milk, Almond Cream",
    presets: ["vegan"]
  });

  const vegan = analysis.results.find((result) => result.id === "vegan");

  assert.equal(vegan.status, "clear");
  assert.equal(vegan.blockedFindings.length, 0);
});

test("halal does not treat sugar alcohol as beverage alcohol", () => {
  const analysis = analyzeIngredients({
    ingredientsText: "Erythritol, Sugar Alcohol, Natural Flavour",
    presets: ["halal"]
  });

  const halal = analysis.results.find((result) => result.id === "halal");

  assert.equal(halal.status, "caution");
  assert.equal(halal.blockedFindings.length, 0);
});

test("ingredient splitting keeps commas inside parentheses together", () => {
  const analysis = analyzeIngredients({
    ingredientsText: "Vegetable Oils (Palm, Canola), Salt, Emulsifier (471, 472)",
    presets: ["vegetarian"]
  });

  assert.deepEqual(analysis.ingredients, [
    "Vegetable Oils (Palm, Canola)",
    "Salt",
    "Emulsifier (471, 472)"
  ]);
});

test("barcode preferences can block vegan results without ingredient text", () => {
  const analysis = analyzeIngredients({
    presets: ["vegan"],
    barcodeLookup: {
      barcode: "0012345678901",
      preferences: [{ name: "Vegan", value: 0 }],
      allergens: []
    }
  });

  const vegan = analysis.results.find((result) => result.id === "vegan");

  assert.equal(vegan.status, "not_allowed");
  assert.ok(vegan.blockedFindings.some((finding) => finding.matchedTerm === "Vegan: no"));
});

test("custom sensitivities become caution when only barcode data is available", () => {
  const analysis = analyzeIngredients({
    customSensitivities: [
      {
        label: "No garlic",
        terms: ["garlic"]
      }
    ],
    barcodeLookup: {
      barcode: "0012345678901",
      preferences: [],
      allergens: []
    }
  });

  const custom = analysis.results.find((result) => result.id === "custom:No garlic");

  assert.equal(custom.status, "caution");
  assert.ok(custom.cautionFindings.some((finding) => /ingredient list unavailable/i.test(finding.matchedTerm)));
});
