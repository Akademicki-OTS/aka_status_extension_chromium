let intervalId = null;
let lastUpdate = null;
let prevOnlinePlayers = [];
let lastNotifiedPlayers = [];
let muteState = false;

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

function playDing() {
  if (muteState) return;
  const audio = document.getElementById('ding-audio');
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
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
    html += `</div>`;
    document.getElementById('watchdog').innerHTML = html;

    // Add/Remove events
    document.getElementById('add-watchdog-form').onsubmit = (e) => {
      e.preventDefault();
      const input = document.getElementById('watchdog-input');
      let val = input.value.trim();
      if (!val) return;
      val = val.replace(/\s+/g, " "); // Single spaces only
      if (watchdogList.includes(val)) {
        input.value = "";
        return;
      }
      watchdogList.push(val);
      saveWatchdogList(watchdogList);
      input.value = "";
      renderWatchdog(playersOnline);
    };
    Array.from(document.getElementsByClassName('remove-watchdog-btn')).forEach(btn => {
      btn.onclick = () => {
        const name = decodeURIComponent(btn.getAttribute('data-name'));
        const idx = watchdogList.indexOf(name);
        if (idx !== -1) {
          watchdogList.splice(idx, 1);
          saveWatchdogList(watchdogList);
          renderWatchdog(playersOnline);
        }
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

    // Players button and player list
    let playersSection = `
      <button id="show-players-btn" style="
        margin-top:6px; 
        background:#232b37; 
        border:none; 
        color:#8ecffb; 
        font-size:0.97em;
        padding:3px 13px; 
        border-radius:7px; 
        cursor:pointer;
        margin-bottom:5px;
        ">
        Show players
      </button>
      <div id="players-list" style="display:none; margin:7px 0 10px 2px;">
        ${
          players.length
            ? players.map(player =>
                `<a href="https://ots76.org/index.php?module=findchar&player=${encodeURIComponent(player)}" target="_blank">${player}</a>`
              ).join('<br>')
            : '<span style="color:#aaa;font-size:0.97em;">No players online</span>'
        }
      </div>
    `;

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
      ${playersSection}
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

    // Show/hide player list button
    const btn = document.getElementById('show-players-btn');
    const list = document.getElementById('players-list');
    if (btn && list) {
      btn.addEventListener('click', () => {
        const visible = list.style.display !== 'none';
        list.style.display = visible ? 'none' : 'block';
        btn.textContent = visible ? 'Show players' : 'Hide players';
      });
    }

    // --- Watchdog functionality ---
    renderWatchdog(players);

    // --- Watchdog notification logic ---
    loadWatchdogList((watchdogList) => {
      const playersNowOnline = watchdogList.filter(name => players.includes(name));
      // For each watched player, if they were NOT online last time but are now online, ding
      const newOnline = playersNowOnline.filter(name => !lastNotifiedPlayers.includes(name));
      if (newOnline.length > 0) {
        playDing();
      }
      lastNotifiedPlayers = playersNowOnline.slice();
    });

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
  intervalId = setInterval(() => fetchStatus(false), 10000);
}

document.addEventListener('DOMContentLoaded', () => {
  debug('DOMContentLoaded event fired');
  loadMuteState(mute => {
    muteState = mute;
    updateMuteBtnIcon();
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
