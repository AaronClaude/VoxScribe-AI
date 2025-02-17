// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Add your background script logic here