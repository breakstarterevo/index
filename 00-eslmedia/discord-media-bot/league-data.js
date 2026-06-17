const DEFAULT_TTL_MS = 300000;

export class LeagueDataClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "https://eurosuperleague.github.io/index/00-build/database/";
    this.cacheTtlMs = Number(options.cacheTtlMs || DEFAULT_TTL_MS);
    this.cache = new Map();
  }

  async getFeed(name) {
    const filename = name.endsWith(".json") ? name : `${name}.json`;
    const cached = this.cache.get(filename);
    const now = Date.now();

    if (cached && now - cached.loadedAt < this.cacheTtlMs) {
      return cached.data;
    }

    const url = new URL(filename, ensureTrailingSlash(this.baseUrl)).toString();
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Could not fetch ${filename}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set(filename, { data, loadedAt: now });
    return data;
  }

  async getPlayerContext() {
    const [players, playerStats] = await Promise.all([
      this.getFeed("players"),
      this.getFeed("player_stats")
    ]);

    return {
      players: Array.isArray(players) ? players : [],
      playerStats: Array.isArray(playerStats?.players) ? playerStats.players : []
    };
  }

  async getTeamContext() {
    const [teams, standings, teamStats, capReport, injuries, schedule] = await Promise.all([
      this.getFeed("teams"),
      this.getFeed("standings"),
      this.getFeed("team_stats"),
      this.getFeed("capreport"),
      this.getFeed("injuries"),
      this.getFeed("schedule")
    ]);

    return {
      teams: Array.isArray(teams) ? teams : [],
      standings,
      teamStats: Array.isArray(teamStats?.teams) ? teamStats.teams : [],
      capReport,
      injuries,
      schedule
    };
  }

  async getLeagueContext() {
    const [standings, leaders] = await Promise.all([
      this.getFeed("standings"),
      this.getFeed("leaders")
    ]);

    return { standings, leaders };
  }

  async getTeamIndexContext() {
    const [teams, standings] = await Promise.all([
      this.getFeed("teams"),
      this.getFeed("standings")
    ]);

    return {
      teams: Array.isArray(teams) ? teams : [],
      standings
    };
  }

  async getYouthContext() {
    const [teams, standings, youthIntake] = await Promise.all([
      this.getFeed("teams"),
      this.getFeed("standings"),
      this.getFeed("youth_intake")
    ]);

    return {
      teams: Array.isArray(teams) ? teams : [],
      standings,
      youthIntake
    };
  }

  async getStandingsContext() {
    const standings = await this.getFeed("standings");
    return { standings };
  }

  async getScheduleContext() {
    const [teams, standings, schedule] = await Promise.all([
      this.getFeed("teams"),
      this.getFeed("standings"),
      this.getFeed("schedule")
    ]);

    return {
      teams: Array.isArray(teams) ? teams : [],
      standings,
      schedule
    };
  }

  async getMonthlyTeamFormContext() {
    const [teams, standings, monthlyTeamForm] = await Promise.all([
      this.getFeed("teams"),
      this.getFeed("standings"),
      this.getFeed("monthly/monthly_team_form")
    ]);

    return {
      teams: Array.isArray(teams) ? teams : [],
      standings,
      monthlyTeamForm
    };
  }

  async getResigningsContext() {
    const [players, playerStats, teams, capReport] = await Promise.all([
      this.getFeed("players"),
      this.getFeed("player_stats"),
      this.getFeed("teams"),
      this.getFeed("capreport")
    ]);

    return {
      players: Array.isArray(players) ? players : [],
      playerStats: Array.isArray(playerStats?.players) ? playerStats.players : [],
      teams: Array.isArray(teams) ? teams : [],
      capReport
    };
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
