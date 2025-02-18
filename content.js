(function () {
  // Prevent duplicate script execution
  if (window.__contentScriptLoaded) {
    console.log("✅ Content script already loaded.");
    return;
  }
  window.__contentScriptLoaded = true;

  console.log("✅ Content script loaded.");

  let lastClickTime = 0;
  let lastClickedElement = null;

  /**
   * Throttle function execution to avoid excessive calls.
   */
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

  /**
   * Click Guard: Prevents rapid clicks & clickjacking attempts
   */
  function clickGuard(event) {
    const now = Date.now();
    const clickedElement = event.target;

    console.log(`🖱 Clicked element:`, clickedElement);

    // Block clicks on hidden elements
    const style = window.getComputedStyle(clickedElement);
    if (
      style.opacity === "0" ||
      style.visibility === "hidden" ||
      style.display === "none" ||
      clickedElement.getBoundingClientRect().width === 0 ||
      clickedElement.getBoundingClientRect().height === 0
    ) {
      console.warn("❌ Click Blocked (Hidden Element):", clickedElement);
      event.preventDefault();
      event.stopPropagation();
      alert("⚠️ Clickjacking detected! Click blocked.");
      return;
    }

    // Prevent rapid double-clicking on different elements
    if (lastClickedElement && lastClickedElement !== clickedElement && now - lastClickTime < 500) {
      console.warn("❌ Click Blocked (Double Click Prevention)");
      event.preventDefault();
      event.stopPropagation();
      alert("⚠️ Suspicious rapid click detected! Click blocked.");
      return;
    }

    lastClickTime = now;
    lastClickedElement = clickedElement;
    console.log("✅ Click Allowed");
  }

  // Attach Click Guard to the document
  document.addEventListener("click", clickGuard, true);

  /**
   * Analyze iframe attributes and styles for potential threats.
   */
  function analyzeIframe(iframe) {
    const styles = window.getComputedStyle(iframe);
    const suspicious = [];

    // Check for hidden or suspicious iframe properties
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

    // Highlight suspicious iframes and log a warning
    if (suspicious.length > 0 && !iframe.dataset.logged) {
      console.warn("⚠️ Suspicious iframe detected:", iframe, suspicious);
      iframe.dataset.logged = true; // Mark as logged to prevent duplicate warnings
      iframe.style.border = "3px solid red";
    }
  }

  /**
   * Scan for all iframes on the page.
   */
  function scanIframes() {
    console.log("🔍 Scanning iframes...");
    const iframes = document.querySelectorAll("iframe");
    iframes.forEach((iframe) => analyzeIframe(iframe));
  }

  // Throttle iframe scanning to run every 500ms
  const throttledScanIframes = throttle(scanIframes, 500);

  /**
   * Monitor DOM changes to detect dynamically added iframes.
   */
  const observer = new MutationObserver(() => {
    throttledScanIframes();
  });

  // Start observing the DOM for changes
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial iframe scan
  scanIframes();

  console.log("✅ Iframe scanner and click guard initialized.");
})();
