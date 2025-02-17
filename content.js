let mediaRecorder = null;
let audioChunks = [];
let isContentScriptReady = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startRecording') {
    if (!isContentScriptReady) {
      sendResponse({ success: false, error: 'Content script not ready' });
      return true;
    }
    startRecording(request.audioFormat)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'stopRecording') {
    stopRecording();
    sendResponse(true);
  }
  return false;
});

async function startRecording(audioFormat) {
  try {
    // Stop any existing recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      stopRecording();
    }

    // Reset chunks
    audioChunks = [];

    // Request audio stream with specific constraints
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 2,
        sampleRate: 44100
      }
    });

    // Create media recorder with specified format
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: audioFormat || 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: audioFormat });
      const reader = new FileReader();
      reader.onloadend = () => {
        const arrayBuffer = reader.result;
        
        chrome.runtime.sendMessage({
          type: 'saveRecording',
          data: Array.from(new Uint8Array(arrayBuffer)),
          filename: `meetcaps-recording-${new Date().toISOString()}.${extension}`,
          mimeType: audioFormat
        });
      };
      reader.readAsArrayBuffer(audioBlob);
    };

    // Start recording with 1-second timeslices
    mediaRecorder.start(1000);
    chrome.runtime.sendMessage({ 
      type: 'recordingStatus', 
      status: 'Recording started successfully' 
    });
  } catch (error) {
    console.error('Recording error:', error);
    chrome.runtime.sendMessage({ 
      type: 'recordingStatus', 
      status: 'Error: ' + error.message 
    });
    throw error; // Propagate error to caller
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }
}

// Notify that content script is loaded
chrome.runtime.sendMessage({ 
  type: 'recordingStatus', 
  status: 'Ready to record' 
});
isContentScriptReady = true;

console.log('Content script loaded'); 