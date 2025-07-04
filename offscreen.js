// offscreen.js
chrome.runtime.onMessage.addListener((msg) => {
    if (msg === 'play-ding') {
      const a = document.getElementById('ding');
      if (a) {
        a.currentTime = 0;
        a.play().catch(() => {/* ignore if user muted tab */});
      }
    }
  });