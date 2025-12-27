// Pomodoro Timer
const TIMER_MODES = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

function formatTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updatePomodoroUI() {
  chrome.storage.local.get(['pomodoroMode', 'pomodoroTimeRemaining', 'pomodoroRunning'], (data) => {
    const mode = data.pomodoroMode || 'pomodoro';
    const timeRemaining = data.pomodoroTimeRemaining !== undefined ? data.pomodoroTimeRemaining : TIMER_MODES[mode];
    const isRunning = data.pomodoroRunning || false;
    
    // Update timer display
    document.getElementById('pomodoroTimer').textContent = formatTimerDisplay(timeRemaining);
    
    // Update button
    const startBtn = document.getElementById('pomodoroStart');
    if (isRunning) {
      startBtn.textContent = 'PAUSE';
      startBtn.classList.add('running');
    } else {
      startBtn.textContent = 'START';
      startBtn.classList.remove('running');
    }
    
    // Update active tab
    document.querySelectorAll('.pomo-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.mode === mode) {
        tab.classList.add('active');
      }
    });
  });
}

function switchMode(mode) {
  chrome.runtime.sendMessage({ action: 'switchPomodoroMode', mode }, () => {
    updatePomodoroUI();
  });
}

function toggleTimer() {
  chrome.storage.local.get(['pomodoroMode', 'pomodoroTimeRemaining', 'pomodoroRunning'], (data) => {
    const mode = data.pomodoroMode || 'pomodoro';
    const isRunning = data.pomodoroRunning || false;
    
    if (isRunning) {
      // Pause
      chrome.runtime.sendMessage({ action: 'pausePomodoro' }, () => {
        updatePomodoroUI();
      });
    } else {
      // Start
      const timeRemaining = data.pomodoroTimeRemaining !== undefined ? data.pomodoroTimeRemaining : TIMER_MODES[mode];
      chrome.runtime.sendMessage({ 
        action: 'startPomodoro', 
        mode: mode,
        timeRemaining: timeRemaining
      }, () => {
        updatePomodoroUI();
      });
    }
  });
}

// Initialize pomodoro UI
updatePomodoroUI();
setInterval(updatePomodoroUI, 1000);

document.querySelectorAll('.pomo-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    switchMode(tab.dataset.mode);
  });
});

document.getElementById('pomodoroStart').addEventListener('click', toggleTimer);

// Intentional Tabs functionality
document.getElementById('save').onclick = () => {
const maxTabs = Number(document.getElementById('maxTabs').value);
chrome.storage.local.set({ maxTabs });
};


chrome.storage.local.get('maxTabs', data => {
if (data.maxTabs) document.getElementById('maxTabs').value = data.maxTabs;
});

function updateCurrentTabCount() {
chrome.tabs.query({}, tabs => {
  const count = tabs.length;
  document.getElementById('currentTabCount').textContent = `Currently open: ${count} tab${count !== 1 ? 's' : ''}`;
});
}

updateCurrentTabCount();
setInterval(updateCurrentTabCount, 1000);


function formatTime(seconds) {
if (!seconds) return '0s';
const hours = Math.floor(seconds / 3600);
const minutes = Math.floor((seconds % 3600) / 60);
const secs = seconds % 60;

if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
if (minutes > 0) return `${minutes}m ${secs}s`;
return `${secs}s`;
}

document.getElementById('view').onclick = () => {
chrome.tabs.create({ url: chrome.runtime.getURL('activity.html') });
};

document.getElementById('enableDestruct').onclick = () => {
const timerMinutes = Number(document.getElementById('destructTimer').value);
if (!timerMinutes || timerMinutes < 1) {
  alert('Please enter a valid timer value');
  return;
}

const timerSeconds = timerMinutes * 60;

chrome.storage.local.set({
  destructTimer: timerSeconds,
  destructStartTime: Date.now(),
  destructTabIds: []
}, () => {
  console.log('Self-destruct enabled:', timerMinutes, 'minutes');
  document.getElementById('destructStatus').innerHTML = `<p style="color: green;">Self-destruct enabled for ${timerMinutes} minute${timerMinutes !== 1 ? 's' : ''}</p>`;
  chrome.runtime.sendMessage({ action: 'startDestructTimer', timerSeconds }, () => {
    console.log('Message sent to background');
  });
});
};

function updateDestructStatus() {
chrome.storage.local.get(['destructTimer', 'destructStartTime', 'destructTabIds'], data => {
  if (data.destructTimer && data.destructStartTime) {
    const elapsedSeconds = Math.floor((Date.now() - data.destructStartTime) / 1000);
    const remainingSeconds = data.destructTimer - elapsedSeconds;
    const tabCount = (data.destructTabIds || []).length;
    
    if (remainingSeconds > 0) {
      document.getElementById('destructStatus').innerHTML = `<p style="color: green;">Self-destruct active: ${remainingSeconds}s remaining<br>Tracking ${tabCount} tab(s)</p>`;
    } else {
      document.getElementById('destructStatus').innerHTML = `<p style="color: red;">Self-destruct timer expired</p>`;
      chrome.storage.local.set({
        destructTimer: null,
        destructStartTime: null,
        destructTabIds: []
      });
    }
  } else {
    document.getElementById('destructStatus').innerHTML = '';
  }
});
}

updateDestructStatus();
setInterval(updateDestructStatus, 500);

// Tab Lockdown functionality
function updateLockdownUI() {
chrome.storage.local.get(['pomodoroRunning', 'lockdownActive', 'lockdownEndTime', 'maxTabs'], (data) => {
  const isPomodoro = data.pomodoroRunning || false;
  let lockdownActive = data.lockdownActive || false;
  
  // Check if lockdown has expired
  if (lockdownActive && data.lockdownEndTime) {
    const remainingSeconds = Math.max(0, Math.floor((data.lockdownEndTime - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      lockdownActive = false;
      // Clear lockdown state
      chrome.storage.local.set({
        lockdownActive: false,
        lockdownEndTime: null
      });
    }
  }
  
  // Disable max tabs input and save button during lockdown
  const maxTabsInput = document.getElementById('maxTabs');
  const saveButton = document.getElementById('save');
  if (lockdownActive) {
    maxTabsInput.disabled = true;
    saveButton.disabled = true;
  } else {
    maxTabsInput.disabled = false;
    saveButton.disabled = false;
  }
  
  // Show appropriate controls
  if (isPomodoro && !lockdownActive) {
    document.getElementById('lockdownPomodoroButton').style.display = 'block';
    document.getElementById('lockdownManualControls').style.display = 'none';
  } else if (!lockdownActive) {
    document.getElementById('lockdownPomodoroButton').style.display = 'none';
    document.getElementById('lockdownManualControls').style.display = 'block';
  } else {
    document.getElementById('lockdownPomodoroButton').style.display = 'none';
    document.getElementById('lockdownManualControls').style.display = 'none';
  }
  
  // Update status
  if (lockdownActive && data.lockdownEndTime) {
    const remainingSeconds = Math.max(0, Math.floor((data.lockdownEndTime - Date.now()) / 1000));
    const maxTabs = data.maxTabs || 'unlimited';
    if (remainingSeconds > 0) {
      const mins = Math.floor(remainingSeconds / 60);
      const secs = remainingSeconds % 60;
      document.getElementById('lockdownStatus').innerHTML = `<p style="color: red; font-weight: bold; font-size: 1.1em;">🔒 LOCKDOWN ACTIVE<br>Max ${maxTabs} tabs | ${mins}m ${secs}s remaining</p>`;
    } else {
      document.getElementById('lockdownStatus').innerHTML = '';
    }
  } else {
    document.getElementById('lockdownStatus').innerHTML = '';
  }
});
}

document.getElementById('lockdownWithPomodoro').onclick = () => {
chrome.storage.local.get(['pomodoroTimeRemaining', 'maxTabs'], (data) => {
  const timeRemaining = data.pomodoroTimeRemaining || 0;
  const maxTabs = data.maxTabs;
  
  if (!maxTabs) {
    alert('Please set max tabs first');
    return;
  }
  
  if (timeRemaining <= 0) {
    alert('Pomodoro timer is not running');
    return;
  }
  
  const endTime = Date.now() + (timeRemaining * 1000);
  
  chrome.storage.local.set({
    lockdownActive: true,
    lockdownEndTime: endTime
  }, () => {
    chrome.runtime.sendMessage({ action: 'startLockdown', endTime }, () => {
      updateLockdownUI();
    });
  });
});
};

document.getElementById('lockdownManual').onclick = () => {
const minutes = Number(document.getElementById('lockdownMinutes').value);
if (!minutes || minutes < 1) {
  alert('Please enter a valid duration');
  return;
}

chrome.storage.local.get('maxTabs', (data) => {
  if (!data.maxTabs) {
    alert('Please set max tabs first');
    return;
  }
  
  const endTime = Date.now() + (minutes * 60 * 1000);
  
  chrome.storage.local.set({
    lockdownActive: true,
    lockdownEndTime: endTime
  }, () => {
    chrome.runtime.sendMessage({ action: 'startLockdown', endTime }, () => {
      updateLockdownUI();
    });
  });
});
};

updateLockdownUI();
setInterval(updateLockdownUI, 1000);