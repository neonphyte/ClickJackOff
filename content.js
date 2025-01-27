(function () {
  // Prevent duplicate script execution
  if (window.__contentScriptLoaded) {
    console.log("Content script already loaded.");
    return;
  }
  window.__contentScriptLoaded = true;

  console.log("Content script loaded.");

  // Utility function to throttle execution
  function throttle(fn, limit) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn(...args);
      }
    };
  }

  // Analyze iframe attributes and styles
  function analyzeIframe(iframe) {
    const styles = window.getComputedStyle(iframe);
    const suspicious = [];

    // Check for suspicious iframe properties
    if (styles.opacity === "0" || styles.visibility === "hidden" || styles.display === "none") {
      suspicious.push("Hidden iframe detected");
    }

    const rect = iframe.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      suspicious.push("Zero-size iframe detected");
    }

    if (!iframe.hasAttribute("sandbox")) {
      suspicious.push("Missing sandbox attribute");
    }

    // Highlight suspicious iframe and log warning
    if (suspicious.length > 0 && !iframe.dataset.logged) {
      console.warn("Suspicious iframe detected:", iframe, suspicious);
      iframe.dataset.logged = true; // Mark iframe as logged to prevent duplicate logs
      iframe.style.border = "3px solid red";
    }
  }

  // Scan for all iframes on the page
  function scanIframes() {
    console.log("Scanning iframes...");
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => analyzeIframe(iframe));
  }

  // Throttle iframe scanning to run every 500ms
  const throttledScanIframes = throttle(scanIframes, 500);

  // Monitor DOM changes for dynamic iframe addition
  const observer = new MutationObserver(() => {
    throttledScanIframes();
  });

  // Start observing the DOM for changes
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial iframe scan
  scanIframes();

  console.log("Iframe scanner and observer initialized.");
})();
