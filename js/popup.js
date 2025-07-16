let intervalId = null;
let lastUpdate = null;
let muteState = false;
let themeMode = 'dark'; // default

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
  // Save preference
  chrome.storage.local.set({ "themeMode": mode });
}
function loadTheme(cb) {
  chrome.storage.local.get({ "themeMode": "dark" }, result => cb(result.themeMode));
}

// Utility
function debug(msg) {
  //console.log('[Aka 7.6 Legacy Popup]', msg);
}

// --- Watchdog Storage ---
function saveWatchdogList(arr) {
  chrome.storage.local.set({ "watchdogList": arr });
}
function loadWatchdogList(cb) {
  chrome.storage.local.get({ "watchdogList": [] }, result => cb(result.watchdogList));
}
function saveMuteState(mute) {
  chrome.storage.local.set({ "muteState": mute });
}
function loadMuteState(cb) {
  chrome.storage.local.get({ "muteState": false }, result => cb(result.muteState));
}

function updateMuteBtnIcon() {
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.innerHTML = muteState ? "🔇" : "🔊";
    muteBtn.title = muteState ? "Unmute sound" : "Mute sound";
    muteBtn.setAttribute('aria-label', muteState ? "Unmute sound" : "Mute sound");
  }
}

function renderWatchdog(playersOnline) {
  loadWatchdogList((watchdogList) => {
    let html = `
      <button id="show-players-btn" style="
        margin-bottom:8px; 
        background:#232b37; 
        border:none; 
        color:#8ecffb; 
        font-size:0.97em;
        padding:3px 13px; 
        border-radius:7px; 
        cursor:pointer;
      ">
        Show players
      </button>
      <form id="add-watchdog-form" style="margin-bottom:7px;display:flex;gap:7px;">
        <input id="watchdog-input" type="text" maxlength="30" placeholder="Player name" style="flex:1 1 0; border-radius:6px; border:1px solid #233; background:#212630; color:#eee; padding:3px 8px; font-size:0.98em;">
        <button type="submit" style="background:#26354b; color:#7ddaff; border:none; border-radius:6px; padding:3px 11px; cursor:pointer;">Add</button>
      </form>
      <div style="margin-bottom:5px;">
        <b style="font-size:0.98em;color:#d9dfff;">Watchdog:</b>`;

    if (!watchdogList.length) {
      html += `<span style="color:#889; margin-left:7px;">No players tracked</span>`;
    } else {
      html += `<ul style="padding-left:1.1em; margin:4px 0 2px 0;">`;
      for (const name of watchdogList) {
        const isOnline = playersOnline.includes(name);
        html += `<li style="margin-bottom:2px;">
            <span style="color:${isOnline ? "#78ff78" : "#e3e3e3"};">${name}</span>
            <button class="remove-watchdog-btn" data-name="${encodeURIComponent(name)}" title="Remove" style="margin-left:7px;background:#282a3a;border:none;color:#fe7777;cursor:pointer;border-radius:4px;font-size:0.96em;padding:0 6px;">✕</button>
            ${isOnline ? `<span style="font-size:0.95em;color:#78ff78;margin-left:2px;">(online)</span>` : ""}
          </li>`;
      }
      html += `</ul>`;
    }
    html += `</div>
    <div id="players-list" style="display:none; margin:7px 0 10px 2px;"></div>
    `;

    document.getElementById('watchdog').innerHTML = html;

    // Show/hide player list button
    const btn = document.getElementById('show-players-btn');
    const list = document.getElementById('players-list');
    if (btn && list) {
      btn.addEventListener('click', () => {
        if (list.innerHTML === "") {
          if (playersOnline.length) {
            list.innerHTML = playersOnline.map(player =>
              `<a href="https://ots76.org/index.php?module=findchar&player=${encodeURIComponent(player)}" target="_blank">${player}</a>`
            ).join('<br>');
          } else {
            list.innerHTML = '<span style="color:#aaa;font-size:0.97em;">No players online</span>';
          }
        }
        const visible = list.style.display !== 'none';
        list.style.display = visible ? 'none' : 'block';
        btn.textContent = visible ? 'Show players' : 'Hide players';
      });
    }

    // Add/Remove events for watchdog
    document.getElementById('add-watchdog-form').onsubmit = (e) => {
      e.preventDefault();
      const input = document.getElementById('watchdog-input');
      let val = input.value.trim();
      if (!val) return;
      val = val.replace(/\s+/g, " "); // Single spaces only
      loadWatchdogList((watchdogList) => {
        if (watchdogList.includes(val)) {
          input.value = "";
          return;
        }
        watchdogList.push(val);
        saveWatchdogList(watchdogList);
        input.value = "";
        renderWatchdog(playersOnline);
      });
    };
    Array.from(document.getElementsByClassName('remove-watchdog-btn')).forEach(btn => {
      btn.onclick = () => {
        const name = decodeURIComponent(btn.getAttribute('data-name'));
        loadWatchdogList((watchdogList) => {
          const idx = watchdogList.indexOf(name);
          if (idx !== -1) {
            watchdogList.splice(idx, 1);
            saveWatchdogList(watchdogList);
            renderWatchdog(playersOnline);
          }
        });
      }
    });
  });
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
    const players = Array.isArray(data.players) ? data.players : [];

    let playersNum = onlineString.match(/^(\d+)/);
    playersNum = playersNum ? playersNum[1] : onlineString;

    lastUpdate = new Date();

    let html = `
      <div class="serverinfo-inline">
        <span>Server: <span class="server-status ${serverStatus === "ONLINE" ? "status-online" : "status-offline"}">${serverStatus}</span></span>
        <span class="uptime-inline">[${uptime.replace(/\s+/g, '').trim()}]</span>
      </div>
      <div class="stat">
        <b>Players online:</b> <span class="stat-value">${playersNum}</span>
      </div>
      <div class="stat discord">
        <a href="https://discord.com/invite/jAU83Yg5SN" target="_blank" rel="noopener">
          <b>Discord online:</b> <span class="stat-value">${discordOnline}</span>
        </a>
      </div>
      <div class="monsters-container">
        <b>Monsters:</b> <span class="stat-value">${monsters}</span>
      </div>
      <hr class="watchdog-separator"/>
    `;

    content.innerHTML = html;

    // --- Watchdog functionality ---
    renderWatchdog(players);

    // --- LAST UPDATE footer ---
    document.getElementById('last-update-footer').innerHTML =
      `Last update: <span id="timestamp">${lastUpdate.toLocaleTimeString()}</span>`;

    debug('Content updated in popup.');
    chrome.runtime.sendMessage({ action: "updateBadgeNow" });
  } catch (e) {
    content.innerHTML = `<div class="error">Failed to load data.<br>${e.message}</div>`;
    debug('Error: ' + e.message);
  }
}

function startAutoRefresh() {
  debug('Starting auto-refresh');
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => fetchStatus(false), 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  debug('DOMContentLoaded event fired');
  loadMuteState(mute => {
    muteState = mute;
    updateMuteBtnIcon();

    loadTheme(mode => {
      applyTheme(mode || 'dark');
    });
  
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        applyTheme(themeMode === 'dark' ? 'light' : 'dark');
      });
    }
  });

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      debug('Refresh button clicked');
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
  debug('Popup unloaded, clearing interval');
  if (intervalId) clearInterval(intervalId);
});
