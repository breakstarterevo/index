import { EmbedBuilder } from "discord.js";

const COLOR = 0x111b36;
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://eurosuperleague.github.io/index/";

export async function handleLeagueCommand(interaction, dataClient) {
  try {
    if (interaction.commandName === "player") {
      await handlePlayer(interaction, dataClient);
      return;
    }

    if (interaction.commandName === "team") {
      await handleTeam(interaction, dataClient);
      return;
    }

    if (interaction.commandName === "league") {
      await handleLeague(interaction, dataClient);
    }
  } catch (error) {
    console.error(`/${interaction.commandName} failed:`, error);
    const payload = { content: "I could not reach the live league data right now. Try again in a minute." };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  }
}

async function handlePlayer(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("name", true);
  const { players, playerStats } = await dataClient.getPlayerContext();
  const match = findBestMatch(query, players, (player) => player.name);

  if (!match.item || match.isAmbiguous) {
    await interaction.editReply(buildLookupMiss("player", query, match.suggestions));
    return;
  }

  const player = match.item;
  const stats = playerStats.find((entry) => entry.playerId === player.playerId);
  const seasonRow = getSeasonAverageRow(stats);
  const fields = [
    field("Team", player.teamLabel || "Free Agent", true),
    field("Pos", player.pos || "-", true),
    field("Age", player.age || "-", true),
    field("Size", [player.ht, player.wt ? `${player.wt} lbs` : ""].filter(Boolean).join(", ") || "-", true),
    field("OVR/POT", [player.overall, player.potential].filter(Boolean).join(" / ") || "-", true),
    field("Salary", player.currentSalaryText || "-", true)
  ];

  if (seasonRow) {
    fields.push(field("Season", formatPlayerLine(seasonRow), false));
  }

  const awardText = listNames(player.awards || player.seasonAwards, 3);
  if (awardText) {
    fields.push(field("Awards", awardText, false));
  }

  const transactionText = listTransactions(player.transactions, 2);
  if (transactionText) {
    fields.push(field("Recent Moves", transactionText, false));
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(player.name)
    .setURL(publicPlayerUrl(player))
    .setDescription(`${player.pos || "Player"} for ${player.teamLabel || "Free Agent"}`)
    .addFields(fields)
    .setFooter({ text: "European Super League live data" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleTeam(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("name", true);
  const context = await dataClient.getTeamContext();
  const candidates = buildTeamCandidates(context);
  const match = findBestMatch(query, candidates, (team) => team.name);

  if (!match.item || match.isAmbiguous) {
    await interaction.editReply(buildLookupMiss("team", query, match.suggestions));
    return;
  }

  const team = match.item;
  const baseTeam = context.teams.find((entry) => sameTeam(entry, team));
  const standing = findStanding(context.standings, team);
  const stats = context.teamStats.find((entry) => sameTeam(entry, team));
  const cap = findCapEntry(context.capReport, team);
  const injuryText = findInjuries(context.injuries, team).slice(0, 3).join("\n");
  const recentGame = findRecentGame(context.schedule, team);
  const nextGame = findNextGame(context.schedule, team);
  const fields = [];

  if (standing) {
    fields.push(
      field("Record", `${standing.wins}-${standing.losses} (${formatPct(standing.pct)})`, true),
      field("Section", standing.sectionTitle || "Standings", true),
      field("Form", `${standing.streak || "-"} | Last 10: ${standing.last10 || "-"}`, true),
      field("PF/PA", `${standing.pf ?? "-"} / ${standing.pa ?? "-"} (${formatSigned(standing.diff)})`, true)
    );
  }

  if (baseTeam?.starPlayer) {
    fields.push(field("Star Player", `${baseTeam.starPlayer.name} (${baseTeam.starPlayer.pos || "-"}) OVR ${baseTeam.starPlayer.overall || "-"}`, true));
  }

  if (cap) {
    fields.push(field("Cap", `Salary ${cap.salaryText || "-"} | Room ${cap.capRoomText || "-"}`, false));
  }

  const topStats = formatTopTeamStats(stats);
  if (topStats) {
    fields.push(field("Team Strengths", topStats, false));
  }

  if (injuryText) {
    fields.push(field("Injuries", injuryText, false));
  }

  if (recentGame) {
    fields.push(field("Recent", recentGame.matchupText || formatGame(recentGame), false));
  }

  if (nextGame) {
    fields.push(field("Next", nextGame.matchupText || formatGame(nextGame), false));
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(team.name)
    .setURL(publicTeamUrl(team))
    .setDescription("ESL team snapshot")
    .addFields(fields.slice(0, 10))
    .setFooter({ text: "European Super League live data" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeague(interaction, dataClient) {
  await interaction.deferReply();
  const { standings, leaders } = await dataClient.getLeagueContext();
  const standingsFields = Array.isArray(standings?.sections)
    ? standings.sections.slice(0, 4).map((section) => field(section.title, formatSectionLeaders(section), false))
    : [];
  const leaderText = formatLeagueLeaders(leaders);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("European Super League")
    .setURL(new URL("index.htm", SITE_BASE_URL).toString())
    .setDescription("Current live league snapshot")
    .addFields([
      ...standingsFields,
      ...(leaderText ? [field("League Leaders", leaderText, false)] : [])
    ])
    .setFooter({ text: "Data from GitHub Pages JSON feeds" });

  await interaction.editReply({ embeds: [embed] });
}

function buildLookupMiss(type, query, suggestions) {
  const hint = suggestions.length
    ? `Closest ${type}s: ${suggestions.map((item) => item.name).join(", ")}`
    : `No close ${type} matches found.`;

  return {
    content: `I could not find a ${type} for "${query}". ${hint}`
  };
}

function findBestMatch(query, items, labelFor) {
  const ranked = items
    .map((item) => ({ item, name: labelFor(item), score: scoreMatch(query, labelFor(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const suggestions = ranked.slice(0, 5).map((entry) => ({ name: entry.name, score: entry.score }));
  const top = ranked[0];
  const second = ranked[1];

  if (!top || top.score < 35) {
    return { item: null, isAmbiguous: false, suggestions };
  }

  const isAmbiguous = second && top.score < 95 && second.score >= top.score - 4;
  return { item: top.item, isAmbiguous, suggestions };
}

function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) {
    return 0;
  }

  if (q === c) {
    return 100;
  }

  if (c.startsWith(q)) {
    return 92;
  }

  if (c.includes(q)) {
    return 82;
  }

  const qTokens = q.split(" ");
  const cTokens = c.split(" ");
  const matchedTokens = qTokens.filter((token) => cTokens.some((candidateToken) => candidateToken.startsWith(token)));
  if (matchedTokens.length === qTokens.length) {
    return 72 + matchedTokens.length;
  }

  const distance = levenshtein(q, c);
  const maxLength = Math.max(q.length, c.length);
  return Math.max(0, Math.round((1 - distance / maxLength) * 70));
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let last = i - 1;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = previous[j];
      previous[j] = a[i - 1] === b[j - 1]
        ? last
        : Math.min(previous[j] + 1, previous[j - 1] + 1, last + 1);
      last = current;
    }
  }
  return previous[b.length];
}

function getSeasonAverageRow(stats) {
  const rows = stats?.stats?.season_averages?.rows;
  if (!Array.isArray(rows)) {
    return null;
  }

  return rows.find((row) => row.season !== "Career") || rows[0] || null;
}

function formatPlayerLine(row) {
  return `${row.pts ?? "-"} PTS, ${row.drb ?? "-"} DRB, ${row.ast ?? "-"} AST, ${row.stl ?? "-"} STL, ${row.blk ?? "-"} BLK in ${row.min ?? "-"} MIN`;
}

function buildTeamCandidates(context) {
  const byName = new Map();
  for (const team of context.teams) {
    byName.set(normalize(team.name), { ...team, name: team.name, id: team.id, file: team.file });
  }

  for (const standing of flattenStandings(context.standings)) {
    const key = normalize(standing.team);
    if (!byName.has(key)) {
      byName.set(key, { name: standing.team, file: standing.rosterFile, id: rosterIdFromFile(standing.rosterFile) });
    }
  }

  return Array.from(byName.values());
}

function sameTeam(entry, team) {
  return entry?.id === team.id
    || entry?.teamId === team.id
    || entry?.file === team.file
    || normalize(entry?.name || entry?.team) === normalize(team.name);
}

function findStanding(standings, team) {
  return flattenStandings(standings).find((entry) =>
    normalize(entry.team) === normalize(team.name)
    || entry.rosterFile === team.file
    || rosterIdFromFile(entry.rosterFile) === team.id
  );
}

function flattenStandings(standings) {
  if (!Array.isArray(standings?.sections)) {
    return [];
  }

  return standings.sections.flatMap((section) =>
    (section.teams || []).map((team) => ({ ...team, sectionTitle: section.title }))
  );
}

function findCapEntry(capReport, team) {
  if (!Array.isArray(capReport?.sections)) {
    return null;
  }

  return capReport.sections
    .flatMap((section) => section.entries || [])
    .find((entry) => normalize(entry.team) === normalize(team.name) || entry.rosterFile === team.file);
}

function findInjuries(injuries, team) {
  if (!Array.isArray(injuries?.sections)) {
    return [];
  }

  return injuries.sections
    .flatMap((section) => section.entries || section.players || [])
    .filter((entry) => normalize(entry.team || entry.teamName) === normalize(team.name) || entry.teamFile === team.file)
    .map((entry) => `${entry.player || entry.name || "Player"}: ${entry.injury || entry.status || entry.duration || "injured"}`);
}

function findRecentGame(schedule, team) {
  return flattenGames(schedule)
    .filter((game) => game.status === "completed" && gameIncludesTeam(game, team))
    .at(-1);
}

function findNextGame(schedule, team) {
  return flattenGames(schedule).find((game) => game.status !== "completed" && gameIncludesTeam(game, team));
}

function flattenGames(schedule) {
  if (!Array.isArray(schedule?.sections)) {
    return [];
  }

  return schedule.sections.flatMap((section) =>
    (section.days || []).flatMap((day) =>
      (day.games || []).map((game) => ({ ...game, date: day.date, sectionTitle: section.title }))
    )
  );
}

function gameIncludesTeam(game, team) {
  return game.homeTeam === team.id
    || game.awayTeam === team.id
    || normalize(game.homeTeamName) === normalize(team.name)
    || normalize(game.awayTeamName) === normalize(team.name);
}

function formatGame(game) {
  const away = game.awayTeamName || "Away";
  const home = game.homeTeamName || "Home";
  if (game.awayScore != null && game.homeScore != null) {
    return `${away} ${game.awayScore}, @${home} ${game.homeScore}`;
  }
  return `${game.date || ""} ${away} @ ${home}`.trim();
}

function formatTopTeamStats(stats) {
  if (!stats?.stats) {
    return "";
  }

  return Object.values(stats.stats)
    .filter((entry) => entry?.team?.totalRank && entry.team.totalRank <= 5)
    .sort((a, b) => a.team.totalRank - b.team.totalRank)
    .slice(0, 4)
    .map((entry) => `${entry.label}: ${entry.team.value} (#${entry.team.totalRank})`)
    .join("\n");
}

function formatSectionLeaders(section) {
  return (section.teams || [])
    .slice(0, 3)
    .map((team, index) => `${index + 1}. ${team.team} ${team.wins}-${team.losses}`)
    .join("\n") || "-";
}

function formatLeagueLeaders(leaders) {
  if (!Array.isArray(leaders?.sections)) {
    return "";
  }

  return leaders.sections
    .flatMap((section) => section.categories || [])
    .slice(0, 5)
    .map((category) => {
      const leader = category.leaders?.[0];
      return leader ? `${category.title}: ${leader.player} (${leader.valueText || leader.value})` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function publicPlayerUrl(player) {
  return new URL(`players/${player.playerId}.htm`, SITE_BASE_URL).toString();
}

function publicTeamUrl(team) {
  return new URL(`rosters/${team.file || `${team.id}.htm`}`, SITE_BASE_URL).toString();
}

function rosterIdFromFile(file) {
  return file ? file.replace(/\.htm$/i, "") : "";
}

function listNames(items, limit) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }

  return items
    .slice(0, limit)
    .map((item) => item.name || item.title || String(item))
    .join(", ");
}

function listTransactions(items, limit) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }

  return items
    .slice(0, limit)
    .map((item) => item.text || item.description || item.transaction || String(item))
    .join("\n");
}

function field(name, value, inline) {
  return {
    name,
    value: String(value || "-").slice(0, 1024),
    inline
  };
}

function formatPct(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function formatSigned(value) {
  if (typeof value !== "number") {
    return "-";
  }

  return value > 0 ? `+${value}` : String(value);
}
