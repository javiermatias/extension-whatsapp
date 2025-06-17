// background.js

// This event runs once when the extension is first installed.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Check if a deviceId already exists to be safe.
    const { deviceId } = await chrome.storage.local.get('deviceId');
    
    if (!deviceId) {
      // 1. Generate a new unique ID and store it.
      const newDeviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId: newDeviceId });
      console.log('Extension installed. New unique Device ID created:', newDeviceId);

      // 2. --- NEW: Register the new installation with your server ---
      try {
        const registrationUrl = 'https://ausentismos.online/paypal/registerchrome';
        const payload = {
          unique_id: newDeviceId,
          programa: "SENDER", // A name to identify this extension
          token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ"
        };

        console.log('Attempting to register new installation with server...', payload);

        const response = await fetch(registrationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        // Check if the server responded with an error status (e.g., 4xx, 5xx)
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }

        // Optional: Log the server's response if it sends one
        const responseData = await response.json(); 
        console.log('✅ Successfully registered with server:', responseData);

      } catch (error) {
        // This will catch network errors or the error thrown from !response.ok
        console.error('❌ Failed to register installation with the server:', error);
        // The extension will still work, but the installation won't be logged on your server.
      }
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