document.addEventListener("DOMContentLoaded", () => {
  const linkCountElement = document.getElementById("link-count");
  const urlListContainer = document.getElementById("url-list");
  const API_URL = "http://52.175.16.74:5000/predict"; // Flask API URL
  // const CHECK_DOWNLOAD_LINK_API_URL = "http://20.2.169.240:5210" // BASE URL for Flask API in 2nd VM
  const API_URL_SECONDARY = "http://20.2.169.240:5210/checkDownloadable"; // Flask API to Secondary VM (RyanER VM)
  
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
   * Fetch Additional check for downloadable files/Links from Secondary VM
  */
async function checkDownloadable(url, resultSpan, downloadButton) {
  try {
    resultSpan.textContent = "Analyzing...";
    resultSpan.style.color = "blue"; // Indicate loading state

    const response = await fetch(API_URL_SECONDARY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Download Check API Error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`Downloadable Check Result for ${url}:`, result);

    if (result.isDownloadable) {
      let riskColor = result.riskLevel === "high_risk" ? "red" : result.riskLevel === "medium_risk" ? "orange" : "green";
      resultSpan.textContent = `Download Risk: ${result.riskLevel.toUpperCase()} (${result.fileType})`;
      resultSpan.style.color = riskColor;

      if (result.vtResult) {
        resultSpan.textContent += ` | VT Results: ${result.vtResult.malicious}`;
        if (result.vtResult.malicious > 0) {
          resultSpan.style.color = "red";
        }
      }
    } else {
      resultSpan.textContent = "No Download Indicators Detected";
      resultSpan.style.color = "gray";
    }

    // Hide the button after check
    downloadButton.style.display = "none";
  } catch (error) {
    console.error(`Error checking downloadable link for ${url}:`, error);
    resultSpan.textContent = "Error analyzing download.";
    resultSpan.style.color = "gray";
  }
}



  /**
   * Updates the UI with scanned links and their latest predictions
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

        // If URL is malicious, add a "Check Download Link" button
        if (statusText === "Malicious" || statusText === "Safe") {
          const downloadButton = document.createElement("button");
          downloadButton.textContent = "Check Download Link";
          downloadButton.style.marginLeft = "10px";
          downloadButton.style.backgroundColor = "#ff4d4d";
          downloadButton.style.color = "white";
          downloadButton.style.border = "none";
          downloadButton.style.padding = "5px 10px";
          downloadButton.style.cursor = "pointer";
          downloadButton.style.borderRadius = "5px";

          downloadButton.addEventListener("click", () => {
            checkDownloadable(url, resultSpan, downloadButton);
          });

          urlItem.appendChild(downloadButton);
        }
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