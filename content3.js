// content.js

// --- Global Flags for State Management ---
window.shouldStop = false;
window.isSendingMessages = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =====================================================================
// --- PERMISSION AND USAGE-TRACKING LOGIC ---
// =====================================================================

async function createSignature(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The central gatekeeper function. Checks for a valid license first,
 * then falls back to the free tier daily limit.
 * @returns {Promise<{allowed: boolean, reason?: 'limit_reached' | 'license_expired'}>}
 */
async function checkPermission() {
  const { deviceId, license, dailyUsage } = await chrome.storage.local.get(['deviceId', 'license', 'dailyUsage']);

  if (!deviceId) {
    alert("Extension error: Device ID is missing. Please try reinstalling.");
    return { allowed: false };
  }

  // --- 1. Check for a Paid License ---
  if (license && license.expires && license.signature) {
    const expectedSignature = await createSignature(`${deviceId}:${license.expires}`);
    if (expectedSignature !== license.signature) {
      alert("License data is corrupted. Sending disabled.");
      return { allowed: false };
    }

    const expiryDate = new Date(license.expires);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date

    if (expiryDate >= today) {
      console.log("✅ Valid license found. Unlimited sending enabled.");
      return { allowed: true }; // User has a valid license
    } else {
      console.log("License expired.");
      return { allowed: false, reason: 'license_expired' };
    }
  }

  // --- 2. Fallback to Free Tier Daily Limit ---
  const FREE_TIER_LIMIT = 20;
  const todayStr = new Date().toISOString().split('T')[0];

  if (!dailyUsage || dailyUsage.date !== todayStr) {
    return { allowed: true }; // First use of the day
  }

  const expectedUsageSignature = await createSignature(`${deviceId}:${dailyUsage.date}:${dailyUsage.count}`);
  if (expectedUsageSignature !== dailyUsage.signature) {
    alert("Usage data is corrupted. Sending disabled.");
    return { allowed: false };
  }

  if (dailyUsage.count >= FREE_TIER_LIMIT) {
    return { allowed: false, reason: 'limit_reached' };
  }

  return { allowed: true };
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

// =====================================================================
// --- UI Functions (Includes NEW License Expired Modal) ---
// =====================================================================

function createProgressWidget() {
  if (document.getElementById("sender-progress-widget")) return;
  const widget = document.createElement("div");
  widget.id = "sender-progress-widget";
  widget.style.cssText = "position: fixed; bottom: 20px; right: 20px; width: 300px; background-color: white; border: 1px solid #ccc; border-radius: 8px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 9999; font-family: Arial, sans-serif; font-size: 14px;";
  widget.innerHTML = `<h4 style="margin: 0 0 10px 0; padding: 0; color: #333;">Bulk Sender Progress</h4><p id="sender-status-text" style="margin: 0; color: #555;">Initializing...</p><div style="background-color: #e0e0e0; border-radius: 5px; margin-top: 10px; overflow: hidden;"><div id="sender-progress-bar" style="width: 0%; height: 10px; background-color: #007bff;"></div></div>`;
  document.body.appendChild(widget);
}

function updateProgress(message, progressPercentage, isError = false) {
  const statusText = document.getElementById("sender-status-text");
  const progressBar = document.getElementById("sender-progress-bar");
  if (statusText) statusText.textContent = message;
  if (progressBar) {
    // If progress is -1, it's an indeterminate state like "Stopping..."
    progressBar.style.width = progressPercentage === -1 ? '100%' : `${progressPercentage}%`;
    progressBar.style.backgroundColor = progressPercentage === -1 ? "#6c757d" : (isError ? "#ffc107" : "#007bff");
  }
}

function showSummaryReport(successes, failures) {
    const progressWidget = document.getElementById("sender-progress-widget");
    if (progressWidget) progressWidget.remove();
    const report = document.createElement("div");
    report.id = "sender-summary-report";
    report.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 450px; max-height: 80vh; background-color: white; border: 1px solid #ccc; border-radius: 8px; padding: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); z-index: 10000; font-family: Arial, sans-serif; overflow-y: auto;";
    const successItems = successes.map(c => `<li style="color: green;">${c.number}</li>`).join('') || '<li>None</li>';
    const failureItems = failures.map(c => `<li style="color: red;">${c.number} - <i style="color:#555;">${c.error}</i></li>`).join('') || '<li>None</li>';
    report.innerHTML = `<h3 style="margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #eee;">Campaign Finished</h3><h4 style="margin: 10px 0 5px 0;">✅ Successful Sends (${successes.length})</h4><ul style="list-style-type: none; padding: 0; margin: 0 0 15px 0; max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 5px;">${successItems}</ul><h4 style="margin: 10px 0 5px 0;">❌ Failed Sends (${failures.length})</h4><ul style="list-style-type: none; padding: 0; margin: 0 0 20px 0; max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 5px;">${failureItems}</ul><button id="close-summary-btn" style="width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>`;
    document.body.appendChild(report);
    document.getElementById("close-summary-btn").addEventListener("click", () => { report.remove(); });
}

function showLimitReachedModal() {
  if (document.getElementById("sender-limit-modal")) return;
  const modal = document.createElement("div");
  modal.id = "sender-limit-modal";
  modal.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; background-color: white; border-radius: 12px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 10001; font-family: Arial, sans-serif; text-align: center;";
  
  modal.innerHTML = `
    <h2 style="color: #1a73e8; margin: 0 0 15px 0; font-size: 22px;">Daily Limit Reached</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      You've sent your 20 free messages for the day. Thank you for using our tool!
    </p>
    <div style="background-color: #f1f3f4; padding: 15px; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Upgrade for Unlimited Sending</h3>
      <p style="margin: 0; color: #555;">To send unlimited messages and support our development, please consider purchasing a license.</p>
    </div>
    <button id="close-limit-modal-btn" style="width: 100%; padding: 12px; margin-top: 20px; background-color: #1a73e8; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">Got it</button>
  `;
  
  document.body.appendChild(modal);
  document.getElementById("close-limit-modal-btn").addEventListener("click", () => modal.remove());
}

/**
 * Displays a friendly modal when a license has expired.
 */
function showLicenseExpiredModal() {
  if (document.getElementById("sender-expired-modal")) return;
  const modal = document.createElement("div");
  modal.id = "sender-expired-modal";
  modal.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; background-color: white; border-radius: 12px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 10001; font-family: Arial, sans-serif; text-align: center;";
  
  modal.innerHTML = `
    <h2 style="color: #d93025; margin: 0 0 15px 0; font-size: 22px;">Your License Has Expired</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Your premium access has ended, and you have been reverted to the free plan.
    </p>
    <div style="background-color: #f1f3f4; padding: 15px; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Want to Renew?</h3>
      <p style="margin: 0; color: #555;">To continue with unlimited sending, please contact our support to renew your license.</p>
    </div>
    <button id="close-expired-modal-btn" style="width: 100%; padding: 12px; margin-top: 20px; background-color: #1a73e8; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">Continue on Free Plan</button>
  `;
  
  document.body.appendChild(modal);
  document.getElementById("close-expired-modal-btn").addEventListener("click", () => modal.remove());
}

// --- Message Listener from Popup ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start_sending") startSendingProcess();
  if (message.command === "stop_sending" && window.isSendingMessages) {
    window.shouldStop = true;
    updateProgress("Stopping process...", -1, false);
  }
  sendResponse({ status: "acknowledged" });
  return true;
});


// =====================================================================
// --- REFACTORED: Main Sending Logic with Full Permission System ---
// =====================================================================
async function startSendingProcess() {
  if (window.isSendingMessages) {
    alert("A sending process is already in progress.");
    return;
  }
  
  window.isSendingMessages = true;
  window.shouldStop = false;

  createProgressWidget();
  updateProgress("Loading contacts...", 0);
  
  try {
    const { contactList, license } = await chrome.storage.local.get(['contactList', 'license']);
    if (!contactList) throw new Error("Could not load contacts.");

    const contactsToSend = contactList.filter(c => !c.sent);
    if (contactsToSend.length === 0) {
      updateProgress("All contacts have already been sent!", 100);
      setTimeout(() => document.getElementById("sender-progress-widget")?.remove(), 4000);
      return;
    }

    const successfullySent = [], failedToSend = [];
    for (let i = 0; i < contactsToSend.length; i++) {
      if (window.shouldStop) {
        updateProgress(`Process stopped by user.`, -1, true);
        break;
      }
      
      const permission = await checkPermission();
      if (!permission.allowed) {
        if (permission.reason === 'license_expired') showLicenseExpiredModal();
        if (permission.reason === 'limit_reached') showLimitReachedModal();
        break;
      }
      
      const contact = contactsToSend[i];
      const overallProgress = ((i + 1) / contactsToSend.length) * 100;
      updateProgress(`Sending ${i + 1}/${contactsToSend.length} to ${contact.number}...`, overallProgress);

      try {
        await sendMessage(contact.number, contact.message);
        successfullySent.push(contact);
        const index = contactList.findIndex(c => c.number === contact.number && c.message === contact.message);
        if (index !== -1) contactList[index].sent = true;
        await chrome.storage.local.set({ 'contactList': contactList });

        // **CRITICAL CHANGE**: Only increment usage if the user is on the free tier
        const hasValidLicense = license && license.expires && new Date(license.expires) >= new Date();
        if (!hasValidLicense) {
          await incrementUsageCount();
        }

      } catch (error) {
        contact.error = error.message;
        failedToSend.push(contact);
        updateProgress(`Failed for ${contact.number}. Retrying...`, overallProgress, true);
        await sleep(3000);
      }
    }
    if (!window.shouldStop) showSummaryReport(successfullySent, failedToSend);

  } catch (error) {
    updateProgress(`Error: ${error.message}`, 0, true);
  } finally {
    window.isSendingMessages = false;
    await chrome.storage.local.set({ isSending: false });
    chrome.runtime.sendMessage({ status: 'process_finished' });
  }
}

// --- Core sendMessage Function (This can remain unchanged) ---
async function sendMessage(number, message) {
  // 1. Start new chat
  const newChatButton = document.querySelector('a[data-e2e-start-button]');
  if (!newChatButton) throw new Error("Could not find 'Start chat' button.");
  newChatButton.click();
  await sleep(2000);

  // 2. Enter number
  const input = document.querySelector("input");
  if (!input) throw new Error("Could not find number input field.");
  input.focus();
  input.value = number;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(3000);

  // Click the conversation item
  const conversationItem = document.querySelector("span.anon-contact-name");
  if (!conversationItem) throw new Error(`Number not found or invalid.`);
  conversationItem.click();
  await sleep(5000);

  // 3. Write and send message
  const textArea = document.querySelector("textarea.input");
  if (!textArea) throw new Error("Could not find message text area.");
  textArea.value = message;
  textArea.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(2000);

  const xpath = "//mws-message-send-button[@class='floating-button']";
  const sendButton = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  if (!sendButton) throw new Error("Could not find send button.");
  const event = new CustomEvent("sendClicked", {
    bubbles: true,
    cancelable: true,
  });
  sendButton.dispatchEvent(event);
  
  // --- INTEGRATION POINT: Increment count AFTER successful send ---
   await incrementUsageCount();
  // --- END INTEGRATION ---
  await sleep(3000);
}

// --- PASTE YOUR FULL, ORIGINAL UI FUNCTIONS HERE ---
//function createProgressWidget() { /* ... */ }
//function updateProgress(message, progressPercentage, isError = false) { /* ... */ }
//function showSummaryReport(successes, failures) { /* ... */ }
//function showLimitReachedModal() { /* ... */ }
