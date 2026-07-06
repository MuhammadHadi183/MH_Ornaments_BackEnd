const db = require('../config/db');

let settingsCache = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadSettings(force = false) {
  const now = Date.now();
  if (!force && settingsCache && now - lastLoadedAt < CACHE_TTL_MS) {
    return settingsCache;
  }

  const [rows] = await db.query('SELECT `key`, `value` FROM settings');
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });

  settingsCache = map;
  lastLoadedAt = now;
  return map;
}

/**
 * Mirrors PHP Admin/SiteSettings.php setting($key, $default)
 */
async function setting(key, defaultValue = '') {
  const settings = await loadSettings();
  if (Object.prototype.hasOwnProperty.call(settings, key)) {
    return settings[key];
  }
  return defaultValue;
}

function settingSync(key, defaultValue = '') {
  if (!settingsCache) return defaultValue;
  if (Object.prototype.hasOwnProperty.call(settingsCache, key)) {
    return settingsCache[key];
  }
  return defaultValue;
}

function isEnabled(key) {
  const value = settingSync(key, '0');
  return value === '1' || value === 1 || value === true;
}

async function warmSettingsCache() {
  return loadSettings(true);
}

function clearSettingsCache() {
  settingsCache = null;
  lastLoadedAt = 0;
}

module.exports = {
  setting,
  settingSync,
  isEnabled,
  loadSettings,
  warmSettingsCache,
  clearSettingsCache,
};
