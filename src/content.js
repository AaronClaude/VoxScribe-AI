// This script runs on YouTube pages
console.log('Content script loaded');

// Add your YouTube-specific content script logic here

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      const videoId = new URLSearchParams(window.location.search).get('v');
      sendResponse({ videoId });
    }
    return true;
  });