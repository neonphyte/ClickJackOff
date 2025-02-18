// // Monitor tab updates
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//     if (changeInfo.status === 'complete') {
//       // Inject your content script whenever a tab is fully loaded
//       chrome.scripting.executeScript({
//         target: { tabId },
//         files: ['content.js'], // Your main script
//       });
//     }
//   });
  
//   // Monitor tab activation
//   chrome.tabs.onActivated.addListener((activeInfo) => {
//     chrome.tabs.get(activeInfo.tabId, (tab) => {
//       if (tab.status === 'complete') {
//         // Reapply your script on the active tab
//         chrome.scripting.executeScript({
//           target: { tabId: tab.id },
//           files: ['content.js'],
//         });
//       }
//     });
//   });

chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0) {
      console.log(`Injecting Click Guard into tab: ${details.tabId}`);
  
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ["content.js"]  // Inject click guard into popups
      });
    }
  });
  