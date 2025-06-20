let intervalId = null;
let lastUpdate = null;

async function fetchStatus(showLoading = false) {
  const content = document.getElementById('content');
  if (showLoading) content.innerHTML = '<span class="loading">Loading...</span>';
  try {
    const resp = await fetch('http://game.ots76.org/client_json.php');
    if (!resp.ok) throw new Error("Network error");
    const data = await resp.json();

    // Use the string as-is from your JSON:
    const onlineString = data.online || "Unknown";
    const discordOnline = data.discord_online ?? "N/A";

    lastUpdate = new Date();

    let html = "";
    html += `<div class="stat"><b>${onlineString}</b></div>`;
    html += `<div class="discord"><b>Discord online:</b> ${discordOnline}</div>`;
    html += `<div class="last-update">Last update: <span id="timestamp">${lastUpdate.toLocaleTimeString()}</span></div>`;
    content.innerHTML = html;

  } catch (e) {
    content.innerHTML = `<div class="error">Failed to load data.<br>${e.message}</div>`;
  }
}

function startAutoRefresh() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => fetchStatus(false), 30000);
}

document.getElementById('refresh-btn').addEventListener('click', () => {
  fetchStatus(true);
  startAutoRefresh();
});

fetchStatus(true);
startAutoRefresh();

window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});
