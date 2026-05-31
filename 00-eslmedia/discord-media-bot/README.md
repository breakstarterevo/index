# ESL Discord Bot

This bot watches the ESL Media article manifest and also serves live league lookup slash commands.

## What it does

- reads `../content/media-articles.js`
- remembers which articles it has already announced
- posts only new articles to a Discord channel
- can optionally ping a role each time
- registers guild slash commands for `/player`, `/team`, and `/league`
- fetches live JSON from `https://eurosuperleague.github.io/index/00-build/database/`

## Setup

1. Create a Discord bot in the Discord Developer Portal.
2. Invite it to your server with permission to:
   - `View Channels`
   - `Send Messages`
   - `Embed Links`
   - `Use Application Commands`
3. Copy `.env.example` to `.env`.
4. Fill in:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID`
   - `DISCORD_CHANNEL_ID`
   - optional `DISCORD_ROLE_ID`
5. Install dependencies:

```powershell
npm install
```

## Register slash commands

From `00-eslmedia/discord-media-bot`:

```powershell
npm run register
```

This registers these guild commands:

- `/player name:<player name>`
- `/team name:<team name>`
- `/league`

## Run it

From `00-eslmedia/discord-media-bot`:

```powershell
npm run once
```

That checks once and posts any articles it has not announced yet.

For continuous polling:

```powershell
npm start
```

By default it checks for new articles every 5 minutes and caches league JSON for 5 minutes.

## GitHub Actions

The existing GitHub Actions workflow can still run the one-shot article notifier:

- `.github/workflows/esl-media-discord.yml`

Add these repository secrets in GitHub:

- `DISCORD_BOT_TOKEN`
- `DISCORD_CHANNEL_ID`
- optional `DISCORD_ROLE_ID`

Once those secrets are set, GitHub Actions will:

- check the article manifest every 5 minutes
- post only newly published articles
- update the tracked state file automatically

The state file is:

- `00-eslmedia/discord-media-bot/data/announced-articles.json`

It is intentionally committed so GitHub Actions knows what has already been announced across runs.

## How publishing works

The bot reads from:

- `00-eslmedia/content/media-articles.js`

That means once a new article is added to the live media manifest, the bot will see it and announce it on the next check.

## Important note

The bot stores its announced state locally in:

- `00-eslmedia/discord-media-bot/data/announced-articles.json`

If you delete that file, it will treat all current articles as unannounced again.

## League data

Slash commands use `DATA_BASE_URL`, which defaults to:

- `https://eurosuperleague.github.io/index/00-build/database/`

The bot fetches and caches:

- `players.json`
- `player_stats.json`
- `teams.json`
- `standings.json`
- `team_stats.json`
- `capreport.json`
- `injuries.json`
- `schedule.json`
- `leaders.json`
