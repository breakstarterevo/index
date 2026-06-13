import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { createArticleNotifier } from "./article-notifier.js";
import { loadEnv } from "./env.js";
import { handleLeagueCommand } from "./league-command-handlers.js";
import { LeagueDataClient } from "./league-data.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const stateDir = path.join(__dirname, "data");

loadEnv(path.join(__dirname, ".env"));

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const ROLE_ID = process.env.DISCORD_ROLE_ID || "";
const SOURCE = process.env.MEDIA_ARTICLES_SOURCE || "../content/media-articles.js";
const ARTICLE_BASE_URL = process.env.ARTICLE_BASE_URL || "https://eurosuperleague.github.io/index/00-eslmedia/content/";
const CHECK_INTERVAL_MS = Number(process.env.CHECK_INTERVAL_MS || 300000);
const DATA_BASE_URL = process.env.DATA_BASE_URL || "https://eurosuperleague.github.io/index/00-build/database/";
const DATA_CACHE_TTL_MS = Number(process.env.DATA_CACHE_TTL_MS || 300000);

const mode = process.argv.includes("--once") ? "once" : "watch";

if (!BOT_TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN. Add it to discord-media-bot/.env.");
  process.exit(1);
}

const articleNotifier = createArticleNotifier({
  botToken: BOT_TOKEN,
  channelId: CHANNEL_ID,
  roleId: ROLE_ID,
  source: SOURCE,
  articleBaseUrl: ARTICLE_BASE_URL,
  checkIntervalMs: CHECK_INTERVAL_MS,
  stateDir
});

async function main() {
  if (mode === "once") {
    await articleNotifier.checkForNewArticles();
    return;
  }

  const dataClient = new LeagueDataClient({
    baseUrl: DATA_BASE_URL,
    cacheTtlMs: DATA_CACHE_TTL_MS
  });
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}.`);
    await articleNotifier.checkForNewArticles();
    articleNotifier.startWatching();
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!["help", "player", "team", "league", "youth", "standings", "schedule", "simrecap", "resignings"].includes(interaction.commandName)) {
      return;
    }

    await handleLeagueCommand(interaction, dataClient);
  });

  await client.login(BOT_TOKEN);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
