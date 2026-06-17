import { REST, Routes, SlashCommandBuilder } from "discord.js";

export const leagueCommands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show ESL bot commands"),
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
    .setDescription("Show the current ESL league overview"),
  new SlashCommandBuilder()
    .setName("youth")
    .setDescription("Show youth rights/intake players for an ESL team")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team name, for example Valencia")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("standings")
    .setDescription("Show standings by tier")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("Tier, for example 3, ECL, or tier3")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Show recent results and next calendar month for a team")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team name, for example Valencia")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("simrecap")
    .setDescription("Show a team's latest monthly sim recap")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Team name, for example Benfica")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("resignings")
    .setDescription("Show former players currently in FA by last recorded team")
    .addStringOption((option) =>
      option
        .setName("team")
        .setDescription("Optional team name, for example Valencia")
        .setRequired(false)
    )
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
