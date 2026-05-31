const DEFAULT_BASE_URL = "https://eurosuperleague.github.io/index/00-build/database/discord/";
const DEFAULT_CACHE_SECONDS = 300;

export async function loadCommandData(commandName, env) {
  if (commandName === "player") {
    return { players: await fetchJson("players.json", env) };
  }
  if (commandName === "team") {
    return { teams: await fetchJson("teams.json", env) };
  }
  if (commandName === "league") {
    return { league: await fetchJson("league.json", env) };
  }
  return {};
}

async function fetchJson(filename, env) {
  const url = new URL(filename, ensureTrailingSlash(env.DATA_BASE_URL || DEFAULT_BASE_URL)).toString();
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

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
