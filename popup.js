let startTime;
let timerInterval;
let settings = {
  confirmBeforeRecording: false,
  showNotifications: true,
  saveLocation: 'downloads'
};

function updateTimer() {
  const currentTime = new Date().getTime();
  const diff = currentTime - startTime;
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  document.querySelector('#timer span').textContent = 
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
  const timerElement = document.getElementById('timer');
  const recordingIndicator = document.querySelector('.recording-indicator');
  
  timerElement.classList.remove('hidden');
  // Wait a bit before showing the timer to allow the transition
  setTimeout(() => {
    timerElement.classList.remove('opacity-0');
    timerElement.classList.add('opacity-100');
    recordingIndicator.classList.remove('hidden');
  }, 50);
  
  startTime = new Date().getTime();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  const timerElement = document.getElementById('timer');
  const recordingIndicator = document.querySelector('.recording-indicator');
  
  timerElement.classList.remove('opacity-100');
  timerElement.classList.add('opacity-0');
  recordingIndicator.classList.add('hidden');
  
  // Hide the timer completely after transition
  setTimeout(() => {
    timerElement.classList.add('hidden');
  }, 200);
}

document.addEventListener('DOMContentLoaded', function() {
  const startButton = document.getElementById('startRecord');
  const stopButton = document.getElementById('stopRecord');
  const statusDiv = document.getElementById('status');

  // Check if current tab is Google Meet
  async function checkGoogleMeet() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url?.includes('meet.google.com')) {
        startButton.disabled = true;
        startButton.classList.add('opacity-50');
        statusDiv.textContent = 'Please open a Google Meet tab';
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking tab:', error);
      return false;
    }
  }

  // Initial check
  checkGoogleMeet();

  // Add after DOMContentLoaded
  chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) {
      settings = result.settings;
      document.getElementById('confirmBeforeRecording').checked = settings.confirmBeforeRecording;
      document.getElementById('showNotifications').checked = settings.showNotifications;
    }
  });

  // Add settings toggle
  document.getElementById('settingsToggle').addEventListener('click', () => {
    const settingsContent = document.querySelector('.settings-content');
    const toggleIcon = document.querySelector('#settingsToggle svg');
    settingsContent.classList.toggle('hidden');
    toggleIcon.classList.toggle('rotate-180');
  });

  // Add settings change handlers
  document.getElementById('confirmBeforeRecording').addEventListener('change', (e) => {
    settings.confirmBeforeRecording = e.target.checked;
    chrome.storage.sync.set({ settings });
  });

  document.getElementById('showNotifications').addEventListener('change', (e) => {
    settings.showNotifications = e.target.checked;
    chrome.storage.sync.set({ settings });
  });

  startButton.addEventListener('click', async () => {
    try {
      if (settings.confirmBeforeRecording) {
        const confirm = window.confirm('Are you sure you want to start recording?');
        if (!confirm) return;
      }

      if (!await checkGoogleMeet()) return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // First inject the content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // Then request microphone access
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioFormat = document.getElementById('audioFormat').value;
      
      // Start recording
      chrome.tabs.sendMessage(tab.id, { 
        action: 'startRecording', 
        audioFormat: audioFormat 
      });

      startTimer();
      startButton.disabled = true;
      stopButton.disabled = false;
      stopButton.classList.remove('opacity-50');
      startButton.classList.add('opacity-50');
      
      statusDiv.textContent = 'Recording in progress...';

      if (settings.showNotifications) {
        chrome.notifications.create('recordingStart', {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Recording Started',
          message: 'MeetCaps is now recording your meeting',
          priority: 2
        });
      }
    } catch (error) {
      console.error('Recording error:', error);
      statusDiv.textContent = 'Error: ' + error.message;
      stopTimer();
    }
  });

  stopButton.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'stopRecording' 
      });
      
      if (!response?.success) {
        throw new Error('Failed to stop recording');
      }
      
      stopTimer();
      startButton.disabled = false;
      stopButton.disabled = true;
      startButton.classList.remove('opacity-50');
      stopButton.classList.add('opacity-50');
      
      statusDiv.textContent = 'Recording saved';

      if (settings.showNotifications) {
        chrome.notifications.create('recordingStop', {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Recording Saved',
          message: 'Your meeting recording has been saved',
          priority: 2
        });
      }
    } catch (error) {
      console.error('Stop recording error:', error);
      statusDiv.textContent = 'Error: ' + error.message;
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'recordingStatus') {
      statusDiv.textContent = message.status;
    }
  });

  console.log('Popup script loaded');
}); 