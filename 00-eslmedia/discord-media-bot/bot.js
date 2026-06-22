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
const MAX_ANNOUNCEMENTS_PER_RUN = Number(process.env.MAX_ANNOUNCEMENTS_PER_RUN || 3);
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
  maxAnnouncementsPerRun: MAX_ANNOUNCEMENTS_PER_RUN,
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
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction, dataClient);
      return;
    }

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

async function handleAutocomplete(interaction, dataClient) {
  try {
    if (interaction.commandName === "player") {
      const { players } = await dataClient.getPlayerContext();
      await interaction.respond(findAutocompleteChoices(interaction.options.getFocused(), players, (player) => player.name));
      return;
    }

    if (["team", "youth", "schedule", "simrecap", "resignings"].includes(interaction.commandName)) {
      const { teams } = await dataClient.getTeamIndexContext();
      await interaction.respond(findAutocompleteChoices(interaction.options.getFocused(), teams, (team) => team.name));
      return;
    }
  } catch (error) {
    console.error(`/${interaction.commandName} autocomplete failed:`, error);
  }

  await interaction.respond([]);
}

function findAutocompleteChoices(query, items, labelFor, valueFor = labelFor) {
  return (items || [])
    .map((item) => ({
      item,
      name: labelFor(item),
      score: scoreMatch(query, labelFor(item))
    }))
    .filter((entry) => entry.score > 0 && entry.name)
    .sort((a, b) => b.score - a.score || entrySort(a.name, b.name))
    .slice(0, 25)
    .map((entry) => ({
      name: String(entry.name).slice(0, 100),
      value: String(valueFor(entry.item)).slice(0, 100)
    }));
}

function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q) return 1;
  if (!c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 90 - Math.min(20, c.length - q.length);
  if (c.includes(q)) return 70 - Math.min(30, c.indexOf(q));

  const tokens = c.split(/\s+/);
  if (tokens.some((token) => token.startsWith(q))) return 65;
  return fuzzyScore(q, c);
}

function fuzzyScore(query, candidate) {
  let queryIndex = 0;
  let score = 0;
  for (let index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
    if (candidate[index] === query[queryIndex]) {
      score += 3;
      queryIndex += 1;
    }
  }
  return queryIndex === query.length ? Math.min(50, score) : 0;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function entrySort(a, b) {
  return String(a).localeCompare(String(b));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
