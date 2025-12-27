let currentAudio = null;

// Listen for messages to play sounds
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'playAudioFile') {
    playAudioFile(request.audioFile, request.loop);
    sendResponse({ success: true });
  } else if (request.action === 'stopAudio') {
    stopAudio();
    sendResponse({ success: true });
  }
  return true;
});

function playAudioFile(filename, loop = false) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  
  currentAudio = new Audio(chrome.runtime.getURL(filename));
  currentAudio.volume = 0.7; // Adjust volume (0.0 to 1.0)
  currentAudio.loop = loop; // Enable looping if requested
  
  currentAudio.play().catch(error => {
    console.error('Error playing audio file:', error);
  });
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}
