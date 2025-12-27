let activeTabId = null;
let tabStartTime = null;
let destructTimerInterval = null;
let lockdownInterval = null;

// Pomodoro Timer
const TIMER_MODES = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

let pomodoroInterval = null;

// Initialize/Resume pomodoro timer on startup
chrome.storage.local.get(['pomodoroMode', 'pomodoroStartTime', 'pomodoroRunning', 'pomodoroDuration'], (data) => {
  if (data.pomodoroRunning && data.pomodoroStartTime) {
    const elapsed = Math.floor((Date.now() - data.pomodoroStartTime) / 1000);
    const duration = data.pomodoroDuration || TIMER_MODES[data.pomodoroMode || 'pomodoro'];
    const remaining = duration - elapsed;
    
    if (remaining > 0) {
      startPomodoroTimer(data.pomodoroMode || 'pomodoro', remaining);
    } else {
      // Timer already finished
      completePomodoroTimer(data.pomodoroMode || 'pomodoro');
    }
  }
});

function startPomodoroTimer(mode, timeRemaining) {
  if (pomodoroInterval) clearInterval(pomodoroInterval);
  
  const startTime = Date.now();
  const duration = timeRemaining;
  
  chrome.storage.local.set({
    pomodoroMode: mode,
    pomodoroStartTime: startTime,
    pomodoroRunning: true,
    pomodoroDuration: duration
  });
  
  pomodoroInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = duration - elapsed;
    
    chrome.storage.local.set({ pomodoroTimeRemaining: remaining });
    
    if (remaining <= 0) {
      completePomodoroTimer(mode);
    }
  }, 1000);
}

function completePomodoroTimer(mode) {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  // Play joyful sound for pomodoro completion
  playJoyfulSound();
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'Pomodoro Timer',
    message: mode === 'pomodoro' ? 'Time for a break!' : 'Break is over!',
    priority: 2
  });
  
  chrome.storage.local.set({
    pomodoroRunning: false,
    pomodoroStartTime: null,
    pomodoroTimeRemaining: TIMER_MODES[mode]
  });
}

async function playSound(soundType) {
  try {
    // Check if offscreen document already exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length === 0) {
      // Create offscreen document if it doesn't exist
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play notification sound'
      });
    }
    
    // Send message to offscreen document to play sound
    await chrome.runtime.sendMessage({ action: soundType });
    
    // Close offscreen document after sound plays
    const closeDelay = soundType === 'playBell' ? 7000 : 2000;
    setTimeout(async () => {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {
        // Ignore errors when closing
      }
    }, closeDelay);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
}

async function playBellSound() {
  await playSound('playBell');
}

async function playJoyfulSound() {
  // Play WAV file
  await playAudioFile('pomodoro-complete.wav');
}

async function playAudioFile(filename, loop = false, keepAlive = false) {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Play notification sound'
      });
    }
    
    await chrome.runtime.sendMessage({ action: 'playAudioFile', audioFile: filename, loop: loop });
    
    // Only close document if not keeping alive for looping
    if (!keepAlive) {
      setTimeout(async () => {
        try {
          await chrome.offscreen.closeDocument();
        } catch (e) {
          // Ignore errors
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Error playing audio file:', error);
  }
}

async function stopAudioPlayback() {
  try {
    await chrome.runtime.sendMessage({ action: 'stopAudio' });
    
    setTimeout(async () => {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {
        // Ignore errors
      }
    }, 500);
  } catch (error) {
    console.error('Error stopping audio:', error);
  }
}

function pausePomodoroTimer() {
  if (pomodoroInterval) {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
  }
  
  // Get current remaining time before pausing
  chrome.storage.local.get(['pomodoroStartTime', 'pomodoroDuration'], (data) => {
    if (data.pomodoroStartTime && data.pomodoroDuration) {
      const elapsed = Math.floor((Date.now() - data.pomodoroStartTime) / 1000);
      const remaining = data.pomodoroDuration - elapsed;
      
      chrome.storage.local.set({ 
        pomodoroRunning: false,
        pomodoroTimeRemaining: Math.max(0, remaining)
      });
    } else {
      chrome.storage.local.set({ pomodoroRunning: false });
    }
  });
}

// Resume timer on service worker startup
chrome.storage.local.get(['destructTimer', 'destructStartTime'], (data) => {
  if (data.destructTimer && data.destructStartTime) {
    const elapsedSeconds = Math.floor((Date.now() - data.destructStartTime) / 1000);
    const remainingSeconds = data.destructTimer - elapsedSeconds;
    
    if (remainingSeconds > 0) {
      // Resume the timer
      startDestructTimer(data.destructTimer);
    } else {
      // Timer already expired, close tabs now
      chrome.storage.local.get('destructTabIds', (result) => {
        const tabIds = result.destructTabIds || [];
        tabIds.forEach(tabId => {
          chrome.tabs.remove(tabId).catch(() => {});
        });
        chrome.storage.local.set({
          destructTimer: null,
          destructStartTime: null,
          destructTabIds: []
        });
      });
    }
  }
});

function startDestructTimer(timerSeconds) {
  // Clear any existing timer
  if (destructTimerInterval) {
    clearInterval(destructTimerInterval);
  }

  // Reset warning flag when starting timer
  chrome.storage.local.set({ destructWarningPlayed: false });

  destructTimerInterval = setInterval(async () => {
    const { destructStartTime, destructTabIds, destructTimer, destructWarningPlayed } = await chrome.storage.local.get(['destructStartTime', 'destructTabIds', 'destructTimer', 'destructWarningPlayed']);
    
    // If timer was cleared, stop checking
    if (!destructTimer) {
      clearInterval(destructTimerInterval);
      destructTimerInterval = null;
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - destructStartTime) / 1000);
    const remainingSeconds = destructTimer - elapsedSeconds;

    console.log(`Self-destruct check: ${remainingSeconds}s remaining, warning played: ${destructWarningPlayed}`);

    // Play warning sound 25 seconds before self-destruct (looping)
    if (remainingSeconds <= 25 && remainingSeconds > 0 && !destructWarningPlayed) {
      await chrome.storage.local.set({ destructWarningPlayed: true });
      playAudioFile('self-destruct.wav', true, true); // loop=true, keepAlive=true
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Self-Destruct Warning',
        message: `Tabs will close in ${remainingSeconds} seconds!`,
        priority: 2
      });
      
      console.log(`Self-destruct warning played: ${remainingSeconds} seconds remaining`);
    }

    if (elapsedSeconds >= destructTimer) {
      // Stop the warning sound
      stopAudioPlayback();
      
      // Timer is up - close tabs
      const tabIds = destructTabIds || [];
      console.log('Self-destruct timer expired. Closing tabs:', tabIds);
      
      for (const tabId of tabIds) {
        try {
          await chrome.tabs.remove(tabId);
          console.log('Closed tab:', tabId);
        } catch (e) {
          console.log('Failed to close tab:', tabId, e);
        }
      }

      // Clear self-destruct data
      await chrome.storage.local.set({
        destructTimer: null,
        destructStartTime: null,
        destructTabIds: [],
        destructWarningPlayed: false
      });

      clearInterval(destructTimerInterval);
      destructTimerInterval = null;
      console.log('Self-destruct complete');
    }
  }, 500);
}

// Resume lockdown on service worker startup
chrome.storage.local.get(['lockdownActive', 'lockdownEndTime'], (data) => {
  if (data.lockdownActive && data.lockdownEndTime) {
    const remainingTime = data.lockdownEndTime - Date.now();
    
    if (remainingTime > 0) {
      startLockdown(data.lockdownEndTime);
    } else {
      // Lockdown already expired
      chrome.storage.local.set({
        lockdownActive: false,
        lockdownEndTime: null
      });
    }
  }
});

function startLockdown(endTime) {
  if (lockdownInterval) {
    clearInterval(lockdownInterval);
  }
  
  lockdownInterval = setInterval(async () => {
    const { lockdownEndTime, lockdownActive } = await chrome.storage.local.get(['lockdownEndTime', 'lockdownActive']);
    
    if (!lockdownActive) {
      clearInterval(lockdownInterval);
      lockdownInterval = null;
      return;
    }
    
    const remainingTime = lockdownEndTime - Date.now();
    
    if (remainingTime <= 0) {
      // Lockdown expired
      await chrome.storage.local.set({
        lockdownActive: false,
        lockdownEndTime: null
      });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Tab Lockdown',
        message: 'Lockdown period has ended',
        priority: 1
      });
      
      clearInterval(lockdownInterval);
      lockdownInterval = null;
    }
  }, 1000);
}

chrome.tabs.onCreated.addListener(async (tab) => {
// Check lockdown first
const { lockdownActive, lockdownEndTime, maxTabs } = await chrome.storage.local.get(['lockdownActive', 'lockdownEndTime', 'maxTabs']);

if (lockdownActive && lockdownEndTime && Date.now() < lockdownEndTime) {
  if (maxTabs) {
    const tabs = await chrome.tabs.query({});
    if (tabs.length > maxTabs) {
      chrome.tabs.remove(tab.id);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Tab Lockdown',
        message: `Maximum ${maxTabs} tabs allowed during lockdown`,
        priority: 2
      });
      return;
    }
  }
}

// Track tab if self-destruct is active
const { destructTimer, destructTabIds } = await chrome.storage.local.get(['destructTimer', 'destructTabIds']);
if (destructTimer) {
  const tabIds = destructTabIds || [];
  tabIds.push(tab.id);
  chrome.storage.local.set({ destructTabIds: tabIds });
}

// Check max tabs limit (if not in lockdown)
if (!lockdownActive && maxTabs) {
  const tabs = await chrome.tabs.query({});
  if (tabs.length > maxTabs) {
    chrome.tabs.remove(tabs[tabs.length - 1].id);
  }
}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Track URL changes or when page finishes loading
  if (tab.url && !tab.url.startsWith('chrome')) {
    // Only process if URL changed or page completed loading
    if (changeInfo.url || changeInfo.status === 'complete') {
      chrome.storage.local.get('tabIntents', data => {
        const intents = data.tabIntents || [];
        const entry = intents.find(i => i.tabId === tabId);
        
        if (entry) {
          // Initialize history array if it doesn't exist
          if (!entry.urlHistory) {
            entry.urlHistory = [];
          }
          
          // Only update if the URL actually changed
          if (entry.currentUrl !== tab.url) {
            // If there's a current URL being tracked, save its time
            if (entry.currentUrl && entry.currentUrlStartTime) {
              const timeOnUrl = Math.floor((Date.now() - entry.currentUrlStartTime) / 1000);
              // Only add to history if time spent is more than 0
              if (timeOnUrl > 0) {
                entry.urlHistory.push({
                  url: entry.currentUrl,
                  visitedAt: new Date(entry.currentUrlStartTime).toISOString(),
                  timeSpent: timeOnUrl
                });
              }
            }
            
            // Set the first URL if not set
            if (!entry.url) {
              entry.url = tab.url;
            }
            
            // Update current URL tracking
            entry.currentUrl = tab.url;
            entry.currentUrlStartTime = Date.now();
            
            chrome.storage.local.set({ tabIntents: intents });
          } else if (!entry.currentUrl) {
            // First time setting current URL
            entry.currentUrl = tab.url;
            entry.currentUrlStartTime = Date.now();
            if (!entry.url) {
              entry.url = tab.url;
            }
            chrome.storage.local.set({ tabIntents: intents });
          }
        }
      });
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  // Save time for previously active tab
  if (activeTabId !== null && tabStartTime !== null) {
    const timeSpent = Math.floor((Date.now() - tabStartTime) / 1000);
    chrome.storage.local.get('tabIntents', data => {
      const intents = data.tabIntents || [];
      const entry = intents.find(i => i.tabId === activeTabId);
      if (entry) {
        entry.timeSpent = (entry.timeSpent || 0) + timeSpent;
        
        // Update current URL time if tracking
        if (entry.currentUrl && entry.currentUrlStartTime) {
          const urlTime = Math.floor((Date.now() - entry.currentUrlStartTime) / 1000);
          // Update the start time for next calculation
          entry.currentUrlStartTime = Date.now();
        }
        
        chrome.storage.local.set({ tabIntents: intents });
      }
    });
  }

  // Set new active tab
  activeTabId = activeInfo.tabId;
  tabStartTime = Date.now();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Save time when tab is closed
  chrome.storage.local.get('tabIntents', data => {
    const intents = data.tabIntents || [];
    const entry = intents.find(i => i.tabId === tabId);
    
    if (entry) {
      // Save final URL time if tracking
      if (entry.currentUrl && entry.currentUrlStartTime) {
        const timeOnUrl = Math.floor((Date.now() - entry.currentUrlStartTime) / 1000);
        if (!entry.urlHistory) entry.urlHistory = [];
        entry.urlHistory.push({
          url: entry.currentUrl,
          visitedAt: new Date(entry.currentUrlStartTime).toISOString(),
          timeSpent: timeOnUrl
        });
        entry.currentUrl = null;
        entry.currentUrlStartTime = null;
      }
      
      // Save total tab time if it's the active tab
      if (tabId === activeTabId && tabStartTime !== null) {
        const timeSpent = Math.floor((Date.now() - tabStartTime) / 1000);
        entry.timeSpent = (entry.timeSpent || 0) + timeSpent;
      }
      
      chrome.storage.local.set({ tabIntents: intents });
    }
  });
  
  if (tabId === activeTabId) {
    activeTabId = null;
    tabStartTime = null;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startDestructTimer') {
    startDestructTimer(request.timerSeconds);
  } else if (request.action === 'startPomodoro') {
    startPomodoroTimer(request.mode, request.timeRemaining);
    sendResponse({ success: true });
  } else if (request.action === 'pausePomodoro') {
    pausePomodoroTimer();
    sendResponse({ success: true });
  } else if (request.action === 'switchPomodoroMode') {
    // Only allow mode switching if timer is not running
    chrome.storage.local.get(['pomodoroRunning'], (data) => {
      if (!data.pomodoroRunning) {
        chrome.storage.local.set({
          pomodoroMode: request.mode,
          pomodoroRunning: false,
          pomodoroStartTime: null,
          pomodoroTimeRemaining: TIMER_MODES[request.mode]
        });
      }
      sendResponse({ success: true });
    });
  } else if (request.action === 'startLockdown') {
    startLockdown(request.endTime);
    sendResponse({ success: true });
  }
  return true;
});