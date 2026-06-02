import { EmbedBuilder } from "discord.js";

const COLOR = 0x111b36;
const SITE_BASE_URL = process.env.SITE_BASE_URL || "https://eurosuperleague.github.io/index/";

export async function handleLeagueCommand(interaction, dataClient) {
  try {
    if (interaction.commandName === "help") {
      await handleHelp(interaction);
      return;
    }

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
      return;
    }

    if (interaction.commandName === "youth") {
      await handleYouth(interaction, dataClient);
      return;
    }

    if (interaction.commandName === "standings") {
      await handleStandings(interaction, dataClient);
      return;
    }

    if (interaction.commandName === "schedule") {
      await handleSchedule(interaction, dataClient);
      return;
    }

    if (interaction.commandName === "simrecap") {
      await handleSimRecap(interaction, dataClient);
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

async function handleHelp(interaction) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("ESL Bot Help")
    .setDescription("Compact league lookups from the live ESL site feeds.")
    .addFields([
      field("League", [
        "`/league` - current league overview",
        "`/standings tier:3` - standings with tier movement markers"
      ].join("\n"), false),
      field("Teams", [
        "`/team name:Valencia` - team snapshot",
        "`/schedule team:Valencia` - recent results and next calendar month",
        "`/simrecap team:Benfica` - latest monthly sim recap"
      ].join("\n"), false),
      field("Players and Youth", [
        "`/player name:Isiah Thomas` - player snapshot",
        "`/youth team:Valencia` - youth rights/intake players"
      ].join("\n"), false)
    ])
    .setFooter({ text: "Data from live ESL site feeds" });

  await interaction.reply({ embeds: [embed] });
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

async function handleYouth(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("team", true);
  const context = await dataClient.getYouthContext();
  const candidates = buildTeamCandidates(context);
  const match = findBestMatch(query, candidates, (team) => team.name);

  if (!match.item || match.isAmbiguous) {
    await interaction.editReply(buildLookupMiss("team", query, match.suggestions));
    return;
  }

  const team = match.item;
  const youthTeam = findYouthTeam(context.youthIntake, team);
  if (!youthTeam) {
    await interaction.editReply({ content: `I could not find youth intake data for ${team.name}.` });
    return;
  }

  const players = Array.isArray(youthTeam.intakePlayers) ? youthTeam.intakePlayers : [];
  const playerLines = players.slice(0, 6).map(formatYouthPlayer);
  if (players.length > 6) {
    playerLines.push(`+${players.length - 6} more`);
  }

  const meta = [
    youthTeam.gm ? `GM: ${youthTeam.gm}` : "",
    youthTeam.tier ? `Tier: ${youthTeam.tier}` : "",
    youthTeam.positionFocus ? `Focus: ${youthTeam.positionFocus}` : ""
  ].filter(Boolean).join(" | ") || "Youth intake";

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${team.name} Youth`)
    .setURL(publicTeamUrl(team))
    .setDescription(meta)
    .addFields([
      field("Intake Players", playerLines.join("\n") || "No youth players listed.", false)
    ])
    .setFooter({ text: "Data from youth intake feed" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleStandings(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("tier", true);
  const tier = normalizeTier(query);
  if (!tier) {
    await interaction.editReply({ content: `I could not understand tier "${query}". Try 1, 2, 3, CLB, ELB, or ECL.` });
    return;
  }

  const { standings } = await dataClient.getStandingsContext();
  const section = findStandingsSection(standings, tier);
  if (!section) {
    await interaction.editReply({ content: `I could not find ${tier.label} standings.` });
    return;
  }

  const lines = (section.teams || []).map((team, index, teams) => formatStandingRow(team, index, teams.length, tier.label));
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(section.title || `${tier.label} Standings`)
    .setURL(new URL("standings.htm", SITE_BASE_URL).toString())
    .setDescription(lines.join("\n") || "No standings rows found.")
    .setFooter({ text: standingsFooter(tier.label) });

  await interaction.editReply({ embeds: [embed] });
}

async function handleSchedule(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("team", true);
  const context = await dataClient.getScheduleContext();
  const candidates = buildTeamCandidates(context);
  const match = findBestMatch(query, candidates, (team) => team.name);

  if (!match.item || match.isAmbiguous) {
    await interaction.editReply(buildLookupMiss("team", query, match.suggestions));
    return;
  }

  const team = match.item;
  const games = flattenGames(context.schedule)
    .filter((game) => gameIncludesTeam(game, team))
    .sort(compareGamesByDate);
  const completed = games.filter((game) => game.status === "completed");
  const recent = completed.slice(-5).map((game) => formatResultLine(game, team));
  const upcoming = nextCalendarMonthGames(games);
  const upcomingLines = upcoming.map(formatScheduledLine);

  const fields = [
    field("Recent Results", recent.join("\n") || "No completed games found.", false),
    field("Next Calendar Month", upcomingLines.join("\n") || "No upcoming scheduled games found.", false)
  ];

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${team.name} Schedule`)
    .setURL(publicTeamUrl(team))
    .setDescription("Recent results and the next league-calendar month.")
    .addFields(fields)
    .setFooter({ text: "Data from schedule feed" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleSimRecap(interaction, dataClient) {
  await interaction.deferReply();
  const query = interaction.options.getString("team", true);
  const context = await dataClient.getMonthlyTeamFormContext();
  const candidates = buildTeamCandidates(context);
  const match = findBestMatch(query, candidates, (team) => team.name);

  if (!match.item || match.isAmbiguous) {
    await interaction.editReply(buildLookupMiss("team", query, match.suggestions));
    return;
  }

  const team = match.item;
  const form = findMonthlyTeamForm(context.monthlyTeamForm, team);
  if (!form) {
    await interaction.editReply({ content: `I could not find a monthly sim recap for ${team.name}.` });
    return;
  }

  const results = Array.isArray(form.recentResults) ? form.recentResults : [];
  const lines = results.map(formatMonthlyResultLine);
  const summary = [
    `Record: ${form.record || `${form.wins ?? "-"}-${form.losses ?? "-"}`}`,
    `Diff: ${formatSigned(form.pointDiff)}`,
    `Avg: ${formatSignedNumber(form.avgMargin)}`,
    `Streak: ${form.streak || "-"}`,
    `Last3: ${form.last3 || "-"}`
  ].join(" | ");

  const notes = [
    form.bestWin ? `Best win: ${form.bestWin.score}` : "",
    form.worstLoss ? `Worst loss: ${form.worstLoss.score}` : "",
    `Close games: ${form.closeGameCount ?? (Array.isArray(form.closeGames) ? form.closeGames.length : 0)}`
  ].filter(Boolean).join("\n");

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${team.name} Sim Recap`)
    .setURL(publicTeamUrl(team))
    .setDescription(summary)
    .addFields([
      field("Scores", lines.join("\n") || "No monthly results found.", false),
      field("Notes", notes || "-", false)
    ])
    .setFooter({ text: "Data from latest monthly team form feed" });

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

function findYouthTeam(youthIntake, team) {
  if (!Array.isArray(youthIntake?.teams)) {
    return null;
  }

  return youthIntake.teams.find((entry) => normalize(entry.team) === normalize(team.name));
}

function formatYouthPlayer(player) {
  const position = player.Position || player.pos || "-";
  const age = player.Age ?? player.age ?? "-";
  const overall = player.overall ?? "";
  const potential = player.potential ?? player.POT ?? "";
  const tier = player.tier || player.Tier || player.tierRaw || "-";
  const rating = [overall, potential].filter((value) => value !== "").join("/");
  return `${formatYouthPlayerName(player)} - ${position}, Age ${age}, OVR/POT ${rating || "-"}, Tier ${tier}`;
}

function formatYouthPlayerName(player) {
  const name = player.name || "Player";
  if (!player.playerId) {
    return name;
  }
  return `[${name}](${new URL(`players/${player.playerId}.htm`, SITE_BASE_URL).toString()})`;
}

function normalizeTier(value) {
  const key = normalize(value).replace(/\s+/g, "");
  const tiers = {
    "1": { label: "CLB", sectionSlug: "clb-standings", titleToken: "clb" },
    clb: { label: "CLB", sectionSlug: "clb-standings", titleToken: "clb" },
    tier1: { label: "CLB", sectionSlug: "clb-standings", titleToken: "clb" },
    t1: { label: "CLB", sectionSlug: "clb-standings", titleToken: "clb" },
    "2": { label: "ELB", sectionSlug: "elb-standings", titleToken: "elb" },
    elb: { label: "ELB", sectionSlug: "elb-standings", titleToken: "elb" },
    tier2: { label: "ELB", sectionSlug: "elb-standings", titleToken: "elb" },
    t2: { label: "ELB", sectionSlug: "elb-standings", titleToken: "elb" },
    "3": { label: "ECL", sectionSlug: "ecl-standings", titleToken: "ecl" },
    ecl: { label: "ECL", sectionSlug: "ecl-standings", titleToken: "ecl" },
    tier3: { label: "ECL", sectionSlug: "ecl-standings", titleToken: "ecl" },
    t3: { label: "ECL", sectionSlug: "ecl-standings", titleToken: "ecl" }
  };
  return tiers[key] || null;
}

function findStandingsSection(standings, tier) {
  if (!Array.isArray(standings?.sections)) {
    return null;
  }

  return standings.sections.find((section) =>
    normalize(section.slug) === normalize(tier.sectionSlug)
    || normalize(section.title).startsWith(tier.titleToken)
  );
}

function formatStandingRow(team, index, total, tierLabel) {
  const zone = standingsMarker(index, total, tierLabel);
  const diff = typeof team.diff === "number" ? formatSignedNumber(team.diff) : "-";
  return `${index + 1}. ${team.team} ${team.wins}-${team.losses} | ${diff} | ${team.streak || "-"} | Last10 ${team.last10 || "-"}${zone}`;
}

function standingsMarker(index, total, tierLabel) {
  if (tierLabel === "CLB") {
    if (index === 0) {
      return " CHAMP";
    }
    return index >= Math.max(0, total - 2) ? " RELEG" : "";
  }
  if (tierLabel === "ELB") {
    if (index < 2) {
      return " PROMO";
    }
    return index === total - 1 ? " RELEG" : "";
  }
  if (tierLabel === "ECL") {
    return index === 0 ? " PROMO" : "";
  }
  return "";
}

function standingsFooter(tierLabel) {
  if (tierLabel === "CLB") {
    return "CHAMP = tier champion | RELEG = bottom 2 relegated";
  }
  if (tierLabel === "ELB") {
    return "PROMO = top 2 promoted | RELEG = bottom 1 relegated";
  }
  if (tierLabel === "ECL") {
    return "PROMO = top 1 promoted";
  }
  return "European Super League live data";
}

function compareGamesByDate(a, b) {
  return parseLeagueDate(a.date) - parseLeagueDate(b.date);
}

function nextCalendarMonthGames(games) {
  const completed = games.filter((game) => game.status === "completed").sort(compareGamesByDate);
  const latestCompletedDate = completed.length ? parseLeagueDate(completed.at(-1).date) : null;
  const scheduled = games
    .filter((game) => game.status !== "completed")
    .filter((game) => latestCompletedDate == null || parseLeagueDate(game.date) > latestCompletedDate)
    .sort(compareGamesByDate);

  const first = scheduled[0];
  if (!first) {
    return [];
  }

  const firstDate = parseLeagueDate(first.date);
  return scheduled.filter((game) => {
    const date = parseLeagueDate(game.date);
    return date.getFullYear() === firstDate.getFullYear() && date.getMonth() === firstDate.getMonth();
  });
}

function formatResultLine(game, team) {
  const result = teamResultFromGame(game, team);
  return `${result ? `${result} ` : ""}${game.date || "-"} - ${game.matchupText || formatGame(game)}`.trim();
}

function formatScheduledLine(game) {
  return `${game.date || "-"} - ${game.matchupText || formatGame(game)}`;
}

function teamResultFromGame(game, team) {
  if (game.winnerName && normalize(game.winnerName) === normalize(team.name)) {
    return "W";
  }
  if (game.loserName && normalize(game.loserName) === normalize(team.name)) {
    return "L";
  }
  if (game.homeScore == null || game.awayScore == null) {
    return "";
  }
  if (normalize(game.homeTeamName) === normalize(team.name)) {
    return Number(game.homeScore) > Number(game.awayScore) ? "W" : "L";
  }
  if (normalize(game.awayTeamName) === normalize(team.name)) {
    return Number(game.awayScore) > Number(game.homeScore) ? "W" : "L";
  }
  return "";
}

function findMonthlyTeamForm(monthlyTeamForm, team) {
  const sections = Object.values(monthlyTeamForm?.tiers || {});
  return sections
    .flatMap((entries) => Array.isArray(entries) ? entries : [])
    .find((entry) =>
      normalize(entry.team) === normalize(team.name)
      || entry.rosterFile === team.file
    ) || null;
}

function formatMonthlyResultLine(result) {
  return `${result.result || "-"} ${result.date || "-"} - ${result.score || "-"}`;
}

function parseLeagueDate(value) {
  const [month, day, year] = String(value || "").split("/").map((part) => Number(part));
  if (!month || !day || !year) {
    return new Date(0);
  }
  return new Date(year, month - 1, day);
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

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const rounded = Math.round(number * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}
