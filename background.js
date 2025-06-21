// background.js

async function updateBadge(withHeartbeat = false) {
  try {
    const resp = await fetch('http://game.ots76.org/client_json.php');
    const data = await resp.json();
    let num = 0;
    if (data.online) {
      const match = data.online.match(/^(\d+)/);
      if (match) num = match[1];
    }
    chrome.action.setBadgeText({ text: num.toString() });

    if (withHeartbeat) {
      chrome.action.setBadgeBackgroundColor({ color: "#ff355b" });
      setTimeout(() => {
        chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
      }, 400);
    } else {
      chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
    }
  } catch (e) {
    chrome.action.setBadgeText({ text: "?" });
    chrome.action.setBadgeBackgroundColor({ color: "#888" });
  }
}

// Update on install, on startup, and every 30 seconds (all with heartbeat)
chrome.runtime.onInstalled.addListener(() => updateBadge(true));
chrome.runtime.onStartup.addListener(() => updateBadge(true));
setInterval(() => updateBadge(true), 30000);
chrome.action.onClicked.addListener(() => updateBadge(true));
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateBadgeNow") {
    updateBadge(true);
    sendResponse({ result: "Badge updated" });
  }
});
