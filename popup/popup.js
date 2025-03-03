document.addEventListener("DOMContentLoaded", () => {
  const linkCountElement = document.getElementById("link-count"); // Optional element for link count
  const urlListContainer = document.getElementById("links-container");
  const currentUrlElement = document.getElementById("current-url");

  // API endpoints
  const API_URL = "http://52.175.16.74:5000/predict";
  const API_URL_SECONDARY = "http://20.2.169.240:5210/checkDownloadable";

  // In-memory object to store user's vote for each URL
  // Example: userVotes[url] = 'tick' or 'cross'
  let userVotes = {};

  // --------------------------------------------------------------------------
  // 1. Display current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url) {
        currentUrlElement.textContent = tab.url;
        // Remove href to prevent clickable link if needed
        if (currentUrlElement.tagName.toLowerCase() === "a") {
          currentUrlElement.removeAttribute("href");
        }
      } else {
        currentUrlElement.textContent = "URL not accessible.";
      }
    } else {
      currentUrlElement.textContent = "No active tab found.";
    }
  });

  // --------------------------------------------------------------------------
  // 2. Scan for URLs in the active tab
  function scanPageUrls() {
    return Array.from(document.querySelectorAll("a, area, base, link"))
      .map(link => link.dataset.originalHref || link.href)
      .filter(href => href && href !== "javascript:void(0)");
  }

  // --------------------------------------------------------------------------
  // 3. Fetch prediction from API
  async function fetchPrediction(url) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error("Error fetching prediction for", url, error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Draw a doughnut chart on a canvas using plain JavaScript
  function drawDoughnutChart(canvasId, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const total = data.reduce((sum, value) => sum + value, 0);
    let startAngle = -Math.PI / 2; // Start at top (12 o'clock)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(canvas.width, canvas.height) / 2;

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    data.forEach((value, index) => {
      const sliceAngle = (value / total) * (2 * Math.PI);
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();

      startAngle = endAngle;
    });

    const innerRadius = outerRadius * 0.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // 5. Update the summary section and draw the doughnut chart
  function updateSummary(urlData) {
    let safeCount = 0;
    let maliciousCount = 0;

    urlData.forEach(item => {
      if (item.status === "Safe") safeCount++;
      else if (item.status === "Malicious") maliciousCount++;
    });

    const summaryHTML = `
      <canvas id="doughnutChart" width="200" height="200"></canvas>
      <div id="summary-text">
        <p>Total URLs scanned: <strong>${urlData.length}</strong></p>
        <p>Safe URLs: <strong>${safeCount}</strong></p>
        <p>Malicious URLs: <strong>${maliciousCount}</strong></p>
      </div>
    `;
    document.getElementById("summary-content").innerHTML = summaryHTML;
    drawDoughnutChart("doughnutChart", [safeCount, maliciousCount], ["#28a745", "#dc3545"]);
  }

  // --------------------------------------------------------------------------
  // 6. Check if a URL is downloadable and add a purple "Downloadable" pill.
  // Returns true if downloadable, false otherwise.
  async function checkAndAddDownloadablePill(pillsContainer, url) {
    try {
      const response = await fetch(API_URL_SECONDARY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) {
        throw new Error(`Download Check API Error: ${response.statusText}`);
      }
      const result = await response.json();
      if (result && result.isDownloadable) {
        const downloadPill = document.createElement("span");
        downloadPill.textContent = "Downloadable";
        downloadPill.style.backgroundColor = "purple";
        downloadPill.style.color = "white";
        downloadPill.style.padding = "2px 6px";
        downloadPill.style.borderRadius = "10px";
        downloadPill.style.marginLeft = "10px";
        pillsContainer.appendChild(downloadPill);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error in checkAndAddDownloadablePill for", url, error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 7. Further analyze the link in a sandbox when the sandbox button is clicked.
  // Row 4 will display a spinner, then show the analysis result (real API call).
  async function furtherAnalyzeSandbox(url, resultContainer) {
    // Display the container (Row 4) and clear any previous content
    resultContainer.style.display = "flex";
    resultContainer.innerHTML = "";
  
    // Create a container for the loading icon + text
    const loadingMessageContainer = document.createElement("div");
    loadingMessageContainer.className = "d-flex align-items-center gap-2";
  
    // Create a Bootstrap spinner icon (rotating circle)
    const loadingIcon = document.createElement("div");
    loadingIcon.className = "spinner-border spinner-border-sm text-light";
    loadingIcon.setAttribute("role", "status");
    const spinnerSpan = document.createElement("span");
    spinnerSpan.className = "visually-hidden";
    spinnerSpan.textContent = "Loading...";
    loadingIcon.appendChild(spinnerSpan);
  
    // Create the text
    const loadingText = document.createElement("span");
    loadingText.textContent = "Analyzing Downloadable in sandbox...";
    loadingText.style.color = "#fff";
  
    // Add the icon + text to the container, then add to Row 4
    loadingMessageContainer.appendChild(loadingIcon);
    loadingMessageContainer.appendChild(loadingText);
    resultContainer.appendChild(loadingMessageContainer);
  
    try {
      console.log("Sending request to sandbox analysis:", url);
  
      // Send request to the Secondary API for deeper (sandbox) analysis
      const response = await fetch(API_URL_SECONDARY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
  
      if (!response.ok) {
        throw new Error(`Sandbox Analysis API Error: ${response.statusText}`);
      }
  
      const result = await response.json();
      console.log(`Sandbox Analysis Result for ${url}:`, result);
  
      // Clear the loading message
      resultContainer.innerHTML = "";
  
      // Create a pill to display the final result (minimal message)
      const analysisPill = document.createElement("span");
      analysisPill.style.padding = "2px 6px";
      analysisPill.style.borderRadius = "10px";
      analysisPill.style.fontSize = "0.75rem";
      analysisPill.style.fontWeight = "bold";
  
      // If the file is considered high risk or malicious
      if (result.vtResult.malicious > 1 && (result.fsResult && result.fsResult.status === "completed" && result.fsResult.verdict === "malicious")) {
        // analysisPill.textContent = "Downloadable analyzed as malicious!";
        analysisPill.textContent = "Malicious File!!!";
        analysisPill.style.backgroundColor = "#dc3545"; // red
        analysisPill.style.color = "#fff";
      } else if (result.vtResult.malicious > 1 || (result.fsResult && result.fsResult.status === "completed" && result.fsResult.verdict === "malicious")){
        // analysisPill.textContent = "Downloadable analyzed as possibly malicious";
        analysisPill.textContent = "Be Careful Of This File!";
        analysisPill.style.backgroundColor = "#ffa500"; // orange
        analysisPill.style.color = "#fff";
      } else {
        // analysisPill.textContent = "Downloadable analyzed as safe!";
        analysisPill.textContent = "Safe File";
        analysisPill.style.backgroundColor = "#28a745"; // green
        analysisPill.style.color = "#fff";
      }
  
      resultContainer.appendChild(analysisPill);
  
    } catch (error) {
      console.error(`Error analyzing sandbox for ${url}:`, error);
      resultContainer.innerHTML = "";
      const errorText = document.createElement("span");
      errorText.textContent = "Error analyzing sandbox.";
      errorText.style.color = "gray";
      resultContainer.appendChild(errorText);
    }
  }
  

  // --------------------------------------------------------------------------
  // 8. Create the URL card with 4 rows:
  // Row 1: Link + Spinner; Row 2: Pills container; Row 3: Action buttons; Row 4: Sandbox analysis result (hidden initially)
  function createURLCard(url) {
    const card = document.createElement("div");
    card.className = "card mb-2";
    card.style.backgroundColor = "#343a40";
    card.style.border = "none";

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";

    // ROW 1: Link and Spinner for prediction
    const row1 = document.createElement("div");
    row1.className = "d-flex justify-content-between align-items-center";
    const linkEl = document.createElement("a");
    linkEl.href = url;
    linkEl.target = "_blank";
    linkEl.textContent = url;
    linkEl.className = "link-url";
    row1.appendChild(linkEl);

    // Spinner for Row 1 (visible until prediction is loaded)
    const spinnerRow1 = document.createElement("div");
    spinnerRow1.className = "spinner-border spinner-border-sm text-light";
    spinnerRow1.setAttribute("role", "status");
    const spinnerSpanRow1 = document.createElement("span");
    spinnerSpanRow1.className = "visually-hidden";
    spinnerSpanRow1.textContent = "Loading...";
    spinnerRow1.appendChild(spinnerSpanRow1);
    row1.appendChild(spinnerRow1);
    cardBody.appendChild(row1);

    // ROW 2: Pills container (for status and downloadable pills)
    const row2 = document.createElement("div");
    row2.className = "d-flex align-items-center gap-2 mt-1";
    cardBody.appendChild(row2);

    // ROW 3: Action buttons container
    const row3 = document.createElement("div");
    row3.className = "d-flex align-items-center gap-2 mt-2";
    cardBody.appendChild(row3);

    // ROW 4: Sandbox analysis result container (hidden initially)
    const row4 = document.createElement("div");
    row4.className = "d-flex align-items-center mt-2";
    row4.style.display = "none";
    cardBody.appendChild(row4);

    card.appendChild(cardBody);
    return {
      card,
      spinnerRow1,
      pillsContainer: row2,
      buttonsContainer: row3,
      sandboxResultContainer: row4
    };
  }

  // --------------------------------------------------------------------------
  // 9. Attach action buttons (Tick, Cross, and conditionally Sandbox) to Row 3.
  // If the link is downloadable, show the Sandbox button instead of a magnifying glass.
  function attachActionButtons(container, sandboxResultContainer, url, downloadable) {
    // Create Tick button
    const tickButton = document.createElement("button");
    tickButton.type = "button";
    tickButton.className = "btn btn-sm btn-light";
    tickButton.innerHTML = '<i class="bi bi-check-lg"></i>';
    tickButton.setAttribute("title", "Misdentified? Help us improve by voting this url as safe or malicious.");

    // Create Cross button
    const crossButton = document.createElement("button");
    crossButton.type = "button";
    crossButton.className = "btn btn-sm btn-light";
    crossButton.innerHTML = '<i class="bi bi-x-lg"></i>';
    crossButton.setAttribute("title", "Misdentified? Help us improve by voting this url as safe or malicious.");

    container.appendChild(tickButton);
    container.appendChild(crossButton);

    // If the link is downloadable, add a Sandbox buttonn
    if (downloadable) {
      const sandboxButton = document.createElement("button");
      sandboxButton.type = "button";
      sandboxButton.className = "btn btn-sm btn-light";
      // Use a sandbox-related icon (here using Bootstrap's box arrow icon as an example)
      sandboxButton.innerHTML = '<i class="bi bi-file-earmark-break-fill"></i>';
      sandboxButton.setAttribute("title", "Send the downloadable to our sandbox for analysis.");
      container.appendChild(sandboxButton);

      // Clicking this button calls furtherAnalyzeSandbox for a deeper analysis
      sandboxButton.addEventListener("click", () => {
        furtherAnalyzeSandbox(url, sandboxResultContainer);
      });
    }

    // Attach vote event listeners for Tick and Cross
    tickButton.addEventListener("click", () => {
      handleVote(url, "tick", tickButton, crossButton);
    });
    crossButton.addEventListener("click", () => {
      handleVote(url, "cross", tickButton, crossButton);
    });
    applyVoteStyles(url, tickButton, crossButton);
  }

  // --------------------------------------------------------------------------
  // 10. Apply stored vote style (tick or cross) for a given URL
  function applyVoteStyles(url, tickButton, crossButton) {
    const vote = userVotes[url];
    if (vote === "tick") {
      tickButton.classList.remove("btn-light");
      tickButton.classList.add("btn-success");
      crossButton.classList.remove("btn-danger");
      crossButton.classList.add("btn-light");
    } else if (vote === "cross") {
      crossButton.classList.remove("btn-light");
      crossButton.classList.add("btn-danger");
      tickButton.classList.remove("btn-success");
      tickButton.classList.add("btn-light");
    } else {
      tickButton.classList.remove("btn-success");
      tickButton.classList.add("btn-light");
      crossButton.classList.remove("btn-danger");
      crossButton.classList.add("btn-light");
    }
  }

  // --------------------------------------------------------------------------
  // 11. Handle user vote logic: toggles vote selection and updates button styles
  function handleVote(url, choice, tickButton, crossButton) {
    if (userVotes[url] === choice) {
      userVotes[url] = null;
    } else {
      userVotes[url] = choice;
    }
    applyVoteStyles(url, tickButton, crossButton);
  }

  // --------------------------------------------------------------------------
  // 12. Disable links in the active page if desired
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

  // --------------------------------------------------------------------------
  // 13. Update UI with link cards and collect summary data
  async function updateUI(urls) {
    if (linkCountElement) linkCountElement.textContent = urls.length || 0;

    if (!urls.length) {
      urlListContainer.innerHTML = "<p>No URLs found on this page.</p>";
      document.getElementById("summary-content").innerHTML = "<p>No URLs found on this page.</p>";
      return;
    }

    // Clear previous content and prepare an array for summary data
    urlListContainer.innerHTML = "";
    let summaryData = [];

    for (const url of urls) {
      // Create the URL card with our 4-row layout
      const { card, spinnerRow1, pillsContainer, buttonsContainer, sandboxResultContainer } = createURLCard(url);
      urlListContainer.appendChild(card);

      // Fetch the prediction for the URL
      const prediction = await fetchPrediction(url);
      let status = "Error";
      if (prediction) {
        status = prediction.prediction;
        if (
          prediction.virustotal &&
          (prediction.virustotal === "Safe" || prediction.virustotal === "Malicious")
        ) {
          status = prediction.virustotal;
        }
      }
      summaryData.push({ url, status });

      // Remove the spinner from Row 1 once prediction is loaded
      spinnerRow1.style.display = "none";

      // In Row 2 (pills container), create and append the status pill
      const statusPill = document.createElement("span");
      statusPill.className = "badge badge-inline";
      if (status === "Safe") {
        statusPill.textContent = "Safe";
        statusPill.classList.add("bg-safe");
      } else if (status === "Malicious") {
        statusPill.textContent = "Malicious";
        statusPill.classList.add("bg-malicious");
      } else {
        statusPill.textContent = status;
        statusPill.classList.add("bg-malicious");
      }
      pillsContainer.appendChild(statusPill);

      // Check if the link is downloadable and add a purple "Downloadable" pill to Row 2.
      // Also, capture the downloadable status.
      let downloadable = await checkAndAddDownloadablePill(pillsContainer, url);

      // Attach action buttons to Row 3.
      // If downloadable is true, show Tick, Cross, and Sandbox button.
      // If not, only show Tick and Cross.
      attachActionButtons(buttonsContainer, sandboxResultContainer, url, downloadable);
    }

    // After processing all URLs, update the summary tab (including the chart)
    updateSummary(summaryData);
  }

  // --------------------------------------------------------------------------
  // 14. Main function to scan and update UI
  async function scanAndPredictLinks() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs.length) return;
      const tab = tabs[0];
      if (tab.url.startsWith("chrome://")) return;

      chrome.scripting.executeScript(
        { target: { tabId: tab.id }, func: scanPageUrls },
        (results) => {
          if (chrome.runtime.lastError) return;
          const urls = results[0].result;
          updateUI(urls);

          // Optionally disable links on the active page
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: disableLinks,
          });
        }
      );
    });
  }

  // --------------------------------------------------------------------------
  // 15. Observe DOM changes in the popup (optional)
  const observer = new MutationObserver(() => disableLinks());
  observer.observe(document.body, { childList: true, subtree: true });

  // --------------------------------------------------------------------------
  // 16. Periodically re-scan (e.g., every 60 seconds)
  setInterval(scanAndPredictLinks, 600000);

  // --------------------------------------------------------------------------
  // Initial scan on load
  scanAndPredictLinks();
});
