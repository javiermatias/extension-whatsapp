document.getElementById("sendButton").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Make sure we are on the right website before sending the trigger
  if (tab.url && tab.url.startsWith("https://messages.google.com/")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: triggerSendingProcess
    });
  } else {
    alert("Please navigate to messages.google.com to send messages.");
  }
});







function triggerSendingProcess() {
  window.dispatchEvent(new CustomEvent("trigger-sending"));
}

document.getElementById('openDataPage').addEventListener('click', () => {
  chrome.runtime.openOptionsPage(); // Will open data.html if set in manifest
});

 document.addEventListener('DOMContentLoaded', function() {
  const countElement = document.getElementById('contactCount');
  chrome.storage.local.get(['contactList'], function(result) {
    let count = 0;
    // Check if the result has the contactList and if it's an array
    if (result.contactList && Array.isArray(result.contactList)) {
      count = result.contactList.length;
    }
    // Update the text content of our <p> element
    countElement.textContent = `Contacts Loaded: ${count}`;
  });
 });