// background.js

async function updateBadge() {
    try {
      const resp = await fetch('http://game.ots76.org/client_json.php');
      const data = await resp.json();
      let num = 0;
      if (data.online) {
        const match = data.online.match(/^(\d+)/);
        if (match) num = match[1];
      }
      chrome.action.setBadgeText({ text: num.toString() });
      chrome.action.setBadgeBackgroundColor({ color: "#2196F3" }); // Nice blue
    } catch (e) {
      chrome.action.setBadgeText({ text: "?" });
      chrome.action.setBadgeBackgroundColor({ color: "#888" });
    }
  }
  
  // Update on install, on startup, and every 30 seconds
  chrome.runtime.onInstalled.addListener(updateBadge);
  chrome.runtime.onStartup.addListener(updateBadge);
  
  // Update every 30 seconds
  setInterval(updateBadge, 30000);
  
  // (Optional) When popup is opened, update badge too
  chrome.action.onClicked.addListener(updateBadge);
  