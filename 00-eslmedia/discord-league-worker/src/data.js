const DEFAULT_BASE_URL = "https://eurosuperleague.github.io/index/00-build/database/discord/";
const DEFAULT_CACHE_SECONDS = 300;

export async function loadCommandData(commandName, env) {
  if (commandName === "help") {
    return {};
  }
  if (commandName === "player") {
    return { players: await fetchJson("players.json", env) };
  }
  if (commandName === "team") {
    return { teams: await fetchJson("teams.json", env) };
  }
  if (commandName === "league") {
    return { league: await fetchJson("league.json", env) };
  }
  if (commandName === "youth") {
    const [teams, youthIntake] = await Promise.all([
      fetchJson("teams.json", env),
      fetchFullJson("youth_intake.json", env),
    ]);
    return { teams, youthIntake };
  }
  if (commandName === "standings") {
    return { standings: await fetchFullJson("standings.json", env) };
  }
  if (commandName === "schedule") {
    const [teams, schedule] = await Promise.all([
      fetchJson("teams.json", env),
      fetchFullJson("schedule.json", env),
    ]);
    return { teams, schedule };
  }
  if (commandName === "simrecap") {
    const [teams, monthlyTeamForm] = await Promise.all([
      fetchJson("teams.json", env),
      fetchFullJson("monthly/monthly_team_form.json", env),
    ]);
    return { teams, monthlyTeamForm };
  }
  if (commandName === "resignings") {
    const [players, playerStats, teams] = await Promise.all([
      fetchFullJson("players.json", env),
      fetchFullJson("player_stats.json", env),
      fetchJson("teams.json", env),
    ]);
    return {
      players: Array.isArray(players) ? players : [],
      playerStats: Array.isArray(playerStats?.players) ? playerStats.players : [],
      teams: Array.isArray(teams) ? teams : [],
    };
  }
  return {};
}

async function fetchJson(filename, env, baseUrl = env.DATA_BASE_URL || DEFAULT_BASE_URL) {
  const url = new URL(filename, ensureTrailingSlash(baseUrl)).toString();
  const cacheSeconds = Number(env.DATA_CACHE_SECONDS || DEFAULT_CACHE_SECONDS);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cf: { cacheTtl: cacheSeconds, cacheEverything: true },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch ${filename}: ${response.status}`);
  }

  return response.json();
}

async function fetchFullJson(filename, env) {
  return fetchJson(filename, env, getFullDataBaseUrl(env));
}

function getFullDataBaseUrl(env) {
  if (env.FULL_DATA_BASE_URL) {
    return env.FULL_DATA_BASE_URL;
  }

  return new URL("../", ensureTrailingSlash(env.DATA_BASE_URL || DEFAULT_BASE_URL)).toString();
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
