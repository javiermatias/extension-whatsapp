const phoneNumbers = [
  "3543604130", "3543604130", "3543604130", "3543604130", "3543604130",
  "3543604130", "3543604130", "3543604130", "3543604130", "3543604130",
  "3543604130", "3543604130", "3543604130", "3543604130", "3543604130",
  "3543604130", "3543604130", "3543604130", "3543604130", "3543604130"
];

const message = "Hello from my Chrome Extension!";

window.addEventListener("trigger-sending", async () => {
  let i =0;
  for (const number of phoneNumbers) {
    console.log(`Sending to individual ${i}`);  
    i++;
    //const START_CHAT_XPATH = "//a[@href='/web/conversations/new?redirected=true']";
    // 1. Start new chat
    const newChatButton = document.querySelector('a[data-e2e-start-button]')
    if (newChatButton) {
      newChatButton.click();
      await sleep(2000);
    } else {
      console.error("New chat button not found");
      return;
    }

    // 2. Paste number and press Enter
    const input = document.querySelector("input");
    if (input) {
      input.focus();
      input.value = number;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(1500);
      const numberSpan = document.querySelector("span.anon-contact-name");
      if (numberSpan) {
        console.log(numberSpan);
        numberSpan.click();
      }


      await sleep(3000);
    } else {
      console.error("Phone input not found");
      return;
    }

    // 3. Write and send message
    const textArea = document.querySelector("textarea.input");
    if (textArea) {
      textArea.focus();
      textArea.value = message;
      textArea.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(2000);

      const xpath = "//mws-message-send-button[@class='floating-button']";
      const sendButton = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      const event = new CustomEvent("sendClicked", {
        bubbles: true,
        cancelable: true,
      });
      sendButton.dispatchEvent(event);
      await sleep(3000);
    } else {
      console.error("Text area not found");
      return;
    }
  }

  alert("Finished sending messages!");
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
