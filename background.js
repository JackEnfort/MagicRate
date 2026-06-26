// background.js
// Keep this file completely clear of any HTML string components, 'document', or 'window' references!

chrome.action.onClicked.addListener(function(tab) {
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_magicplan_overlay" }, function() {
      // Gracefully catch errors if clicked on an extension-restricted page (like chrome://extensions)
      if (chrome.runtime.lastError) {
        console.log("Overlay frame context not initialized on this page tab yet.");
      }
    });
  }
});