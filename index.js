require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

const config = require('./config.json');
const {
  setBirthday,
  getBirthday,
  getAllBirthdays,
  getTodaysBirthdays,
  getLastMessageIndex,
  setLastMessageIndex,
} = require('./storage');
const { getRandomBirthdayGif } = require('./gif');

const BDAY_REGEX = /^\d{2}-\d{2}$/;

const BIRTHDAY_MESSAGES = [
  (names) => `🎉🎂 Happy birthday ${names}!! Hope your day is as awesome as you are 🥳`,
  (names) => `Yo ${names}, it's your day! 🎈 Go eat cake, ignore responsibilities, you've earned it 😂`,
  (names) => `🎊 Wishing ${names} the happiest of birthdays! May your wifi be fast and your cake be bigger than your problems 🍰`,
  (names) => `Happy bday ${names}! 🥳🎁 Another year older, still hasn't paid us back 💀 jk love ya`,
  (names) => `🌟 Sending birthday love to ${names} today! Hope it's full of good vibes, good food, and zero adulting 🎂✨`,
];

const MAX_RECONNECT_DELAY_MS = 60_000;
let reconnectAttempts = 0;

function isValidMMDD(mmdd) {
  if (!BDAY_REGEX.test(mmdd)) return false;
  const [month, day] = mmdd.split('-').map(Number);
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(2024, month, 0).getDate(); // 2024 = leap year, allows Feb 29
  return day >= 1 && day <= daysInMonth;
}

function isTaggableJid(jid) {
  return jid.endsWith('@lid') || jid.endsWith('@s.whatsapp.net');
}

function buildMentionTokens(people) {
  const mentions = [];
  const tokens = people.map((p) => {
    if (isTaggableJid(p.jid)) {
      mentions.push(p.jid);
      return `@${p.jid.split('@')[0]}`;
    }
    return p.name;
  });
  return { tokens, mentions };
}

function joinNames(names) {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function pickBirthdayMessage(names) {
  const lastIndex = getLastMessageIndex();
  let index;
  do {
    index = Math.floor(Math.random() * BIRTHDAY_MESSAGES.length);
  } while (BIRTHDAY_MESSAGES.length > 1 && index === lastIndex);

  setLastMessageIndex(index);
  return BIRTHDAY_MESSAGES[index](joinNames(names));
}

async function sendWithTypingSimulation(sock, jid, text, mentions = []) {
  await sock.sendPresenceUpdate('composing', jid);
  const typingDelay = 3000 + Math.floor(Math.random() * 2000); // 3-5s
  await new Promise((resolve) => setTimeout(resolve, typingDelay));
  await sock.sendPresenceUpdate('paused', jid);
  await sock.sendMessage(jid, { text, mentions });
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_state');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Scan this QR code with WhatsApp (Linked Devices):');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log('Logged out. Delete the auth_state folder and re-scan the QR to reconnect.');
        return;
      }

      reconnectAttempts += 1;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
      console.log(`Connection closed (${statusCode}). Reconnecting in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
      setTimeout(startBot, delay);
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp.');
      reconnectAttempts = 0;
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const senderId = msg.key.participant || msg.key.remoteJid;
    const senderName = msg.pushName || 'Someone';

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.startsWith('/')) return;

    const [command, ...args] = text.trim().split(/\s+/);

    if (command === '/setbday') {
      const mmdd = args[0];
      if (!mmdd || !isValidMMDD(mmdd)) {
        await sock.sendMessage(chatId, {
          text: 'Usage: /setbday MM-DD (e.g. /setbday 04-12)',
        });
        return;
      }
      setBirthday(senderId, senderName, mmdd);
      await sock.sendMessage(chatId, {
        text: `Got it! Saved ${senderName}'s birthday as ${mmdd}.`,
      });
    } else if (command === '/mybday') {
      const entry = getBirthday(senderId);
      await sock.sendMessage(chatId, {
        text: entry
          ? `Your saved birthday is ${entry.date}.`
          : "You haven't set a birthday yet. Use /setbday MM-DD.",
      });
    } else if (command === '/listbdays') {
      const all = getAllBirthdays();
      const lines = Object.values(all).map((e) => `${e.name}: ${e.date}`);
      await sock.sendMessage(chatId, {
        text: lines.length ? lines.join('\n') : 'No birthdays saved yet.',
      });
    } else if (command === '/groupid') {
      await sock.sendMessage(chatId, {
        text: `This chat's ID is:\n${chatId}\n\nPaste this into config.json as "groupJid".`,
      });
    }
  });

  scheduleBirthdayCheck(sock);
}

function getTodayMMDD(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const mm = parts.find((p) => p.type === 'month').value;
  const dd = parts.find((p) => p.type === 'day').value;
  return `${mm}-${dd}`;
}

function scheduleBirthdayCheck(sock) {
  cron.schedule(
    '0 0 * * *',
    async () => {
      const stamp = new Date().toISOString();
      try {
        if (!config.groupJid) {
          console.log(`[${stamp}] No groupJid set in config.json, skipping birthday check.`);
          return;
        }

        const today = getTodayMMDD(config.timezone);
        console.log(`[${stamp}] Birthday check running, today=${today}`);

        const todaysBirthdays = getTodaysBirthdays(today);
        if (todaysBirthdays.length === 0) {
          console.log(`[${stamp}] No birthdays matched ${today}.`);
          return;
        }

        const { tokens, mentions } = buildMentionTokens(todaysBirthdays);
        const message = pickBirthdayMessage(tokens);

        await sendWithTypingSimulation(sock, config.groupJid, message, mentions);
        console.log(`[${stamp}] Birthday message sent for: ${todaysBirthdays.map((p) => p.name).join(', ')}`);

        const gifUrl = await getRandomBirthdayGif();
        if (gifUrl) {
          await sock.sendMessage(config.groupJid, { video: { url: gifUrl }, gifPlayback: true });
          console.log(`[${stamp}] Birthday gif sent.`);
        } else {
          console.log(`[${stamp}] No gif sent (fetch failed or no API key).`);
        }
      } catch (err) {
        // An uncaught error here would otherwise crash the whole bot process
        // (unhandled promise rejection) and lose that day's only send window.
        console.log(`[${stamp}] Birthday check failed:`, err.message);
      }
    },
    { timezone: config.timezone }
  );

  console.log(`Birthday check scheduled daily at midnight (${config.timezone}).`);
}

startBot();
