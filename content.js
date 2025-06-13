// --- Global Flags for State Management ---
// NEW: This flag will be set to true by the popup to stop the process.
window.shouldStop = false; 
// This flag prevents multiple sending processes from running at once.
window.isSendingMessages = false; 

// A simple helper function for delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- UI Functions (Progress Widget & Summary Report) ---
// These functions remain unchanged.
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


// --- NEW: Message Listener from Popup ---
// This replaces the old "trigger-sending" event listener.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start_sending") {
    console.log("Start command received.");
    startSendingProcess();
    sendResponse({ status: "started" });
  } else if (message.command === "stop_sending") {
    console.log("Stop command received.");
    if (window.isSendingMessages) {
      window.shouldStop = true; // Set the flag
      updateProgress("Stopping process...", -1, false);
    }
    sendResponse({ status: "stopping" });
  }
  return true; // Keep the message channel open for an async response
});


// --- MODIFIED: Main Sending Logic wrapped in a function ---
async function startSendingProcess() {
  if (!window.location.href.startsWith("https://messages.google.com/")) {
    alert("This script can only be run on messages.google.com.");
    return;
  }
  if (window.isSendingMessages) {
    alert("A sending process is already in progress.");
    return;
  }

  // Set initial state
  window.isSendingMessages = true;
  window.shouldStop = false; // Reset stop flag at the start of a new process

  createProgressWidget();
  updateProgress("Loading contacts...", 0);

  chrome.storage.local.get(['contactList'], async (result) => {
    // MODIFIED: Use a 'finally' block for cleanup
    try {
      if (chrome.runtime.lastError || !result.contactList) {
        throw new Error("Could not load contacts.");
      }

      const fullContactList = result.contactList;
      const contactsToSend = fullContactList.filter(contact => !contact.sent);
      const successfullySent = [];
      const failedToSend = [];

      if (contactsToSend.length === 0) {
        updateProgress("All contacts have already been sent!", 100);
        setTimeout(() => document.getElementById("sender-progress-widget")?.remove(), 4000);
        return; // Exit early, 'finally' will still run
      }

      // The main sending loop
      for (let i = 0; i < contactsToSend.length; i++) {
        // --- NEW: Check if the user clicked "Stop" in the popup ---
        if (window.shouldStop) {
          updateProgress(`Process stopped by user. ${successfullySent.length} messages were sent.`, -1, true);
          break; // Exit the loop
        }
        // -------------------------------------------------------------

        const contact = contactsToSend[i];
        const overallProgress = ((i + 1) / contactsToSend.length) * 100;
        updateProgress(`Sending ${i + 1}/${contactsToSend.length} to ${contact.number}...`, overallProgress);

        try {
          await sendMessage(contact.number, contact.message);
          successfullySent.push(contact);
          const index = fullContactList.findIndex(c => c.number === contact.number && c.message === contact.message);
          if (index !== -1) fullContactList[index].sent = true;
          await new Promise(resolve => chrome.storage.local.set({ 'contactList': fullContactList }, resolve));
        } catch (error) {
          console.error(`Failed to send to ${contact.number}:`, error.message);
          updateProgress(`Failed for ${contact.number}. Continuing...`, overallProgress, true);
          contact.error = error.message;
          failedToSend.push(contact);
          await sleep(3000);
        }
      }
      
      // --- MODIFIED: Only show the report if the process completed normally ---
      if (!window.shouldStop) {
        showSummaryReport(successfullySent, failedToSend);
      }

    } catch (error) {
      updateProgress(`Error: ${error.message}`, 0, true);
    } finally {
      // --- NEW: This block always runs, ensuring state is reset ---
      console.log("Process finished or stopped. Cleaning up.");
      window.isSendingMessages = false; // Allow a new process to start
      await chrome.storage.local.set({ isSending: false });
      console.log("✅ 'isSending' flag in chrome.storage has been set to false.");
      // Tell the popup that the process is over so it can reset its button
      chrome.runtime.sendMessage({ status: 'process_finished' });
    }
  });
}


// --- Core sendMessage Function (Unchanged) ---
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
    await sleep(3000);
}