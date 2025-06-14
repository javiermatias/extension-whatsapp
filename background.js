
// background.js

// This event runs once when the extension is first installed.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Check if a deviceId already exists to be safe.
    const { deviceId } = await chrome.storage.local.get('deviceId');
    if (!deviceId) {
      // Generate a new unique ID and store it. This is the user's permanent "fingerprint".
      const newDeviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId: newDeviceId });
      console.log('Extension installed. New unique Device ID created:', newDeviceId);
    }
  }
});

/*// --- Main Function to Update the Badge Text ---
async function updateBadge() {
  try {
    const result = await chrome.storage.local.get(['contactList']);
    const list = result.contactList || [];
    const count = list.length;
    
    // Display the number of loaded contacts on the extension icon
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4688F1' });
  } catch (error) {
    console.error("Error updating badge:", error);
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  }
}

// ==========================================================
// --- EVENT LISTENERS ---
// ==========================================================

// 1. Run when the extension is first installed or updated.
// THIS IS THE MERGED LISTENER
chrome.runtime.onInstalled.addListener(async (details) => {
  // --- Action A: Update the badge (runs on both install and update) ---
  updateBadge();

  // --- Action B: Create a unique device ID (runs ONLY on first install) ---
  if (details.reason === 'install') {
    // Check if a deviceId already exists just to be safe.
    const { deviceId } = await chrome.storage.local.get('deviceId');
    if (!deviceId) {
      // Generate a new unique ID and store it. This is the user's permanent "fingerprint".
      const newDeviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId: newDeviceId });
      console.log('Extension installed. New unique Device ID created:', newDeviceId);
    }
  }
});

// 2. Run whenever the contact list changes in storage to keep the badge current.
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.contactList) {
    console.log("Contact list changed, updating badge.");
    updateBadge();
  }
});

// 3. Listen for messages from other parts of the extension (e.g., popup).
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle request for contact counts from the popup
  if (message.type === 'get-contact-counts') {
    (async () => {
      try {
        const result = await chrome.storage.local.get(['contactList']);
        const list = result.contactList || [];
        const loadedCount = list.length;
        const sentCount = list.filter(contact => contact.sent).length;
        
        sendResponse({ 
          success: true, 
          data: { loaded: loadedCount, sent: sentCount } 
        });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    // Return true to indicate that we will send a response asynchronously
    return true; 
  }
}); */