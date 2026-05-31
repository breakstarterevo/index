import { REST, Routes, SlashCommandBuilder } from "discord.js";

export const leagueCommands = [
  new SlashCommandBuilder()
    .setName("player")
    .setDescription("Look up an ESL player")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Player name, for example Larry Bird")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("team")
    .setDescription("Look up an ESL team")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Team name, for example AFC Richmond")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("league")
    .setDescription("Show the current ESL league overview")
].map((command) => command.toJSON());

export async function registerLeagueCommands({ botToken, clientId, guildId }) {
  if (!botToken || !clientId || !guildId) {
    throw new Error("Missing DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID.");
  }

  const rest = new REST({ version: "10" }).setToken(botToken);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: leagueCommands
  });
}
