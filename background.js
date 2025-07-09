// background.js

// This event runs once when the extension is first installed.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
///////////// Define the default timings for the sendMessage function/////////////////////
    const defaultConfig = {
      times: {
        buttonClick: 2000,  // Wait after clicking "Start chat"
        input: 3000,        // Wait after typing the number
        conversation: 5000, // Wait after clicking the contact to load chat
        sendMessage: 2000,  // Wait after typing the message
        postSend: 3000      // Wait after the message is sent
      }
    };

    // Save this configuration object to chrome.storage.local
    chrome.storage.local.set({ 'appConfig': defaultConfig }, () => {
      console.log('Default configuration saved on installation.');
    });  

///////////////////////////////////////////////////////////////////////////////////////////

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_LICENSE") {
    const url = 'https://ausentismos.online/paypal/licensestatus';
    const payload = {
      user: message.userKey,
      mex: false,
      token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ"
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => sendResponse(data))
    .catch(error => {
      console.error('Error fetching license:', error);
      sendResponse({ dateexpiration: 0 });
    });

    return true; // Keeps sendResponse alive asynchronously
  }
});