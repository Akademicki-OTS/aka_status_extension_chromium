let intervalId = null;
let lastUpdate = null;
let muteState = false;
let themeMode = 'dark'; // default

/* ========== THEME ========== */
function updateThemeIcon() {
  const themeBtn = document.getElementById('theme-btn');
  if (!themeBtn) return;
  themeBtn.innerHTML = themeMode === 'dark' ? "🌙" : "☀️";
  themeBtn.title = themeMode === 'dark' ? "Switch to light mode" : "Switch to dark mode";
  themeBtn.setAttribute('aria-label', themeBtn.title);
}

function applyTheme(mode) {
  document.body.classList.toggle('light-mode', mode === 'light');
  document.documentElement.classList.toggle('light-mode', mode === 'light');
  themeMode = mode;
  updateThemeIcon();
  chrome.storage.local.set({ "themeMode": mode });
}

function loadTheme(cb) {
  chrome.storage.local.get({ "themeMode": "dark" }, r => cb(r.themeMode));
}

/* ========== STORAGE HELPERS ========== */
function debug(msg) {
  // console.log('[Aka 7.6 Popup]', msg);
}
function saveWatchdogList(arr) { chrome.storage.local.set({ "watchdogList": arr }); }
function loadWatchdogList(cb) { chrome.storage.local.get({ "watchdogList": [] }, r => cb(r.watchdogList)); }
function saveMuteState(mute) { chrome.storage.local.set({ "muteState": mute }); }
function loadMuteState(cb) { chrome.storage.local.get({ "muteState": false }, r => cb(r.muteState)); }

/* ========== UI HELPERS ========== */
function updateMuteBtnIcon() {
  const muteBtn = document.getElementById('mute-btn');
  if (!muteBtn) return;
  muteBtn.innerHTML = muteState ? "🔇" : "🔊";
  muteBtn.title = muteState ? "Unmute sound" : "Mute sound";
  muteBtn.setAttribute('aria-label', muteState ? "Unmute sound" : "Mute sound");
}

function formatRawUptime(uptime) {
  if (!uptime) return "--";
  return uptime.replace(/\s+/g, ' ').trim(); // collapse spaces
}

/* ========== WATCHDOG RENDER ========== */
function renderWatchdog(playersOnline) {
  loadWatchdogList((watchdogList) => {
    const root = document.getElementById('watchdog');
    if (!root) return;

    let html = `
      <button id="show-players-btn" class="show-players-btn">Show players</button>
      <form id="add-watchdog-form" class="watchdog-form">
        <input id="watchdog-input" type="text" maxlength="30" placeholder="Player name">
        <button type="submit" class="btn-add">Add</button>
      </form>
      <div class="watchdog-list-wrapper">
        <b class="watchdog-label">Watchdog:</b>`;

    if (!watchdogList.length) {
      html += `<span class="watchdog-empty"> No players tracked</span>`;
    } else {
      html += `<ul class="watchdog-ul">`;
      for (const name of watchdogList) {
        const isOnline = playersOnline.includes(name);
        html += `
          <li>
            <span class="${isOnline ? 'player-online' : 'player-offline'}">${name}</span>
            <button class="watchdog-remove-btn remove-watchdog-btn" data-name="${encodeURIComponent(name)}" title="Remove">✕</button>
            ${isOnline ? `<span class="player-online online-tag">(online)</span>` : ""}
          </li>`;
      }
      html += `</ul>`;
    }
    html += `
      </div>
      <div id="players-list" class="players-list" style="display:none;"></div>
    `;

    root.innerHTML = html;

    // Show players toggle
    const showBtn = document.getElementById('show-players-btn');
    const listDiv = document.getElementById('players-list');
    if (showBtn && listDiv) {
      showBtn.addEventListener('click', () => {
        if (listDiv.innerHTML === "") {
          listDiv.innerHTML = playersOnline.length
            ? playersOnline.map(p =>
              `<a href="https://ots76.org/index.php?module=findchar&player=${encodeURIComponent(p)}" target="_blank">${p}</a>`
            ).join('<br>')
            : '<span class="players-empty">No players online</span>';
        }
        const visible = listDiv.style.display !== 'none';
        listDiv.style.display = visible ? 'none' : 'block';
        showBtn.textContent = visible ? 'Show players' : 'Hide players';
      });
    }

    // Add form submission
    const form = document.getElementById('add-watchdog-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('watchdog-input');
        if (!input) return;
        let val = input.value.trim();
        if (!val) return;
        val = val.replace(/\s+/g, ' ');
        loadWatchdogList(listArr => {
          if (!listArr.includes(val)) {
            listArr.push(val);
            saveWatchdogList(listArr);
            renderWatchdog(playersOnline);
          }
          input.value = '';
        });
      });
    }

    // Remove handlers
    Array.from(document.getElementsByClassName('remove-watchdog-btn')).forEach(btn => {
      btn.addEventListener('click', () => {
        const name = decodeURIComponent(btn.getAttribute('data-name'));
        loadWatchdogList(listArr => {
          const idx = listArr.indexOf(name);
          if (idx !== -1) {
            listArr.splice(idx, 1);
            saveWatchdogList(listArr);
            renderWatchdog(playersOnline);
          }
        });
      });
    });
  });
}

/* ========== FETCH STATUS ========== */
async function fetchStatus(showLoading = false) {
  const content = document.getElementById('content');
  if (showLoading && content) content.innerHTML = '<span class="loading">Loading...</span>';

  try {
    const resp = await fetch('http://game.ots76.org/client_json.php');
    if (!resp.ok) throw new Error("Network error (stats)");
    const data = await resp.json();

    const serverStatus = data.status || "Unknown";
    const uptimeRaw = formatRawUptime(data.uptime || "—");
    const monsters = data.monsters || "—";
    const onlineStr = data.online || "Unknown";
    const discordOnline = data.discord_online ?? "N/A";
    const players = Array.isArray(data.players) ? data.players : [];

    let playersNum = onlineStr.match(/^(\d+)/);
    playersNum = playersNum ? playersNum[1] : onlineStr;

    lastUpdate = new Date();

    const html = `
      <div class="serverinfo-inline">
        <span>Server: <span class="server-status ${serverStatus === "ONLINE" ? "status-online" : "status-offline"}">${serverStatus}</span></span>
        <span class="uptime-inline">[${uptimeRaw}]</span>
      </div>
      <div class="stat"><b>Players online:</b> <span class="stat-value">${playersNum}</span></div>
      <div class="stat discord">
        <a href="https://discord.com/invite/jAU83Yg5SN" target="_blank" rel="noopener">
          <b>Discord online:</b> <span class="stat-value">${discordOnline}</span>
        </a>
      </div>
      <div class="monsters-container"><b>Monsters:</b> <span class="stat-value">${monsters}</span></div>
      <hr class="watchdog-separator" />
    `;
    if (content) content.innerHTML = html;

    renderWatchdog(players);

    const lu = document.getElementById('last-update-footer');
    if (lu) lu.innerHTML = `Last update: <span id="timestamp">${lastUpdate.toLocaleTimeString()}</span>`;

    chrome.runtime.sendMessage({ action: "updateBadgeNow" });
  } catch (err) {
    if (content) {
      content.innerHTML = `<div class="error">Failed to load data.<br>${err.message}</div>`;
    }
  }
}

/* ========== AUTO REFRESH ========== */
function startAutoRefresh() {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => fetchStatus(false), 10000);
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
  loadTheme(mode => applyTheme(mode || 'dark'));

  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () =>
      applyTheme(themeMode === 'dark' ? 'light' : 'dark')
    );
  }

  loadMuteState(mute => {
    muteState = mute;
    updateMuteBtnIcon();
  });

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchStatus(true);
      startAutoRefresh();
    });
  }

  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      muteState = !muteState;
      saveMuteState(muteState);
      updateMuteBtnIcon();
    });
  }

  fetchStatus(true);
  startAutoRefresh();
});

window.addEventListener('unload', () => {
  if (intervalId) clearInterval(intervalId);
});
