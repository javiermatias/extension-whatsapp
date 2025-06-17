// --- Get all necessary elements from the DOM ---
const sendButton = document.getElementById("sendButton");
const countElement = document.getElementById('contactCount');
const sendElement = document.getElementById('contactSend');
const openDataPageButton = document.getElementById('openDataPage');
const openContactPageButton = document.getElementById('openContactPage');
const openActivate = document.getElementById('openActivate');
const helpButton = document.getElementById('helpButton');
//openActivate

// --- Function to update button text and state based on storage ---
// Uses async/await for cleaner syntax.
async function updateButtonState() {
  const { isSending } = await chrome.storage.local.get('isSending');
  if (isSending) {
    sendButton.textContent = "Stop Process";
    sendButton.classList.add('stop-button');
    sendButton.disabled = false;
  } else {
    sendButton.textContent = "Send Messages";
    sendButton.classList.remove('stop-button');
    sendButton.disabled = false;
  }
}

// --- Listen for messages from the content script ---
// This is now simpler as per your request.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.status === 'process_finished') {
    // The content script has already updated the storage.
    // The popup's only job is to refresh its button to reflect that change.
    console.log("Popup received 'process_finished' message. Updating UI.");
    updateButtonState();
  }
  return true; // Keep message channel open for async responses if needed
});

// --- Main click listener for the send/stop button ---
// Refactored with async/await and a try/catch block for robust error handling.
sendButton.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.startsWith("https://messages.google.com/")) {
      alert("Please navigate to messages.google.com to use this feature.");
      return;
    }

    const { isSending } = await chrome.storage.local.get('isSending');

    if (isSending) {
      // --- If it's currently sending, send a STOP command ---
      console.log("Popup: Sending 'stop' command.");
      sendButton.textContent = "Stopping...";
      sendButton.disabled = true; // Briefly disable to prevent multiple clicks
      await chrome.tabs.sendMessage(tab.id, { command: "stop_sending" });
      // The content script will handle resetting state and notifying us back.
    } else {
      // --- If it's not sending, send a START command ---
      console.log("Popup: Sending 'start' command.");
      await chrome.storage.local.set({ isSending: true });
      updateButtonState(); // Update UI immediately
      await chrome.tabs.sendMessage(tab.id, { command: "start_sending" });
    }
  } catch (error) {
    // THIS IS THE FIX for "Receiving end does not exist"
    if (error.message.includes("Could not establish connection")) {
      alert("Connection failed. Please RELOAD the Google Messages tab and try again.");
      console.error("Connection Error:", error.message);
      // CRITICAL: Reset the state since the 'start' command failed
      await chrome.storage.local.set({ isSending: false });
      updateButtonState(); // Update the button back to "Send"
    } else {
      // Handle any other unexpected errors
      console.error("An unexpected error occurred:", error);
      alert("An unexpected error occurred. Check the console for details.");
    }
  }
});

// --- Initialization logic when the popup is opened ---
// Also refactored to use async/await.
document.addEventListener('DOMContentLoaded', async function() {
  // 1. Set the correct initial state of the Send/Stop button
  await updateButtonState();

  // 2. Load and display contact counts
  const { contactList } = await chrome.storage.local.get('contactList');
  let count = 0;
  let countSend = 0;
  if (contactList && Array.isArray(contactList)) {
    count = contactList.length;
    countSend = contactList.filter(contact => contact.sent).length;
  }
  countElement.textContent = `Contacts Loaded: ${count}`;
  sendElement.textContent = `Sent Messages: ${countSend}`;

  // 3. Set up other button listeners (using optional chaining ?. for safety)
  openDataPageButton?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  openContactPageButton?.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('contacts.html') });
  });

  openActivate?.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('activate.html') });
  });
  

  helpButton?.addEventListener('click', function() {
    chrome.tabs.create({ url: chrome.runtime.getURL('help.html') });
  });
});