# ESL Discord League Worker

Cloudflare Worker for Discord slash commands:

- `/player`
- `/team`
- `/league`

The Worker receives Discord interactions over HTTP, verifies Discord signatures, fetches compact JSON from GitHub Pages, and responds with embeds. It does not need an always-on bot process.

## Setup

Install dependencies:

```powershell
npm install
```

Set the Discord public key:

```powershell
wrangler secret put DISCORD_PUBLIC_KEY
```

Deploy:

```powershell
npm run deploy
```

Set the Discord Developer Portal Interactions Endpoint URL to:

```text
https://your-worker-url/interactions
```

Register commands:

```powershell
$env:DISCORD_BOT_TOKEN="your_bot_token"
$env:DISCORD_APPLICATION_ID="your_application_id"
$env:DISCORD_GUILD_ID="your_server_id"
npm run register
```

## Data

The Worker reads compact generated feeds from:

```text
https://eurosuperleague.github.io/index/00-build/database/discord/
```

Generate those feeds with the normal site build, or directly:

```powershell
python ..\..\00-build\scripts\build_discord_json.py
```

Generated feeds:

- `players.json` includes lookup fields plus compact season, shooting, efficiency, and career-high stats.
- `player_stats.json` contains the compact player stats on their own for future stat-focused commands.
- `teams.json` contains compact standings, cap, injury, strengths, and schedule context.
- `league.json` contains the compact standings/leaders overview.
