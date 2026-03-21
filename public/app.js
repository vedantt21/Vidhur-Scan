const state = {
  presets: [],
  customSensitivities: [],
  analyses: [],
  parserStatus: {
    openaiConfigured: false,
    openaiModel: null
  },
  selectedImage: null,
  imagePreviewUrl: "",
  lastExtractionSource: null,
  ocrLibraryPromise: null
};

const form = document.querySelector("#analysis-form");
const presetGrid = document.querySelector("#preset-grid");
const customList = document.querySelector("#custom-list");
const historyContainer = document.querySelector("#history");
const resultsContainer = document.querySelector("#results");
const statusBanner = document.querySelector("#status-banner");
const submitButton = document.querySelector("#submit-button");
const customLabelInput = document.querySelector("#custom-label");
const customTermsInput = document.querySelector("#custom-terms");
const customItemTemplate = document.querySelector("#custom-item-template");
const historyItemTemplate = document.querySelector("#history-item-template");
const ingredientsTextInput = document.querySelector("#ingredients-text");
const cameraInput = document.querySelector("#camera-input");
const imageInput = document.querySelector("#image-input");
const cameraButton = document.querySelector("#camera-button");
const uploadButton = document.querySelector("#upload-button");
const clearImageButton = document.querySelector("#clear-image-button");
const aiCleanupButton = document.querySelector("#ai-cleanup-button");
const imagePreview = document.querySelector("#image-preview");
const ocrStatus = document.querySelector("#ocr-status");

function statusLabel(status) {
  if (status === "not_allowed") {
    return "Flagged";
  }

  if (status === "caution") {
    return "Review";
  }

  return "Clear";
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatSource(source) {
  if (!source || !source.type) {
    return "Manual text";
  }

  if (source.type === "image_ocr") {
    return "Image OCR";
  }

  if (source.type === "image_ai") {
    return "AI image parse";
  }

  if (source.type === "text_ai_refined") {
    return "AI text cleanup";
  }

  if (source.type === "image_selected") {
    return "Image attached";
  }

  return "Manual text";
}

function getSelectedPresets() {
  return Array.from(document.querySelectorAll('input[name="preset"]:checked')).map((input) => input.value);
}

function setOcrStatus(message) {
  ocrStatus.className = "ocr-status";
  ocrStatus.textContent = message;
}

function setPhotoButtonsDisabled(disabled) {
  cameraButton.disabled = disabled;
  uploadButton.disabled = disabled;
  clearImageButton.disabled = disabled;
  aiCleanupButton.disabled = disabled;
}

function resetImagePreviewUrl() {
  if (!state.imagePreviewUrl) {
    return;
  }

  URL.revokeObjectURL(state.imagePreviewUrl);
  state.imagePreviewUrl = "";
}

function renderImagePreview() {
  if (!state.selectedImage) {
    resetImagePreviewUrl();
    imagePreview.className = "image-preview empty-state";
    imagePreview.textContent = "No label photo selected.";
    return;
  }

  resetImagePreviewUrl();
  state.imagePreviewUrl = URL.createObjectURL(state.selectedImage);
  imagePreview.className = "image-preview";
  imagePreview.innerHTML = `
    <div class="image-preview-card">
      <div>
        <strong>${state.selectedImage.name}</strong>
        <p>${Math.round(state.selectedImage.size / 1024)} KB</p>
      </div>
      <img src="${state.imagePreviewUrl}" alt="Selected ingredient label" />
    </div>
  `;
}

function clearSelectedImage(options = {}) {
  const { preserveStatus = false, preserveExtractionSource = false } = options;

  state.selectedImage = null;

  if (!preserveExtractionSource) {
    state.lastExtractionSource = null;
  }

  cameraInput.value = "";
  imageInput.value = "";
  renderImagePreview();

  if (!preserveStatus) {
    setOcrStatus(defaultParserMessage());
  }
}

function extractCandidateIngredients(text) {
  const cleaned = String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const markerMatch = cleaned.match(/ingredients?\s*[:.-]?\s*([\s\S]+)/i);
  let workingText = markerMatch ? markerMatch[1] : cleaned;

  const stopMarkers = [/nutrition facts/i, /allergy advice/i, /contains:/i, /distributed by/i, /storage:/i];

  for (const marker of stopMarkers) {
    const match = workingText.match(marker);

    if (match && typeof match.index === "number") {
      workingText = workingText.slice(0, match.index);
    }
  }

  return workingText
    .replace(/\n+/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildSourcePayload() {
  if (state.lastExtractionSource) {
    return state.lastExtractionSource;
  }

  if (state.selectedImage) {
    return {
      type: "image_selected",
      fileName: state.selectedImage.name
    };
  }

  return {
    type: "manual_text"
  };
}

function defaultParserMessage() {
  if (state.parserStatus.openaiConfigured) {
    return `AI parser ready (${state.parserStatus.openaiModel}). Take a photo, upload an image, or improve pasted text with AI.`;
  }

  return "OpenAI parser not configured. Photo parsing will use the local OCR fallback.";
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

async function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected image."));
    image.src = dataUrl;
  });
}

async function buildUploadImageData(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const maxDimension = 1600;
  const largestSide = Math.max(image.width, image.height) || 1;
  const scale = Math.min(1, maxDimension / largestSide);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Image processing is not supported in this browser.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return {
    imageDataUrl: canvas.toDataURL("image/jpeg", 0.82),
    width,
    height
  };
}

function loadOcrLibrary() {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (state.ocrLibraryPromise) {
    return state.ocrLibraryPromise;
  }

  state.ocrLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => reject(new Error("Could not load OCR support on this device/network."));
    document.head.appendChild(script);
  });

  return state.ocrLibraryPromise;
}

async function extractTextFromImage() {
  if (!state.selectedImage) {
    setOcrStatus("Take a photo or upload an image first.");
    return;
  }

  setPhotoButtonsDisabled(true);
  setOcrStatus("Loading OCR support...");

  try {
    const Tesseract = await loadOcrLibrary();
    setOcrStatus("Reading label photo...");

    const result = await Tesseract.recognize(state.selectedImage, "eng", {
      logger(message) {
        if (message.status === "recognizing text") {
          setOcrStatus(`Reading label photo... ${Math.round(message.progress * 100)}%`);
        }
      }
    });
    const extractedText = extractCandidateIngredients(result.data.text);

    if (!extractedText) {
      throw new Error("No readable ingredient text was found in the image.");
    }

    ingredientsTextInput.value = extractedText;
    state.lastExtractionSource = {
      type: "image_ocr",
      fileName: state.selectedImage.name,
      extractionMethod: "tesseract.js"
    };
    setOcrStatus("Photo parsed. Review the extracted text if needed, then analyze and save.");
    statusBanner.className = "status-banner active";
    statusBanner.textContent = "Photo parsed successfully. Review the extracted ingredients, then analyze and save.";
  } catch (error) {
    setOcrStatus(error.message || "Could not extract text from the image.");
  } finally {
    setPhotoButtonsDisabled(false);
  }
}

async function parsePhotoWithAI() {
  if (!state.selectedImage) {
    throw new Error("Take a photo or upload an image first.");
  }

  setPhotoButtonsDisabled(true);
  setOcrStatus(`Uploading photo to AI parser (${state.parserStatus.openaiModel})...`);

  try {
    const imagePayload = await buildUploadImageData(state.selectedImage);
    const response = await fetch("/api/parse-photo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fileName: state.selectedImage.name,
        imageDataUrl: imagePayload.imageDataUrl
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not parse the photo with AI.");
    }

    if (!String(payload?.parse?.ingredientsText || "").trim()) {
      throw new Error("AI parsing returned no ingredient text.");
    }

    if (!document.querySelector("#product-name").value.trim() && payload.parse.productName) {
      document.querySelector("#product-name").value = payload.parse.productName;
    }

    ingredientsTextInput.value = payload.parse.ingredientsText || "";
    state.lastExtractionSource = payload.parse.source || null;
    setOcrStatus("Photo parsed with AI. Review the extracted text if needed, then analyze and save.");
    statusBanner.className = "status-banner active";
    statusBanner.textContent = "AI photo parse finished. Review the extracted ingredients, then analyze and save.";
  } finally {
    setPhotoButtonsDisabled(false);
  }
}

async function handleSelectedFile(file) {
  state.selectedImage = file || null;
  state.lastExtractionSource = null;
  renderImagePreview();

  if (!state.selectedImage) {
    setOcrStatus("No image selected yet. On phone, tap Take photo. On desktop, use Upload image.");
    return;
  }

  setOcrStatus(`Selected ${state.selectedImage.name}. Parsing photo now...`);

  if (state.parserStatus.openaiConfigured) {
    try {
      await parsePhotoWithAI();
      return;
    } catch (error) {
      setOcrStatus(`${error.message} Falling back to local OCR...`);
    }
  }

  await extractTextFromImage();
}

async function refineCurrentTextWithAI() {
  if (!state.parserStatus.openaiConfigured) {
    setOcrStatus("OpenAI parser is not configured.");
    return;
  }

  const rawText = ingredientsTextInput.value.trim();

  if (!rawText) {
    setOcrStatus("Paste or extract some text first, then improve it with AI.");
    return;
  }

  aiCleanupButton.disabled = true;
  setOcrStatus(`Cleaning text with AI (${state.parserStatus.openaiModel})...`);

  try {
    const response = await fetch("/api/refine-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productName: document.querySelector("#product-name").value,
        rawText
      })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not improve the text with AI.");
    }

    ingredientsTextInput.value = payload.parse.ingredientsText || rawText;

    if (!document.querySelector("#product-name").value.trim() && payload.parse.productName) {
      document.querySelector("#product-name").value = payload.parse.productName;
    }

    state.lastExtractionSource = payload.parse.source || null;
    setOcrStatus("Text cleaned with AI. Review it, then analyze and save.");
  } catch (error) {
    setOcrStatus(error.message || "Could not improve the text with AI.");
  } finally {
    aiCleanupButton.disabled = false;
  }
}

function renderPresets() {
  presetGrid.innerHTML = "";

  state.presets.forEach((preset) => {
    const label = document.createElement("label");
    label.className = "preset-option";

    label.innerHTML = `
      <input type="checkbox" name="preset" value="${preset.id}" />
      <div>
        <strong>${preset.label}</strong>
        <p>${preset.summary}</p>
      </div>
    `;

    presetGrid.appendChild(label);
  });
}

function renderCustomSensitivities() {
  if (state.customSensitivities.length === 0) {
    customList.className = "custom-list empty-state";
    customList.textContent = "No custom sensitivities added yet.";
    return;
  }

  customList.className = "custom-list";
  customList.innerHTML = "";

  state.customSensitivities.forEach((entry, index) => {
    const fragment = customItemTemplate.content.cloneNode(true);
    const root = fragment.querySelector(".custom-item");

    fragment.querySelector(".custom-label").textContent = entry.label;
    fragment.querySelector(".custom-terms").textContent = entry.terms.join(", ");
    fragment.querySelector(".remove-custom").addEventListener("click", () => {
      state.customSensitivities.splice(index, 1);
      renderCustomSensitivities();
    });

    customList.appendChild(fragment);
    root.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 220, easing: "ease-out" }
    );
  });
}

function createFinding(title, finding) {
  const item = document.createElement("div");
  item.className = "finding";
  item.innerHTML = `
    <strong>${finding.ingredient}</strong>
    <p>Matched <code>${finding.matchedTerm}</code>. ${finding.reason}</p>
  `;
  return item;
}

function renderResults(analysis) {
  if (!analysis) {
    resultsContainer.className = "results empty-results";
    resultsContainer.textContent = "";
    statusBanner.className = "status-banner";
    statusBanner.textContent = "Choose sensitivities, take a photo or paste ingredients, and run an analysis.";
    return;
  }

  resultsContainer.className = "results";
  resultsContainer.innerHTML = "";

  const productLabel = analysis.productName || "Unnamed product";
  const blockedCount = analysis.results.reduce((sum, entry) => sum + entry.blockedFindings.length, 0);
  const cautionCount = analysis.results.reduce((sum, entry) => sum + entry.cautionFindings.length, 0);

  statusBanner.className = "status-banner active";
  statusBanner.textContent =
    `${productLabel}: ${blockedCount} flagged ingredient match${blockedCount === 1 ? "" : "es"} and ` +
    `${cautionCount} caution match${cautionCount === 1 ? "" : "es"}. ${analysis.disclaimer}`;

  if (analysis.results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Select at least one preset or add a custom sensitivity to produce results.";
    resultsContainer.appendChild(empty);
    return;
  }

  analysis.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = `result-card ${result.status}`;
    card.style.animationDelay = `${index * 80}ms`;

    card.innerHTML = `
      <div class="result-head">
        <div>
          <div class="result-title">${result.label}</div>
          <p class="result-summary">${result.summary}</p>
        </div>
        <span class="status-pill ${result.status}">${statusLabel(result.status)}</span>
      </div>
    `;

    if (result.blockedFindings.length > 0) {
      const section = document.createElement("section");
      section.className = "finding-group";
      section.innerHTML = "<h3>Flagged matches</h3>";
      const list = document.createElement("div");
      list.className = "finding-list";
      result.blockedFindings.forEach((finding) => list.appendChild(createFinding("Flagged matches", finding)));
      section.appendChild(list);
      card.appendChild(section);
    }

    if (result.cautionFindings.length > 0) {
      const section = document.createElement("section");
      section.className = "finding-group";
      section.innerHTML = "<h3>Needs verification</h3>";
      const list = document.createElement("div");
      list.className = "finding-list";
      result.cautionFindings.forEach((finding) => list.appendChild(createFinding("Needs verification", finding)));
      section.appendChild(list);
      card.appendChild(section);
    }

    if (result.blockedFindings.length === 0 && result.cautionFindings.length === 0) {
      const clear = document.createElement("div");
      clear.className = "finding-group";
      clear.innerHTML =
        '<div class="empty-state">No blocked or caution matches were detected for this sensitivity using the current rules.</div>';
      card.appendChild(clear);
    }

    resultsContainer.appendChild(card);
  });
}

function fillFormFromAnalysis(analysis) {
  document.querySelector("#product-name").value = analysis.productName || "";
  ingredientsTextInput.value = analysis.ingredientsText || "";

  document.querySelectorAll('input[name="preset"]').forEach((input) => {
    input.checked = analysis.presets.includes(input.value);
  });

  state.customSensitivities = analysis.customSensitivities || [];
  clearSelectedImage({ preserveStatus: true, preserveExtractionSource: true });
  state.lastExtractionSource = analysis.source || null;
  setOcrStatus(`Loaded saved analysis from ${formatSource(analysis.source)}.`);
  renderCustomSensitivities();
  renderResults(analysis);
}

function renderHistory() {
  if (state.analyses.length === 0) {
    historyContainer.className = "history empty-state";
    historyContainer.textContent = "No saved analyses yet.";
    return;
  }

  historyContainer.className = "history";
  historyContainer.innerHTML = "";

  state.analyses.forEach((analysis) => {
    const fragment = historyItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".history-item");
    const productLabel = analysis.productName || "Unnamed product";

    fragment.querySelector(".history-name").textContent = productLabel;
    fragment.querySelector(".history-meta").textContent =
      `${formatDate(analysis.createdAt)} · ${formatSource(analysis.source)}`;

    button.addEventListener("click", () => {
      fillFormFromAnalysis(analysis);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    historyContainer.appendChild(fragment);
  });
}

async function loadPresets() {
  const response = await fetch("/api/sensitivities");
  const payload = await response.json();
  state.presets = payload.sensitivities || [];
  renderPresets();
}

async function loadParserStatus() {
  const response = await fetch("/api/parser-status");
  const payload = await response.json();

  state.parserStatus = {
    openaiConfigured: Boolean(payload.openaiConfigured),
    openaiModel: payload.openaiModel || null
  };
  aiCleanupButton.hidden = !state.parserStatus.openaiConfigured;
  setOcrStatus(defaultParserMessage());
}

async function loadHistory() {
  const response = await fetch("/api/analyses");
  const payload = await response.json();
  state.analyses = payload.analyses || [];
  renderHistory();
}

document.querySelector("#add-custom").addEventListener("click", () => {
  const label = customLabelInput.value.trim();
  const terms = customTermsInput.value
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);

  if (!label || terms.length === 0) {
    return;
  }

  state.customSensitivities.push({ label, terms });
  customLabelInput.value = "";
  customTermsInput.value = "";
  renderCustomSensitivities();
});

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files || [];
  imageInput.value = "";
  handleSelectedFile(file).catch((error) => {
    setOcrStatus(error.message || "Could not parse the selected image.");
  });
});

cameraInput.addEventListener("change", () => {
  const [file] = cameraInput.files || [];
  cameraInput.value = "";
  handleSelectedFile(file).catch((error) => {
    setOcrStatus(error.message || "Could not parse the selected photo.");
  });
});

cameraButton.addEventListener("click", () => {
  cameraInput.click();
});

uploadButton.addEventListener("click", () => {
  imageInput.click();
});

clearImageButton.addEventListener("click", () => {
  clearSelectedImage();
});

aiCleanupButton.addEventListener("click", () => {
  refineCurrentTextWithAI().catch((error) => {
    setOcrStatus(error.message || "Could not improve the text with AI.");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  submitButton.textContent = "Analyzing...";

  try {
    const ingredientsText = ingredientsTextInput.value.trim();

    if (!ingredientsText) {
      throw new Error("Paste ingredients or extract them from an image first.");
    }

    const payload = {
      productName: document.querySelector("#product-name").value,
      ingredientsText,
      presets: getSelectedPresets(),
      customSensitivities: state.customSensitivities,
      source: buildSourcePayload()
    };

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    renderResults(data.analysis);
    await loadHistory();
  } catch (error) {
    statusBanner.className = "status-banner active";
    statusBanner.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Analyze and save";
  }
});

Promise.all([loadPresets(), loadHistory(), loadParserStatus()]).catch((error) => {
  statusBanner.className = "status-banner active";
  statusBanner.textContent = `Failed to load app data: ${error.message}`;
});
