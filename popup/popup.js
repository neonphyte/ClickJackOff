document.addEventListener('DOMContentLoaded', () => {
  // Get elements
  const linkCountElement = document.getElementById('link-count');
  const urlListContainer = document.getElementById('url-list');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Switch tabs
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Remove active class from all buttons and panes
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabPanes.forEach((pane) => pane.classList.remove('active'));

      // Add active class to the clicked button and its pane
      button.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Use Chrome's tabs API to scan links
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        func: scanPageUrls, // Function to execute in the tab
      },
      (results) => {
        const urls = results[0].result;
        updateUI(urls);
      }
    );
  });

  // Function to scan URLs on the page
  function scanPageUrls() {
    const links = Array.from(document.querySelectorAll('a'));
    return links.map((link) => link.href);
  }

  // Function to update the UI
  function updateUI(urls) {
    // Update link count
    linkCountElement.textContent = urls.length;

    // Update URL list
    if (urls.length === 0) {
      urlListContainer.innerHTML = '<p>No URLs found on this page.</p>';
      return;
    }

    urls.forEach((url) => {
      const urlItem = document.createElement('div');
      urlItem.className = 'url-item';

      urlItem.innerHTML = `
        <a href="${url}" target="_blank" class="url-link">${url}</a>
      `;

      urlListContainer.appendChild(urlItem);
    });
  }
});
