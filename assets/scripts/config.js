// =========================================================================
//            MASTER AUTOMATION CONFIGURATION LOADER (CHROME EXTENSION)
// =========================================================================

// Resolve the absolute extension path to your JSON file
const jsonUrl = chrome.runtime.getURL('/assets/configFiles/currentValues.json');

// Fetch the file locally from the extension bundle
window.AUTOMATION_CONFIG_READY = fetch(jsonUrl)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Extension failed to read local JSON file: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    // Inject the data onto the window object identically to how it originally functioned
    window.AUTOMATION_CONFIG = data;
    return data;
  })
  .catch(error => {
    console.error('Failed to load MASTER AUTOMATION DICTIONARY:', error);
  });