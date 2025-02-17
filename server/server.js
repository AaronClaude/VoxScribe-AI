const express = require('express');
const cors = require('cors');
const { YoutubeTranscript } = require('youtube-transcript');
const axios = require('axios');
const entities = require('html-entities');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Store progress and results
const transcriptionProgress = new Map();
const summarizationProgress = new Map();
const results = new Map();

function cleanTranscript(text) {
  try {
    // First decode any HTML entities
    let cleaned = entities.decode(text);
    
    // Then apply other cleaning
    cleaned = cleaned
      // Remove timestamps
      .replace(/\[\d+:\d+\]/g, '')
      // Remove parenthetical notes and brackets
      .replace(/\([^)]*\)|\[[^\]]*\]|<[^>]*>/g, '')
      // Remove musical notes and emojis
      .replace(/[♪♫🎵🎶]/g, '')
      // Remove filler words
      .replace(/\b(um|uh|ah|er|like|you know|i mean)\b/gi, '')
      // Fix spacing
      .replace(/\s+/g, '')
      .replace(/&#39;/g, '')
      .trim();

    return cleaned;
  } catch (error) {
    console.error('Error in cleanTranscript:', error);
    return text; // Return original text if cleaning fails
  }
}

function generateLocalSummary(text) {
  try {
    // Split into sentences
    const sentences = text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out very short sentences

    if (sentences.length === 0) {
      return "Unable to generate summary: text too short or invalid.";
    }

    // Take 20% of sentences, minimum 3, maximum 5
    const numSentences = Math.min(5, Math.max(3, Math.ceil(sentences.length * 0.2)));
    
    // Get evenly distributed sentences
    const step = Math.floor(sentences.length / numSentences);
    let summary = "Summary:\n\n";
    
    for (let i = 0; i < numSentences; i++) {
      const index = Math.min(i * step, sentences.length - 1);
      summary += `• ${sentences[index]}.\n`;
    }

    return summary;
  } catch (error) {
    console.error('Error in generateLocalSummary:', error);
    return "Error generating summary";
  }
}

app.post('/transcribe', async (req, res) => {
  const { videoId } = req.body;
  
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID is required' });
  }

  try {
    console.log(`Starting transcription for video: ${videoId}`);
    
    transcriptionProgress.set(videoId, {
      progress: 0,
      status: 'Starting transcription...'
    });

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    console.log(`Received transcript with ${transcript.length} segments`);

    transcriptionProgress.set(videoId, {
      progress: 50,
      status: 'Processing transcript...'
    });

    // Join and clean transcript
    const rawText = transcript.map(entry => entry.text).join(' ');
    console.log('Raw transcript length:', rawText.length);

    const cleanedText = cleanTranscript(rawText);
    console.log('Cleaned transcript length:', cleanedText.length);

    // Store result
    results.set(`transcript-${videoId}`, cleanedText);
    
    transcriptionProgress.set(videoId, {
      progress: 100,
      status: 'Transcription complete'
    });

    res.json({ 
      success: true,
      message: 'Transcription completed successfully'
    });

  } catch (error) {
    console.error('Transcription error:', error);
    transcriptionProgress.set(videoId, {
      progress: 0,
      status: `Error: ${error.message}`
    });
    res.status(500).json({ error: error.message });
  }
});

app.post('/summarize', async (req, res) => {
  const { videoId, transcript } = req.body;
  
  if (!videoId || !transcript) {
    return res.status(400).json({ error: 'Video ID and transcript are required' });
  }

  try {
    console.log(`Starting summarization for video: ${videoId}`);
    console.log('Transcript length:', transcript.length);

    summarizationProgress.set(videoId, {
      progress: 0,
      status: 'Starting summarization...'
    });

    // Generate summary
    const summary = generateLocalSummary(transcript);
    console.log('Summary length:', summary.length);

    // Store result
    results.set(`summary-${videoId}`, summary);
    
    summarizationProgress.set(videoId, {
      progress: 100,
      status: 'Summarization complete'
    });

    res.json({ 
      success: true,
      message: 'Summarization completed successfully'
    });

  } catch (error) {
    console.error('Summarization error:', error);
    summarizationProgress.set(videoId, {
      progress: 0,
      status: `Error: ${error.message}`
    });
    res.status(500).json({ error: error.message });
  }
});

// Progress endpoints
app.get('/transcribe/progress/:videoId', (req, res) => {
  const progress = transcriptionProgress.get(req.params.videoId) || { 
    progress: 0, 
    status: 'Not started' 
  };
  res.json(progress);
});

app.get('/summarize/progress/:videoId', (req, res) => {
  const progress = summarizationProgress.get(req.params.videoId) || { 
    progress: 0, 
    status: 'Not started' 
  };
  res.json(progress);
});

// Result endpoints
app.get('/transcribe/result/:videoId', (req, res) => {
  const transcript = results.get(`transcript-${req.params.videoId}`);
  if (transcript) {
    res.json({ transcript });
  } else {
    res.status(404).json({ error: 'Transcript not found' });
  }
});

app.get('/summarize/result/:videoId', (req, res) => {
  const summary = results.get(`summary-${req.params.videoId}`);
  if (summary) {
    res.json({ summary });
  } else {
    res.status(404).json({ error: 'Summary not found' });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});