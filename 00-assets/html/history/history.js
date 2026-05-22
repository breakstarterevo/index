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
      supercupLeaders: await fetchJson(`${base}supercup/leaders.json`, { sections: [] })
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

  function isIdentityActive(identity) {
    return (state.currentPlayers || []).some((player) => {
      return isRealCurrentTeam(player)
        && String(player.name || "").toLowerCase() === String(identity.name || "").toLowerCase()
        && String(player.ht || "") === String(identity.height || "");
    });
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
        </div>
        <nav class="history-nav">
          <div class="history-nav-item"><a class="history-nav-link" href="index.htm">Players</a><div class="history-mega" id="megaPlayers"><div class="empty">Loading greats...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="index.htm#teams">Teams</a><div class="history-mega" id="megaTeams"><div class="empty">Loading teams...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="season.htm">Seasons</a><div class="history-mega" id="megaSeasons"></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="leaders.htm">Leaders</a><div class="history-mega"><div class="mega-line"><strong>Leaderboards:</strong> <a href="leaders.htm">Player Leaders</a> | <a href="season.htm">Season Summaries</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="youth-intake.htm">Youth Intake</a><div class="history-mega"><div class="mega-line"><strong>Draft History:</strong> <a href="youth-intake.htm">Youth Intake by Season</a> | <a href="youth-intake.htm#franchise">Franchise Intake History</a></div></div></div>
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
      const sectionRows = ["season summary", "leaders", "youth intake"].filter((x) => x.includes(query)).map((x) => {
        const href = x === "leaders" ? "leaders.htm" : x === "youth intake" ? "youth-intake.htm" : "season.htm";
        return `<a class="history-result" href="${href}"><span>${esc(x.replace(/\b\w/g, (m) => m.toUpperCase()))}</span><small>Section</small></a>`;
      });
      results.innerHTML = [...playerRows, ...teamRows, ...sectionRows].join("") || `<div class="history-result"><span>No archive matches</span><small></small></div>`;
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

    const controls = `<div class="selector-row"><label for="playerStatTable"><strong>Table</strong></label><select id="playerStatTable">${keys.map((key) => `<option value="${esc(key)}" ${key === tableKey ? "selected" : ""}>${esc(stats[key].title || key.replace(/_/g, " "))}</option>`).join("")}</select><span class="pill">Source: ${esc(stat.name || "")}</span></div>`;
    const tableOnly = table(headers, rows, "No archived rows for this table");
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

  async function renderIndex() {
    const season = await loadSeason(latestSeason());
    const allTime = await rankedPlayers({ limit: 10 });
    const active = await rankedPlayers({ activeOnly: true, limit: 10 });
    $("#history-app").innerHTML = `
      <section class="history-hero">
        <div class="eyebrow">European Superleague History</div>
        <h1>Season Archive</h1>
        <div class="history-meta"><span class="pill">${state.index.seasonCount || 0} Seasons</span><span class="pill">Latest: ${esc(seasonLabel(season.season))}</span><span class="pill">Archive Only</span></div>
      </section>
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Latest Season Standings</h2>${renderStandings(season)}</section>
          <section class="reference-section" id="teams"><h2>Team Directory</h2><div class="mega-grid">${(season.standings.sections || []).map((section) => `<div><h3>${esc(tierFromTitle(section.title))}</h3>${(section.teams || []).map((team) => `<div>${teamMini(team.team, team.rosterFile)}</div>`).join("")}</div>`).join("")}</div></section>
        </div>
        <div>
          <section class="reference-section"><h2>All-Time Greats</h2>${table(["Player", "Peak", "Season"], allTime.map((p) => `<tr><td><a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a></td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`))}</section>
          <section class="reference-section"><h2>Active Greats</h2>${table(["Player", "Peak", "Season"], active.map((p) => `<tr><td><a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a></td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`), "No active historical matches")}</section>
          <section class="reference-section"><h2>Season Index</h2>${table(["Season", "Summary", "Leaders", "Youth"], (state.index.seasons || []).map((s) => `<tr><td>${esc(s.label || s.season)}</td><td><a href="season.htm?season=${s.season}">Summary</a></td><td><a href="leaders.htm?season=${s.season}">Leaders</a></td><td><a href="youth-intake.htm?season=${s.season}">Youth Intake</a></td></tr>`))}</section>
        </div>
      </div>
      <section class="reference-section"><h2>Leader Snapshot</h2><div class="history-grid three">${renderLeaderCards(season, 3)}</div></section>`;
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
    const active = isIdentityActive(identity);
    $("#history-app").innerHTML = `
      <section class="history-hero">
        <div class="eyebrow">Historical Player</div>
        <h1>${esc(identity.name)}</h1>
        <div class="history-meta"><span class="pill ${active ? "status-active" : "status-retired"}">${active ? "Active" : "Retired"}</span><span class="pill">${esc(identity.height)}</span><span class="pill">First: ${esc(seasonLabel(identity.firstSeason))}</span><span class="pill">Latest: ${esc(seasonLabel(identity.latestSeason))}</span></div>
      </section>
      <div class="history-grid main-rail">
        <div>
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
    const selectedMarker = standing.marker || "";
    $("#history-app").innerHTML = `
      <section class="history-hero profile-split">
        <div>${logoFor(teamName) ? `<img class="history-team-logo" src="${logoFor(teamName)}" alt="">` : ""}</div>
        <div><div class="eyebrow">Historical Team</div><h1>${esc(teamName)}</h1><div class="history-meta"><span class="pill">${esc(standing.tier || "Archive")}</span><span class="pill">#${esc(standing.position || "-")}</span><span class="pill">${esc(standing.wins)}-${esc(standing.losses)}</span><span class="pill">Diff ${esc(standing.diff)}</span>${movementBadge(selectedMarker)}${seasonSelector(selected)}</div></div>
      </section>
      <div class="history-grid main-rail">
        <div>
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
      <section class="history-hero">
        <div class="eyebrow">Season Summary</div><h1>${esc((state.index.seasons || []).find((s) => s.season === selected)?.label || selected)}</h1>
        <div class="history-meta">${seasonSelector(selected)}<span class="pill">${(data.standings.sections || []).length} Divisions</span><span class="pill">Archive Only</span></div>
      </section>
      <section class="reference-section" id="standings"><h2>Standings</h2>${renderStandings(data)}</section>
      <section class="reference-section" id="team-stats"><h2>Team Stats</h2>${renderTeamStatsTable(data)}</section>
      <div class="history-grid">
        <section class="reference-section"><h2>Season Awards</h2>${table(["Tier", "Award", "Person", "Team"], (data.seasonAwards.sections || []).flatMap((section) => (section.awards || []).map((award) => `<tr><td>${esc(section.title)}</td><td>${esc(award.award)}</td><td>${playerLink(selected, award.personFile, award.person)}</td><td>${teamLink(award.teamFile, award.team)}</td></tr>`)), "Archived season awards unavailable")}</section>
        <section class="reference-section"><h2>Weekly / Monthly Awards</h2>${renderArchiveAwards(data)}</section>
      </div>
      <section class="reference-section"><h2>Super Cup</h2>${renderSupercup(data)}</section>`;
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

  async function renderLeaders() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected);
    const allCategories = (data.leaders.sections || []).flatMap((section) => (section.categories || []).map((category) => ({ section, category })));
    const selectedCat = params().get("category") || allCategories[0]?.category?.slug || "";
    const active = allCategories.find((item) => item.category.slug === selectedCat) || allCategories[0];
    $("#history-app").innerHTML = `
      <section class="history-hero"><div class="eyebrow">Historical Leaders</div><h1>Player Leaders</h1><div class="history-meta">${seasonSelector(selected)}<select id="categorySelect">${allCategories.map((item) => `<option value="${esc(item.category.slug)}" ${item.category.slug === active?.category?.slug ? "selected" : ""}>${esc(tierFromTitle(item.section.title))} | ${esc(item.category.title)}</option>`).join("")}</select></div></section>
      <section class="reference-section"><h2>${esc(active?.category?.title || "Leaders")} <span class="muted">${esc(tierFromTitle(active?.section?.title || ""))}</span></h2>${table(["Rank", "Player", "Team", "Value"], (active?.category?.leaders || []).map((leader) => `<tr><td class="num">${esc(leader.rank)}</td><td>${playerLink(selected, leader.playerFile, leader.player)}</td><td>${teamLink(leader.teamFile, leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`), "Archived leaders unavailable")}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`leaders.htm?season=${encodeURIComponent(event.target.value)}`); });
    $("#categorySelect")?.addEventListener("change", (event) => { navigate(`leaders.htm?season=${encodeURIComponent(selected)}&category=${encodeURIComponent(event.target.value)}`); });
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
      <section class="history-hero"><div class="eyebrow">Youth Intake History</div><h1>Youth Intake</h1><div class="history-meta">${seasonSelector(selected)}<select id="teamSelect">${teams.map((row) => `<option value="${esc(row.team)}" ${row.team === team.team ? "selected" : ""}>${esc(row.team)}</option>`).join("")}</select></div></section>
      <section class="reference-section"><h2>${esc(team.team || "Team")} Intake</h2>${renderYouthTeam(data, team.team)}</section>
      <section class="reference-section" id="franchise"><h2>Franchise Intake History</h2>${table(["Season", "Team", "Player", "Pos", "Age", "College"], franchiseRows, "No archived youth intake")}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(event.target.value)}&team=${encodeURIComponent(team.team || "")}`); });
    $("#teamSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(selected)}&team=${encodeURIComponent(event.target.value)}`); });
  }

  function pageFromLocation() {
    const file = window.location.pathname.split("/").pop() || "index.htm";
    if (file === "player.htm") return "player";
    if (file === "team.htm") return "team";
    if (file === "season.htm") return "season";
    if (file === "leaders.htm") return "leaders";
    if (file === "youth-intake.htm") return "youth";
    return "index";
  }

  async function renderRoute({ keepScroll = false } = {}) {
    await initCore();
    const page = pageFromLocation();
    document.body.dataset.page = page;
    $("#history-app").innerHTML = `<section class="history-hero"><h1>Loading...</h1></section>`;
    if (page === "index") await renderIndex();
    if (page === "player") await renderPlayer();
    if (page === "team") await renderTeam();
    if (page === "season") await renderSeason();
    if (page === "leaders") await renderLeaders();
    if (page === "youth") await renderYouth();
    setupSortableTables($("#history-app"));
    if (!keepScroll) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
    if (next !== current) window.history.pushState({}, "", url.href);
    renderRoute(options).catch((error) => {
      console.error(error);
      const app = $("#history-app");
      if (app) app.innerHTML = `<section class="history-hero"><h1>Archive Load Error</h1><p class="muted">${esc(error.message)}</p></section>`;
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
      if (app) app.innerHTML = `<section class="history-hero"><h1>Archive Load Error</h1><p class="muted">${esc(error.message)}</p></section>`;
    });
  });
})();


