const fs = require('fs');
const path = require('path');

const BIRTHDAYS_PATH = path.join(__dirname, 'birthdays.json');
const STATE_PATH = path.join(__dirname, 'state.json');

function loadBirthdays() {
  if (!fs.existsSync(BIRTHDAYS_PATH)) return {};
  return JSON.parse(fs.readFileSync(BIRTHDAYS_PATH, 'utf8'));
}

function saveBirthdays(data) {
  fs.writeFileSync(BIRTHDAYS_PATH, JSON.stringify(data, null, 2));
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
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(data) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(data, null, 2));
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

module.exports = {
  setBirthday,
  getBirthday,
  getAllBirthdays,
  getTodaysBirthdays,
  getLastMessageIndex,
  setLastMessageIndex,
};
