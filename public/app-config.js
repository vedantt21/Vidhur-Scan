window.IngredientScreenConfig = Object.assign(
  {
    // Set apiBaseUrl before building a native Android app if the backend is hosted separately.
    apiBaseUrl: "",
    // When false, native builds use the hosted API instead of the on-device localStorage fallback.
    useNativeLocalStorage: true
  },
  window.IngredientScreenConfig || {}
);
