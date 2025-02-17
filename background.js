chrome.runtime.onInstalled.addListener(() => {
  console.log('MeetCaps extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveRecording') {
    const blob = new Blob([new Uint8Array(message.data)], { type: message.mimeType });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: message.filename,
      conflictAction: 'uniquify',
      saveAs: true
    });
  }
}); 