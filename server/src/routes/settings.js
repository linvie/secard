const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'data', 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSettings(data) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

// Get settings (mask API key for security)
router.get('/', (req, res) => {
  const settings = readSettings();
  res.json({
    deepseek_api_key: settings.deepseek_api_key
      ? '****' + settings.deepseek_api_key.slice(-4)
      : '',
  });
});

// Update settings
router.put('/', (req, res) => {
  const { deepseek_api_key } = req.body;
  if (deepseek_api_key === undefined) {
    return res.status(400).json({ error: 'deepseek_api_key is required' });
  }
  const settings = readSettings();
  settings.deepseek_api_key = deepseek_api_key;
  writeSettings(settings);
  res.json({ success: true });
});

// Check if API key is configured
router.get('/status', (req, res) => {
  const settings = readSettings();
  res.json({ configured: !!settings.deepseek_api_key });
});

module.exports = router;
