document.getElementById("sendButton").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: sendMessages
  });
});

function sendMessages() {
  window.dispatchEvent(new CustomEvent("trigger-sending"));
}