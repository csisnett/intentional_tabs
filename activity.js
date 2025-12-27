function formatTime(seconds) {
  if (!seconds) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}

let currentFilter = 'all';

async function displayActivity() {
  const log = document.getElementById('log');
  log.innerHTML = ''; // Clear existing content
  
  // Get all current tabs
  const tabs = await chrome.tabs.query({});
  const tabUrlMap = {};
  tabs.forEach(tab => {
    tabUrlMap[tab.id] = tab.url;
  });
  
  chrome.storage.local.get('tabIntents', data => {
    const intents = data.tabIntents || [];

    if (intents.length === 0) {
      log.innerHTML = '<p>No activity recorded yet.</p>';
      return;
    }

    let visibleCount = 0;

    intents.forEach(i => {
      const div = document.createElement('div');
      div.className = 'activity-item';
      const timeSpent = formatTime(i.timeSpent || 0);
      const createdAt = formatDate(i.createdAt);
      
      // Get current URL from open tabs if tab is still open
      const currentUrl = tabUrlMap[i.tabId] || i.currentUrl || i.url;
      const isTabOpen = tabUrlMap[i.tabId] !== undefined;
      
      // Apply filter
      if (currentFilter === 'open' && !isTabOpen) {
        div.classList.add('hidden');
      } else if (currentFilter === 'closed' && isTabOpen) {
        div.classList.add('hidden');
      } else {
        visibleCount++;
      }
      
      let historyHtml = '';
      if (i.urlHistory && i.urlHistory.length > 0) {
        historyHtml = '<div class="url-history"><h4>Visit History:</h4><ul>';
        i.urlHistory.forEach(visit => {
          historyHtml += `
            <li>
              <div class="visit-url">${visit.url}</div>
              <div class="visit-details">
                <span>Visited: ${formatDate(visit.visitedAt)}</span>
                <span class="visit-time">Duration: ${formatTime(visit.timeSpent)}</span>
              </div>
            </li>
          `;
        });
        historyHtml += '</ul></div>';
      }
      
      const statusBadge = isTabOpen ? '<span class="status-badge open">Open</span>' : '<span class="status-badge closed">Closed</span>';
      
      div.innerHTML = `
        <b>${i.intent}</b> ${statusBadge}
        <div class="current-url-label">Current Website:</div>
        <div class="url">${currentUrl || '—'}</div>
        <small>Tab Opened: ${createdAt}</small>
        <div class="time-spent">Total Time: ${timeSpent}</div>
        ${historyHtml}
      `;
      log.appendChild(div);
    });

    // Show message if no tabs match filter
    if (visibleCount === 0 && intents.length > 0) {
      const noResultsMsg = document.createElement('p');
      noResultsMsg.textContent = `No ${currentFilter} tabs found.`;
      noResultsMsg.style.color = '#666';
      noResultsMsg.style.textAlign = 'center';
      noResultsMsg.style.padding = '20px';
      log.appendChild(noResultsMsg);
    }
  });
}

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', () => {
  displayActivity();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Update active state
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update filter and refresh display
    currentFilter = btn.dataset.filter;
    displayActivity();
  });
});

// Initial display
displayActivity();
