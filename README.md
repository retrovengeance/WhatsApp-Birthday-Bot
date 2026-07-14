# WhatsApp Birthday Bot

A small WhatsApp bot for a friend group that solves exactly one problem: nobody remembers everyone's birthday. Friends register their birthday once, and the bot automatically wishes them happy birthday in the group chat at midnight on the day — with no manual reminders, spreadsheets, or calendar invites required.

Built on [Baileys](https://github.com/WhiskeySockets/Baileys) (an unofficial WhatsApp Web protocol library), designed to run for free indefinitely on a Google Cloud Always Free VM.

## Features

- **Self-service birthday registration** — anyone in the group can register their own birthday with a single command, no admin needed.
- **Automatic midnight wishes** — a daily scheduled check fires at 00:00 in your configured timezone and posts to the group if anyone's birthday matches.
- **Batched messages** — if multiple people share a birthday, they're wished together in a single message instead of a spammy back-to-back sequence.
- **Randomized, non-repeating messages** — 5 different birthday message variations (different tone/emoji), chosen at random but never repeating the previous day's message.
- **Human-like sending behavior** — simulates a "typing…" presence for a few seconds before sending, rather than firing off a message instantly like an obvious script.
- **Resilient reconnection** — if the WhatsApp connection drops, the bot reconnects with exponential backoff instead of hammering the server with retries.
- **Zero ongoing cost** — runs comfortably within Google Cloud's Always Free tier (e2-micro instance).

## How it works

The bot links to a real WhatsApp account (ideally a spare/secondary number, not your personal one — see [Security notes](#security-notes)) the same way WhatsApp Web does: you scan a QR code once, and it holds a persistent session from then on. It listens for slash commands in any chat it's part of, stores birthdays locally in a JSON file, and runs a daily cron job that checks for matches and posts to a configured group.

## Prerequisites

- A spare WhatsApp-capable phone number (see [Security notes](#security-notes) for why not to use your primary number)
- A Google Cloud account (no payment expected — see [Hosting cost](#hosting-cost))
- Basic comfort with a Linux terminal (copy-pasting commands via SSH)

## Commands

| Command | Description |
|---|---|
| `/setbday MM-DD` | Register or update your birthday (e.g. `/setbday 04-12` for April 12th). Year is not stored. |
| `/mybday` | Check the birthday you currently have saved. |
| `/listbdays` | List everyone's saved birthdays. |
| `/groupid` | Reply with the current chat's JID — used once during setup to configure which group receives birthday messages. |

## Project structure

```
.
├── index.js              # Bot connection, command handling, cron job
├── storage.js            # Reads/writes birthdays.json and state.json
├── config.example.json   # Template config — copy to config.json and fill in
├── package.json
└── .gitignore
```

Generated at runtime (not committed, see `.gitignore`):
- `config.json` — your real config (group JID + timezone)
- `birthdays.json` — registered birthdays
- `state.json` — tracks the last birthday message used, to avoid repeats
- `auth_state/` — your WhatsApp session credentials

## Installation & deployment (Google Cloud, free tier)

### 1. Create the VM
In the Google Cloud Console → Compute Engine → **Create instance**:
- Machine type: `e2-micro`
- Region: `us-west1`, `us-central1`, or `us-east1` (required for the Always Free tier)
- Boot disk: any recent Ubuntu LTS

### 2. Connect
Click **SSH** next to the instance in the console — opens a browser-based terminal, no local setup needed.

### 3. Install Node.js and git
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

### 4. Clone and install
```bash
git clone https://github.com/<your-username>/WhatsApp-Birthday-Bot.git
cd WhatsApp-Birthday-Bot
npm install
```

### 5. Configure
```bash
cp config.example.json config.json
nano config.json
```
Set `timezone` to your group's actual timezone (e.g. `"Asia/Kolkata"`). Leave `groupJid` blank for now.

### 6. Run it with PM2 (keeps it alive across disconnects/reboots)
```bash
sudo npm install -g pm2
pm2 start index.js --name birthday-bot
pm2 logs birthday-bot
```

### 7. Link your WhatsApp account
Scan the QR code that appears in the logs, using your **spare number** → WhatsApp → Linked Devices. Once you see `Connected to WhatsApp.`, press `Ctrl+C` to stop tailing (the bot keeps running under PM2).

### 8. Add the bot to your friend group
From your own phone: open the group → group name → **Add participant** → add the spare number.

### 9. Get the group JID
In the group chat, send:
```
/groupid
```
The bot replies with an ID ending in `@g.us`.

### 10. Finish the config and restart
```bash
nano config.json   # paste the JID into "groupJid"
pm2 restart birthday-bot
pm2 save
```

### 11. Survive VM reboots
```bash
pm2 startup
```
Run the command it prints (it will be specific to your system).

The bot is now live — friends can `/setbday MM-DD` at any time, and the midnight check runs automatically every day.

## Configuration reference (`config.json`)

| Field | Description |
|---|---|
| `groupJid` | The WhatsApp group chat ID that receives birthday messages. Obtained via `/groupid`. |
| `timezone` | IANA timezone string (e.g. `Asia/Kolkata`, `America/New_York`) used to determine when "midnight" is. |

## Security notes

This bot uses **Baileys**, an unofficial library that connects to WhatsApp's protocol directly rather than Meta's sanctioned Business API. This is necessary because Meta's official Cloud API doesn't reliably support posting into group chats, and requires a developer account approval process.

Because it's unofficial:
- **Use a spare/secondary phone number**, never your primary WhatsApp account. WhatsApp bans are typically all-or-nothing for the linked number — low-risk usage like this (one message a day, to a known small group) is unlikely to trigger detection, but a false positive costs you nothing on a spare number versus your entire personal account on your primary one.
- Never commit `auth_state/` to git. It contains session credentials equivalent to full access to that WhatsApp account. It's already covered by `.gitignore`.
- `birthdays.json`, `state.json`, and your real `config.json` are also gitignored, since they contain your friends' personal data (names, birthdates, chat IDs) and shouldn't live in a public repository.

## Hosting cost

Designed to run entirely within Google Cloud's **Always Free** tier:
- 1x `e2-micro` instance (in `us-west1`, `us-central1`, or `us-east1`) is free indefinitely, not a trial.
- This bot's workload (idle most of the day, sending a handful of messages once a day) uses negligible CPU/RAM — well within the free allowance.
- Double-check you selected `e2-micro` and a free-tier region when creating the VM; other machine types/regions are billed.
