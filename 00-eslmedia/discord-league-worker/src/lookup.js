const COLOR = 0x111b36;

export function handleCommand(command, data, env) {
  if (command.name === "help") {
    return handleHelp();
  }

  if (command.name === "player") {
    return handlePlayer(getOption(command, "name"), data.players || [], env);
  }

  if (command.name === "team") {
    return handleTeam(getOption(command, "name"), data.teams || [], env);
  }

  if (command.name === "league") {
    return handleLeague(data.league, env);
  }

  if (command.name === "youth") {
    return handleYouth(getOption(command, "team"), data.teams || [], data.youthIntake, env);
  }

  if (command.name === "standings") {
    return handleStandings(getOption(command, "tier"), data.standings, env);
  }

  if (command.name === "schedule") {
    return handleSchedule(getOption(command, "team"), data.teams || [], data.schedule, env);
  }

  if (command.name === "simrecap") {
    return handleSimRecap(getOption(command, "team"), data.teams || [], data.monthlyTeamForm, env);
  }

  return message(`Unknown command: ${command.name}`, true);
}

export function handleHelp() {
  return embedResponse({
    title: "ESL Bot Help",
    description: "Compact league lookups from the live ESL site feeds.",
    footer: "Data from live ESL site feeds",
    fields: [
      field("League", [
        "`/league` - current league overview",
        "`/standings tier:3` - standings with tier movement markers",
      ].join("\n"), false),
      field("Teams", [
        "`/team name:Valencia` - team snapshot",
        "`/schedule team:Valencia` - recent results and next calendar month",
        "`/simrecap team:Benfica` - latest monthly sim recap",
      ].join("\n"), false),
      field("Players and Youth", [
        "`/player name:Isiah Thomas` - player snapshot",
        "`/youth team:Valencia` - youth rights/intake players",
      ].join("\n"), false),
    ],
  });
}

export function handlePlayer(query, players, env = {}) {
  const match = findBestMatch(query, players, (player) => player.name);
  if (!match.item || match.isAmbiguous) {
    return lookupMiss("player", query, match.suggestions);
  }

  const player = match.item;
  const praLine = player.stats?.season ? formatPraDefense(player.stats.season) : "";
  const fields = [
    field("OFFENSE", formatRatings(player.ratings?.offense), true),
    field("DEFENSE", formatRatings(player.ratings?.defense), true),
    field("PHYSICAL", formatRatings(player.ratings?.physical), true),
  ];

  if (praLine) {
    fields.push(field("PTS | REB | AST | STL | BLK", praLine, false));
  }

  if (player.stats?.shooting) {
    fields.push(field("Shooting", formatShooting(player.stats.shooting), false));
  }

  if (player.stats?.careerHighs) {
    fields.push(field("Career Highs", formatCareerHighs(player.stats.careerHighs), false));
  }

  return embedResponse({
    title: `${player.name}    ${player.overall || "-"} OVR`,
    url: player.url || siteUrl(env, `00-assets/html/unified-player.htm?id=${player.id}`),
    description: [
      `**${String(player.team || "Free Agent").toUpperCase()} | ${player.pos || "-"} | AGE ${player.age || "-"}**`,
      `POT ${player.potential || "-"} | ${[player.height, player.weight ? `${player.weight} lbs` : ""].filter(Boolean).join(" | ") || "Size -"}`,
      player.salary ? `Salary ${player.salary}` : "",
    ].filter(Boolean).join("\n"),
    fields,
  });
}

export function handleTeam(query, teams, env = {}) {
  const match = findBestMatch(query, teams, (team) => team.name);
  if (!match.item || match.isAmbiguous) {
    return lookupMiss("team", query, match.suggestions);
  }

  const team = match.item;
  const record = team.record || {};
  const fields = [];

  if (record.wins != null && record.losses != null) {
    fields.push(
      field("Record", `${record.wins}-${record.losses} (${formatPct(record.pct)})`, true),
      field("Section", team.section || "Standings", true),
      field("Form", `${team.streak || "-"} | Last 10: ${team.last10 || "-"}`, true),
      field("PF/PA", `${team.pf ?? "-"} / ${team.pa ?? "-"} (${formatSigned(team.diff)})`, true),
    );
  }

  if (team.starPlayer) {
    fields.push(field("Star Player", `${team.starPlayer.name} (${team.starPlayer.pos || "-"}) OVR ${team.starPlayer.overall || "-"}`, true));
  }

  if (team.cap) {
    fields.push(field("Cap", `Salary ${team.cap.salary || "-"} | Room ${team.cap.room || "-"}`, false));
  }

  if (team.strengths?.length) {
    fields.push(field("Team Strengths", team.strengths.map((item) => `${item.label}: ${item.value} (#${item.rank})`).join("\n"), false));
  }

  if (team.injuries?.length) {
    fields.push(field("Injuries", team.injuries.map((item) => `${item.name}: ${item.injury}${item.length ? ` (${item.length})` : ""}`).join("\n"), false));
  }

  if (team.recentGame) {
    fields.push(field("Recent", team.recentGame.text, false));
  }

  if (team.nextGame) {
    fields.push(field("Next", team.nextGame.text, false));
  }

  return embedResponse({
    title: team.name,
    url: team.url || siteUrl(env, `00-assets/html/unified-roster.htm?id=${team.id}`),
    description: "ESL team snapshot",
    fields: fields.slice(0, 10),
  });
}

export function handleLeague(league, env = {}) {
  const fields = [];

  for (const section of (league?.sections || []).slice(0, 4)) {
    fields.push(field(
      section.title || "Standings",
      (section.teams || []).map((team, index) => `${index + 1}. ${team.name} ${team.wins}-${team.losses}`).join("\n") || "-",
      false,
    ));
  }

  if (league?.leaders?.length) {
    fields.push(field(
      "League Leaders",
      league.leaders.map((leader) => `${leader.category}: ${leader.player} (${leader.value})`).join("\n"),
      false,
    ));
  }

  return embedResponse({
    title: league?.name || "European Super League",
    url: league?.url || siteUrl(env, "index.htm"),
    description: "Current live league snapshot",
    fields,
  });
}

export function handleYouth(query, teams, youthIntake, env = {}) {
  const match = findBestMatch(query, teams, (team) => team.name);
  if (!match.item || match.isAmbiguous) {
    return lookupMiss("team", query, match.suggestions);
  }

  const team = match.item;
  const youthTeam = (youthIntake?.teams || []).find((entry) => normalize(entry.team) === normalize(team.name));
  if (!youthTeam) {
    return message(`I could not find youth intake data for ${team.name}.`, true);
  }

  const players = Array.isArray(youthTeam.intakePlayers) ? youthTeam.intakePlayers : [];
  const lines = players.slice(0, 6).map((player) => formatYouthPlayer(player, env));
  if (players.length > 6) {
    lines.push(`+${players.length - 6} more`);
  }

  const meta = [
    youthTeam.gm ? `GM: ${youthTeam.gm}` : "",
    youthTeam.tier ? `Tier: ${youthTeam.tier}` : "",
    youthTeam.positionFocus ? `Focus: ${youthTeam.positionFocus}` : "",
  ].filter(Boolean).join(" | ") || "Youth intake";

  return embedResponse({
    title: `${team.name} Youth`,
    url: team.url || siteUrl(env, `00-assets/html/unified-roster.htm?id=${team.id}`),
    description: meta,
    fields: [field("Intake Players", lines.join("\n") || "No youth players listed.", false)],
  });
}

export function handleStandings(query, standings, env = {}) {
  const tier = normalizeTier(query);
  if (!tier) {
    return message(`I could not understand tier "${query}". Try 1, 2, 3, CLB, ELB, or ECL.`, true);
  }

  const section = findStandingsSection(standings, tier);
  if (!section) {
    return message(`I could not find ${tier.label} standings.`, true);
  }

  return embedResponse({
    title: section.title || `${tier.label} Standings`,
    url: siteUrl(env, "standings.htm"),
    description: (section.teams || []).map((team, index, teams) => formatStandingRow(team, index, teams.length, tier.label)).join("\n") || "No standings rows found.",
    footer: standingsFooter(tier.label),
    fields: [],
  });
}

export function handleSchedule(query, teams, schedule, env = {}) {
  const match = findBestMatch(query, teams, (team) => team.name);
  if (!match.item || match.isAmbiguous) {
    return lookupMiss("team", query, match.suggestions);
  }

  const team = match.item;
  const games = flattenGames(schedule)
    .filter((game) => gameIncludesTeam(game, team))
    .sort(compareGamesByDate);
  const recent = games
    .filter((game) => game.status === "completed")
    .slice(-5)
    .map((game) => formatResultLine(game, team));
  const upcoming = nextCalendarMonthGames(games).map(formatScheduledLine);

  return embedResponse({
    title: `${team.name} Schedule`,
    url: team.url || siteUrl(env, `00-assets/html/unified-roster.htm?id=${team.id}`),
    description: "Recent results and the next league-calendar month.",
    fields: [
      field("Recent Results", recent.join("\n") || "No completed games found.", false),
      field("Next Calendar Month", upcoming.join("\n") || "No upcoming scheduled games found.", false),
    ],
  });
}

export function handleSimRecap(query, teams, monthlyTeamForm, env = {}) {
  const match = findBestMatch(query, teams, (team) => team.name);
  if (!match.item || match.isAmbiguous) {
    return lookupMiss("team", query, match.suggestions);
  }

  const team = match.item;
  const form = findMonthlyTeamForm(monthlyTeamForm, team);
  if (!form) {
    return message(`I could not find a monthly sim recap for ${team.name}.`, true);
  }

  const summary = [
    `Record: ${form.record || `${form.wins ?? "-"}-${form.losses ?? "-"}`}`,
    `Diff: ${formatSignedNumber(form.pointDiff)}`,
    `Avg: ${formatSignedNumber(form.avgMargin)}`,
    `Streak: ${form.streak || "-"}`,
    `Last3: ${form.last3 || "-"}`,
  ].join(" | ");
  const notes = [
    form.bestWin ? `Best win: ${form.bestWin.score}` : "",
    form.worstLoss ? `Worst loss: ${form.worstLoss.score}` : "",
    `Close games: ${form.closeGameCount ?? (Array.isArray(form.closeGames) ? form.closeGames.length : 0)}`,
  ].filter(Boolean).join("\n");

  return embedResponse({
    title: `${team.name} Sim Recap`,
    url: team.url || siteUrl(env, `00-assets/html/unified-roster.htm?id=${team.id}`),
    description: summary,
    fields: [
      field("Scores", (form.recentResults || []).map(formatMonthlyResultLine).join("\n") || "No monthly results found.", false),
      field("Notes", notes || "-", false),
    ],
  });
}

export function findBestMatch(query, items, labelFor) {
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

  return {
    item: top.item,
    isAmbiguous: Boolean(second && top.score < 95 && second.score >= top.score - 4),
    suggestions,
  };
}

export function findAutocompleteChoices(query, items, labelFor, valueFor = labelFor) {
  const seen = new Set();
  return items
    .map((item) => ({ item, name: labelFor(item), value: valueFor(item), score: scoreMatch(query, labelFor(item)) }))
    .filter((entry) => entry.score >= 35)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .filter((entry) => {
      const key = normalize(entry.name);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 25)
    .map((entry) => ({ name: entry.name.slice(0, 100), value: String(entry.value || entry.name).slice(0, 100) }));
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
  return Math.max(0, Math.round((1 - distance / Math.max(q.length, c.length)) * 70));
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

function lookupMiss(type, query, suggestions) {
  const hint = suggestions.length
    ? `Closest ${type}s: ${suggestions.map((item) => item.name).join(", ")}`
    : `No close ${type} matches found.`;
  return message(`I could not find a ${type} for "${query}". ${hint}`, true);
}

function embedResponse({ title, url, description, fields, footer = "European Super League live data" }) {
  return {
    type: 4,
    data: {
      embeds: [{
        title,
        url,
        description,
        color: COLOR,
        fields,
        footer: { text: footer },
      }],
    },
  };
}

function message(content, ephemeral = false) {
  return {
    type: 4,
    data: {
      content,
      flags: ephemeral ? 64 : undefined,
    },
  };
}

function getOption(command, name) {
  return command.options?.find((option) => option.name === name)?.value || "";
}

function field(name, value, inline) {
  return {
    name,
    value: String(value || "-").slice(0, 1024),
    inline,
  };
}

function siteUrl(env, path) {
  return new URL(path, env.SITE_BASE_URL || "https://eurosuperleague.github.io/index/").toString();
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

function formatYouthPlayer(player, env = {}) {
  const position = player.Position || player.pos || "-";
  const age = player.Age ?? player.age ?? "-";
  const overall = player.overall ?? "";
  const potential = player.potential ?? player.POT ?? "";
  const tier = player.tier || player.Tier || player.tierRaw || "-";
  const rating = [overall, potential].filter((value) => value !== "").join("/");
  return `${formatYouthPlayerName(player, env)} - ${position}, Age ${age}, OVR/POT ${rating || "-"}, Tier ${tier}`;
}

function formatYouthPlayerName(player, env = {}) {
  const name = player.name || "Player";
  if (!player.playerId) {
    return name;
  }
  return `[${name}](${siteUrl(env, `00-assets/html/unified-player.htm?id=${player.playerId}`)})`;
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
    t3: { label: "ECL", sectionSlug: "ecl-standings", titleToken: "ecl" },
  };
  return tiers[key] || null;
}

function findStandingsSection(standings, tier) {
  return (standings?.sections || []).find((section) =>
    normalize(section.slug) === normalize(tier.sectionSlug)
    || normalize(section.title).startsWith(tier.titleToken)
  );
}

function formatStandingRow(team, index, total, tierLabel) {
  const zone = standingsMarker(index, total, tierLabel);
  return `${index + 1}. ${team.team} ${team.wins}-${team.losses} | ${formatSignedNumber(team.diff)} | ${team.streak || "-"} | Last10 ${team.last10 || "-"}${zone}`;
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

function flattenGames(schedule) {
  return (schedule?.sections || []).flatMap((section) =>
    (section.days || []).flatMap((day) =>
      (day.games || []).map((game) => ({ ...game, date: day.date, sectionTitle: section.title })),
    ),
  );
}

function gameIncludesTeam(game, team) {
  return game.homeTeam === team.id
    || game.awayTeam === team.id
    || normalize(game.homeTeamName) === normalize(team.name)
    || normalize(game.awayTeamName) === normalize(team.name);
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

function formatGame(game) {
  const away = game.awayTeamName || "Away";
  const home = game.homeTeamName || "Home";
  if (game.awayScore != null && game.homeScore != null) {
    return `${away} ${game.awayScore}, @${home} ${game.homeScore}`;
  }
  return `${game.date || ""} ${away} @ ${home}`.trim();
}

function findMonthlyTeamForm(monthlyTeamForm, team) {
  return Object.values(monthlyTeamForm?.tiers || {})
    .flatMap((entries) => Array.isArray(entries) ? entries : [])
    .find((entry) => normalize(entry.team) === normalize(team.name) || entry.rosterFile === `${team.id}.htm`) || null;
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

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "-";
  }
  const rounded = Math.round(number * 10) / 10;
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

function formatShooting(shooting) {
  return [
    `FG ${formatMadeAttempt(shooting.fgm, shooting.fga)} (${formatPercent(shooting.fg_pct)})`,
    `FT ${formatMadeAttempt(shooting.ftm, shooting.fta)} (${formatPercent(shooting.ft_pct)})`,
    `3P ${formatMadeAttempt(shooting["3pm"], shooting["3pa"])} (${formatPercent(shooting["3p_pct"])})`,
  ].join(" | ");
}

function formatCareerHighs(highs) {
  return [
    `PTS ${highs.pts ?? "-"}`,
    `REB ${highs.reb ?? "-"}`,
    `AST ${highs.ast ?? "-"}`,
    `STL ${highs.stl ?? "-"}`,
    `BLK ${highs.blk ?? "-"}`,
  ].join(" | ");
}

function formatMadeAttempt(made, attempt) {
  return `${made ?? "-"}/${attempt ?? "-"}`;
}

function formatPercent(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function formatPraDefense(season) {
  const rebounds = Number(season.orb || 0) + Number(season.drb || 0);
  return [
    `**${formatOneDecimal(season.pts)}** PTS`,
    `**${formatOneDecimal(rebounds)}** REB`,
    `**${formatOneDecimal(season.ast)}** AST`,
    `**${formatOneDecimal(season.stl)}** STL`,
    `**${formatOneDecimal(season.blk)}** BLK`,
  ].join(" | ");
}

function formatOneDecimal(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : "-";
}

function formatRatings(group) {
  if (!group) {
    return "-";
  }

  return Object.entries(group)
    .filter(([, rating]) => getRatingValue(rating) !== "")
    .map(([label, rating]) => {
      const value = getRatingValue(rating);
      const potential = typeof rating === "object" ? rating.potential : "";
      return `${label.padEnd(3, " ")} **${value}**${potential ? ` (${potential})` : ""}`;
    })
    .join("\n") || "-";
}

function getRatingValue(rating) {
  if (rating && typeof rating === "object") {
    return rating.value ?? "";
  }
  return rating ?? "";
}
