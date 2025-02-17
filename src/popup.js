document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('urlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const clearBtn = document.getElementById('clearBtn');
  const transcribeBtn = document.getElementById('transcribeBtn');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const status = document.getElementById('status');
  const transcript = document.getElementById('transcript');
  const summary = document.getElementById('summary');
  const copyBtn = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const languageSelect = document.getElementById('languageSelect');
  const videoTitle = document.getElementById('videoTitle');
  const videoDuration = document.getElementById('videoDuration');
  const cleanTextBtn = document.getElementById('cleanTextBtn');

  let currentVideoId = null;

  // Add this constant at the top of the file
  const SERVER_URL = 'http://localhost:3000';  // Adjust this to match your server URL

  // Function to extract video ID from YouTube URL
  function getYouTubeVideoId(url) {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    } else if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }
    return null;
  }

  // Add these functions at the top level, after the initial declarations
  async function fetchVideoDetails(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`);
      const data = await response.json();
      return {
        title: data.title,
        author: data.author_name,
        thumbnail: data.thumbnail_url
      };
    } catch (error) {
      console.error('Error fetching video details:', error);
      return null;
    }
  }

  function updateProgress(type, percent) {
    const progressDiv = document.getElementById(`${type}Progress`);
    const progressBar = document.getElementById(`${type}ProgressBar`);
    const percentText = document.getElementById(`${type}Percent`);
    
    progressDiv.classList.remove('hidden');
    progressBar.style.width = `${percent}%`;
    percentText.textContent = `${Math.round(percent)}%`;
    
    if (percent >= 100) {
      setTimeout(() => {
        progressDiv.classList.add('hidden');
      }, 1000);
    }
  }

  // Function to update video info
  async function updateVideoInfo(url) {
    try {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        currentVideoId = videoId;
        videoTitle.textContent = 'Loading video details...';
        videoDuration.textContent = 'Duration: --:--';
        transcribeBtn.disabled = true;
        
        const details = await fetchVideoDetails(videoId);
        if (details) {
          videoTitle.textContent = details.title;
          videoDuration.textContent = `By: ${details.author}`;
          transcribeBtn.disabled = false;
        } else {
          throw new Error('Failed to fetch video details');
        }
      } else {
        videoTitle.textContent = 'Invalid YouTube URL';
        videoDuration.textContent = 'Duration: --:--';
        transcribeBtn.disabled = true;
      }
    } catch (error) {
      console.error('Error:', error);
      videoTitle.textContent = 'Error loading video details';
      videoDuration.textContent = 'Duration: --:--';
      transcribeBtn.disabled = true;
    }
  }

  // Paste button handler
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text;
      await updateVideoInfo(text);
    } catch (error) {
      console.error('Failed to paste:', error);
    }
  });

  // Clear button handler
  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    videoTitle.textContent = 'Enter YouTube URL';
    videoDuration.textContent = 'Duration: --:--';
    transcribeBtn.disabled = true;
  });

  // URL input handler
  urlInput.addEventListener('input', async (e) => {
    if (e.target.value) {
      await updateVideoInfo(e.target.value);
    } else {
      videoTitle.textContent = 'Enter YouTube URL';
      videoDuration.textContent = 'Duration: --:--';
      transcribeBtn.disabled = true;
    }
  });

  // Check current tab on popup open
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url.includes('youtube.com/watch')) {
    urlInput.value = tab.url;
    await updateVideoInfo(tab.url);
  }

  // Add this function to clean the text
  function cleanText(text) {
    const entities = {
      '&#39;': "'",
      '&quot;': '"',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&nbsp;': ' '
    };
    
    let cleaned = text;
    for (const [entity, char] of Object.entries(entities)) {
      cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
    }
    
    // Remove extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  // Update the transcribe button click handler
  transcribeBtn.addEventListener('click', async () => {
    status.classList.remove('hidden');
    transcribeBtn.disabled = true;
    updateStatusText('Starting transcription...');
    
    try {
      document.getElementById('transcriptContainer').classList.remove('hidden');
      updateProgress('transcribe', 10);
      
      // Send request to start transcription
      const response = await fetch(`${SERVER_URL}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: currentVideoId,
          language: languageSelect.value
        })
      });

      if (!response.ok) {
        throw new Error('Transcription request failed');
      }

      // Poll for transcription progress
      let transcriptionComplete = false;
      while (!transcriptionComplete) {
        const progressResponse = await fetch(`${SERVER_URL}/transcribe/progress/${currentVideoId}`);
        const progressData = await progressResponse.json();
        
        updateProgress('transcribe', progressData.progress);
        updateStatusText(progressData.status);
        
        if (progressData.progress >= 100) {
          transcriptionComplete = true;
          const transcriptResponse = await fetch(`${SERVER_URL}/transcribe/result/${currentVideoId}`);
          const transcriptData = await transcriptResponse.json();
          transcript.textContent = transcriptData.transcript;
          summarizeBtn.disabled = false;
          copyBtn.classList.remove('hidden');
          downloadBtn.classList.remove('hidden');
          cleanTextBtn.classList.remove('hidden'); // Show clean text button
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
        }
      }
      
    } catch (error) {
      console.error('Transcription failed:', error);
      updateStatusText('Transcription failed: ' + error.message);
    } finally {
      status.classList.add('hidden');
    }
  });

  // Update the summarize button click handler
  summarizeBtn.addEventListener('click', async () => {
    status.classList.remove('hidden');
    summarizeBtn.disabled = true;
    updateStatusText('Starting summarization...');
    
    try {
      document.getElementById('summaryContainer').classList.remove('hidden');
      updateProgress('summarize', 10);
      
      // Send request to start summarization
      const response = await fetch(`${SERVER_URL}/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: currentVideoId,
          transcript: transcript.textContent
        })
      });

      if (!response.ok) {
        throw new Error('Summarization request failed');
      }

      // Poll for summarization progress
      let summarizationComplete = false;
      while (!summarizationComplete) {
        const progressResponse = await fetch(`${SERVER_URL}/summarize/progress/${currentVideoId}`);
        const progressData = await progressResponse.json();
        
        updateProgress('summarize', progressData.progress);
        updateStatusText(progressData.status);
        
        if (progressData.progress >= 100) {
          summarizationComplete = true;
          const summaryResponse = await fetch(`${SERVER_URL}/summarize/result/${currentVideoId}`);
          const summaryData = await summaryResponse.json();
          summary.textContent = summaryData.summary;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
        }
      }
      
    } catch (error) {
      console.error('Summarization failed:', error);
      updateStatusText('Summarization failed: ' + error.message);
    } finally {
      status.classList.add('hidden');
      summarizeBtn.disabled = false;
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(transcript.textContent);
    // Show copy confirmation
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  });

  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([transcript.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `transcript-${currentVideoId}.txt`
    });
  });

  // Add clean text button handler
  cleanTextBtn.addEventListener('click', () => {
    const currentText = transcript.textContent;
    const cleanedText = cleanText(currentText);
    transcript.textContent = cleanedText;
    
    // Show confirmation
    const originalText = cleanTextBtn.textContent;
    cleanTextBtn.textContent = 'Text Cleaned!';
    cleanTextBtn.disabled = true;
    
    setTimeout(() => {
      cleanTextBtn.textContent = originalText;
      cleanTextBtn.disabled = false;
    }, 2000);
  });

  // Add error handling for the status text
  function updateStatusText(text) {
    const statusText = document.getElementById('statusText');
    statusText.textContent = text;
  }
});