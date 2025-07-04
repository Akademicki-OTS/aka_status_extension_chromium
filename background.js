let prevOnline = [];
let lastBadgeNum = null;

// Helper: Fetch the JSON
async function fetchStatusJson() {
  try {
    const resp = await fetch('http://game.ots76.org/client_json.php');
    if (!resp.ok) throw new Error("Network error");
    return await resp.json();
  } catch (e) {
    return null;
  }
}

// Helper: Get the watchdog list
function getWatchdogList(cb) {
  chrome.storage.local.get({ "watchdogList": [] }, result => cb(result.watchdogList));
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play ding.wav when a watched player logs in'
  });
}

function playDingOffscreen() {
  chrome.runtime.sendMessage('play-ding');
}

function playDingOffscreen() {
  chrome.runtime.sendMessage("play-ding");
}

// Helper: Create browser notification
function notifyPlayerOnline(playerNames) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon32x32.png",
    title: "Aka 7.6 Status: Watchdog",
    message: (playerNames.length === 1
      ? `${playerNames[0]} is online!`
      : `${playerNames.join(', ')} are online!`
    ),
    priority: 2
  });
}

// Helper: Set badge
function setBadge(num, heartbeat = false) {
  chrome.action.setBadgeText({ text: String(num) });
  if (heartbeat) {
    chrome.action.setBadgeBackgroundColor({ color: "#ff355b" });
    setTimeout(() => {
      chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
    }, 400);
  } else {
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
  }
}

// Main polling
async function pollStatus() {
  const data = await fetchStatusJson();
  if (!data) {
    setBadge("?", false);
    return;
  }
  // Set badge (players online)
  let num = "?";
  if (data.online) {
    const match = data.online.match(/^(\d+)/);
    if (match) num = match[1];
  }
  // Always set the badge, heartbeat only if changed
  if (lastBadgeNum !== num) {
    setBadge(num, true);
  } else {
    setBadge(num, false);
  }
  lastBadgeNum = num;

  // Watchdog logic
  getWatchdogList((watchdogList) => {
    const players = Array.isArray(data.players) ? data.players : [];
    const onlineNow = watchdogList.filter(name => players.includes(name));
    const newOnline = onlineNow.filter(name => !prevOnline.includes(name));
    if (newOnline.length > 0) {
      notifyPlayerOnline(newOnline);          // visual
      ensureOffscreen().then(playDingOffscreen); // audio
    }
    prevOnline = onlineNow;
  });
}

// On install, on startup, and every 10s
chrome.runtime.onInstalled.addListener(pollStatus);
chrome.runtime.onStartup.addListener(pollStatus);
setInterval(pollStatus, 10000); // 10s

chrome.action.onClicked.addListener(pollStatus);

// Optional: if popup wants badge update NOW
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadgeNow") {
    pollStatus();
    sendResponse({ result: "Badge updated" });
  }
});
