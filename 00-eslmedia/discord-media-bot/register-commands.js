import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { registerLeagueCommands } from "./commands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv(path.join(__dirname, ".env"));

await registerLeagueCommands({
  botToken: process.env.DISCORD_BOT_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID
});

console.log("Registered ESL Media Discord guild commands.");
