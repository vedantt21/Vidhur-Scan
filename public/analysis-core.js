(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.IngredientAnalysis = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PRESET_SENSITIVITIES = {
    vegetarian: {
      id: "vegetarian",
      label: "Vegetarian",
      summary: "Flags meat, fish, insect-derived colorings, and animal-derived additives.",
      blocked: [
        {
          terms: ["gelatin"],
          reason: "Usually derived from animal collagen."
        },
        {
          terms: ["rennet", "animal rennet"],
          reason: "Traditional rennet is animal-derived."
        },
        {
          terms: ["lard", "tallow", "suet", "beef fat", "chicken fat"],
          reason: "Rendered animal fat is not vegetarian."
        },
        {
          terms: [
            "anchovy",
            "anchovies",
            "fish sauce",
            "oyster sauce",
            "shrimp",
            "prawn",
            "chicken",
            "beef",
            "pork",
            "lamb",
            "duck",
            "turkey",
            "meat stock",
            "bone broth"
          ],
          reason: "Contains meat or seafood."
        },
        {
          terms: ["carmine", "cochineal"],
          reason: "Red coloring made from insects."
        },
        {
          terms: ["shellac", "confectioner's glaze"],
          reason: "Coating derived from lac insects."
        }
      ],
      caution: [
        {
          terms: [
            "mono and diglycerides",
            "mono- and diglycerides",
            "monoglycerides",
            "diglycerides",
            "e471",
            "e472"
          ],
          reason: "Emulsifiers can be plant- or animal-derived."
        },
        {
          terms: ["glycerin", "glycerine"],
          reason: "Can be sourced from plants or animals."
        },
        {
          terms: ["natural flavor", "natural flavour", "natural flavours", "natural flavoring", "natural flavouring"],
          reason: "The source is often undisclosed."
        },
        {
          terms: ["enzymes"],
          reason: "Can come from microbial or animal sources."
        },
        {
          terms: ["vitamin d3", "cholecalciferol"],
          reason: "Often sourced from lanolin."
        }
      ]
    },
    vegan: {
      id: "vegan",
      label: "Vegan",
      summary: "Flags all animal-derived ingredients, including dairy, eggs, and honey.",
      blocked: [
        {
          terms: ["milk", "skim milk", "whole milk", "milk solids", "milk powder", "butter", "cream", "ghee"],
          excludeTerms: [
            "almond milk",
            "cashew milk",
            "coconut milk",
            "hazelnut milk",
            "macadamia milk",
            "oat milk",
            "pea milk",
            "rice milk",
            "soy milk",
            "almond cream",
            "coconut cream",
            "oat cream",
            "soy cream",
            "cream of tartar"
          ],
          reason: "Dairy is animal-derived."
        },
        {
          terms: ["cheese", "whey", "casein", "caseinate", "lactose", "yogurt", "yoghurt"],
          reason: "Dairy-derived ingredient."
        },
        {
          terms: ["egg", "eggs", "egg white", "egg yolk", "albumen"],
          reason: "Egg is animal-derived."
        },
        {
          terms: ["honey", "beeswax", "propolis", "royal jelly"],
          reason: "Bee-derived ingredient."
        },
        {
          terms: ["gelatin", "collagen"],
          reason: "Animal-derived protein."
        },
        {
          terms: ["rennet", "animal rennet", "lanolin", "shellac", "confectioner's glaze", "carmine", "cochineal"],
          reason: "Animal- or insect-derived additive."
        },
        {
          terms: [
            "anchovy",
            "anchovies",
            "fish sauce",
            "oyster sauce",
            "shrimp",
            "prawn",
            "chicken",
            "beef",
            "pork",
            "lamb",
            "duck",
            "turkey"
          ],
          reason: "Contains meat or seafood."
        }
      ],
      caution: [
        {
          terms: [
            "mono and diglycerides",
            "mono- and diglycerides",
            "monoglycerides",
            "diglycerides",
            "e471",
            "e472"
          ],
          reason: "Can be made from plant or animal fats."
        },
        {
          terms: ["glycerin", "glycerine"],
          reason: "May be plant- or animal-derived."
        },
        {
          terms: ["lecithin"],
          reason: "Often soy-based, but can also come from egg."
        },
        {
          terms: ["natural flavor", "natural flavour", "natural flavours", "natural flavoring", "natural flavouring"],
          reason: "The source may not be disclosed."
        },
        {
          terms: ["enzymes", "vitamin d3", "cholecalciferol"],
          reason: "Source may be animal-derived."
        }
      ]
    },
    halal: {
      id: "halal",
      label: "Halal",
      summary: "Flags pork, alcohol, and ingredients that usually need certification or source verification.",
      blocked: [
        {
          terms: ["pork", "ham", "bacon", "lard", "porcine", "pepperoni", "salami"],
          reason: "Pork-derived ingredients are not halal."
        },
        {
          terms: ["beer", "wine", "rum", "vodka", "brandy", "bourbon", "liqueur", "alcohol"],
          excludeTerms: ["sugar alcohol", "sugar alcohols"],
          reason: "Alcoholic ingredients are generally not halal."
        },
        {
          terms: ["blood"],
          reason: "Blood-derived ingredients are not halal."
        }
      ],
      caution: [
        {
          terms: ["gelatin", "collagen"],
          reason: "Can be halal only if sourced and processed compliantly."
        },
        {
          terms: ["rennet", "enzymes"],
          reason: "Need source verification or halal certification."
        },
        {
          terms: [
            "mono and diglycerides",
            "mono- and diglycerides",
            "monoglycerides",
            "diglycerides",
            "e471",
            "e472",
            "glycerin",
            "glycerine"
          ],
          reason: "These emulsifiers can come from animal or plant sources."
        },
        {
          terms: ["natural flavor", "natural flavour", "natural flavours", "vanilla extract"],
          reason: "May contain alcohol or undisclosed processing aids."
        }
      ]
    },
    kosher: {
      id: "kosher",
      label: "Kosher",
      summary: "Flags ingredients that are clearly non-kosher or often require certification.",
      blocked: [
        {
          terms: ["pork", "ham", "bacon", "lard", "porcine"],
          reason: "Pork-derived ingredients are not kosher."
        },
        {
          terms: ["shrimp", "prawn", "lobster", "crab", "oyster", "clam", "mussel", "scallop", "shellfish"],
          reason: "Shellfish is not kosher."
        }
      ],
      caution: [
        {
          terms: ["gelatin", "collagen"],
          reason: "Requires kosher-certified sourcing and processing."
        },
        {
          terms: ["rennet", "enzymes", "cheese"],
          reason: "These ingredients often need kosher certification."
        },
        {
          terms: [
            "mono and diglycerides",
            "mono- and diglycerides",
            "monoglycerides",
            "diglycerides",
            "e471",
            "e472",
            "glycerin",
            "glycerine"
          ],
          reason: "The source is often unclear without certification."
        },
        {
          terms: ["natural flavor", "natural flavour", "natural flavours", "confectioner's glaze", "shellac"],
          reason: "May rely on non-kosher or uncertified sourcing."
        }
      ]
    }
  };

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitIngredients(ingredientsText) {
    const merged = String(ingredientsText || "")
      .replace(/\r/g, "")
      .replace(/\n+/g, ", ");
    const ingredients = [];
    let current = "";
    let nestingDepth = 0;

    for (const character of merged) {
      if (character === "(") {
        nestingDepth += 1;
      } else if (character === ")" && nestingDepth > 0) {
        nestingDepth -= 1;
      }

      if ((character === "," || character === ";") && nestingDepth === 0) {
        const trimmed = current.trim();

        if (trimmed) {
          ingredients.push(trimmed);
        }

        current = "";
        continue;
      }

      current += character;
    }

    const trailing = current.trim();

    if (trailing) {
      ingredients.push(trailing);
    }

    return ingredients;
  }

  function containsTerm(text, term) {
    const haystack = ` ${normalizeText(text)} `;
    const needle = ` ${normalizeText(term)} `;

    return needle.trim().length > 0 && haystack.includes(needle);
  }

  function asArray(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (value == null) {
      return [];
    }

    return [value];
  }

  function normalizeTernary(value) {
    const numeric = Number(value);

    if (numeric === 1 || numeric === 0 || numeric === -1) {
      return numeric;
    }

    return -1;
  }

  function sanitizeNamedFlags(collection) {
    return asArray(collection)
      .map((entry) => ({
        name: String(entry && entry.name ? entry.name : "").trim(),
        value: normalizeTernary(entry && entry.value)
      }))
      .filter((entry) => entry.name);
  }

  function sanitizeBarcodeLookup(barcodeLookup) {
    if (!barcodeLookup || typeof barcodeLookup !== "object") {
      return null;
    }

    const barcode = String(barcodeLookup.barcode || "").replace(/\D+/g, "");
    const foodId = String(barcodeLookup.foodId || "").trim();
    const servingId = String(barcodeLookup.servingId || "").trim();
    const preferences = sanitizeNamedFlags(barcodeLookup.preferences);
    const allergens = sanitizeNamedFlags(barcodeLookup.allergens);

    if (!barcode && !foodId && preferences.length === 0 && allergens.length === 0) {
      return null;
    }

    return {
      barcode: barcode || null,
      foodId: foodId || null,
      servingId: servingId || null,
      preferences,
      allergens
    };
  }

  function findNamedFlag(collection, name) {
    const target = normalizeText(name);
    const entry = collection.find((item) => normalizeText(item.name) === target);

    return entry ? entry.value : null;
  }

  function barcodeFindingLabel(barcodeLookup) {
    if (barcodeLookup && barcodeLookup.barcode) {
      return `Barcode ${barcodeLookup.barcode}`;
    }

    return "Barcode lookup";
  }

  function buildBarcodeFinding(barcodeLookup, matchedTerm, reason) {
    return {
      ingredient: barcodeFindingLabel(barcodeLookup),
      matchedTerm,
      reason
    };
  }

  function dedupeFindings(findings) {
    const seen = new Set();

    return findings.filter((finding) => {
      const key = `${finding.ingredient}::${finding.matchedTerm}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function collectMatches(ingredients, rules) {
    const findings = [];

    for (const rule of rules) {
      for (const ingredient of ingredients) {
        const hasExclusion =
          Array.isArray(rule.excludeTerms) && rule.excludeTerms.some((term) => containsTerm(ingredient, term));

        if (hasExclusion) {
          continue;
        }

        const matchedTerm = rule.terms.find((term) => containsTerm(ingredient, term));

        if (!matchedTerm) {
          continue;
        }

        findings.push({
          ingredient,
          matchedTerm,
          reason: rule.reason
        });
      }
    }

    return dedupeFindings(findings);
  }

  function summariseStatus(blockedFindings, cautionFindings) {
    if (blockedFindings.length > 0) {
      return "not_allowed";
    }

    if (cautionFindings.length > 0) {
      return "caution";
    }

    return "clear";
  }

  function collectBarcodeMatches(sensitivityId, barcodeLookup, hasIngredientText) {
    if (!barcodeLookup) {
      return {
        blockedFindings: [],
        cautionFindings: []
      };
    }

    const blockedFindings = [];
    const cautionFindings = [];
    const veganPreference = findNamedFlag(barcodeLookup.preferences, "Vegan");
    const vegetarianPreference = findNamedFlag(barcodeLookup.preferences, "Vegetarian");
    const milkAllergen = findNamedFlag(barcodeLookup.allergens, "Milk");
    const eggAllergen = findNamedFlag(barcodeLookup.allergens, "Egg");
    const fishAllergen = findNamedFlag(barcodeLookup.allergens, "Fish");
    const shellfishAllergen = findNamedFlag(barcodeLookup.allergens, "Shellfish");

    if (sensitivityId === "vegetarian") {
      if (vegetarianPreference === 0) {
        blockedFindings.push(
          buildBarcodeFinding(barcodeLookup, "Vegetarian: no", "FatSecret marks this product as not vegetarian.")
        );
      } else if (!hasIngredientText && vegetarianPreference !== 1) {
        cautionFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            "Vegetarian: unknown",
            "Barcode data did not confirm vegetarian status. Use OCR or paste ingredients as backup."
          )
        );
      }

      if (fishAllergen === 1 || shellfishAllergen === 1) {
        blockedFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            shellfishAllergen === 1 ? "Shellfish allergen" : "Fish allergen",
            "FatSecret allergen data indicates seafood is present."
          )
        );
      }
    }

    if (sensitivityId === "vegan") {
      if (veganPreference === 0) {
        blockedFindings.push(buildBarcodeFinding(barcodeLookup, "Vegan: no", "FatSecret marks this product as not vegan."));
      } else if (!hasIngredientText && veganPreference !== 1) {
        cautionFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            "Vegan: unknown",
            "Barcode data did not confirm vegan status. Use OCR or paste ingredients as backup."
          )
        );
      }

      if (milkAllergen === 1) {
        blockedFindings.push(buildBarcodeFinding(barcodeLookup, "Milk allergen", "FatSecret allergen data indicates milk."));
      }

      if (eggAllergen === 1) {
        blockedFindings.push(buildBarcodeFinding(barcodeLookup, "Egg allergen", "FatSecret allergen data indicates egg."));
      }

      if (fishAllergen === 1 || shellfishAllergen === 1) {
        blockedFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            shellfishAllergen === 1 ? "Shellfish allergen" : "Fish allergen",
            "FatSecret allergen data indicates seafood is present."
          )
        );
      }
    }

    if (sensitivityId === "halal" && !hasIngredientText) {
      cautionFindings.push(
        buildBarcodeFinding(
          barcodeLookup,
          "Halal status unavailable",
          "FatSecret barcode data does not provide halal certification or source-tracing detail."
        )
      );
    }

    if (sensitivityId === "kosher") {
      if (shellfishAllergen === 1) {
        blockedFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            "Shellfish allergen",
            "FatSecret allergen data indicates shellfish, which is not kosher."
          )
        );
      }

      if (!hasIngredientText) {
        cautionFindings.push(
          buildBarcodeFinding(
            barcodeLookup,
            "Kosher status unavailable",
            "FatSecret barcode data does not provide kosher certification or source-tracing detail."
          )
        );
      }
    }

    return {
      blockedFindings: dedupeFindings(blockedFindings),
      cautionFindings: dedupeFindings(cautionFindings)
    };
  }

  function buildPresetResult(sensitivity, ingredients, barcodeLookup) {
    const ingredientBlockedFindings = collectMatches(ingredients, sensitivity.blocked);
    const ingredientCautionFindings = collectMatches(ingredients, sensitivity.caution);
    const barcodeMatches = collectBarcodeMatches(sensitivity.id, barcodeLookup, ingredients.length > 0);
    const blockedFindings = dedupeFindings(ingredientBlockedFindings.concat(barcodeMatches.blockedFindings));
    const cautionFindings = dedupeFindings(ingredientCautionFindings.concat(barcodeMatches.cautionFindings));

    return {
      id: sensitivity.id,
      label: sensitivity.label,
      summary: sensitivity.summary,
      status: summariseStatus(blockedFindings, cautionFindings),
      blockedFindings,
      cautionFindings
    };
  }

  function buildCustomResult(customSensitivity, ingredients, barcodeLookup) {
    const blockedFindings = [];

    for (const ingredient of ingredients) {
      const matchedTerm = customSensitivity.terms.find((term) => containsTerm(ingredient, term));

      if (!matchedTerm) {
        continue;
      }

      blockedFindings.push({
        ingredient,
        matchedTerm,
        reason: `Matches your custom sensitivity "${customSensitivity.label}".`
      });
    }

    const deduped = dedupeFindings(blockedFindings);
    const cautionFindings =
      ingredients.length === 0 && barcodeLookup
        ? [
            buildBarcodeFinding(
              barcodeLookup,
              "Ingredient list unavailable",
              `Custom sensitivity "${customSensitivity.label}" needs ingredient text. Use OCR or paste ingredients as backup.`
            )
          ]
        : [];

    return {
      id: `custom:${customSensitivity.label}`,
      label: customSensitivity.label,
      summary: "Custom keyword match.",
      status: summariseStatus(deduped, cautionFindings),
      blockedFindings: deduped,
      cautionFindings
    };
  }

  function sanitizeCustomSensitivities(customSensitivities) {
    if (!Array.isArray(customSensitivities)) {
      return [];
    }

    return customSensitivities
      .map((entry) => {
        const label = String(entry.label || "").trim();
        const terms = Array.isArray(entry.terms)
          ? entry.terms.map((term) => String(term || "").trim()).filter(Boolean)
          : [];

        return {
          label,
          terms
        };
      })
      .filter((entry) => entry.label && entry.terms.length > 0);
  }

  function sanitizeSource(source) {
    if (!source || typeof source !== "object") {
      return null;
    }

    const type = String(source.type || "").trim();
    const fileName = String(source.fileName || "").trim();
    const extractionMethod = String(source.extractionMethod || "").trim();
    const provider = String(source.provider || "").trim();
    const barcode = String(source.barcode || "").replace(/\D+/g, "");
    const foodId = String(source.foodId || "").trim();
    const servingId = String(source.servingId || "").trim();
    const lookupMode = String(source.lookupMode || "").trim();
    const fallbackUsed = Boolean(source.fallbackUsed);

    if (!type && !fileName && !extractionMethod && !provider && !barcode && !foodId && !servingId && !lookupMode) {
      return null;
    }

    return {
      type: type || "manual_text",
      fileName: fileName || null,
      extractionMethod: extractionMethod || null,
      provider: provider || null,
      barcode: barcode || null,
      foodId: foodId || null,
      servingId: servingId || null,
      lookupMode: lookupMode || null,
      fallbackUsed
    };
  }

  function analyzeIngredients({
    productName = "",
    ingredientsText = "",
    presets = [],
    customSensitivities = [],
    source = null,
    barcodeLookup = null
  }) {
    const ingredients = splitIngredients(ingredientsText);
    const presetIds = Array.isArray(presets)
      ? presets.filter((id) => Object.prototype.hasOwnProperty.call(PRESET_SENSITIVITIES, id))
      : [];
    const safeCustomSensitivities = sanitizeCustomSensitivities(customSensitivities);
    const safeSource = sanitizeSource(source);
    const safeBarcodeLookup = sanitizeBarcodeLookup(barcodeLookup);

    const presetResults = presetIds.map((id) => buildPresetResult(PRESET_SENSITIVITIES[id], ingredients, safeBarcodeLookup));
    const customResults = safeCustomSensitivities.map((entry) =>
      buildCustomResult(entry, ingredients, safeBarcodeLookup)
    );
    const results = presetResults.concat(customResults);

    return {
      productName: String(productName || "").trim(),
      ingredientsText: String(ingredientsText || "").trim(),
      ingredients,
      presets: presetIds,
      customSensitivities: safeCustomSensitivities,
      source: safeSource,
      results,
      disclaimer:
        "This is a screening tool, not a certification service. Ambiguous additives still need brand or certifier verification."
    };
  }

  function listPresetSensitivities() {
    return Object.values(PRESET_SENSITIVITIES).map(({ id, label, summary }) => ({
      id,
      label,
      summary
    }));
  }

  return {
    PRESET_SENSITIVITIES,
    analyzeIngredients,
    containsTerm,
    listPresetSensitivities,
    normalizeText,
    sanitizeBarcodeLookup,
    sanitizeSource,
    splitIngredients
  };
});
