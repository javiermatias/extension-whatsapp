// Get all necessary elements from the DOM once
const sendButton = document.getElementById("sendButton");
const countElement = document.getElementById('contactCount');
const sendElement = document.getElementById('contactSend');
const openDataPageButton = document.getElementById('openDataPage');
const openContactPageButton = document.getElementById('openContactPage');
const helpButton = document.getElementById('helpButton'); // <-- ADD THIS LINE

// --- NEW: Function to update button text and state based on storage ---
async function updateButtonState() {
  // Check the 'isSending' flag in storage
  chrome.storage.local.get(['isSending'], (result) => {
    if (result.isSending) {
      // If a process is running, show the "Stop" button
      sendButton.textContent = "Stop Process";
      sendButton.classList.add('stop-button'); // Optional: for CSS styling
      sendButton.disabled = false; // Ensure button is enabled
    } else {
      // If no process is running, show the "Send" button
      sendButton.textContent = "Send Messages";
      sendButton.classList.remove('stop-button');
      sendButton.disabled = false;
    }
  });
}

// --- NEW: Listen for messages from the content script ---
// This is how we know the process has finished or been stopped on its own.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.status === 'process_finished') {
    // The process on the content page has ended, so update our state
    chrome.storage.local.set({ isSending: false }, () => {
      updateButtonState(); // Reset the button to "Send"
    });
  }
});


// --- MODIFIED: Main click listener for the send/stop button ---
sendButton.addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.startsWith("https://messages.google.com/")) {
    alert("Please navigate to messages.google.com to use this feature.");
    return;
  }

  // Check the current state to decide whether to send "start" or "stop"
  chrome.storage.local.get(['isSending'], (result) => {
    if (result.isSending) {
      // --- If it's currently sending, send a STOP command ---
      console.log("Sending 'stop' command to content script.");
      chrome.tabs.sendMessage(tab.id, { command: "stop_sending" });
      sendButton.textContent = "Stopping...";
      sendButton.disabled = true; // Briefly disable to prevent multiple clicks
    } else {
      // --- If it's not sending, send a START command ---
      console.log("Sending 'start' command to content script.");
      // First, set the state to "sending"
      chrome.storage.local.set({ isSending: true }, () => {
        // Then, send the message to start the process
        chrome.tabs.sendMessage(tab.id, { command: "start_sending" });
        // Finally, update the button UI immediately
        updateButtonState();
      });
    }
  });
});


// --- MODIFIED: DOMContentLoaded listener ---
// This now handles all initialization logic for the popup.
document.addEventListener('DOMContentLoaded', function() {
  // 1. Set the correct initial state of the Send/Stop button
  updateButtonState();

  // 2. Load and display contact counts (your original code)
  chrome.storage.local.get(['contactList'], function(result) {
    let count = 0;
    let countSend = 0;
    if (result.contactList && Array.isArray(result.contactList)) {
      count = result.contactList.length;
      countSend = result.contactList.filter(contact => contact.sent).length;
    }
    countElement.textContent = `Contacts Loaded: ${count}`;
    sendElement.textContent = `Sent Messages: ${countSend}`;
  });

  // 3. Set up other button listeners (your original code)
  if (openDataPageButton) {
    openDataPageButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  if (openContactPageButton) {
    openContactPageButton.addEventListener('click', function() {
      chrome.tabs.create({
        url: chrome.runtime.getURL('contacts.html')
      });
    });
  }

  // --- ADD THIS NEW BLOCK FOR THE HELP BUTTON ---
  if (helpButton) {
    helpButton.addEventListener('click', function() {
      // Open the help.html page in a new tab
      chrome.tabs.create({
        url: chrome.runtime.getURL('help.html')
      });
    });
  }
  // --- END OF NEW BLOCK ---
});