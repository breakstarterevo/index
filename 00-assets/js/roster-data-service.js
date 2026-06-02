(function () {
  const DEFAULT_PATHS = {
    standings: "../../00-build/database/standings.json",
    teams: "../../00-build/database/teams.json",
    players: "../../00-build/database/players.json",
    playerStats: "../../00-build/database/player_stats.json",
    schedule: "../../00-build/database/schedule.json",
    injuries: "../../00-build/database/injuries.json",
    capReport: "../../00-build/database/capreport.json",
    monthlyTeamForm: "../../00-build/database/monthly/monthly_team_form.json",
    teamStats: "../../00-build/database/team_stats.json",
    youthIntake: "../../00-build/database/youth_intake.json",
    humanCoaches: "../../humancoaches.htm"
  };

  const cache = {
    baseData: null,
    rosterBundleByFile: new Map()
  };

  function repoRootPrefix() {
    if (!window.location || !window.location.pathname) return "";
    const marker = "/00-assets/";
    const markerIndex = window.location.pathname.indexOf(marker);
    return markerIndex >= 0 ? window.location.pathname.slice(0, markerIndex) : "";
  }

  function rootCandidate(path) {
    const clean = String(path || "").replace(/^(\.\.\/)+/, "").replace(/^\.\/+/, "");
    return `${repoRootPrefix()}/${clean}`.replace(/\/{2,}/g, "/");
  }

  function pathCandidates(path) {
    const urls = [path, rootCandidate(path)];
    return urls.filter(Boolean).filter((url, index) => urls.indexOf(url) === index);
  }

  function cacheBust(url) {
    const joiner = String(url).includes("?") ? "&" : "?";
    return `${url}${joiner}v=${Date.now()}`;
  }

  async function fetchFirst(path) {
    let lastResponse = null;
    for (const candidate of pathCandidates(path)) {
      try {
        const res = await fetch(cacheBust(candidate), { cache: "no-store" });
        if (res.ok) return res;
        lastResponse = res;
      } catch (error) {
        // Try the next portable path candidate.
      }
    }
    return lastResponse || fetch(path);
  }

  async function optionalJson(path) {
    for (const candidate of pathCandidates(path)) {
      try {
        const res = await fetch(cacheBust(candidate), { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch (error) {
        // Optional feeds should not block the roster page.
      }
    }
    return null;
  }

  function normalizeRosterFile(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    const fromQuery = s.match(/roster(?:s\/)?(roster\d+\.htm)/i);
    if (fromQuery) return fromQuery[1];
    return s.replace(/^.*[\\/]/, "");
  }

  function parseCoachMap(htmlText) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const rows = Array.from(doc.querySelectorAll("tr"));
    const map = {};
    rows.forEach((row) => {
      const coachLink = row.querySelector('a.linkhuman[href*="coaches/coach"]');
      const rosterLink = row.querySelector('a.linkhuman[href*="rosters/roster"]');
      if (!coachLink || !rosterLink) return;
      const rosterFile = normalizeRosterFile(rosterLink.getAttribute("href") || "").toLowerCase();
      if (!rosterFile) return;
      const coachHref = String(coachLink.getAttribute("href") || "").replace(/^(\.\/|\.\.\/)+/, "");
      if (!coachHref) return;
      map[rosterFile] = {
        name: coachLink.textContent.replace(/\s+/g, " ").trim(),
        href: `../../${coachHref}`
      };
    });
    return map;
  }

  function parseSectionTable(sectionTitle, doc) {
    const target = Array.from(doc.querySelectorAll("td.tableheader")).find((td) =>
      td.textContent.replace(/\s+/g, " ").trim().toLowerCase().includes(sectionTitle.toLowerCase())
    );
    if (!target) return null;
    const table = target.closest("table");
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll("tr"));
    const matrix = rows.map((tr) =>
      Array.from(tr.children).map((td) => {
        const nestedColor = td.querySelector("td[bgcolor]");
        return {
          text: td.textContent.replace(/\s+/g, " ").trim(),
          color: nestedColor ? nestedColor.getAttribute("bgcolor") : ""
        };
      })
    );
    return matrix.filter((r) => r.some((c) => c.text || c.color));
  }

  function parseRosterSections(htmlText, statModes) {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const sectionNames = ["Season Info", "Attributes", "Potentials", "Contract", ...(statModes || [])];
    const parsed = {};
    sectionNames.forEach((name) => {
      parsed[name] = parseSectionTable(name, doc);
    });
    return parsed;
  }

  function extractTeamColors(htmlText) {
    const styleChunk = (htmlText.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
    const main = (styleChunk.match(/td\.teamheader\s*\{[^}]*background:\s*([^;]+);/i) || [])[1] || "#111b36";
    const c2 = (styleChunk.match(/td\.teamheader2\s*\{[^}]*background:\s*([^;]+);/i) || [])[1] || main;
    return { main: String(main).trim(), secondary: String(c2).trim() };
  }

  async function loadBaseData(paths = DEFAULT_PATHS) {
    if (cache.baseData) return cache.baseData;

    const [standingsRes, teamsRes, playersRes, playerStatsRes, scheduleRes, injuriesRes, coachesRes, capReportData, monthlyTeamFormData, teamStatsData, youthIntakeData] = await Promise.all([
      fetchFirst(paths.standings),
      fetchFirst(paths.teams),
      fetchFirst(paths.players),
      fetchFirst(paths.playerStats),
      fetchFirst(paths.schedule),
      fetchFirst(paths.injuries),
      fetchFirst(paths.humanCoaches),
      optionalJson(paths.capReport),
      optionalJson(paths.monthlyTeamForm),
      optionalJson(paths.teamStats),
      optionalJson(paths.youthIntake)
    ]);

    const [standingsData, teamsData, playersData, playerStatsData, scheduleData, injuriesData, coachesHtml] = await Promise.all([
      standingsRes.json(),
      teamsRes.json(),
      playersRes.json(),
      playerStatsRes.json(),
      scheduleRes.json(),
      injuriesRes.json(),
      coachesRes.text()
    ]);

    cache.baseData = {
      standings: Array.isArray(standingsData.sections) ? standingsData.sections : [],
      teams: Array.isArray(teamsData.teams) ? teamsData.teams : [],
      players: Array.isArray(playersData) ? playersData : [],
      playerStats: Array.isArray(playerStatsData.players) ? playerStatsData.players : [],
      scheduleSections: Array.isArray(scheduleData.sections) ? scheduleData.sections : [],
      injuries: Array.isArray(injuriesData.injuries) ? injuriesData.injuries : [],
      capReport: capReportData && Array.isArray(capReportData.sections) ? capReportData.sections : [],
      monthlyTeamForm: monthlyTeamFormData && monthlyTeamFormData.tiers ? monthlyTeamFormData.tiers : {},
      teamStats: teamStatsData && Array.isArray(teamStatsData.teams) ? teamStatsData.teams : [],
      youthIntake: youthIntakeData && Array.isArray(youthIntakeData.teams) ? youthIntakeData.teams : [],
      coachesByRoster: parseCoachMap(coachesHtml)
    };

    return cache.baseData;
  }

  function buildTeamDirectory(standingsSections) {
    const standingsFlat = (standingsSections || []).flatMap((sec) =>
      (sec.teams || []).map((t) => ({ ...t, league: sec.title }))
    );
    const seen = new Set();
    return standingsFlat
      .map((t) => ({
        teamName: String(t.team || "").trim(),
        teamId: String(t.rosterFile || "").replace(".htm", ""),
        rosterFile: normalizeRosterFile(t.rosterFile || t.rosterUrl || ""),
        record: `${t.wins}-${t.losses}`,
        league: t.league,
        diff: t.diff,
        streak: t.streak
      }))
      .filter((t) => t.teamName && t.rosterFile)
      .filter((t) => {
        const key = `${t.teamName}|${t.rosterFile}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" }));
  }

  function findTeamFromQuery(teamDirectory, search) {
    const params = new URLSearchParams(search || "");
    const file = normalizeRosterFile(params.get("file"));
    const teamId = params.get("team") || params.get("id");
    if (file) {
      return (teamDirectory || []).find((t) => t.rosterFile.toLowerCase() === file.toLowerCase()) || null;
    }
    if (teamId) {
      return (teamDirectory || []).find((t) => String(t.teamId).toLowerCase() === String(teamId).toLowerCase()) || null;
    }
    return (teamDirectory || [])[0] || null;
  }

  async function loadTeamBundle(rosterFile, statModes) {
    const cleanFile = normalizeRosterFile(rosterFile);
    if (!cleanFile) throw new Error("Missing roster file");
    const cacheKey = cleanFile.toLowerCase();
    if (cache.rosterBundleByFile.has(cacheKey)) {
      return cache.rosterBundleByFile.get(cacheKey);
    }

    const rosterPath = `../../rosters/${cleanFile}`;
    const res = await fetch(rosterPath);
    if (!res.ok) throw new Error(`Could not load roster file: ${cleanFile}`);
    const htmlText = await res.text();
    const bundle = {
      rosterFile: cleanFile,
      colors: extractTeamColors(htmlText),
      parsedSections: parseRosterSections(htmlText, statModes)
    };
    cache.rosterBundleByFile.set(cacheKey, bundle);
    return bundle;
  }

  window.UnifiedRosterDataService = {
    loadBaseData,
    buildTeamDirectory,
    findTeamFromQuery,
    loadTeamBundle,
    normalizeRosterFile
  };
})();

