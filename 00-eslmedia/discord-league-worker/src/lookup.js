const COLOR = 0x111b36;

export function handleCommand(command, data, env) {
  if (command.name === "player") {
    return handlePlayer(getOption(command, "name"), data.players || [], env);
  }

  if (command.name === "team") {
    return handleTeam(getOption(command, "name"), data.teams || [], env);
  }

  if (command.name === "league") {
    return handleLeague(data.league, env);
  }

  return message(`Unknown command: ${command.name}`, true);
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
  return items
    .map((item) => ({ item, name: labelFor(item), value: valueFor(item), score: scoreMatch(query, labelFor(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 25)
    .map((entry) => ({
      name: entry.name.slice(0, 100),
      value: String(entry.value || entry.name).slice(0, 100),
    }));
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

function embedResponse({ title, url, description, fields }) {
  return {
    type: 4,
    data: {
      embeds: [{
        title,
        url,
        description,
        color: COLOR,
        fields,
        footer: { text: "European Super League live data" },
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
    .filter(([, value]) => value !== "" && value != null)
    .map(([label, value]) => `${label.padEnd(3, " ")} **${value}**`)
    .join("\n") || "-";
}
