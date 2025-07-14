// background.js
// --- Global State (managed by the background script) ---
let isSending = false;
let shouldStop = false;

// ===================================================================
// --- MESSAGE LISTENER (The Entry Point) ---
// ===================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.command === "start_sending" && !isSending) {
        startSendingProcess();
        sendResponse({ status: "Starting process..." });
    } else if (message.command === "stop_sending" && isSending) {
        shouldStop = true;
        console.log("Stop signal received. Process will halt after the current message.");
        sendResponse({ status: "Stopping process..." });
    }
    // Listen for license check requests from your options page or content script
    else if (message.type === "CHECK_LICENSE") {
        checkLicense(message.userKey).then(sendResponse);
        return true; // Indicates async response
    }
    return true;
});


// ===================================================================
// --- MAIN SENDING PROCESS (The Core Loop) ---
// ===================================================================
async function startSendingProcess() {
  isSending = true;
  shouldStop = false;
  await chrome.storage.local.set({ isSending: true });
  // Notify popup that we've started
  chrome.runtime.sendMessage({ status: 'process_started' });

  // Find the active WhatsApp tab to inject the UI into
  const waTab = await findOrCreateWhatsAppTab();
  if (!waTab) {
      console.error("Could not find or create a WhatsApp tab.");
      isSending = false;
      await chrome.storage.local.set({ isSending: false });
      chrome.runtime.sendMessage({ status: 'process_finished' });
      return;
  }
  
  // Inject the UI Widget immediately
  injectContentScriptFunction(waTab.id, 'createProgressWidget');

  // *** STEP 1: Perform the permission check ONCE ***
  const session = await determineSessionStatus();

  // *** STEP 2: Handle expired license ***
  if (session.status === 'expired') {
      injectContentScriptFunction(waTab.id, 'showLicenseExpiredModal');
      finishProcess();
      return;
  }

  // --- User is 'premium' or 'free' ---
  const initialMessage = session.status === 'premium' ? "Premium license active. Loading contacts..." : "Free tier active. Loading contacts...";
  updateContentProgress(waTab.id, initialMessage, 0);

  const { contactList } = await chrome.storage.local.get('contactList');
  if (!contactList || contactList.length === 0) {
      updateContentProgress(waTab.id, "Error: No contacts loaded.", 0, true);
      finishProcess();
      return;
  }
  
  const contactsToSend = contactList.filter(c => !c.sent);
  if (contactsToSend.length === 0) {
      updateContentProgress(waTab.id, "All contacts have already been sent.", 100);
      finishProcess(waTab.id, [], []); // Show empty summary
      return;
  }

  const successfullySent = [], failedToSend = [];
  for (let i = 0; i < contactsToSend.length; i++) {
      if (shouldStop) {
          updateContentProgress(waTab.id, `Process stopped by user.`, -1, true);
          chrome.runtime.sendMessage({ status: 'process_stopped' });
          break;
      }

      if (session.status === 'free') {
          const isAllowed = await checkFreeTierDailyLimit();
          if (!isAllowed) {
              injectContentScriptFunction(waTab.id, 'showLimitReachedModal');
              break;
          }
      }

      const contact = contactsToSend[i];
      const overallProgress = ((i + 1) / contactsToSend.length) * 100;
      updateContentProgress(waTab.id, `Sending ${i + 1}/${contactsToSend.length} to ${contact.number}...`, overallProgress);

      try {
          // The magic happens here: URL opens the chat, then script sends it.
          const chatUrl = `https://web.whatsapp.com/send?phone=${contact.number}`;
          await chrome.tabs.update(waTab.id, { url: chatUrl });

          // Wait for the tab to update and then send the message.
          const result = await injectSendFunction(waTab.id, contact.message);
          if (result.error) throw new Error(result.error);
          
          successfullySent.push(contact);
          const index = contactList.findIndex(c => c.number === contact.number && c.message === contact.message);
          if (index !== -1) contactList[index].sent = true;
          await chrome.storage.local.set({ 'contactList': contactList });
          
          if (session.status === 'free') await incrementUsageCount();

      } catch (error) {
          contact.error = error.message;
          failedToSend.push(contact);
          updateContentProgress(waTab.id, `Failed for ${contact.number}. Continuing...`, overallProgress, true);
          await sleep(1000); // Small delay after a failure
      }
      
      // Add a random delay between messages to appear more human
      const sendTimes = await getSendConfig();
      await sleep(sendTimes.postSend);
  }

  finishProcess(waTab.id, successfullySent, failedToSend);
}

async function finishProcess(tabId, successes, failures) {
  if (tabId && successes && failures) {
    if (!shouldStop) { // Only show summary if not manually stopped
       injectContentScriptFunction(tabId, 'showSummaryReport', [successes, failures]);
    }
  }
  isSending = false;
  shouldStop = false;
  await chrome.storage.local.set({ isSending: false });
  chrome.runtime.sendMessage({ status: 'process_finished' });
  console.log("Process finished.");
}



async function checkLicenseFree() {
  const { deviceId, license} =  await chrome.storage.local.get(['deviceId', 'license']);
  if (!license || !license.user) {
    return true;
  }
  
  const expectedSignature = await createSignature(`${deviceId}:${license.expires}:${license.user}`);
  if (expectedSignature !== license.signature) {
    return true;
  }
  return false;


}
async function createSignature(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
async function determineSessionStatus() {
  //const { license } = await checkLicenseFree()
  if (await checkLicenseFree()) {
    return { status: 'free' };
  }
  const { license } = await chrome.storage.local.get('license');
  const apiResponse = await fetchLicenseStatus(license.user);
  if (!apiResponse.dateexpiration || apiResponse.dateexpiration === 0) {
    return { status: 'free' };
  }

  const expiryDate = new Date(apiResponse.dateexpiration);
  if (expiryDate >= new Date()) {
    return { status: 'premium' };
  } else {
    return { status: 'expired' };
  }
}
async function checkFreeTierDailyLimit() {
  const { deviceId, dailyUsage } = await chrome.storage.local.get(['deviceId', 'dailyUsage']);
  const todayStr = new Date().toISOString().split('T')[0];

  if (!dailyUsage || dailyUsage.date !== todayStr) return true;

  // Verify signature to prevent tampering
  const expectedSignature = await createSignature(`${deviceId}:${dailyUsage.date}:${dailyUsage.count}`);
  if (expectedSignature !== dailyUsage.signature) {
    alert("Usage data is corrupted. Sending disabled.");
    return false;
  }

  return dailyUsage.count < 20;
}
async function incrementUsageCount() {
  // This function is now only called for free tier users
  const { deviceId, dailyUsage } = await chrome.storage.local.get(['deviceId', 'dailyUsage']);
  const today = new Date().toISOString().split('T')[0];
  let currentCount = (dailyUsage && dailyUsage.date === today) ? dailyUsage.count : 0;
  const newCount = currentCount + 1;
  const newSignature = await createSignature(`${deviceId}:${today}:${newCount}`);
  
  await chrome.storage.local.set({ 
    dailyUsage: { count: newCount, date: today, signature: newSignature } 
  });
  console.log(`Free tier usage incremented. New count for ${today}: ${newCount}`);
}
async function getSendConfig() {
  // Define the same defaults here as a fallback
  const defaultTimes = {
    postSend: 3000
  };
}

// --- Tab & Scripting Helpers ---
async function findOrCreateWhatsAppTab() {
  let [tab] = await chrome.tabs.query({ url: "*://web.whatsapp.com/*" });
  if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      return tab;
  }
  return await chrome.tabs.create({ url: "https://web.whatsapp.com", active: true });
}

// Function to inject and execute a function from content.js by its name
function injectContentScriptFunction(tabId, functionName, args = []) {
  chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (name, funcArgs) => {
          // This is executed in the content script context
          if (window[name] && typeof window[name] === 'function') {
              window[name](...funcArgs);
          }
      },
      args: [functionName, args]
  });
}

function updateContentProgress(tabId, message, progress, isError = false) {
  injectContentScriptFunction(tabId, 'updateProgress', [message, progress, isError]);
}

// Injects the function responsible for the actual sending action
function injectSendFunction(tabId, message) {
  return new Promise(resolve => {
      chrome.scripting.executeScript({
          target: { tabId },
          func: sendMessageOnPage, // This function is defined below
          args: [message]
      }, (injectionResults) => {
           // Handle errors or get the result from the content script
           if (chrome.runtime.lastError) {
              resolve({ error: chrome.runtime.lastError.message });
           } else {
              resolve(injectionResults[0].result || { error: 'No result from content script' });
           }
      });
  });
}

// THIS FUNCTION IS INJECTED INTO THE WHATSAPP PAGE TO SEND A MESSAGE
// It has NO access to background script variables, only its arguments.
function sendMessageOnPage(message) {
  // These selectors are crucial for WhatsApp Web.
  const messageBoxSelector = 'div[contenteditable="true"][data-tab="10"]';
  const sendButtonSelector = "button[aria-label='Send'], button[aria-label='Enviar']";

  // Use a promise to handle async operations and return a result
  return new Promise(async (resolve) => {
      const waitForElement = (selector, timeout = 15000) => {
          return new Promise((res, rej) => {
              const interval = setInterval(() => {
                  const element = document.querySelector(selector);
                  if (element) {
                      clearInterval(interval);
                      clearTimeout(timer);
                      res(element);
                  }
              }, 500);
              const timer = setTimeout(() => {
                  clearInterval(interval);
                  rej(new Error(`Timeout: Element "${selector}" not found after ${timeout/1000}s. The number might be invalid or not on WhatsApp.`));
              }, timeout);
          });
      };

      try {
    /*       const messageBox = await waitForElement(messageBoxSelector);
          
          // Simulate typing for React to register it
          messageBox.focus();
          document.execCommand('insertText', false, message);
          messageBox.dispatchEvent(new Event('input', { bubbles: true }));

          // Wait a moment for the send button to become active
          await new Promise(res => setTimeout(res, 300)); */

          const sendButton = await waitForElement(sendButtonSelector);
          sendButton.click();
          
          // Wait a moment to ensure message is sent before next step
          await new Promise(res => setTimeout(res, 500));
          
          resolve({ success: true });

      } catch (error) {
          resolve({ error: error.message });
      }
  });
}











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

async function checkLicense(userKey) {
  const url = 'https://ausentismos.online/paypal/activateWhatsappLicense';
  const payload = {
    user: userKey,
    token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ"
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return await response.json();
  } catch (error) {
    console.error('Error fetching license:', error);
    return { dateexpiration: 0 };
  }
}
