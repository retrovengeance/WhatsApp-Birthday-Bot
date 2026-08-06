# WhatsApp Birthday Bot

A small WhatsApp bot for a friend group that solves exactly one problem: nobody remembers everyone's birthday. Friends register their birthday once, and the bot automatically wishes them happy birthday in the group chat at midnight on the day — with no manual reminders, spreadsheets, or calendar invites required.

Built on [Baileys](https://github.com/WhiskeySockets/Baileys) (an unofficial WhatsApp Web protocol library), designed to run for free indefinitely on a Google Cloud Always Free VM.

## Features

- **Self-service birthday registration** — anyone in the group can register their own birthday with a single command, no admin needed.
- **Automatic midnight wishes** — a daily scheduled check fires at 00:00 in your configured timezone and posts to the group if anyone's birthday matches.
- **Actually tags the birthday person** — the message @-mentions them (when they registered themselves via `/setbday`, so the bot has their real JID), rather than just printing their name as plain text.
- **Birthday gif** — after the text message, the bot sends a random gif (sourced from [Klipy](https://klipy.com), searching "birthday meme", picked from the top 10 results) as a follow-up.
- **Batched messages** — if multiple people share a birthday, they're wished together in a single message instead of a spammy back-to-back sequence.
- **Randomized, non-repeating messages and gifs** — 5 different birthday message variations (different tone/emoji), and the gif pick, are each chosen at random but never repeat the immediately previous pick.
- **Human-like sending behavior** — simulates a "typing…" presence for a few seconds before sending, rather than firing off a message instantly like an obvious script.
- **Resilient reconnection** — if the WhatsApp connection drops, the bot reconnects with exponential backoff instead of hammering the server with retries. The nightly schedule itself is only ever registered once per process lifetime, so frequent reconnects can't stack up duplicate midnight triggers (an earlier bug that caused dozens of duplicate birthday messages to fire simultaneously).
- **Crash-proof birthday check** — a bad read of `birthdays.json` (e.g. mid hand-edit) or any other unexpected error during the nightly check is caught and logged rather than crashing the whole bot; a single bad night can't take down the rest of the bot's functionality or delay it coming back online.
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

## Adding someone manually (without a mention)

Everyone who registers themselves via `/setbday` gets tagged (@-mentioned) in their birthday message, because the bot captures their real WhatsApp JID from that message. If you want to add someone who can't or won't run the command themselves, you can hand-edit `birthdays.json` directly — but use a key that **isn't** a real JID (i.e. doesn't end in `@lid` or `@s.whatsapp.net`), for example:
```json
"manual-jdoe": { "name": "Jane Doe", "date": "09-15" }
```
The bot detects that this isn't a taggable JID and falls back to using their plain name in the message instead of a mention. Don't reuse a manual key that collides with a real JID format, or the bot will try (and fail) to mention a nonexistent contact.

## Project structure

```
.
├── index.js              # Bot connection, command handling, cron job
├── storage.js            # Reads/writes birthdays.json and state.json
├── gif.js                # Fetches a random birthday gif from Klipy
├── config.example.json   # Template config — copy to config.json and fill in
├── .env.example           # Template for the Klipy API key — copy to .env and fill in
├── package.json
└── .gitignore
```

Generated at runtime (not committed, see `.gitignore`):
- `config.json` — your real config (group JID + timezone)
- `.env` — your real Klipy API key
- `birthdays.json` — registered birthdays
- `state.json` — tracks the last birthday message and last gif used, to avoid repeats
- `auth_state/` — your WhatsApp session credentials

## Installation & deployment (Google Cloud, free tier)

### 1. Create the VM
In the Google Cloud Console → Compute Engine → **Create instance**:
- Machine type: `e2-micro`
- Region: `us-west1`, `us-central1`, or `us-east1` (required for the Always Free tier)
- Boot disk: any recent Ubuntu LTS

### 2. Connect
Click **SSH** next to the instance in the console — opens a browser-based terminal, no local setup needed.

### 3. Install Node.js, git, and ffmpeg
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git ffmpeg
```
`ffmpeg` isn't optional: Baileys uses it to probe the real width/height/duration of the birthday gif and generate a proper thumbnail before sending. Without it, the gif still sends, but WhatsApp **mobile** clients render it as a small, cropped preview that only shows properly once tapped (WhatsApp Desktop looks fine either way, which is what makes this easy to miss during testing).

### 4. Clone and install
```bash
git clone https://github.com/<your-username>/WhatsApp-Birthday-Bot.git
cd WhatsApp-Birthday-Bot
npm install
```

### 5. Add swap space (do this before running the bot)
`e2-micro` has only ~958MB of RAM and **no swap by default**. Left unaddressed, a long-running Node process combined with the OS's background services can fully exhaust memory — at which point the kernel's OOM killer can kill *any* process needing memory next, including `sshd` trying to accept your next SSH login. That looks like "the bot randomly died and I can't even SSH in to fix it," and it's avoidable:
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
This is just a file on the boot disk you already have — it doesn't create a new billable resource or push you outside the Always Free tier (see [Hosting cost](#hosting-cost)).

### 6. Configure
```bash
cp config.example.json config.json
nano config.json
```
Set `timezone` to your group's actual timezone (e.g. `"Asia/Kolkata"`). Leave `groupJid` blank for now.

### 7. Add your Klipy API key
```bash
cp .env.example .env
nano .env
```
Get a free API key from [Klipy](https://klipy.com) and paste it in as `KLIPY_API_KEY`. This powers the birthday gif sent after each message — if you skip this step, `.env` will be missing the key, and the bot just logs a warning and skips the gif rather than failing.

### 8. Run it with PM2 (keeps it alive across disconnects/reboots)
```bash
sudo npm install -g pm2
pm2 start index.js --name birthday-bot --max-memory-restart 250M
pm2 logs birthday-bot
```
`--max-memory-restart 250M` makes PM2 proactively restart the bot if it ever creeps up toward the memory ceiling, instead of leaving it to grow unchecked until the kernel OOM killer intervenes (see step 5).

### 9. Link your WhatsApp account
Scan the QR code that appears in the logs, using your **spare number** → WhatsApp → Linked Devices. Once you see `Connected to WhatsApp.`, press `Ctrl+C` to stop tailing (the bot keeps running under PM2).

### 10. Add the bot to your friend group
From your own phone: open the group → group name → **Add participant** → add the spare number.

### 11. Get the group JID
In the group chat, send:
```
/groupid
```
The bot replies with an ID ending in `@g.us`.

### 12. Finish the config and restart
```bash
nano config.json   # paste the JID into "groupJid"
pm2 restart birthday-bot
pm2 save
```

### 13. Survive VM reboots — do not skip this
```bash
pm2 startup
```
This prints a `sudo env PATH=... pm2 startup systemd ...` command specific to your system. **You must copy and run that printed command** — `pm2 startup` alone only tells you what to run, it doesn't install anything by itself. Skipping this step means the bot will not come back after any VM reboot (including ones Google performs for host maintenance), silently, with no error to tell you it happened.

Verify it actually took effect:
```bash
systemctl status pm2-$(whoami)
```
This should show an active/enabled systemd service. If it says `Unit ... could not be found`, the startup script was never installed — re-run the `pm2 startup` command above and paste/run its output.

The bot is now live — friends can `/setbday MM-DD` at any time, and the midnight check runs automatically every day.

## Configuration reference

### `config.json`

| Field | Description |
|---|---|
| `groupJid` | The WhatsApp group chat ID that receives birthday messages. Obtained via `/groupid`. |
| `timezone` | IANA timezone string (e.g. `Asia/Kolkata`, `America/New_York`) used to determine when "midnight" is. |

### `.env`

| Field | Description |
|---|---|
| `KLIPY_API_KEY` | Free API key from [Klipy](https://klipy.com), used to fetch the birthday gif. If unset, the bot skips sending a gif (logs a warning) but the text message still sends normally. |

## Security notes

This bot uses **Baileys**, an unofficial library that connects to WhatsApp's protocol directly rather than Meta's sanctioned Business API. This is necessary because Meta's official Cloud API doesn't reliably support posting into group chats, and requires a developer account approval process.

Because it's unofficial:
- **Use a spare/secondary phone number**, never your primary WhatsApp account. WhatsApp bans are typically all-or-nothing for the linked number — low-risk usage like this (one message a day, to a known small group) is unlikely to trigger detection, but a false positive costs you nothing on a spare number versus your entire personal account on your primary one.
- Never commit `auth_state/` to git. It contains session credentials equivalent to full access to that WhatsApp account. It's already covered by `.gitignore`.
- Never commit `.env` to git either — it holds your real Klipy API key. Only `.env.example` (with a placeholder) should be committed. Already covered by `.gitignore`.
- `birthdays.json`, `state.json`, and your real `config.json` are also gitignored, since they contain your friends' personal data (names, birthdates, chat IDs) and shouldn't live in a public repository.

## Hosting cost

Designed to run entirely within Google Cloud's **Always Free** tier:
- 1x `e2-micro` instance (in `us-west1`, `us-central1`, or `us-east1`) is free indefinitely, not a trial.
- This bot's workload (idle most of the day, sending a handful of messages once a day) uses negligible CPU/RAM — well within the free allowance.
- Double-check you selected `e2-micro` and a free-tier region when creating the VM; other machine types/regions are billed.
- The 1GB swapfile from setup lives on the boot disk you already have and isn't a separate billable resource; it stays within the Always Free tier's persistent disk allowance as long as your total disk usage is under 30GB.
- The daily Klipy gif fetch is a free API call plus a small amount of network egress (one gif, once a day) — nowhere near the Always Free tier's 1GB/month outbound data allowance.
