const MIN_DAILY_STARTS = 450;
const MAX_DAILY_STARTS = 700;
const MAX_DAILY_STARTING_VALUE = 500;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashDate(dateKey) {
  let hash = 2166136261;
  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function dailyValue(now = new Date()) {
  const dateKey = localDateKey(now);
  const random = seededRandom(hashDate(dateKey));
  const range = MAX_DAILY_STARTING_VALUE - MIN_DAILY_STARTS + 1;
  let value = MIN_DAILY_STARTS + Math.floor(random() * range);
  let elapsedMinutes = 0;
  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

  while (elapsedMinutes < minutesSinceMidnight && value < MAX_DAILY_STARTS) {
    elapsedMinutes += 5 + Math.floor(random() * 16);
    if (elapsedMinutes <= minutesSinceMidnight) {
      value = Math.min(MAX_DAILY_STARTS, value + 1 + Math.floor(random() * 3));
    }
  }

  return value;
}

function updateDailyStarts() {
  const counter = document.getElementById('dailyStartsCount');
  if (!counter) return;
  counter.textContent = dailyValue().toLocaleString();
}

updateDailyStarts();

// Recalculate periodically so a page left open across midnight resets itself.
setInterval(updateDailyStarts, 60_000);
