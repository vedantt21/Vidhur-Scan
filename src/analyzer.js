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

function summariseStatus(blockedFindings, cautionFindings) {
  if (blockedFindings.length > 0) {
    return "not_allowed";
  }

  if (cautionFindings.length > 0) {
    return "caution";
  }

  return "clear";
}

function buildPresetResult(sensitivity, ingredients) {
  const blockedFindings = collectMatches(ingredients, sensitivity.blocked);
  const cautionFindings = collectMatches(ingredients, sensitivity.caution);

  return {
    id: sensitivity.id,
    label: sensitivity.label,
    summary: sensitivity.summary,
    status: summariseStatus(blockedFindings, cautionFindings),
    blockedFindings,
    cautionFindings
  };
}

function buildCustomResult(customSensitivity, ingredients) {
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

  return {
    id: `custom:${customSensitivity.label}`,
    label: customSensitivity.label,
    summary: "Custom keyword match.",
    status: deduped.length > 0 ? "not_allowed" : "clear",
    blockedFindings: deduped,
    cautionFindings: []
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
  const model = String(source.model || "").trim();

  if (!type && !fileName && !extractionMethod && !model) {
    return null;
  }

  return {
    type: type || "manual_text",
    fileName: fileName || null,
    extractionMethod: extractionMethod || null,
    model: model || null
  };
}

function analyzeIngredients({
  productName = "",
  ingredientsText = "",
  presets = [],
  customSensitivities = [],
  source = null
}) {
  const ingredients = splitIngredients(ingredientsText);
  const presetIds = Array.isArray(presets)
    ? presets.filter((id) => Object.prototype.hasOwnProperty.call(PRESET_SENSITIVITIES, id))
    : [];
  const safeCustomSensitivities = sanitizeCustomSensitivities(customSensitivities);
  const safeSource = sanitizeSource(source);

  const presetResults = presetIds.map((id) => buildPresetResult(PRESET_SENSITIVITIES[id], ingredients));
  const customResults = safeCustomSensitivities.map((entry) => buildCustomResult(entry, ingredients));
  const results = [...presetResults, ...customResults];

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

module.exports = {
  analyzeIngredients,
  listPresetSensitivities,
  PRESET_SENSITIVITIES,
  splitIngredients,
  normalizeText,
  containsTerm,
  sanitizeSource
};
