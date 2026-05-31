import { COMMANDS } from "../src/commands.js";
import fs from "node:fs";

loadLocalEnv(".env");
loadLocalEnv(".dev.vars");

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !applicationId || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID/DISCORD_CLIENT_ID, or DISCORD_GUILD_ID.");
  process.exit(1);
}

const response = await fetch(
  `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(COMMANDS),
  },
);

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Command registration failed ${response.status}: ${body}`);
}

const commands = await response.json();
console.log(`Registered ${commands.length} guild commands: ${commands.map((command) => command.name).join(", ")}`);

function loadLocalEnv(path) {
  if (!fs.existsSync(path)) {
    return;
  }

  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const idx = line.indexOf("=");
    if (idx === -1) {
      continue;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
