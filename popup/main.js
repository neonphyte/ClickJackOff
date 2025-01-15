chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "iframe-detection") {
      console.log("Detected iframe:", message.data);
      sendResponse({ status: "logged" });
    }
  });
  