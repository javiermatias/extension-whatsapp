// content.js

// --- Global Flags & Helpers ---
window.shouldStop = false;
window.isSendingMessages = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =====================================================================
// --- PERMISSION & USAGE-TRACKING LOGIC ---
// =====================================================================

async function fetchLicenseStatus(userKey) {
  try {
    const url = 'https://ausentismos.online/paypal/licensestatus';
    const payload = { user: userKey, mex: false, token: "EMQzHBjq0YYpLHWWDjN-KGcVES4j-JYQ2FDHb6HjumFpQTbZclDMHIAmCULgK4Aa5pRSSs7f_OUB8mqQ" };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) return { dateexpiration: 0 };
    return await response.json();
  } catch (error) {
    console.error('Network error checking license:', error);
    return { dateexpiration: 0 };
  }
}

/**
 * The ONE-TIME check performed at the START of a sending process.
 * Determines if the session is 'premium', 'expired', or 'free'.
 * @returns {Promise<{status: 'premium' | 'free' | 'expired'}>}
 */
async function determineSessionStatus() {
  const { license } = await chrome.storage.local.get('license');
  if (!license || !license.user) {
    return { status: 'free' };
  }

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

async function checkFreeTierDailyLimit() { /* ... same as before ... */ }
async function createSignature(message) { /* ... same as before ... */ }
async function incrementUsageCount() { /* ... same as before ... */ }

// =====================================================================
// --- UI Functions (With NEW License Expired Modal) ---
// =====================================================================
function createProgressWidget() { /* ... same as before ... */ }
function updateProgress(message, progressPercentage, isError = false) { /* ... same as before ... */ }
function showSummaryReport(successes, failures) { /* ... same as before ... */ }
function showLimitReachedModal() { /* ... same as before ... */ }

/**
 * NEW: Displays a friendly modal when a license has expired.
 */
function showLicenseExpiredModal() {
  if (document.getElementById("sender-expired-modal")) return;
  const modal = document.createElement("div");
  modal.id = "sender-expired-modal";
  modal.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; background-color: white; border-radius: 12px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); z-index: 10001; font-family: Arial, sans-serif; text-align: center;";
  
  modal.innerHTML = `
    <h2 style="color: #d93025; margin: 0 0 15px 0; font-size: 22px;">Your License Has Expired</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
      Your premium access has ended. You can continue using the tool on the free plan with a daily limit.
    </p>
    <div style="background-color: #f1f3f4; padding: 15px; border-radius: 8px;">
      <h3 style="margin: 0 0 10px 0; color: #333;">Want to Renew?</h3>
      <p style="margin: 0; color: #555;">To restore unlimited sending, please contact the administrators to renew your license.</p>
    </div>
    <button id="close-expired-modal-btn" style="width: 100%; padding: 12px; margin-top: 20px; background-color: #1a73e8; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">Got It</button>
  `;
  
  document.body.appendChild(modal);
  document.getElementById("close-expired-modal-btn").addEventListener("click", () => modal.remove());
}

// --- Message Listener ---
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
// --- Main Sending Logic (Updated with Final Permission System) ---
// =====================================================================
async function startSendingProcess() {
  if (window.isSendingMessages) {
    alert("A sending process is already in progress.");
    return;
  }

  // *** STEP 1: Perform the permission check ONCE before anything else ***
  const session = await determineSessionStatus();

  // *** STEP 2: Handle an expired license immediately and STOP ***
  if (session.status === 'expired') {
    showLicenseExpiredModal();
    return; // Do not proceed
  }

  // --- If we get here, the user is either 'premium' or 'free' ---
  window.isSendingMessages = true;
  window.shouldStop = false;
  
  createProgressWidget();
  updateProgress(session.status === 'premium' ? "Premium license active. Loading contacts..." : "Free tier active. Loading contacts...", 0);
  
  try {
    const { contactList } = await chrome.storage.local.get('contactList');
    if (!contactList) throw new Error("Could not load contacts.");

    const contactsToSend = contactList.filter(c => !c.sent);
    if (contactsToSend.length === 0) {
      updateProgress("All contacts sent!", 100);
      setTimeout(() => document.getElementById("sender-progress-widget")?.remove(), 4000);
      return;
    }

    const successfullySent = [], failedToSend = [];
    for (let i = 0; i < contactsToSend.length; i++) {
      if (window.shouldStop) {
        updateProgress(`Process stopped by user.`, -1, true);
        break;
      }
      
      if (session.status === 'free') {
        const isAllowed = await checkFreeTierDailyLimit();
        if (!isAllowed) {
          showLimitReachedModal();
          break;
        }
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

        if (session.status === 'free') {
          await incrementUsageCount();
        }

      } catch (error) {
        contact.error = error.message;
        failedToSend.push(contact);
        updateProgress(`Failed for ${contact.number}. Continuing...`, overallProgress, true);
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

// --- Core sendMessage Function and other helpers (Paste your full functions here) ---
async function sendMessage(number, message) { /* ...your existing sendMessage logic... */ }
async function createSignature(message) { /* ...your existing createSignature logic... */ }
async function checkFreeTierDailyLimit() {
  const { deviceId, dailyUsage } = await chrome.storage.local.get(['deviceId', 'dailyUsage']);
  if (!deviceId) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  if (!dailyUsage || dailyUsage.date !== todayStr) return true;
  const expectedSignature = await createSignature(`${deviceId}:${dailyUsage.date}:${dailyUsage.count}`);
  if (expectedSignature !== dailyUsage.signature) {
    alert("Usage data is corrupted. Sending disabled.");
    return false;
  }
  return dailyUsage.count < 20;
}
async function incrementUsageCount() { /* ...your existing incrementUsageCount logic... */ }
// ... and all your UI functions