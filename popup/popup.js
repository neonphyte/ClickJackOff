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

  // 1. Display current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      if (tab.url) {
        currentUrlElement.textContent = tab.url;
        // Remove href to prevent clickable link
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

  // 2. Scan for URLs in the active tab
  function scanPageUrls() {
    return Array.from(document.querySelectorAll("a, area, base, link"))
      .map(link => link.dataset.originalHref || link.href)
      .filter(href => href && href !== "javascript:void(0)");
  }

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
      return null;
    }
  }

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

    // Draw each slice of the doughnut
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

    // Draw the inner circle for the doughnut effect
    const innerRadius = outerRadius * 0.5; // Adjust this ratio to change thickness
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff"; // Color of the inner circle (background)
    ctx.fill();
  }

  // 5. Updated updateSummary function: updates summary text and draws the doughnut chart
  function updateSummary(urlData) {
    let safeCount = 0;
    let maliciousCount = 0;

    urlData.forEach(item => {
      if (item.status === "Safe") safeCount++;
      else if (item.status === "Malicious") maliciousCount++;
    });

    const summaryHTML = `
      <div id="summary-text">
        <p>Total URLs scanned: <strong>${urlData.length}</strong></p>
        <p>Safe URLs: <strong>${safeCount}</strong></p>
        <p>Malicious URLs: <strong>${maliciousCount}</strong></p>
      </div>
      <canvas id="doughnutChart" width="200" height="200"></canvas>
    `;

    document.getElementById("summary-content").innerHTML = summaryHTML;

    // Draw the doughnut chart using the computed counts
    drawDoughnutChart("doughnutChart", [safeCount, maliciousCount], ["#28a745", "#dc3545"]);
  }

  // 6. Update UI with link cards and collect summary data
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
      // Create card container
      const card = document.createElement("div");
      card.className = "card mb-2";
      card.style.backgroundColor = "#343a40";
      card.style.border = "none";

      // Card body
      const cardBody = document.createElement("div");
      cardBody.className = "card-body";

      // Top row: left (URL and spinner/badge) and right (action buttons)
      const topRow = document.createElement("div");
      topRow.className = "d-flex justify-content-between align-items-center";

      // LEFT DIV: URL link and spinner/badge
      const leftDiv = document.createElement("div");
      leftDiv.className = "link-info d-inline-flex align-items-center";

      // URL link
      const urlLink = document.createElement("a");
      urlLink.href = url;
      urlLink.target = "_blank";
      urlLink.textContent = url;
      urlLink.className = "link-url"; // uses CSS styling
      leftDiv.appendChild(urlLink);

      // Spinner container (displaying "Checking..." while waiting for API)
      const spinnerContainer = document.createElement("div");
      spinnerContainer.className = "d-inline-flex align-items-center ms-2";

      const spinnerText = document.createElement("span");
      spinnerText.textContent = "Checking...";
      spinnerText.style.fontSize = "0.75rem";
      spinnerText.style.color = "#fff";

      const spinner = document.createElement("div");
      spinner.className = "spinner-border spinner-border-sm text-light ms-1";
      spinner.setAttribute("role", "status");
      const spinnerSpan = document.createElement("span");
      spinnerSpan.className = "visually-hidden";
      spinnerSpan.textContent = "Loading...";
      spinner.appendChild(spinnerSpan);

      spinnerContainer.appendChild(spinnerText);
      spinnerContainer.appendChild(spinner);
      leftDiv.appendChild(spinnerContainer);

      // RIGHT DIV: for action buttons (will be filled later)
      const rightDiv = document.createElement("div");
      rightDiv.className = "action-buttons d-flex align-items-center";

      // Assemble the top row
      topRow.appendChild(leftDiv);
      topRow.appendChild(rightDiv);

      // Append top row to card body, and card body to card
      cardBody.appendChild(topRow);
      card.appendChild(cardBody);

      // Add the card to the container
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

      // Store this URL's result for summary calculations
      summaryData.push({ url, status });

      // Remove the spinner container now that the prediction is in
      leftDiv.removeChild(spinnerContainer);

      // Create a badge element to display the status
      const pill = document.createElement("span");
      pill.className = "badge badge-inline"; // aligns with .link-url
      pill.textContent = "Error"; // default text if prediction fails
      leftDiv.appendChild(pill);

      // Process the prediction and update the badge and buttons
      let statusText = status;
      if (statusText === "Safe") {
        pill.textContent = "Safe";
        pill.classList.add("bg-safe"); // uses your styles.css

        // Create a 2-button row for "Safe" URLs
        const buttonRow = document.createElement("div");
        buttonRow.className = "row row-cols-2 g-2 mt-2";

        // Tick button
        const tickCol = document.createElement("div");
        tickCol.className = "col text-center";
        const tickButton = document.createElement("button");
        tickButton.type = "button";
        tickButton.className = "btn btn-sm btn-light w-100";
        tickButton.innerHTML = '<i class="bi bi-check-lg"></i>';
        tickCol.appendChild(tickButton);
        buttonRow.appendChild(tickCol);

        // Cross button
        const crossCol = document.createElement("div");
        crossCol.className = "col text-center";
        const crossButton = document.createElement("button");
        crossButton.type = "button";
        crossButton.className = "btn btn-sm btn-light w-100";
        crossButton.innerHTML = '<i class="bi bi-x-lg"></i>';
        crossCol.appendChild(crossButton);
        buttonRow.appendChild(crossCol);

        // Append the button row to the card body
        cardBody.appendChild(buttonRow);

        // Restore any existing vote for this URL
        applyVoteStyles(url, tickButton, crossButton);

        // Add event listeners for vote buttons
        tickButton.addEventListener("click", () => {
          handleVote(url, "tick", tickButton, crossButton);
        });
        crossButton.addEventListener("click", () => {
          handleVote(url, "cross", tickButton, crossButton);
        });

      } else if (statusText === "Malicious") {
        pill.textContent = "Malicious";
        pill.classList.add("bg-malicious");

        // Create a 3-button row for "Malicious" URLs
        const buttonRow = document.createElement("div");
        buttonRow.className = "row row-cols-3 g-2 mt-2";

        // Magnifying Glass button
        const magCol = document.createElement("div");
        magCol.className = "col text-center";
        const magButton = document.createElement("button");
        magButton.type = "button";
        magButton.className = "btn btn-sm btn-light w-100";
        magButton.innerHTML = '<i class="bi bi-search"></i>';
        magCol.appendChild(magButton);
        buttonRow.appendChild(magCol);

        // Tick button
        const tickCol = document.createElement("div");
        tickCol.className = "col text-center";
        const tickButton = document.createElement("button");
        tickButton.type = "button";
        tickButton.className = "btn btn-sm btn-light w-100";
        tickButton.innerHTML = '<i class="bi bi-check-lg"></i>';
        tickCol.appendChild(tickButton);
        buttonRow.appendChild(tickCol);

        // Cross button
        const crossCol = document.createElement("div");
        crossCol.className = "col text-center";
        const crossButton = document.createElement("button");
        crossButton.type = "button";
        crossButton.className = "btn btn-sm btn-light w-100";
        crossButton.innerHTML = '<i class="bi bi-x-lg"></i>';
        crossCol.appendChild(crossButton);
        buttonRow.appendChild(crossCol);

        // Append the button row to the card body
        cardBody.appendChild(buttonRow);

        // Restore any existing vote for this URL (applies to tick/cross)
        applyVoteStyles(url, tickButton, crossButton);

        // Add event listeners for Tick and Cross buttons
        tickButton.addEventListener("click", () => {
          handleVote(url, "tick", tickButton, crossButton);
        });
        crossButton.addEventListener("click", () => {
          handleVote(url, "cross", tickButton, crossButton);
        });

        // Add event listener for the magnifying glass button
        magButton.addEventListener("click", () => {
          console.log("Magnifying glass clicked for:", url);
        });

      } else {
        // For unknown or error statuses, show the error text
        pill.textContent = statusText;
        pill.classList.add("bg-malicious");
      }
    }

    // After processing all URLs, update the summary tab (including the chart)
    updateSummary(summaryData);
  }

  // 7. Apply stored vote style (tick or cross) for a given URL
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

  // 8. Handle user vote logic: toggles vote selection and updates button styles
  function handleVote(url, choice, tickButton, crossButton) {
    if (userVotes[url] === choice) {
      userVotes[url] = null;
    } else {
      userVotes[url] = choice;
    }
    applyVoteStyles(url, tickButton, crossButton);
  }

  // 9. Disable links in the active page if desired
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

  // 10. Main function to scan and update UI
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

  // 11. Observe DOM changes in the popup (optional)
  const observer = new MutationObserver(() => disableLinks());
  observer.observe(document.body, { childList: true, subtree: true });

  // 12. Periodically re-scan (e.g., every 60 seconds)
  setInterval(scanAndPredictLinks, 60000);

  // Initial scan on load
  scanAndPredictLinks();
});
