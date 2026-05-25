(function () {
  "use strict";

  const HISTORY_ROOT = "../../../00-build/history/";
  const CURRENT_DB = "../../../00-build/database/";
  const LOGO_ROOT = "../../photos/";
  const SITE_LOGO = "../../images/ESLcropped-removebg-preview.png";
  const ATTR_KEYS = ["Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", "Psd", "Prd", "Stl", "Blk", "Qkn", "Str", "Jmp", "Sta"];
  const LOGO_MAP = {
    "ac milan": "acmilan.jpg",
    "afc richmond": "richmond.jpg",
    ajax: "ajax.jpg",
    "aston villa": "astonvilla.jpg",
    "atletico madrid": "atletico.jpg",
    barcelona: "barcelona.jpg",
    "bayern munich": "bayern.jpg",
    benfica: "benfica.jpg",
    brighton: "brighton.jpg",
    chelsea: "chelsea.jpg",
    "crystal palace": "crystalpalace.jpg",
    "fl fart": "flfart.jpg",
    "inter milan": "intermilan.jpg",
    juventus: "juventus.jpg",
    "manchester city": "manchestercity.jpg",
    "manchester united": "manutd.jpg",
    marseille: "marseille.jpg",
    monaco: "monaco.jpg",
    "paris saint-germain": "psg.jpg",
    psg: "psg.jpg",
    "real madrid": "realmadrid.jpg",
    "sheffield united": "sheffield.jpg",
    "sporting cp": "sportingcp.jpg",
    tottenham: "tottenham.jpg",
    "tottenham hotspur": "tottenham.jpg",
    valencia: "valencia.jpg"
  };

  const state = {
    index: null,
    playerIndex: null,
    currentPlayers: [],
    currentTeams: [],
    seasonCache: new Map(),
    coreReady: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const params = () => new URLSearchParams(window.location.search);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const num = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const slug = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const fileStem = (file) => String(file || "").replace(/\.htm$/i, "");
  const tierFromTitle = (title) => String(title || "").split(/\s+/)[0].toUpperCase();
  const seasonNumber = (season) => Number((String(season || "").match(/\d+/) || [0])[0]);
  const latestSeason = () => (state.index?.seasons || []).slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season)).at(-1)?.season || "season-1";
  const seasonLabel = (season) => (state.index?.seasons || []).find((item) => item.season === season)?.label || season;
  const logoFor = (team) => LOGO_MAP[String(team || "").toLowerCase()] ? `${LOGO_ROOT}${LOGO_MAP[String(team || "").toLowerCase()]}` : "";
  const teamLink = (file, label) => `<a href="team.htm?id=${encodeURIComponent(fileStem(file))}">${esc(label || fileStem(file))}</a>`;
  const playerLink = (season, file, label) => {
    const key = state.playerIndex?.seasonMaps?.[season]?.[file] || "";
    return key ? `<a href="player.htm?key=${encodeURIComponent(key)}">${esc(label)}</a>` : esc(label);
  };
  const percent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return n <= 1 ? `${Math.round(n * 1000) / 10}%` : `${Math.round(n * 10) / 10}%`;
  };

  function heightTextFromInches(value) {
    const inches = Number(value);
    if (!Number.isFinite(inches) || inches <= 0) return "";
    return `${Math.floor(inches / 12)}-${inches % 12}`;
  }

  function youthPlayerLink(player) {
    const name = String(player?.name || "").trim();
    if (!name) return "";
    const height = heightTextFromInches(player.Height);
    const candidates = (state.playerIndex?.identities || []).filter((identity) => {
      if (String(identity.name || "").toLowerCase() !== name.toLowerCase()) return false;
      return !height || String(identity.height || "") === height;
    });
    if (candidates.length === 1) {
      return `<a href="player.htm?key=${encodeURIComponent(candidates[0].key)}">${esc(name)}</a>`;
    }
    return esc(name);
  }

  async function fetchJson(path, fallback) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (_error) {
      return fallback;
    }
  }

  async function initCore() {
    if (state.coreReady) return state.coreReady;
    state.coreReady = (async () => {
    state.index = await fetchJson(`${HISTORY_ROOT}index.json`, { seasons: [] });
    state.playerIndex = await fetchJson(`${HISTORY_ROOT}player_index.json`, { identities: [], seasonMaps: {} });
    state.currentTeams = await fetchJson(`${CURRENT_DB}teams.json`, []);
    state.currentPlayers = await fetchJson(`${CURRENT_DB}players.json`, []);
    renderTopbar();
    })();
    return state.coreReady;
  }

  async function loadSeason(season) {
    if (state.seasonCache.has(season)) return state.seasonCache.get(season);
    const base = `${HISTORY_ROOT}${season}/database/`;
    const data = {
      season,
      players: await fetchJson(`${base}players.json`, []),
      playerStats: await fetchJson(`${base}player_stats.json`, { players: [] }),
      standings: await fetchJson(`${base}standings.json`, { sections: [] }),
      leaders: await fetchJson(`${base}leaders.json`, { sections: [] }),
      teams: await fetchJson(`${base}teams.json`, []),
      teamStats: await fetchJson(`${base}team_stats.json`, { teams: [] }),
      awards: await fetchJson(`${base}awards.json`, { sections: [] }),
      seasonAwards: await fetchJson(`${base}season_awards.json`, { sections: [], missing: true }),
      youth: await fetchJson(`${base}youth_intake.json`, { teams: [] }),
      supercupStandings: await fetchJson(`${base}supercup/standings.json`, { sections: [] }),
      supercupLeaders: await fetchJson(`${base}supercup/leaders.json`, { sections: [] }),
      supercupResults: await fetchJson(`${base}supercup/game_results.json`, { results: [] })
    };
    state.seasonCache.set(season, data);
    return data;
  }

  async function allSeasonData() {
    return Promise.all((state.index?.seasons || []).map((s) => loadSeason(s.season)));
  }

  function ratingClass(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "rating-orange";
    if (n >= 151) return "rating-purple";
    if (n >= 115) return "rating-blue";
    if (n >= 100) return "rating-green";
    if (n >= 80) return "rating-yellow";
    return "rating-orange";
  }

  function ratingChip(label, value) {
    const text = value === undefined || value === null || value === "" ? "-" : value;
    return `<span class="rating-chip ${ratingClass(text)}">${esc(label)} ${esc(text)}</span>`;
  }

  function table(headers, rows, empty = "Archived feed unavailable") {
    if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
    return `<div class="table-wrap"><table class="ref-table sortable-table"><thead><tr>${headers.map((h, index) => `<th class="sortable" data-sort-index="${index}" tabindex="0" role="button" aria-sort="none">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function cellSortValue(cell) {
    const raw = (cell?.textContent || "").trim();
    if (!raw) return { type: "text", value: "" };
    const recordMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    if (recordMatch) {
      const wins = Number(recordMatch[1]);
      const losses = Number(recordMatch[2]);
      return { type: "number", value: wins - losses + wins / 1000 };
    }
    const numeric = Number(raw.replace(/[$,%]/g, "").replace(/,/g, ""));
    if (Number.isFinite(numeric)) return { type: "number", value: numeric };
    return { type: "text", value: raw.toLowerCase() };
  }

  function compareSortValues(a, b, direction) {
    if (a.type === "number" && b.type === "number") {
      return (a.value - b.value) * direction;
    }
    return String(a.value).localeCompare(String(b.value), undefined, { numeric: true, sensitivity: "base" }) * direction;
  }

  function sortTableByHeader(header) {
    const tableEl = header.closest("table");
    const tbody = tableEl?.querySelector("tbody");
    if (!tableEl || !tbody) return;
    const index = Number(header.dataset.sortIndex);
    const current = header.getAttribute("aria-sort");
    const next = current === "ascending" ? "descending" : "ascending";
    const direction = next === "ascending" ? 1 : -1;
    const rows = Array.from(tbody.querySelectorAll("tr"));

    rows.sort((rowA, rowB) => {
      const result = compareSortValues(cellSortValue(rowA.children[index]), cellSortValue(rowB.children[index]), direction);
      if (result !== 0) return result;
      return Number(rowA.dataset.originalIndex || 0) - Number(rowB.dataset.originalIndex || 0);
    });

    tableEl.querySelectorAll("th.sortable").forEach((th) => {
      th.setAttribute("aria-sort", "none");
      th.classList.remove("sort-asc", "sort-desc");
    });
    header.setAttribute("aria-sort", next);
    header.classList.toggle("sort-asc", next === "ascending");
    header.classList.toggle("sort-desc", next === "descending");
    rows.forEach((row) => tbody.appendChild(row));
  }

  function setupSortableTables(root = document) {
    root.querySelectorAll("table.sortable-table").forEach((tableEl) => {
      tableEl.querySelectorAll("tbody tr").forEach((row, index) => {
        if (!row.dataset.originalIndex) row.dataset.originalIndex = String(index);
      });
    });
  }

  document.addEventListener("click", (event) => {
    const header = event.target.closest?.("th.sortable");
    if (header) sortTableByHeader(header);
  });

  document.addEventListener("keydown", (event) => {
    const header = event.target.closest?.("th.sortable");
    if (!header || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    sortTableByHeader(header);
  });

  function seasonSelector(selected, id = "seasonSelect") {
    return `<select id="${id}">${(state.index?.seasons || []).map((s) => `<option value="${esc(s.season)}" ${s.season === selected ? "selected" : ""}>${esc(s.label || s.season)}</option>`).join("")}</select>`;
  }

  function isRealCurrentTeam(player) {
    const teamIds = new Set((state.currentTeams || []).map((t) => fileStem(t.file || t.url || t.id)));
    const teamNames = new Set((state.currentTeams || []).map((t) => String(t.name || "").toLowerCase()));
    return teamIds.has(fileStem(player.team)) || teamNames.has(String(player.teamLabel || player.team || "").toLowerCase());
  }

  function currentPlayerForIdentity(identity) {
    return (state.currentPlayers || []).find((player) =>
      String(player.name || "").toLowerCase() === String(identity.name || "").toLowerCase()
      && String(player.ht || "") === String(identity.height || "")
    ) || null;
  }

  function identityStatus(identity) {
    const player = currentPlayerForIdentity(identity);
    if (!player) return { label: "Retired", key: "retired" };
    const team = String(player.teamLabel || player.team || "").trim().toLowerCase();
    if (team === "draft") return { label: "Incoming Prospect", key: "prospect" };
    if (team === "fa" || team === "free agent" || team === "free agents") return { label: "Free Agent", key: "free-agent" };
    if (isRealCurrentTeam(player)) return { label: "Active", key: "active" };
    return { label: "Free Agent", key: "free-agent" };
  }

  function isIdentityActive(identity) {
    return identityStatus(identity).key === "active";
  }

  function identityForSeasonPlayer(season, playerFile) {
    const key = state.playerIndex?.seasonMaps?.[season]?.[playerFile] || "";
    return key ? (state.playerIndex?.identities || []).find((identity) => identity.key === key) : null;
  }

  function allTeamsFromLatest(seasonData) {
    const seen = new Set();
    return (seasonData.standings.sections || []).flatMap((section) => (section.teams || []).map((team, index) => {
      const id = fileStem(team.rosterFile);
      if (seen.has(id)) return null;
      seen.add(id);
      return {
        ...team,
        id,
        tier: tierFromTitle(section.title),
        position: index + 1,
        teamCount: (section.teams || []).length
      };
    })).filter(Boolean);
  }

  function tierSortValue(tier) {
    const order = { CLB: 1, ELB: 2, ECL: 3 };
    return order[String(tier || "").toUpperCase()] || 9;
  }

  function teamOverallRank(row) {
    return (tierSortValue(row.tier) - 1) * Math.max(18, row.teamCount || 18) + Number(row.position || 0);
  }

  async function bestPlayerForTeam(season, teamId) {
    const data = await loadSeason(season);
    return (data.players || [])
      .filter((player) => fileStem(player.team) === teamId || fileStem(player.teamFile) === teamId)
      .sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || null;
  }

  function leaderCategories(data) {
    return (data.leaders.sections || []).flatMap((section) => (section.categories || []).map((category) => ({
      tier: tierFromTitle(section.title),
      section,
      category
    })));
  }

  async function rankedPlayers({ activeOnly = false, limit = 12 } = {}) {
    return (state.playerIndex?.identities || []).map((identity) => {
      const peak = (identity.appearances || []).slice().sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || {};
      return {
        key: identity.key,
        name: identity.name,
        pos: peak.pos,
        team: peak.team,
        season: peak.season,
        overall: num(peak.overall) || 0,
        potential: peak.potential,
        identity
      };
    })
      .filter((row) => !activeOnly || isIdentityActive(row.identity))
      .sort((a, b) => b.overall - a.overall)
      .slice(0, limit);
  }

  function renderTopbar() {
    const host = $("#history-topbar");
    if (!host) return;
    host.innerHTML = `
      <header class="history-topbar">
        <div class="history-brand-row">
          <a class="history-brand" href="index.htm">
            <img class="history-logo" src="${SITE_LOGO}" alt="">
            <span><span class="history-title">European Superleague</span><span class="history-subtitle">History</span></span>
          </a>
          <form class="history-search" id="historySearch">
            <input id="historySearchInput" type="search" autocomplete="off" placeholder="Enter Person, Team, Section, etc">
            <button type="submit">Search</button>
            <div class="history-results" id="historyResults"></div>
          </form>
          <a class="history-index-button" href="../../../index.htm">Back to Index</a>
        </div>
        <nav class="history-nav">
          <div class="history-nav-item"><a class="history-nav-link" href="index.htm">Archive Home</a><div class="history-mega" id="megaHome"><div class="mega-line"><strong>Jump:</strong> <a href="players.htm">Players</a> | <a href="teams.htm">Teams</a> | <a href="leaders.htm">Leaders</a> | <a href="compare.htm">Compare</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="players.htm">Players</a><div class="history-mega" id="megaPlayers"><div class="empty">Loading greats...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="teams.htm">Teams</a><div class="history-mega" id="megaTeams"><div class="empty">Loading teams...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="season.htm">Seasons</a><div class="history-mega" id="megaSeasons"></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="leaders.htm">Leaders</a><div class="history-mega"><div class="mega-line"><strong>Leaderboards:</strong> <a href="leaders.htm">Player Leaders</a> | <a href="season.htm">Season Summaries</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="supercup.htm">Super Cup</a><div class="history-mega"><div class="mega-line"><strong>Cup Archive:</strong> <a href="supercup.htm#knockout">Knockout Bracket</a> | <a href="supercup.htm#group-stage">Group Stage</a> | <a href="supercup.htm#cup-leaders">Stat Leaders</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="youth-intake.htm">Youth Intake</a><div class="history-mega"><div class="mega-line"><strong>Draft History:</strong> <a href="youth-intake.htm">Youth Intake by Season</a> | <a href="youth-intake.htm#franchise">Franchise Intake History</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="compare.htm">Compare</a><div class="history-mega"><div class="mega-line"><strong>Compare:</strong> <a href="compare.htm?type=players">Players</a> | <a href="compare.htm?type=teams">Teams</a></div></div></div>
        </nav>
      </header>`;
    setupSearch();
    renderMegaMenus();
  }

  async function renderMegaMenus() {
    const allTime = await rankedPlayers({ limit: 10 });
    const active = await rankedPlayers({ activeOnly: true, limit: 10 });
    $("#megaPlayers").innerHTML = `
      <div class="mega-line"><strong>All-Time Greats:</strong> ${allTime.map((p) => `<a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a>`).join(" | ") || "No archived players"}</div>
      <div class="mega-line"><strong>Active Greats:</strong> ${active.map((p) => `<a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a>`).join(" | ") || "No active matches"}</div>`;

    const season = await loadSeason(latestSeason());
    $("#megaTeams").innerHTML = `<div class="mega-grid">${(season.standings.sections || []).map((section) => `
      <div><strong>${esc(tierFromTitle(section.title))}</strong><div class="mega-line">${(section.teams || []).map((team) => teamMini(team.team, team.rosterFile)).join("")}</div></div>`).join("")}</div>`;

    $("#megaSeasons").innerHTML = (state.index?.seasons || []).map((seasonItem) => `
      <div class="mega-line"><strong>${esc(seasonItem.label || seasonItem.season)}:</strong>
        <a href="season.htm?season=${encodeURIComponent(seasonItem.season)}">Summary</a> |
        <a href="season.htm?season=${encodeURIComponent(seasonItem.season)}#standings">Standings</a> |
        <a href="leaders.htm?season=${encodeURIComponent(seasonItem.season)}">Leaders</a> |
        <a href="supercup.htm?season=${encodeURIComponent(seasonItem.season)}">Super Cup</a> |
        <a href="youth-intake.htm?season=${encodeURIComponent(seasonItem.season)}">Youth Intake</a>
      </div>`).join("");
  }

  function teamMini(teamName, file) {
    const logo = logoFor(teamName);
    return `<span class="team-mini">${logo ? `<img src="${logo}" alt="">` : ""}${teamLink(file, teamName)}</span>`;
  }

  function setupSearch() {
    const form = $("#historySearch");
    const input = $("#historySearchInput");
    const results = $("#historyResults");
    if (!form || !input || !results) return;
    const run = async () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        results.style.display = "none";
        results.innerHTML = "";
        return;
      }
      const season = await loadSeason(latestSeason());
      const playerRows = (state.playerIndex?.identities || [])
        .filter((p) => String(p.name || "").toLowerCase().includes(query))
        .slice(0, 8)
        .map((p) => `<a class="history-result" href="player.htm?key=${encodeURIComponent(p.key)}"><span>${esc(p.name)}</span><small>Player</small></a>`);
      const teamRows = (season.teams || [])
        .filter((t) => String(t.name || "").toLowerCase().includes(query))
        .slice(0, 8)
        .map((t) => `<a class="history-result" href="team.htm?id=${encodeURIComponent(fileStem(t.file || t.id))}"><span>${esc(t.name)}</span><small>Team</small></a>`);
      const seasonRows = (state.index?.seasons || [])
        .filter((s) => `${s.season} ${s.label || ""}`.toLowerCase().includes(query))
        .slice(0, 4)
        .map((s) => `<a class="history-result" href="season.htm?season=${encodeURIComponent(s.season)}"><span>${esc(s.label || s.season)}</span><small>Season</small></a>`);
      const keywordLinks = [
        { terms: ["home", "archive", "dashboard"], label: "Archive Home", href: "index.htm" },
        { terms: ["players", "greats", "active", "retired"], label: "Player Directory", href: "players.htm" },
        { terms: ["teams", "clubs", "franchises"], label: "Team Directory", href: "teams.htm" },
        { terms: ["season", "standings", "champions", "promoted", "promotion", "relegated", "relegation"], label: "Season Summary", href: "season.htm" },
        { terms: ["leaders", "leaderboard", "mvp", "points", "rebounds", "assists"], label: "Leaderboards", href: "leaders.htm" },
        { terms: ["super cup", "supercup", "cup", "knockout", "bracket", "group stage"], label: "Super Cup Archive", href: "supercup.htm" },
        { terms: ["youth", "intake", "draft", "rookies"], label: "Youth Intake", href: "youth-intake.htm" },
        { terms: ["compare", "versus", "vs"], label: "Compare Players and Teams", href: "compare.htm" }
      ];
      const sectionRows = keywordLinks
        .filter((item) => item.terms.some((term) => term.includes(query) || query.includes(term)))
        .map((item) => `<a class="history-result" href="${item.href}"><span>${esc(item.label)}</span><small>Section</small></a>`);
      results.innerHTML = [...playerRows, ...teamRows, ...seasonRows, ...sectionRows].join("") || `<div class="history-result"><span>No archive matches</span><small>Try a player, team, award, season, or promotion term</small></div>`;
      results.style.display = "block";
    };
    input.addEventListener("input", run);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const first = $(".history-result", results);
      if (first?.href) navigate(first.href);
    });
    document.addEventListener("click", (event) => {
      if (!form.contains(event.target)) results.style.display = "none";
    });
  }

  function renderStandings(seasonData) {
    return (seasonData.standings.sections || []).map((section) => `
      <section class="reference-section" id="${slug(section.title)}">
        <h2>${esc(section.title)}</h2>
        ${table(["#", "Team", "W-L", "PCT", "GB", "PF", "PA", "DIFF", "L10", "Streak"], (section.teams || []).map((team, index) => {
          const tier = tierFromTitle(section.title);
          const position = index + 1;
          const rowClass = standingsHighlightClass(tier, position, (section.teams || []).length);
          return `<tr class="${rowClass}"><td class="num">${position}</td><td>${teamMini(team.team, team.rosterFile)}</td><td class="num">${team.wins}-${team.losses}</td><td class="num">${esc(team.pct)}</td><td class="num">${esc(team.gb)}</td><td class="num">${esc(team.pf)}</td><td class="num">${esc(team.pa)}</td><td class="num">${esc(team.diff)}</td><td class="num">${esc(team.last10)}</td><td class="num">${esc(team.streak)}</td></tr>`;
        }))}
      </section>`).join("");
  }

  function statHeaderKeys(headers) {
    const counts = {};
    return (headers || []).map((header) => {
      let key = String(header || "").toLowerCase().replace("+/-", "plus_minus").replace("%", "_pct");
      key = key.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "value";
      counts[key] = (counts[key] || 0) + 1;
      return counts[key] > 1 ? `${key}_${counts[key]}` : key;
    });
  }

  function renderPlayerStatTable(stat, selectedTable) {
    const stats = stat?.stats || {};
    const keys = Object.keys(stats);
    if (!keys.length) return { controls: "", tableHtml: table([], [], "No archived player stats") };
    const tableKey = keys.includes(selectedTable) ? selectedTable : keys[0];
    const statTable = stats[tableKey] || {};
    const headers = statTable.headers || [];
    const rowKeys = statHeaderKeys(headers);
    const rows = (statTable.rows || []).map((row) => `<tr>${rowKeys.map((key) => {
      const value = row[key] ?? "";
      const numberish = value !== "" && Number.isFinite(Number(String(value).replace(/,/g, "")));
      return `<td class="${numberish ? "num" : ""}">${esc(value)}</td>`;
    }).join("")}</tr>`);

    const controls = `<div class="selector-row"><label for="playerStatTable"><strong>Table</strong></label><select id="playerStatTable">${keys.map((key) => `<option value="${esc(key)}" ${key === tableKey ? "selected" : ""}>${esc(stats[key].title || key.replace(/_/g, " "))}</option>`).join("")}</select></div>`;
    const tableOnly = table(headers, rows, "No archived rows for this table")
      .replace('class="table-wrap"', 'class="table-wrap player-stats-table-wrap"');
    return {
      controls,
      title: statTable.title || "Player Stats",
      tableOnly,
      tableHtml: `<div id="playerStatsTableTitle" class="eyebrow">${esc(statTable.title || "Player Stats")}</div><div id="playerStatsTableBody">${tableOnly}</div>`,
      tableKey
    };
  }

  function replacePlayerStatTable(stat, selectedTable) {
    const nextView = renderPlayerStatTable(stat, selectedTable);
    const titleEl = $("#playerStatsTableTitle");
    const bodyEl = $("#playerStatsTableBody");
    if (titleEl) titleEl.textContent = nextView.title || "Player Stats";
    if (bodyEl) {
      bodyEl.innerHTML = nextView.tableOnly;
      setupSortableTables(bodyEl);
    }
  }

  function renderTeamStatsTable(seasonData) {
    const rows = (seasonData.teamStats.teams || []).map((team) => {
      const stats = team.stats || {};
      const points = stats.points || {};
      const rebounds = stats.rebounds || {};
      const assists = stats.assists || {};
      const fg = stats.fg_pct || {};
      const defense = stats.blocks || {};
      return `<tr><td>${teamMini(team.team, team.file)}</td><td class="num">${esc(points.team?.value)}</td><td class="num">${esc(points.opponent?.value)}</td><td class="num">${esc(points.margin?.value)}</td><td class="num">${esc(rebounds.team?.value)}</td><td class="num">${esc(assists.team?.value)}</td><td class="num">${esc(fg.team?.value)}</td><td class="num">${esc(defense.team?.value)}</td></tr>`;
    });
    return table(["Team", "PTS", "OPP PTS", "Margin", "REB", "AST", "FG%", "BLK"], rows, "Archived team stats unavailable");
  }

  function renderLeaderCards(seasonData, limit = 3) {
    const cats = (seasonData.leaders.sections || []).flatMap((section) => (section.categories || []).map((category) => ({ tier: tierFromTitle(section.title), category }))).slice(0, 6);
    return cats.map(({ tier, category }) => `
      <section class="reference-section">
        <h2>${esc(category.title)} Leaders <span class="muted">${esc(tier)}</span></h2>
        ${table(["#", "Player", "Team", "Value"], (category.leaders || []).slice(0, limit).map((leader) => `
          <tr><td class="num">${esc(leader.rank)}</td><td>${playerLink(seasonData.season, leader.playerFile, leader.player)}</td><td>${teamLink(leader.teamFile, leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`))}
      </section>`).join("");
  }

  async function dashboardFacts(season) {
    const teams = allTeamsFromLatest(season);
    const champion = teams.slice().sort((a, b) => teamOverallRank(a) - teamOverallRank(b))[0] || {};
    const promoted = teams.filter((row) => movementMarker(row.tier, row.position, row.teamCount) === "P");
    const relegated = teams.filter((row) => movementMarker(row.tier, row.position, row.teamCount) === "R");
    const allTime = await rankedPlayers({ limit: 1 });
    const active = await rankedPlayers({ activeOnly: true, limit: 1 });
    return { teams, champion, promoted, relegated, allTime: allTime[0], active: active[0] };
  }

  function dashboardCard(label, title, body, href = "") {
    const inner = `<div class="dashboard-card-label">${esc(label)}</div><strong>${title}</strong><p>${body}</p>`;
    return href ? `<a class="dashboard-card" href="${href}">${inner}</a>` : `<div class="dashboard-card">${inner}</div>`;
  }

  function renderQuickLinks() {
    return `
      <div class="quick-link-grid">
        <a href="players.htm"><span>Players</span><strong>All-time and active greats</strong></a>
        <a href="teams.htm"><span>Teams</span><strong>Club histories and timelines</strong></a>
        <a href="leaders.htm"><span>Leaders</span><strong>Filtered season leaderboards</strong></a>
        <a href="supercup.htm"><span>Super Cup</span><strong>Knockouts, groups and leaders</strong></a>
        <a href="compare.htm"><span>Compare</span><strong>Player and team head-to-heads</strong></a>
      </div>`;
  }

  async function renderIndex() {
    const season = await loadSeason(latestSeason());
    const facts = await dashboardFacts(season);
    const allTimeGreats = await rankedPlayers({ limit: 8 });
    const activeGreats = await rankedPlayers({ activeOnly: true, limit: 8 });
    $("#history-app").innerHTML = `
      <section class="dashboard-grid">
        ${dashboardCard("Top Club", teamMini(facts.champion.team, facts.champion.rosterFile), `${esc(facts.champion.wins)}-${esc(facts.champion.losses)} in ${esc(facts.champion.tier)} with a ${esc(facts.champion.diff)} point diff.`)}
        ${dashboardCard("All-Time Peak", `<a href="player.htm?key=${encodeURIComponent(facts.allTime?.key || "")}">${esc(facts.allTime?.name || "No player")}</a>`, `${ratingChip("OVR", facts.allTime?.overall)} ${esc(facts.allTime?.team || "")} | ${esc(seasonLabel(facts.allTime?.season))}`)}
        ${dashboardCard("Active Legend", `<a href="player.htm?key=${encodeURIComponent(facts.active?.key || "")}">${esc(facts.active?.name || "No active player")}</a>`, `${facts.active ? `${ratingChip("OVR", facts.active.overall)} ${esc(facts.active.team || "")}` : "No active historical match yet."}`)}
        ${dashboardCard("Movement Watch", "Promotion / Relegation", `${facts.promoted.map((team) => esc(team.team)).join(", ") || "No promotion spots"}${facts.relegated.length ? ` | Down: ${facts.relegated.map((team) => esc(team.team)).join(", ")}` : ""}`, "season.htm#standings")}
      </section>
      ${renderQuickLinks()}
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Latest Season Standings</h2>${renderStandings(season)}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Season Index</h2>${table(["Season", "Summary", "Leaders", "Super Cup", "Youth"], (state.index.seasons || []).map((s) => `<tr><td>${esc(s.label || s.season)}</td><td><a href="season.htm?season=${s.season}">Summary</a></td><td><a href="leaders.htm?season=${s.season}">Leaders</a></td><td><a href="supercup.htm?season=${s.season}">Cup</a></td><td><a href="youth-intake.htm?season=${s.season}">Youth Intake</a></td></tr>`))}</section>
          <section class="reference-section"><h2>All-Time Greats</h2>${table(["Player", "Peak", "Season"], allTimeGreats.map((p) => `<tr><td><a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a></td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`), "No archived players")}</section>
          <section class="reference-section"><h2>Current Greats</h2>${table(["Player", "Peak", "Season"], activeGreats.map((p) => `<tr><td><a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a></td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`), "No active historical matches")}</section>
          <section class="reference-section"><h2>Team Directory</h2><div class="mega-grid">${(season.standings.sections || []).map((section) => `<div><h3>${esc(tierFromTitle(section.title))}</h3>${(section.teams || []).map((team) => `<div>${teamMini(team.team, team.rosterFile)}</div>`).join("")}</div>`).join("")}</div></section>
        </div>
      </div>
      <section class="reference-section"><h2>Leader Snapshot</h2><div class="history-grid three">${renderLeaderCards(season, 3)}</div></section>`;
  }

  async function renderPlayersDirectory() {
    const suffixes = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
    const lastName = (name) => {
      const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
      while (parts.length > 1 && suffixes.has(parts.at(-1).toLowerCase())) parts.pop();
      return parts.at(-1) || "";
    };
    const players = (state.playerIndex?.identities || [])
      .filter((player) => (player.appearances || []).some((appearance) => (num(appearance.overall) || 0) >= 50))
      .slice()
      .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: "base" }) || String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const sections = letters.map((letter) => {
      const rows = players.filter((player) => lastName(player.name).charAt(0).toUpperCase() === letter);
      if (!rows.length) return "";
      return `<section class="reference-section alphabet-section" id="letter-${letter}"><h2>${letter}</h2><div class="alphabet-name-grid">${rows.map((player) => `<a href="player.htm?key=${encodeURIComponent(player.key)}">${esc(player.name)}</a>`).join("")}</div></section>`;
    }).join("");
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls alphabet-controls"><h2>Players by Last Name</h2><div class="alphabet-jump">${letters.map((letter) => players.some((player) => lastName(player.name).charAt(0).toUpperCase() === letter) ? `<a href="#letter-${letter}">${letter}</a>` : `<span>${letter}</span>`).join("")}</div></section>
      ${sections || `<section class="reference-section"><div class="empty">No archived players</div></section>`}`;
  }

  async function renderTeamsDirectory() {
    const season = await loadSeason(latestSeason());
    const teams = allTeamsFromLatest(season);
    $("#history-app").innerHTML = `
      <section class="team-directory-grid">${teams.map((team) => `
        <a class="team-directory-card" href="team.htm?id=${encodeURIComponent(team.id)}">
          ${logoFor(team.team) ? `<img src="${logoFor(team.team)}" alt="">` : ""}
          <span><strong>${esc(team.team)}</strong><small>${esc(team.tier)} #${esc(team.position)} | ${esc(team.wins)}-${esc(team.losses)} | Diff ${esc(team.diff)}</small></span>
          ${movementBadge(movementMarker(team.tier, team.position, team.teamCount))}
        </a>`).join("")}</section>`;
  }

  function findIdentityByParam() {
    const p = params();
    const key = p.get("key");
    if (key) return (state.playerIndex.identities || []).find((item) => item.key === key);
    const id = p.get("id");
    if (!id) return null;
    const file = id.endsWith(".htm") ? id : `${id}.htm`;
    const mappedKey = Object.values(state.playerIndex.seasonMaps || {}).map((map) => map[file]).find(Boolean);
    return (state.playerIndex.identities || []).find((item) => item.key === mappedKey);
  }

  function sparklineChart(series, keys, options = {}) {
    const rows = series.filter((row) => keys.some((key) => Number.isFinite(num(row[key]))));
    if (!rows.length) return `<div class="empty">No chartable archive values yet</div>`;
    const width = options.width || 500;
    const height = options.height || 165;
    const pad = { top: 14, right: 16, bottom: 26, left: 38 };
    const values = rows.flatMap((row) => keys.map((key) => num(row[key])).filter((value) => Number.isFinite(value)));
    const min = Math.min(options.min ?? Math.min(...values), Math.min(...values));
    const max = Math.max(options.max ?? Math.max(...values), Math.max(...values));
    const range = Math.max(1, max - min);
    const x = (index) => pad.left + (rows.length === 1 ? (width - pad.left - pad.right) / 2 : index * ((width - pad.left - pad.right) / (rows.length - 1)));
    const y = (value) => pad.top + (max - value) * ((height - pad.top - pad.bottom) / range);
    const colors = ["#0645ad", "#a66400", "#16833a", "#d71920"];
    const lines = keys.map((key, keyIndex) => {
      const points = rows.map((row, index) => `${x(index)},${y(num(row[key]) || min)}`).join(" ");
      const dots = rows.map((row, index) => {
        const extra = typeof options.tooltipExtra === "function" ? options.tooltipExtra(row, key) : "";
        return `<circle cx="${x(index)}" cy="${y(num(row[key]) || min)}" r="3"><title>${esc(row.label)} ${esc(key)}: ${esc(row[key])}${extra ? ` | ${esc(extra)}` : ""}</title></circle>`;
      }).join("");
      return `<g class="chart-series chart-series-${keyIndex}" style="--series-color:${colors[keyIndex % colors.length]}"><polyline points="${points}"></polyline>${dots}</g>`;
    }).join("");
    const labels = rows.map((row, index) => `<text x="${x(index)}" y="${height - 10}" text-anchor="middle">${esc(row.shortLabel || row.label)}</text>`).join("");
    const legend = keys.map((key, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${esc(key)}</span>`).join("");
    return `<div class="chart-wrap"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || "Archive chart")}">
      <line class="chart-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
      <line class="chart-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}"></line>
      <text class="chart-y" x="8" y="${pad.top + 4}">${esc(max)}</text>
      <text class="chart-y" x="8" y="${height - pad.bottom}">${esc(min)}</text>
      ${lines}${labels}
    </svg><div class="chart-legend">${legend}</div></div>`;
  }

  function renderCareerChart(snapshots) {
    const rows = snapshots.map(({ season, player }) => ({
      label: seasonLabel(season),
      shortLabel: seasonLabel(season).replace(/^Season\s*/i, "S"),
      OVR: num(player.overall),
      POT: num(player.potential),
      Age: num(player.age)
    }));
    const values = rows.flatMap((row) => [row.OVR, row.POT].filter((value) => Number.isFinite(value)));
    const lowerCutoff = values.length ? Math.max(0, Math.floor((Math.min(...values) - 8) / 10) * 10) : 0;
    const upperCutoff = values.length ? Math.min(180, Math.ceil((Math.max(...values) + 8) / 10) * 10) : 180;
    return sparklineChart(rows, ["OVR", "POT"], {
      label: "Player career rating chart",
      min: lowerCutoff,
      max: Math.max(lowerCutoff + 10, upperCutoff),
      tooltipExtra: (row) => Number.isFinite(row.Age) ? `Age: ${row.Age}` : ""
    });
  }

  function teamPositionChart(positionHistory) {
    if (!positionHistory.length) return `<div class="empty">No archived position history</div>`;
    const width = 560;
    const height = 190;
    const pad = { top: 14, right: 16, bottom: 28, left: 46 };
    const tierSize = Math.max(18, ...positionHistory.map((row) => row.standing.teamCount || 18));
    const maxRank = tierSize * 3;
    const x = (index) => pad.left + (positionHistory.length === 1 ? (width - pad.left - pad.right) / 2 : index * ((width - pad.left - pad.right) / (positionHistory.length - 1)));
    const y = (rank) => pad.top + (rank - 1) * ((height - pad.top - pad.bottom) / Math.max(1, maxRank - 1));
    const points = positionHistory.map(({ standing }, index) => `${x(index)},${y(teamOverallRank(standing))}`).join(" ");
    const bands = ["CLB", "ELB", "ECL"].map((tier, index) => {
      const y1 = y(index * tierSize + 1);
      const y2 = y((index + 1) * tierSize);
      return `<rect class="tier-band tier-band-${index}" x="${pad.left}" y="${y1}" width="${width - pad.left - pad.right}" height="${Math.max(1, y2 - y1)}"></rect><text class="tier-label" x="12" y="${(y1 + y2) / 2 + 4}">${tier}</text>`;
    }).join("");
    const dots = positionHistory.map(({ season, standing }, index) => {
      const marker = movementMarker(standing.tier, standing.position, standing.teamCount);
      const rank = teamOverallRank(standing);
      return `<g class="position-dot ${marker === "C" ? "champion" : marker === "P" ? "promoted" : marker === "R" ? "relegated" : ""}">
        <circle cx="${x(index)}" cy="${y(rank)}" r="4"></circle>
        ${marker ? `<text x="${x(index) + 9}" y="${y(rank) + 4}" text-anchor="start">${marker}</text>` : ""}
        <title>${esc(seasonLabel(season))}: ${esc(standing.tier)} #${esc(standing.position)}, ${esc(standing.wins)}-${esc(standing.losses)}, Diff ${esc(standing.diff)}</title>
      </g>`;
    }).join("");
    const labels = positionHistory.map(({ season }, index) => `<text x="${x(index)}" y="${height - 12}" text-anchor="middle">${esc(seasonLabel(season).replace(/^Season\s*/i, "S"))}</text>`).join("");
    return `<div class="chart-wrap"><svg class="history-chart position-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="All-tier league position chart">${bands}<polyline class="position-line" points="${points}"></polyline>${dots}${labels}</svg></div>`;
  }

  async function renderTeamTimeline(positionHistory, id) {
    const rows = await Promise.all(positionHistory.map(async ({ season, standing }) => {
      const best = await bestPlayerForTeam(season, id);
      const marker = movementMarker(standing.tier, standing.position, standing.teamCount);
      return `<article class="timeline-card">
        <div><strong>${esc(seasonLabel(season))}</strong><span>${esc(standing.tier)} #${esc(standing.position)}</span></div>
        <p>${esc(standing.wins)}-${esc(standing.losses)} (${percent(standing.pct)}) | Diff ${esc(standing.diff)} | ${esc(standing.last10 || "")}</p>
        <p>Best player: ${best ? playerLink(season, String(best.url || "").split("/").pop(), best.name) + ` ${ratingChip("OVR", best.overall)}` : "Unavailable"}</p>
        ${movementBadge(marker)}
      </article>`;
    }));
    return `<div class="timeline-grid">${rows.join("")}</div>`;
  }

  async function renderPlayer() {
    const identity = findIdentityByParam();
    if (!identity) {
      $("#history-app").innerHTML = `<section class="history-hero"><h1>Player Not Found</h1><p class="muted">Use a history player key from search or an archived season map.</p></section>`;
      return;
    }
    const appearances = identity.appearances || [];
    const snapshots = [];
    const statSnapshots = [];
    const accoladeRows = [];
    for (const appearance of appearances) {
      const data = await loadSeason(appearance.season);
      const player = (data.players || []).find((p) => String(p.url || "").endsWith(appearance.playerFile)) || {};
      snapshots.push({ season: appearance.season, player });
      const stat = (data.playerStats.players || []).find((p) => String(p.url || "").endsWith(appearance.playerFile) || p.name === identity.name);
      if (stat) statSnapshots.push({ season: appearance.season, stat });
      (player.awards || []).forEach((award) => accoladeRows.push(`<tr><td>${esc(seasonLabel(appearance.season))}</td><td>${esc(award.season)}</td><td>${esc(award.award)}</td></tr>`));
      (data.seasonAwards.sections || []).forEach((section) => (section.awards || []).filter((award) => award.personFile === appearance.playerFile).forEach((award) => {
        accoladeRows.push(`<tr><td>${esc(seasonLabel(appearance.season))}</td><td>${esc(section.title)}</td><td>${esc(award.award)} | ${esc(award.team)}</td></tr>`);
      }));
    }
    const peak = snapshots.slice().sort((a, b) => (num(b.player.overall) || 0) - (num(a.player.overall) || 0))[0] || { player: {}, season: "" };
    const latestStats = statSnapshots.slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season)).at(-1)?.stat;
    const selectedStatTable = params().get("table") || "season_averages";
    const playerStatsView = renderPlayerStatTable(latestStats, selectedStatTable);
    const status = identityStatus(identity);
    $("#history-app").innerHTML = `
      <section class="history-hero">
        <div class="eyebrow">Historical Player</div>
        <h1>${esc(identity.name)}</h1>
        <div class="history-meta"><span class="pill status-${esc(status.key)}">${esc(status.label)}</span><span class="pill">${esc(identity.height)}</span><span class="pill">First: ${esc(seasonLabel(identity.firstSeason))}</span><span class="pill">Latest: ${esc(seasonLabel(identity.latestSeason))}</span></div>
      </section>
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Career Arc</h2>${renderCareerChart(snapshots)}</section>
          <section class="reference-section"><h2>Player Stats</h2>${playerStatsView.controls}${playerStatsView.tableHtml}</section>
          <section class="reference-section"><h2>Accolades</h2>${table(["Archive Season", "Season/Award Group", "Award"], accoladeRows, "No archived accolades")}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Peak Snapshot</h2><p><strong>${esc(seasonLabel(peak.season))}</strong> | ${esc(peak.player.pos || "")} | ${esc(peak.player.teamLabel || peak.player.team || "")}</p><p>${ratingChip("OVR", peak.player.overall)} ${ratingChip("POT", peak.player.potential)}</p>${table(["Attribute", "Value"], ATTR_KEYS.map((key) => `<tr><td>${esc(key)}</td><td class="num">${esc(peak.player[key])}</td></tr>`), "No peak attributes")}</section>
          <section class="reference-section"><h2>Archived Appearances</h2>${table(["Season", "Team", "Age", "OVR", "POT"], appearances.map((a) => `<tr><td>${esc(seasonLabel(a.season))}</td><td>${esc(a.team)}</td><td class="num">${esc(a.age)}</td><td>${ratingChip("OVR", a.overall)}</td><td>${ratingChip("POT", a.potential)}</td></tr>`))}</section>
        </div>
      </div>`;
    $("#playerStatTable")?.addEventListener("change", (event) => {
      replacePlayerStatTable(latestStats, event.target.value);
      const next = new URL(window.location.href);
      next.searchParams.set("table", event.target.value);
      window.history.replaceState({}, "", next.toString());
    });
  }

  function selectedSeasonOrLatest() {
    return params().get("season") || latestSeason();
  }

  async function renderTeam() {
    const id = fileStem(params().get("id") || params().get("team") || "");
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    const team = (data.teams || []).find((t) => fileStem(t.file || t.id) === id) || (data.standings.sections || []).flatMap((s) => s.teams || []).find((t) => fileStem(t.rosterFile) === id);
    if (!team) {
      $("#history-app").innerHTML = `<section class="history-hero"><h1>Team Not Found</h1></section>`;
      return;
    }
    const teamName = team.name || team.team;
    const rosterFile = team.file || team.rosterFile || `${id}.htm`;
    const standing = selectedTeamStanding(data, id);
    const players = (data.players || []).filter((p) => fileStem(p.team) === id || p.teamLabel === teamName).sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0));
    const teamStats = (data.teamStats.teams || []).find((row) => fileStem(row.file) === id) || {};
    const positionHistory = await teamPositionHistory(id);
    const timelineHtml = await renderTeamTimeline(positionHistory, id);
    const selectedMarker = standing.marker || "";
    $("#history-app").innerHTML = `
      <section class="history-hero profile-split">
        <div>${logoFor(teamName) ? `<img class="history-team-logo" src="${logoFor(teamName)}" alt="">` : ""}</div>
        <div><div class="eyebrow">Historical Team</div><h1>${esc(teamName)}</h1><div class="history-meta"><span class="pill">${esc(standing.tier || "Archive")}</span><span class="pill">#${esc(standing.position || "-")}</span><span class="pill">${esc(standing.wins)}-${esc(standing.losses)}</span><span class="pill">Diff ${esc(standing.diff)}</span>${movementBadge(selectedMarker)}${seasonSelector(selected)}</div></div>
      </section>
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>League Position Chart</h2>${teamPositionChart(positionHistory)}</section>
          <section class="reference-section"><h2>Timeline Cards</h2>${timelineHtml}</section>
          <section class="reference-section"><h2>Season Position History</h2>${table(["Season", "Tier", "Pos", "W-L", "PCT", "GB", "Diff", "Move"], positionHistory.map(({ season, standing: row }) => `<tr><td>${esc(seasonLabel(season))}</td><td>${esc(row.tier)}</td><td class="num">${esc(row.position)}</td><td>${esc(row.wins)}-${esc(row.losses)}</td><td class="num">${esc(row.pct)}</td><td class="num">${esc(row.gb)}</td><td class="num">${esc(row.diff)}</td><td>${movementBadge(row.marker) || ""}</td></tr>`), "No archived position history")}</section>
          <section class="reference-section"><h2>Roster Snapshot</h2>${table(["Player", "Pos", "Age", "OVR", "POT", "Salary"], players.map((p) => {
            const file = String(p.url || "").split("/").pop();
            return `<tr><td>${playerLink(selected, file, p.name)}</td><td>${esc(p.pos)}</td><td class="num">${esc(p.age)}</td><td>${ratingChip("OVR", p.overall)}</td><td>${ratingChip("POT", p.potential)}</td><td class="num">${esc(p.currentSalaryText)}</td></tr>`;
          }))}</section>
          <section class="reference-section"><h2>Team Stats</h2>${renderTeamStatsTable({ teamStats: { teams: [teamStats] } })}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Season Record</h2>${table(["Tier", "W-L", "PCT", "Home", "Road", "PF", "PA", "Diff"], [`<tr><td>${esc(standing.tier)}</td><td>${esc(standing.wins)}-${esc(standing.losses)}</td><td class="num">${esc(standing.pct)}</td><td>${esc(standing.home)}</td><td>${esc(standing.road)}</td><td class="num">${esc(standing.pf)}</td><td class="num">${esc(standing.pa)}</td><td class="num">${esc(standing.diff)}</td></tr>`])}</section>
          <section class="reference-section"><h2>Awards</h2>${table(["Group", "Award", "Person"], (data.seasonAwards.sections || []).flatMap((section) => (section.awards || []).filter((award) => fileStem(award.teamFile) === id).map((award) => `<tr><td>${esc(section.title)}</td><td>${esc(award.award)}</td><td>${esc(award.person)}</td></tr>`)), "No season awards")}</section>
          <section class="reference-section"><h2>Youth Intake</h2>${renderYouthTeam(data, teamName, 5)}</section>
        </div>
      </div>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`team.htm?id=${encodeURIComponent(id)}&season=${encodeURIComponent(event.target.value)}`); });
  }

  function renderYouthTeam(data, teamName, limit = Infinity) {
    const youthTeam = (data.youth.teams || []).find((row) => row.team === teamName);
    const players = (youthTeam?.intakePlayers || []).slice(0, limit);
    return table(["Player", "Pos", "Age", "College", "INS", "JPS", "HND", "PSD"], players.map((p) => `<tr><td>${youthPlayerLink(p)}</td><td>${esc(p.Position)}</td><td class="num">${esc(p.Age)}</td><td>${esc(p.College)}</td><td class="num">${esc(p.InsideScoring)}</td><td class="num">${esc(p.JumpShot)}</td><td class="num">${esc(p.Handling)}</td><td class="num">${esc(p.PostDefense)}</td></tr>`), "No archived youth intake");
  }

  function movementMarker(tier, position, teamCount) {
    const t = String(tier || "").toUpperCase();
    if (t === "CLB" && position === 1) return "C";
    if (t === "ELB" && position <= 2) return "P";
    if (t === "ECL" && position <= 1) return "P";
    if (t === "CLB" && position > Math.max(0, teamCount - 2)) return "R";
    if (t === "ELB" && position === teamCount) return "R";
    return "";
  }

  function standingsHighlightClass(tier, position, teamCount) {
    const t = String(tier || "").toUpperCase();
    if (t === "CLB" && position === 1) return "standing-champ";
    const marker = movementMarker(tier, position, teamCount);
    if (marker === "P") return "standing-promo";
    if (marker === "R") return "standing-relegated";
    return "";
  }

  function movementBadge(marker) {
    if (marker === "C") return `<span class="pill status-champion">C</span>`;
    if (marker === "P") return `<span class="pill status-promoted">P</span>`;
    if (marker === "R") return `<span class="pill status-relegated">R</span>`;
    return "";
  }

  function selectedTeamStanding(data, id) {
    return (data.standings.sections || []).flatMap((section) => {
      const tier = tierFromTitle(section.title);
      const teams = section.teams || [];
      return teams.map((row, index) => ({
        ...row,
        tier,
        position: index + 1,
        teamCount: teams.length,
        marker: movementMarker(tier, index + 1, teams.length)
      }));
    }).find((row) => fileStem(row.rosterFile) === id) || {};
  }

  async function teamPositionHistory(id) {
    const seasons = await allSeasonData();
    return seasons.map((data) => {
      const standing = selectedTeamStanding(data, id);
      return standing.team ? { season: data.season, standing } : null;
    }).filter(Boolean).sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season));
  }

  async function renderSeason() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Season Controls</h2><div class="filter-bar">
        <label>Season ${seasonSelector(selected)}</label>
        <div class="history-meta"><span class="pill">${(data.standings.sections || []).length} Divisions</span><span class="pill">Archive Only</span></div>
      </div></section>
      <section class="reference-section" id="standings"><h2>Standings</h2>${renderStandings(data)}</section>
      <section class="reference-section" id="team-stats"><h2>Team Stats</h2>${renderTeamStatsTable(data)}</section>
      <div class="history-grid">
        <section class="reference-section"><h2>Season Awards</h2>${table(["Tier", "Award", "Person", "Team"], (data.seasonAwards.sections || []).flatMap((section) => (section.awards || []).map((award) => `<tr><td>${esc(section.title)}</td><td>${esc(award.award)}</td><td>${playerLink(selected, award.personFile, award.person)}</td><td>${teamLink(award.teamFile, award.team)}</td></tr>`)), "Archived season awards unavailable")}</section>
        <section class="reference-section"><h2>Weekly / Monthly Awards</h2>${renderArchiveAwards(data)}</section>
      </div>
      <section class="reference-section"><h2>Super Cup <a class="section-link" href="supercup.htm?season=${encodeURIComponent(selected)}">Full Cup Archive</a></h2>${renderSupercup(data)}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`season.htm?season=${encodeURIComponent(event.target.value)}`); });
  }

  function renderArchiveAwards(data) {
    const rows = (data.awards.sections || []).flatMap((section) => (section.categories || []).flatMap((category) => (category.awards || []).map((award) => `<tr><td>${esc(section.title)}</td><td>${esc(category.title)}</td><td>${esc(award.date)}</td><td>${playerLink(data.season, award.playerFile, award.player)}</td><td>${teamLink(award.teamFile, award.teamName)}</td></tr>`)));
    return table(["Section", "Category", "Date", "Player", "Team"], rows, "Archived weekly/monthly awards unavailable");
  }

  function renderSupercup(data) {
    const standingsRows = (data.supercupStandings.sections || []).flatMap((section) => (section.teams || []).map((team) => `<tr><td>${esc(section.title)}</td><td>${esc(team.team)}</td><td class="num">${esc(team.wins)}-${esc(team.losses)}</td><td class="num">${esc(team.diff)}</td><td>${esc(team.streak)}</td></tr>`));
    const leaderRows = (data.supercupLeaders.sections || []).flatMap((section) => (section.categories || []).slice(0, 2).flatMap((category) => (category.leaders || []).slice(0, 5).map((leader) => `<tr><td>${esc(category.title)}</td><td>${esc(leader.player)}</td><td>${esc(leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`)));
    return `<div class="history-grid"><div>${table(["Group", "Team", "W-L", "Diff", "Streak"], standingsRows, "No archived Super Cup standings")}</div><div>${table(["Category", "Player", "Team", "Value"], leaderRows, "No archived Super Cup leaders")}</div></div>`;
  }

  function supercupTeam(team) {
    const logo = logoFor(team);
    return `<span class="cup-team">${logo ? `<img src="${logo}" alt="">` : ""}<strong>${esc(team)}</strong></span>`;
  }

  function supercupSeedMap(data) {
    const teams = data.supercupStandings.sections?.[0]?.teams || [];
    return new Map(teams.map((team, index) => [team.team, index + 1]));
  }

  function gameDateValue(value) {
    const parts = String(value || "").split("/").map(Number);
    if (parts.length !== 3) return String(value || "");
    const [day, month, year] = parts;
    return new Date(year, month - 1, day).getTime();
  }

  function supercupRoundGames(data) {
    const games = (data.supercupResults.results || [])
      .filter((game) => game.sectionSlug === "playoffs")
      .slice()
      .sort((a, b) => gameDateValue(a.date) - gameDateValue(b.date) || String(a.boxscoreFile).localeCompare(String(b.boxscoreFile)));
    const grouped = [];
    games.forEach((game) => {
      const round = grouped.find((entry) => entry.date === game.date);
      if (round) round.games.push(game);
      else grouped.push({ date: game.date, games: [game] });
    });
    const titles = grouped.length === 4
      ? ["First Round", "Quarterfinals", "Semifinals", "Final"]
      : grouped.map((_round, index) => `Round ${index + 1}`);
    return grouped.map((round, index) => ({ ...round, title: titles[index] }));
  }

  function supercupMatchCard(game, seeds) {
    const winner = game.winnerName;
    const teams = [
      { name: game.awayTeamName, score: game.awayScore },
      { name: game.homeTeamName, score: game.homeScore }
    ].sort((a, b) => (seeds.get(a.name) || 99) - (seeds.get(b.name) || 99));
    return `<article class="cup-match">
      ${teams.map((team) => `<div class="cup-match-row ${team.name === winner ? "winner" : ""}"><span class="cup-seed">#${esc(seeds.get(team.name) || "-")}</span>${supercupTeam(team.name)}<strong class="cup-score">${esc(team.score)}</strong></div>`).join("")}
      <div class="cup-date">${esc(game.date)}</div>
    </article>`;
  }

  function renderSupercupBracket(data) {
    const rounds = supercupRoundGames(data);
    const seeds = supercupSeedMap(data);
    if (!rounds.length) return `<div class="empty">No archived Super Cup knockout results</div>`;
    return `<div class="cup-bracket">${rounds.map((round) => `
      <section class="cup-round">
        <h3>${esc(round.title)}</h3>
        <div class="cup-round-matches">${round.games.map((game) => supercupMatchCard(game, seeds)).join("")}</div>
      </section>`).join("")}</div>`;
  }

  function renderSupercupStandings(data) {
    return (data.supercupStandings.sections || []).map((section) => `
      <section class="reference-section">
        <h2>${esc(section.title || "Group Stage Standings")}</h2>
        ${table(["#", "Team", "W-L", "PCT", "GB", "PF", "PA", "DIFF", "L10", "Streak"], (section.teams || []).map((team, index) => `
          <tr><td class="num">${index + 1}</td><td>${supercupTeam(team.team)}</td><td class="num">${esc(team.wins)}-${esc(team.losses)}</td><td class="num">${esc(team.pct)}</td><td class="num">${esc(team.gb)}</td><td class="num">${esc(team.pf)}</td><td class="num">${esc(team.pa)}</td><td class="num">${esc(team.diff)}</td><td class="num">${esc(team.last10)}</td><td>${esc(team.streak)}</td></tr>`), "No archived Super Cup standings")}
      </section>`).join("");
  }

  function renderSupercupLeaders(data) {
    const categories = (data.supercupLeaders.sections || []).flatMap((section) => section.categories || []);
    if (!categories.length) return `<div class="empty">No archived Super Cup leaders</div>`;
    return `<div class="history-grid three">${categories.map((category) => `
      <section class="reference-section">
        <h2>${esc(category.title)}</h2>
        ${table(["#", "Player", "Team", "Value"], (category.leaders || []).slice(0, 5).map((leader) => `<tr><td class="num">${esc(leader.rank)}</td><td>${esc(leader.player)}</td><td>${esc(leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`), "No archived leaders")}
      </section>`).join("")}</div>`;
  }

  async function renderSupercupPage() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Super Cup Archive</h2><div class="filter-bar">
        <label>Season ${seasonSelector(selected)}</label>
        <div class="history-meta"><span class="pill">Archive Only</span></div>
      </div></section>
      <section class="reference-section cup-feature" id="knockout"><h2>Knockout Bracket <span class="muted">${esc(seasonLabel(selected))}</span></h2>${renderSupercupBracket(data)}</section>
      <div id="group-stage">${renderSupercupStandings(data)}</div>
      <section class="reference-section" id="cup-leaders"><h2>Stat Leaders</h2>${renderSupercupLeaders(data)}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`supercup.htm?season=${encodeURIComponent(event.target.value)}`); });
  }

  async function renderLeaders() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    const allCategories = leaderCategories(data);
    const p = params();
    const selectedTier = p.get("tier") || "all";
    const selectedTeam = p.get("team") || "all";
    const selectedPos = p.get("pos") || "all";
    const selectedStatus = p.get("status") || "all";
    const selectedLimit = p.get("limit") || "25";
    const categoryOptions = selectedTier === "all" ? allCategories : allCategories.filter((item) => item.tier === selectedTier);
    const categoryKey = (item) => `${item.tier}:${item.category.slug}`;
    const selectedCat = p.get("category") || (categoryOptions[0] ? categoryKey(categoryOptions[0]) : "");
    const active = categoryOptions.find((item) => categoryKey(item) === selectedCat)
      || categoryOptions.find((item) => item.category.slug === selectedCat)
      || categoryOptions[0]
      || allCategories[0];
    const teams = allTeamsFromLatest(data).sort((a, b) => a.team.localeCompare(b.team));
    const playerByFile = new Map((data.players || []).map((player) => [String(player.url || "").split("/").pop(), player]));
    let leaders = (active?.category?.leaders || []).map((leader) => {
      const player = playerByFile.get(leader.playerFile) || {};
      const identity = identityForSeasonPlayer(selected, leader.playerFile);
      return { leader, player, identity };
    });
    if (selectedTeam !== "all") leaders = leaders.filter(({ leader }) => fileStem(leader.teamFile) === selectedTeam);
    if (selectedPos !== "all") leaders = leaders.filter(({ player }) => String(player.pos || "") === selectedPos);
    if (selectedStatus !== "all") leaders = leaders.filter(({ identity }) => identity && identityStatus(identity).key === selectedStatus);
    leaders = leaders.slice(0, Number(selectedLimit) || 25);
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Filters</h2><div class="filter-bar">
        <label>Season ${seasonSelector(selected)}</label>
        <label>Category <select id="categorySelect">${categoryOptions.map((item) => `<option value="${esc(categoryKey(item))}" ${item === active ? "selected" : ""}>${esc(item.tier)} | ${esc(item.category.title)}</option>`).join("")}</select></label>
        <label>Tier <select id="tierFilter"><option value="all">All</option>${[...new Set(allCategories.map((item) => item.tier))].map((tier) => `<option value="${esc(tier)}" ${selectedTier === tier ? "selected" : ""}>${esc(tier)}</option>`).join("")}</select></label>
        <label>Team <select id="teamFilter"><option value="all">All</option>${teams.map((team) => `<option value="${esc(team.id)}" ${selectedTeam === team.id ? "selected" : ""}>${esc(team.team)}</option>`).join("")}</select></label>
        <label>Pos <select id="posFilter"><option value="all">All</option>${["PG", "SG", "SF", "PF", "C"].map((pos) => `<option value="${pos}" ${selectedPos === pos ? "selected" : ""}>${pos}</option>`).join("")}</select></label>
        <label>Status <select id="statusFilter"><option value="all">All</option><option value="active" ${selectedStatus === "active" ? "selected" : ""}>Active</option><option value="prospect" ${selectedStatus === "prospect" ? "selected" : ""}>Incoming Prospect</option><option value="free-agent" ${selectedStatus === "free-agent" ? "selected" : ""}>Free Agent</option><option value="retired" ${selectedStatus === "retired" ? "selected" : ""}>Retired</option></select></label>
        <label>Rows <select id="limitFilter">${["10", "25", "50", "100"].map((limit) => `<option value="${limit}" ${selectedLimit === limit ? "selected" : ""}>Top ${limit}</option>`).join("")}</select></label>
      </div></section>
      <section class="reference-section"><h2>${esc(active?.category?.title || "Leaders")} <span class="muted">${esc(active?.tier || "")}</span></h2>${table(["Rank", "Player", "Pos", "Status", "Team", "Value"], leaders.map(({ leader, player, identity }) => `<tr><td class="num">${esc(leader.rank)}</td><td>${playerLink(selected, leader.playerFile, leader.player)}</td><td>${esc(player.pos || "-")}</td><td>${identity ? esc(identityStatus(identity).label) : "-"}</td><td>${teamLink(leader.teamFile, leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`), "No leaders match these filters")}</section>`;
    const update = () => {
      const next = new URL("leaders.htm", window.location.href);
      next.searchParams.set("season", $("#seasonSelect")?.value || selected);
      next.searchParams.set("tier", $("#tierFilter")?.value || selectedTier);
      next.searchParams.set("category", $("#categorySelect")?.value || (active ? categoryKey(active) : selectedCat));
      next.searchParams.set("team", $("#teamFilter")?.value || selectedTeam);
      next.searchParams.set("pos", $("#posFilter")?.value || selectedPos);
      next.searchParams.set("status", $("#statusFilter")?.value || selectedStatus);
      next.searchParams.set("limit", $("#limitFilter")?.value || selectedLimit);
      navigate(next.href);
    };
    ["seasonSelect", "categorySelect", "tierFilter", "teamFilter", "posFilter", "statusFilter", "limitFilter"].forEach((id) => $(`#${id}`)?.addEventListener("change", update));
  }

  async function renderYouth() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    const teams = data.youth.teams || [];
    const selectedTeam = params().get("team") || teams[0]?.team || "";
    const team = teams.find((row) => row.team === selectedTeam) || teams[0] || {};
    const allData = await allSeasonData();
    const franchiseRows = allData.flatMap((seasonData) => (seasonData.youth.teams || []).filter((row) => !selectedTeam || row.team === selectedTeam).flatMap((row) => (row.intakePlayers || []).map((p) => `<tr><td>${esc(seasonLabel(seasonData.season))}</td><td>${esc(row.team)}</td><td>${youthPlayerLink(p)}</td><td>${esc(p.Position)}</td><td class="num">${esc(p.Age)}</td><td>${esc(p.College)}</td></tr>`)));
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Youth Intake Controls</h2><div class="filter-bar">
        <label>Season ${seasonSelector(selected)}</label>
        <label>Team <select id="teamSelect">${teams.map((row) => `<option value="${esc(row.team)}" ${row.team === team.team ? "selected" : ""}>${esc(row.team)}</option>`).join("")}</select></label>
      </div></section>
      <section class="reference-section"><h2>${esc(team.team || "Team")} Intake</h2>${renderYouthTeam(data, team.team)}</section>
      <section class="reference-section" id="franchise"><h2>Franchise Intake History</h2>${table(["Season", "Team", "Player", "Pos", "Age", "College"], franchiseRows, "No archived youth intake")}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(event.target.value)}&team=${encodeURIComponent(team.team || "")}`); });
    $("#teamSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(selected)}&team=${encodeURIComponent(event.target.value)}`); });
  }

  function comparePickerOptions(type) {
    if (type === "teams") {
      const latest = state.seasonCache.get(latestSeason());
      return allTeamsFromLatest(latest || { standings: { sections: [] } }).map((team) => `<option value="${esc(team.id)}">${esc(team.team)}</option>`).join("");
    }
    return (state.playerIndex?.identities || [])
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((identity) => `<option value="${esc(identity.key)}">${esc(identity.name)}</option>`)
      .join("");
  }

  async function playerCompareCard(key) {
    const identity = (state.playerIndex?.identities || []).find((item) => item.key === key);
    if (!identity) return `<section class="reference-section"><h2>Player</h2><div class="empty">Choose a player to compare</div></section>`;
    const appearances = identity.appearances || [];
    const peak = appearances.slice().sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || {};
    return `<section class="reference-section compare-card"><h2>${esc(identity.name)}</h2>
      <div class="history-meta"><span class="pill status-${esc(identityStatus(identity).key)}">${esc(identityStatus(identity).label)}</span><span class="pill">${esc(identity.height)}</span><span class="pill">${appearances.length} Seasons</span></div>
      <p>Peak: ${ratingChip("OVR", peak.overall)} ${esc(peak.team || "")} | ${esc(seasonLabel(peak.season))}</p>
      ${table(["Season", "Team", "Age", "OVR", "POT"], appearances.map((a) => `<tr><td>${esc(seasonLabel(a.season))}</td><td>${esc(a.team)}</td><td class="num">${esc(a.age)}</td><td>${ratingChip("OVR", a.overall)}</td><td>${ratingChip("POT", a.potential)}</td></tr>`), "No appearances")}</section>`;
  }

  async function teamCompareCard(id) {
    if (!id) return `<section class="reference-section"><h2>Team</h2><div class="empty">Choose a team to compare</div></section>`;
    const latest = await loadSeason(latestSeason());
    const team = allTeamsFromLatest(latest).find((row) => row.id === id);
    const history = await teamPositionHistory(id);
    const bestFinish = history.slice().sort((a, b) => teamOverallRank(a.standing) - teamOverallRank(b.standing))[0];
    return `<section class="reference-section compare-card"><h2>${teamMini(team?.team || id, team?.rosterFile || `${id}.htm`)}</h2>
      <div class="history-meta"><span class="pill">${history.length} Seasons</span><span class="pill">Best: ${esc(bestFinish?.standing?.tier || "-")} #${esc(bestFinish?.standing?.position || "-")}</span></div>
      ${teamPositionChart(history)}
      ${table(["Season", "Tier", "Pos", "W-L", "Diff", "Move"], history.map(({ season, standing }) => `<tr><td>${esc(seasonLabel(season))}</td><td>${esc(standing.tier)}</td><td class="num">${esc(standing.position)}</td><td>${esc(standing.wins)}-${esc(standing.losses)}</td><td class="num">${esc(standing.diff)}</td><td>${movementBadge(standing.marker)}</td></tr>`), "No team history")}</section>`;
  }

  async function renderCompare() {
    await loadSeason(latestSeason());
    const p = params();
    const type = p.get("type") === "teams" ? "teams" : "players";
    const a = p.get("a") || "";
    const b = p.get("b") || "";
    const options = comparePickerOptions(type);
    const cards = type === "teams" ? [await teamCompareCard(a), await teamCompareCard(b)] : [await playerCompareCard(a), await playerCompareCard(b)];
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Compare Controls</h2><div class="filter-bar">
        <label>Type <select id="compareType"><option value="players" ${type === "players" ? "selected" : ""}>Players</option><option value="teams" ${type === "teams" ? "selected" : ""}>Teams</option></select></label>
        <label>First <select id="compareA"><option value="">Choose</option>${options}</select></label>
        <label>Second <select id="compareB"><option value="">Choose</option>${options}</select></label>
      </div></section>
      <div class="history-grid">${cards.join("")}</div>`;
    $("#compareA").value = a;
    $("#compareB").value = b;
    const update = () => navigate(`compare.htm?type=${encodeURIComponent($("#compareType").value)}&a=${encodeURIComponent($("#compareA").value)}&b=${encodeURIComponent($("#compareB").value)}`);
    ["compareType", "compareA", "compareB"].forEach((id) => $(`#${id}`)?.addEventListener("change", update));
  }

  function pageFromLocation() {
    const file = window.location.pathname.split("/").pop() || "index.htm";
    if (file === "players.htm") return "players";
    if (file === "teams.htm") return "teams";
    if (file === "player.htm") return "player";
    if (file === "team.htm") return "team";
    if (file === "season.htm") return "season";
    if (file === "leaders.htm") return "leaders";
    if (file === "supercup.htm") return "supercup";
    if (file === "youth-intake.htm") return "youth";
    if (file === "compare.htm") return "compare";
    return "index";
  }

  async function renderRoute({ keepScroll = false } = {}) {
    await initCore();
    const page = pageFromLocation();
    document.body.dataset.page = page;
    $("#history-app").innerHTML = `<section class="reference-section compact-controls"><h2>Loading...</h2></section>`;
    if (page === "index") await renderIndex();
    if (page === "players") await renderPlayersDirectory();
    if (page === "teams") await renderTeamsDirectory();
    if (page === "player") await renderPlayer();
    if (page === "team") await renderTeam();
    if (page === "season") await renderSeason();
    if (page === "leaders") await renderLeaders();
    if (page === "supercup") await renderSupercupPage();
    if (page === "youth") await renderYouth();
    if (page === "compare") await renderCompare();
    setupSortableTables($("#history-app"));
    if (window.location.hash) {
      scrollToHash(window.location.hash);
    } else if (!keepScroll) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }

  function scrollToHash(hash) {
    const id = decodeURIComponent(String(hash || "").replace(/^#/, ""));
    if (!id) return;
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ block: "start" });
  }

  function isInternalHistoryUrl(url) {
    return url.origin === window.location.origin && /\/00-assets\/html\/history\/[^/]+\.htm$/.test(url.pathname);
  }

  function navigate(href, options = {}) {
    const url = new URL(href, window.location.href);
    if (!isInternalHistoryUrl(url)) {
      window.location.href = url.href;
      return;
    }
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const nextRoute = `${url.pathname}${url.search}`;
    const currentRoute = `${window.location.pathname}${window.location.search}`;
    if (next !== current) window.history.pushState({}, "", url.href);
    if (nextRoute === currentRoute && url.hash) {
      scrollToHash(url.hash);
      return;
    }
    renderRoute(options).catch((error) => {
      console.error(error);
      const app = $("#history-app");
      if (app) app.innerHTML = `<section class="reference-section compact-controls"><h2>Archive Load Error</h2><p class="muted">${esc(error.message)}</p></section>`;
    });
  }

  function setupSpaNavigation() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
      const url = new URL(link.href, window.location.href);
      if (!isInternalHistoryUrl(url)) return;
      event.preventDefault();
      navigate(url.href);
    });
    window.addEventListener("popstate", () => {
      renderRoute({ keepScroll: true }).catch((error) => console.error(error));
    });
  }

  async function init() {
    setupSpaNavigation();
    await renderRoute();
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error(error);
      const app = $("#history-app");
      if (app) app.innerHTML = `<section class="reference-section compact-controls"><h2>Archive Load Error</h2><p class="muted">${esc(error.message)}</p></section>`;
    });
  });
})();


