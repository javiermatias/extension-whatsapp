// Function to update the badge text on the extension icon
async function updateBadge() {
    try {
      const result = await chrome.storage.local.get(['contactList']);
      const list = result.contactList || [];
      const count = list.length;
      
      // Display the number of loaded contacts on the extension icon itself
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
      chrome.action.setBadgeBackgroundColor({ color: '#4688F1' }); // Optional: set a color
    } catch (error) {
      console.error("Error updating badge:", error);
      chrome.action.setBadgeText({ text: '!' }); // Show an error state
      chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
    }
  }
  
  // --- Listeners to keep the badge up-to-date ---
  
  // 1. Run when the extension is first installed or updated
  chrome.runtime.onInstalled.addListener(updateBadge);
  
  // 2. Run whenever the contact list changes in storage
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.contactList) {
      console.log("Contact list changed, updating badge.");
      updateBadge();
    }
  });

  // 3. Listen for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get-contact-counts') {
      // We make this listener async so we can use `await` inside
      // and `sendResponse` will wait for the promise to resolve.
      (async () => {
        try {
          const result = await chrome.storage.local.get(['contactList']);
          const list = result.contactList || [];
          const loadedCount = list.length;
          const sentCount = list.filter(contact => contact.sent).length;
          
          // Send the data back to the popup
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
  });