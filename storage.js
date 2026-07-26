const fs = require('fs');
const path = require('path');

const BIRTHDAYS_PATH = path.join(__dirname, 'birthdays.json');
const STATE_PATH = path.join(__dirname, 'state.json');

function loadBirthdays() {
  if (!fs.existsSync(BIRTHDAYS_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(BIRTHDAYS_PATH, 'utf8'));
  } catch (err) {
    // Guards against reading birthdays.json mid hand-edit (e.g. nano save-in-progress),
    // which previously crashed the whole bot process via an unhandled JSON.parse throw.
    console.log(`birthdays.json is invalid JSON right now (${err.message}); treating as empty for this read.`);
    return {};
  }
}

function saveBirthdays(data) {
  const tmpPath = `${BIRTHDAYS_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, BIRTHDAYS_PATH);
}

function setBirthday(jid, name, mmdd) {
  const data = loadBirthdays();
  data[jid] = { name, date: mmdd };
  saveBirthdays(data);
}

function getBirthday(jid) {
  const data = loadBirthdays();
  return data[jid];
}

function getAllBirthdays() {
  return loadBirthdays();
}

function getTodaysBirthdays(mmdd) {
  const data = loadBirthdays();
  return Object.entries(data)
    .filter(([, entry]) => entry.date === mmdd)
    .map(([jid, entry]) => ({ jid, ...entry }));
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (err) {
    console.log(`state.json is invalid JSON right now (${err.message}); treating as empty for this read.`);
    return {};
  }
}

function saveState(data) {
  const tmpPath = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, STATE_PATH);
}

function getLastMessageIndex() {
  const state = loadState();
  return typeof state.lastMessageIndex === 'number' ? state.lastMessageIndex : null;
}

function setLastMessageIndex(index) {
  const state = loadState();
  state.lastMessageIndex = index;
  saveState(state);
}

function getLastGifIndex() {
  const state = loadState();
  return typeof state.lastGifIndex === 'number' ? state.lastGifIndex : null;
}

function setLastGifIndex(index) {
  const state = loadState();
  state.lastGifIndex = index;
  saveState(state);
}

module.exports = {
  setBirthday,
  getBirthday,
  getAllBirthdays,
  getTodaysBirthdays,
  getLastMessageIndex,
  setLastMessageIndex,
  getLastGifIndex,
  setLastGifIndex,
};
