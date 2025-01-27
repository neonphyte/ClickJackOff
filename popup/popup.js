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

        // Make links non-clickable initially
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: disableLinks, // Execute the disableLinks function
        });
      }
    );
  });

  // Function to scan URLs on the page
  function scanPageUrls() {
    const links = Array.from(document.querySelectorAll('a'));
    // Map through each link and check its href
    return links.map((link) => {
      // If href is 'javascript:void(0)', use the value from data-original-href
      if (link.href === 'javascript:void(0)') {
        return link.dataset.originalHref; // Return the original href stored in data-original-href
      }
      // Otherwise, return the href as is
      return link.href;
    });
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

// Function to disable all <a> tags and set them to non-clickable by default
function disableLinks() {
  const links = document.querySelectorAll('a');
  links.forEach((link) => {
    // Store the original href if it hasn't been stored already
    if (!link.dataset.originalHref) {
      link.dataset.originalHref = link.href;
    }

    // Disable the link by setting it to javascript:void(0)
    link.href = 'javascript:void(0)';
    link.classList.add('disabled'); // Optionally, add a class for styling

    // Enable the link when the user hovers over the link
    link.addEventListener('mouseenter', function () {
      if (this.classList.contains('disabled')) {
        this.classList.remove('disabled'); // Remove the disabled class on hover
        this.href = this.dataset.originalHref; // Restore original href
      }
    });

    // Re-disable the link when the user stops hovering
    link.addEventListener('mouseleave', function () {
      this.classList.add('disabled'); // Re-add the disabled class
      this.href = 'javascript:void(0)'; // Disable the link
    });
  });
}

// Reapply disableLinks() when DOM changes occur
const observer = new MutationObserver(() => {
  disableLinks();
});

// Observe DOM changes to ensure dynamically added links are handled
observer.observe(document.body, { childList: true, subtree: true });
