window.IngredientScreenConfig = Object.assign(
  {
    // Set apiBaseUrl before building a native Android app if the backend is hosted separately.
    // Android emulator example: http://10.0.2.2:3000
    // Physical Android device example: http://192.168.1.50:3000
    apiBaseUrl: "",
    // Keep this false for Android Studio builds that should talk to the Node backend.
    useNativeLocalStorage: false
  },
  window.IngredientScreenConfig || {}
);
