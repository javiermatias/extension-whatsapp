
// --- Global Flags (less important now, but can be useful) ---
// =====================================================================
window.isWidgetVisible = false;

// =====================================================================
// --- MESSAGE LISTENER (Listens for commands from Background.js) ---
// =====================================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Note: We don't need to check sender, as these are targeted messages from our background
    if (message.command === 'create_widget') {
        createProgressWidget();
    }
    if (message.command === 'update_progress') {
        const { statusText, progress, isError } = message.payload;
        updateProgress(statusText, progress, isError);
    }
    if (message.command === 'show_summary') {
        const { successes, failures } = message.payload;
        showSummaryReport(successes, failures);
    }
    if (message.command === 'show_limit_modal') {
        showLimitReachedModal();
    }
    if (message.command === 'show_expired_modal') {
        showLicenseExpiredModal();
    }
    sendResponse({ status: "acknowledged" });
    return true;
});


// =====================================================================
// --- UI Functions (Your code, unchanged, just pasted here) ---
// =====================================================================
// These functions are now exposed to the global `window` object so
// the background script can call them via `executeScript`.

window.createProgressWidget = function() {
  if (document.getElementById("sender-progress-widget")) return;
  const widget = document.createElement("div");
  // ... (paste your full createProgressWidget function here)
  widget.id = "sender-progress-widget";
  widget.style.cssText = "position: fixed; bottom: 20px; right: 20px; width: 300px; background-color: white; border: 1px solid #ccc; border-radius: 8px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); z-index: 9999; font-family: Arial, sans-serif; font-size: 14px;";
  widget.innerHTML = `<h4 style="margin: 0 0 10px 0; padding: 0; color: #333;">Bulk Sender Progress</h4><p id="sender-status-text" style="margin: 0; color: #555;">Initializing...</p><div style="background-color: #e0e0e0; border-radius: 5px; margin-top: 10px; overflow: hidden;"><div id="sender-progress-bar" style="width: 0%; height: 10px; background-color: #007bff;"></div></div>`;
  document.body.appendChild(widget);
  window.isWidgetVisible = true;
};

window.updateProgress = function(message, progressPercentage, isError = false) {
  // Ensure the widget exists first
  if (!window.isWidgetVisible) window.createProgressWidget();
  // ... (paste your full updateProgress function here)
  const statusText = document.getElementById("sender-status-text");
  const progressBar = document.getElementById("sender-progress-bar");
  if (statusText) statusText.textContent = message;
  if (progressBar) {
    progressBar.style.width = progressPercentage === -1 ? '100%' : `${progressPercentage}%`;
    progressBar.style.backgroundColor = progressPercentage === -1 ? "#6c757d" : (isError ? "#ffc107" : "#007bff");
  }
};

window.showSummaryReport = function(successes, failures) {
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
};

window.showLimitReachedModal = function() {
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
};

window.showLicenseExpiredModal = function() {
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
};







