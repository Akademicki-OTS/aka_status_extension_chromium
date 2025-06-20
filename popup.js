let intervalId = null;
let lastUpdate = null;

function debug(msg) {
  console.log('[Aka 7.6 Legacy Popup]', msg);
}

async function fetchStatus(showLoading = false) {
  const content = document.getElementById('content');
  debug('fetchStatus called');
  if (showLoading) content.innerHTML = '<span class="loading">Loading...</span>';
  try {
    const resp = await fetch('http://game.ots76.org/client_json.php');
    debug('Fetch response status: ' + resp.status);
    if (!resp.ok) throw new Error("Network error");
    const data = await resp.json();
    debug('Fetched data: ' + JSON.stringify(data));

    const onlineString = data.online || "Unknown";
    const discordOnline = data.discord_online ?? "N/A";

    lastUpdate = new Date();

    let html = "";
    html += `<div class="stat"><b>${onlineString}</b></div>`;
    html += `<div class="discord"><b>Discord online:</b> ${discordOnline}</div>`;
    html += `<div class="last-update">Last update: <span id="timestamp">${lastUpdate.toLocaleTimeString()}</span></div>`;
    content.innerHTML = html;
    debug('Content updated in popup.');

  } catch (e) {
    content.innerHTML = `<div class="error">Failed to load data.<br>${e.message}</div>`;
    debug('Error: ' + e.message);
  }
}

function startAutoRefresh() {
  debug('Starting auto-refresh');
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => fetchStatus(false), 30000);
}

document.addEventListener('DOMContentLoaded', () => {
  debug('DOMContentLoaded event fired');
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      debug('Refresh button clicked');
      fetchStatus(true);
      startAutoRefresh();
    });
  } else {
    debug('Refresh button NOT found');
  }
  fetchStatus(true);
  startAutoRefresh();
});

window.addEventListener('unload', () => {
  debug('Popup unloaded, clearing interval');
  if (intervalId) clearInterval(intervalId);
});
