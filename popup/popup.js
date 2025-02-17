document.addEventListener("DOMContentLoaded", () => {
  const linkCountElement = document.getElementById("link-count");
  const urlListContainer = document.getElementById("url-list");
  const API_URL = "http://52.175.16.74:5000/predict"; // Flask API URL
  let lastClickTime = 0;
  let lastClickedElement = null;

  /**
   * Scans for all links on the current page.
   */
  function scanPageUrls() {
    return Array.from(document.querySelectorAll("a, area, base, link"))
      .map(link => link.dataset.originalHref || link.href)
      .filter(href => href && href !== "javascript:void(0)");
  }

  /**
   * Fetch predictions for a given URL from the Flask backend API.
   */
  async function fetchPrediction(url) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error fetching prediction for ${url}:`, error);
      return null;
    }
  }

  /**
   * Click Guard: Prevents rapid clicks & clickjacking attempts
   */
  function clickGuard(event) {
    const now = Date.now();
    const clickedElement = event.target;

    // Block clicks on hidden elements
    const style = window.getComputedStyle(clickedElement);
    if (
      style.opacity === "0" ||
      style.visibility === "hidden" ||
      style.display === "none" ||
      clickedElement.getBoundingClientRect().width === 0 ||
      clickedElement.getBoundingClientRect().height === 0
    ) {
      console.warn("Blocked click on hidden element:", clickedElement);
      event.preventDefault();
      event.stopPropagation();
      alert("⚠️ Clickjacking detected! Click blocked.");
      return;
    }

    // Prevent rapid double-clicking on different elements
    if (lastClickedElement && lastClickedElement !== clickedElement && now - lastClickTime < 500) {
      console.warn("Double Clickjacking detected!");
      event.preventDefault();
      event.stopPropagation();
      alert("⚠️ Suspicious rapid click detected! Click blocked.");
      return;
    }

    lastClickTime = now;
    lastClickedElement = clickedElement;
  }

  // Attach click guard to the document
  document.addEventListener("click", clickGuard, true);

  /**
   * Updates the UI with scanned links and their latest predictions.
   */
  async function updateUI(urls) {
    linkCountElement.textContent = urls.length;

    if (urls.length === 0) {
      urlListContainer.innerHTML = "<p>No URLs found on this page.</p>";
      return;
    }

    urlListContainer.innerHTML = ""; // Clear previous results

    for (const url of urls) {
      const urlItem = document.createElement("div");
      urlItem.className = "url-item";

      const urlLink = document.createElement("a");
      urlLink.href = url;
      urlLink.target = "_blank";
      urlLink.textContent = url;
      urlLink.className = "url-link";

      const resultSpan = document.createElement("span");
      resultSpan.textContent = "Checking...";
      resultSpan.style.marginLeft = "10px";

      urlItem.appendChild(urlLink);
      urlItem.appendChild(resultSpan);
      urlListContainer.appendChild(urlItem);

      // Fetch prediction and update the result
      const prediction = await fetchPrediction(url);
      if (prediction) {
        let statusText;
        let color;

        if (prediction.virustotal && prediction.virustotal.risk) {
          // Use VirusTotal result only
          statusText = prediction.virustotal.risk;
          color = prediction.virustotal.risk === "Malicious" ? "red" : "green";
        } else {
          // If VirusTotal was not checked, fallback to the first round result
          statusText = prediction.prediction;
          color = prediction.prediction === "Malicious" ? "red" : "green";
        }

        resultSpan.textContent = statusText;
        resultSpan.style.color = color;
      } else {
        resultSpan.textContent = "Error fetching result.";
        resultSpan.style.color = "gray";
      }
    }
  }

  /**
   * Disables links on the page to prevent malicious clicks.
   */
  function disableLinks() {
    document.querySelectorAll("a").forEach(link => {
      if (link.classList.contains("processed")) return;

      if (!link.dataset.originalHref) {
        link.dataset.originalHref = link.href;
      }

      link.href = "javascript:void(0)";
      link.classList.add("disabled");

      link.addEventListener("mouseenter", function () {
        if (this.classList.contains("disabled")) {
          this.classList.remove("disabled");
          this.href = this.dataset.originalHref;
        }
      });

      link.addEventListener("mouseleave", function () {
        this.classList.add("disabled");
        this.href = "javascript:void(0)";
      });

      link.classList.add("processed");
    });
  }

  /**
   * Gets the current active tab.
   */
  async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  /**
   * Main function to scan links and update UI.
   */
  async function scanAndPredictLinks() {
    const tab = await getCurrentTab();

    chrome.scripting.executeScript(
      { target: { tabId: tab.id }, func: scanPageUrls },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error("Error scanning page:", chrome.runtime.lastError.message);
          return;
        }

        const urls = results[0].result;
        updateUI(urls);

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: disableLinks,
        });
      }
    );
  }

  // Watch for DOM changes and reapply click protection
  const observer = new MutationObserver(() => disableLinks());
  observer.observe(document.body, { childList: true, subtree: true });

  // Scan and predict links every 10 seconds
  setInterval(scanAndPredictLinks, 10000);

  // Run the initial scan and prediction when the popup is opened
  scanAndPredictLinks();
});
