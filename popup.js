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
    const jsonResp = await fetch('http://game.ots76.org/client_json.php');
    debug('JSON fetch status: ' + jsonResp.status);
    if (!jsonResp.ok) throw new Error("Network error (stats)");
    const data = await jsonResp.json();
    debug('Fetched data: ' + JSON.stringify(data));

    const serverStatus = data.status || "Unknown";
    const uptime = data.uptime || "—";
    const monsters = data.monsters || "—";
    const onlineString = data.online || "Unknown";
    const discordOnline = data.discord_online ?? "N/A";

    // Extract just the player number from e.g. "4 Players online"
    let playersNum = onlineString.match(/^(\d+)/);
    playersNum = playersNum ? playersNum[1] : onlineString;

    lastUpdate = new Date();

    let html = `
  <div class="serverinfo">
    Server: <span style="font-weight:600;color:${serverStatus === "ONLINE" ? "#78ff78" : "#ff5656"};">
      ${serverStatus}
    </span>
  </div>
  <div class="uptime" style="margin:2px 0 10px 0;">
    Uptime: <span style="color:#c3e3fa;">${uptime}</span>
  </div>
  <div class="spacer"></div>
  <div class="stat">
    Players online: <span style="font-weight:600;color:#3db9f8;">${playersNum}</span>
  </div>
  <div style="margin:3px 0 12px 0;">
    Monsters: <span style="font-weight:600;color:#3db9f8;">${monsters}</span>
  </div>
  <div style="height:7px"></div>
  <div class="discord">
    Discord online: <span style="font-weight:600;color:#3db9f8;">${discordOnline}</span>
  </div>
  <div class="last-update">Last update: <span id="timestamp">${lastUpdate.toLocaleTimeString()}</span></div>
`;

    content.innerHTML = html;
    debug('Content updated in popup.');

    chrome.runtime.sendMessage({action: "updateBadgeNow"});

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
