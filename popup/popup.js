document.addEventListener("DOMContentLoaded", () => {
  const linkCountElement = document.getElementById("link-count");
  const urlListContainer = document.getElementById("url-list");
  const API_URL = "http://52.175.16.74:5000/predict"; // Replace with your Flask API URL

  /**
   * Scans for all links on the current page.
   * This function runs in the context of the active tab.
   */
  function scanPageUrls() {
    const links = Array.from(document.querySelectorAll("a"));
    return links
      .map((link) => {
        // Use data-original-href if available, otherwise use href
        return link.dataset.originalHref || link.href;
      })
      .filter((href) => href && href !== "javascript:void(0)"); // Filter out invalid links
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
   * Updates the UI with scanned links and their predictions.
   */
  async function updateUI(urls) {
    linkCountElement.textContent = urls.length;

    if (urls.length === 0) {
      urlListContainer.innerHTML = "<p>No URLs found on this page.</p>";
      return;
    }

    // Clear previous results
    urlListContainer.innerHTML = "";

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
        resultSpan.textContent = `${prediction.prediction}`;
        resultSpan.style.color = prediction.prediction === "Malicious" ? "red" : "green";
      } else {
        resultSpan.textContent = "Error fetching result.";
        resultSpan.style.color = "gray";
      }
    }
  }

  /**
   * Disables links on the page by replacing `href` with `javascript:void(0)`.
   */
  function disableLinks() {
    const links = document.querySelectorAll("a");

    links.forEach((link) => {
      // Skip already processed links
      if (link.classList.contains("processed")) return;

      // Store the original href in data-original-href
      if (!link.dataset.originalHref) {
        link.dataset.originalHref = link.href;
      }

      // Disable the link by setting href to "javascript:void(0)"
      link.href = "javascript:void(0)";
      link.classList.add("disabled"); // Add a class for styling

      // Enable the link temporarily on hover
      link.addEventListener("mouseenter", function () {
        if (this.classList.contains("disabled")) {
          this.classList.remove("disabled");
          this.href = this.dataset.originalHref; // Restore the original href
        }
      });

      // Re-disable the link when the user stops hovering
      link.addEventListener("mouseleave", function () {
        this.classList.add("disabled");
        this.href = "javascript:void(0)";
      });

      // Mark as processed
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
   * Main function to scan links on the active tab and update the UI with predictions.
   */
  async function scanAndPredictLinks() {
    // Get the active tab
    const tab = await getCurrentTab();

    // Use Chrome's scripting API to scan links on the page
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: scanPageUrls, // This function will run in the tab's context
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error("Error scanning page:", chrome.runtime.lastError.message);
          return;
        }
        const urls = results[0].result;
        updateUI(urls);

        // Make links non-clickable
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: disableLinks, // Execute the disableLinks function
        });
      }
    );
  }

  // Watch for DOM changes and reapply click protection
  const observer = new MutationObserver(() => {
    disableLinks();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Scan and predict links every 10 seconds
  setInterval(scanAndPredictLinks, 10000);

  // Run the initial scan and prediction when the popup is opened
  scanAndPredictLinks();
});
