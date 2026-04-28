/* ============================================================
   F1 REACTION TIMER — SCRIPT.JS
   High-precision reaction timing with full game loop
   ============================================================ */

'use strict';

/* ---- STATE ---- */
let playerName       = '';
let gamePhase        = 'name';      // name | countdown | waiting | green | result
let greenStartTime   = null;
let colorTimeout     = null;
let falseStartPenaltyTimeout = null;
const COLOR_CLASSES  = ['color-red', 'color-yellow', 'color-blue'];
const COLOR_LABELS   = { 'color-red': 'RED', 'color-yellow': 'YELLOW', 'color-blue': 'BLUE', 'color-green': 'GREEN' };

/* ---- DOM REFS ---- */
const screenName        = document.getElementById('screen-name');
const screenCountdown   = document.getElementById('screen-countdown');
const screenReaction    = document.getElementById('screen-reaction');
const screenResult      = document.getElementById('screen-result');
const countdownNumber   = document.getElementById('countdown-number');
const reactionZone      = document.getElementById('reaction-zone');
const reactionStatus    = document.getElementById('reaction-status');
const reactionHint      = document.getElementById('reaction-hint');
const flashOverlay      = document.getElementById('flash-overlay');
const falseStartOverlay = document.getElementById('false-start-overlay');
const falseStartCountdownEl = document.getElementById('false-start-countdown');
const resultName        = document.getElementById('result-name');
const resultTime        = document.getElementById('result-time');
const resultRating      = document.getElementById('result-rating');
const resultIcon        = document.getElementById('result-icon');
const playerNameInput   = document.getElementById('player-name');
const lights            = [
  document.getElementById('light-1'),
  document.getElementById('light-2'),
  document.getElementById('light-3'),
];

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */
function showScreen(id) {
  [screenName, screenCountdown, screenReaction, screenResult].forEach(s => {
    s.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

/* ============================================================
   START GAME — name entry → countdown
   ============================================================ */
function startGame() {
  const rawName = playerNameInput.value.trim();
  if (!rawName) {
    playerNameInput.focus();
    playerNameInput.style.borderBottomColor = '#FF2420';
    playerNameInput.style.boxShadow = '0 0 0 3px rgba(255,36,32,0.25)';
    setTimeout(() => {
      playerNameInput.style.borderBottomColor = '';
      playerNameInput.style.boxShadow = '';
    }, 1000);
    return;
  }
  playerName = rawName.toUpperCase();
  gamePhase = 'countdown';
  showScreen('screen-countdown');
  runCountdown();
}

/* ============================================================
   RETRY — skip name entry, rerun with same name
   ============================================================ */
function retryGame() {
  clearAllTimers();
  gamePhase = 'countdown';
  resetReactionZone();
  showScreen('screen-countdown');
  runCountdown();
}

/* ============================================================
   RESET — back to name entry screen
   ============================================================ */
function resetToStart() {
  clearAllTimers();
  gamePhase = 'name';
  playerName = '';
  playerNameInput.value = '';
  resetReactionZone();
  showScreen('screen-name');
}

/* ============================================================
   COUNTDOWN  3 → 2 → 1 → GO
   ============================================================ */
function runCountdown() {
  // Reset lights
  lights.forEach(l => l.classList.remove('on'));
  let count = 3;
  countdownNumber.textContent = count;
  // Trigger re-animation
  countdownNumber.style.animation = 'none';
  countdownNumber.offsetHeight; // reflow
  countdownNumber.style.animation = '';

  const tick = () => {
    // Light up corresponding light (index = 3 - count)
    const lightIdx = 3 - count;
    if (lightIdx >= 0 && lightIdx < lights.length) {
      lights[lightIdx].classList.add('on');
    }

    count--;
    if (count > 0) {
      countdownNumber.textContent = count;
      // re-trigger CSS animation
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
      colorTimeout = setTimeout(tick, 1000);
    } else {
      // Show "GO!" briefly then start reaction
      countdownNumber.textContent = 'GO!';
      countdownNumber.style.animation = 'none';
      countdownNumber.offsetHeight;
      countdownNumber.style.animation = '';
      colorTimeout = setTimeout(() => {
        lights.forEach(l => l.classList.add('on'));
        startReactionPhase();
      }, 700);
    }
  };

  colorTimeout = setTimeout(tick, 1000);
}

/* ============================================================
   REACTION PHASE — random color cycling
   ============================================================ */
function startReactionPhase() {
  gamePhase = 'waiting';
  showScreen('screen-reaction');
  resetReactionZone();
  reactionStatus.textContent = 'WAIT FOR GREEN...';
  reactionHint.textContent = 'DO NOT PRESS SPACE';
  scheduleNextColor();
}

function scheduleNextColor() {
  // Random delay: 1000ms – 3000ms
  const delay = 1000 + Math.random() * 2000;
  colorTimeout = setTimeout(showRandomColor, delay);
}

function showRandomColor() {
  if (gamePhase !== 'waiting') return;

  // Randomly choose red, yellow, or blue — OR green
  // Weight: 30% chance of green each time, else random other
  const rand = Math.random();
  if (rand < 0.30) {
    showGreen();
  } else {
    const cls = COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)];
    setZoneColor(cls);
    scheduleNextColor();
  }
}

function setZoneColor(cls) {
  // Remove all color classes
  reactionZone.classList.remove('color-red', 'color-yellow', 'color-blue', 'color-green');
  if (cls) reactionZone.classList.add(cls);
}

function showGreen() {
  if (gamePhase !== 'waiting') return;
  gamePhase = 'green';

  setZoneColor('color-green');
  reactionStatus.textContent = 'PRESS SPACE NOW!';
  reactionHint.textContent = 'HIT THE SPACE BAR';

  // Trigger flash overlay
  // flashOverlay.classList.remove('active');
  // flashOverlay.offsetHeight; // reflow
  // flashOverlay.classList.add('active');

  // Record high-precision start time
  greenStartTime = performance.now();
}

function resetReactionZone() {
  setZoneColor(null);
  reactionStatus.textContent = 'WAIT FOR GREEN...';
  reactionHint.textContent = 'DO NOT PRESS SPACE';
  flashOverlay.classList.remove('active');
  greenStartTime = null;
}

/* ============================================================
   KEYBOARD / CLICK HANDLER
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  e.preventDefault();
  handleInput();
});

// Also allow tapping on the reaction zone on mobile
document.addEventListener('click', (e) => {
  if (gamePhase === 'green' || gamePhase === 'waiting') {
    handleInput();
  }
});

function handleInput() {
  if (gamePhase === 'green') {
    // ✅ Correct — measure reaction time
    const reactionMs = Math.round(performance.now() - greenStartTime);
    clearAllTimers();
    gamePhase = 'result';
    showResult(reactionMs);

  } else if (gamePhase === 'waiting') {
    // ❌ False start — jumped before green
    clearAllTimers();
    gamePhase = 'false-start';
    triggerFalseStart();
  }
  // Ignore in all other phases
}

/* ============================================================
   FALSE START HANDLING
   ============================================================ */
function triggerFalseStart() {
  resetReactionZone();
  falseStartOverlay.classList.add('active');

  let penaltyCount = 3;
  falseStartCountdownEl.textContent = `Restarting in ${penaltyCount}...`;

  const penaltyTick = () => {
    penaltyCount--;
    if (penaltyCount > 0) {
      falseStartCountdownEl.textContent = `Restarting in ${penaltyCount}...`;
      falseStartPenaltyTimeout = setTimeout(penaltyTick, 1000);
    } else {
      falseStartCountdownEl.textContent = 'GO!';
      falseStartPenaltyTimeout = setTimeout(() => {
        falseStartOverlay.classList.remove('active');
        gamePhase = 'countdown';
        showScreen('screen-countdown');
        runCountdown();
      }, 700);
    }
  };

  falseStartPenaltyTimeout = setTimeout(penaltyTick, 1000);
}

/* ============================================================
   SHOW RESULT
   ============================================================ */
function showResult(ms) {
  showScreen('screen-result');

  resultName.textContent = playerName;
  resultTime.textContent = `${ms}ms`;
  resultTime.classList.remove('false-start');

  // Rating system
  let rating = '';
  let icon   = '🏁';

  if (ms < 150) {
    rating = '⚡ SUPERHUMAN — ARE YOU SURE?';
    icon   = '🤔';
  } else if (ms < 200) {
    rating = '🏆 F1 DRIVER LEVEL';
    icon   = '🏆';
  } else if (ms < 250) {
    rating = '🔥 ELITE REFLEXES';
    icon   = '🔥';
  } else if (ms < 300) {
    rating = '⚡ SHARP REACTIONS';
    icon   = '⚡';
  } else if (ms < 400) {
    rating = '✅ AVERAGE DRIVER';
    icon   = '🏎️';
  } else if (ms < 600) {
    rating = '😴 A BIT SLOW...';
    icon   = '😴';
  } else {
    rating = '🐢 WERE YOU SLEEPING?';
    icon   = '🐢';
  }

  resultIcon.textContent   = icon;
  resultRating.textContent = rating;
}

/* ============================================================
   UTILITY — CLEAR ALL TIMERS
   ============================================================ */
function clearAllTimers() {
  clearTimeout(colorTimeout);
  clearTimeout(falseStartPenaltyTimeout);
  colorTimeout = null;
  falseStartPenaltyTimeout = null;
}

/* ============================================================
   NAME INPUT — ENTER KEY SUPPORT
   ============================================================ */
playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});

/* ============================================================
   INIT
   ============================================================ */
showScreen('screen-name');
