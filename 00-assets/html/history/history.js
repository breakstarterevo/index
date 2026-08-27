(function () {
  "use strict";

  const HISTORY_ROOT = "../../../00-build/history/";
  const CURRENT_DB = "../../../00-build/database/";
  const LOGO_ROOT = "../../photos/";
  const SITE_LOGO = "../../images/ESLcropped-removebg-preview.png";
  const SEASON_FEEDS = {
    players: ["players.json", []],
    playerStats: ["player_stats.json", { players: [] }],
    standings: ["standings.json", { sections: [] }],
    leaders: ["leaders.json", { sections: [] }],
    teams: ["teams.json", []],
    teamStats: ["team_stats.json", { teams: [] }],
    awards: ["awards.json", { sections: [] }],
    seasonAwards: ["season_awards.json", { sections: [], missing: true }],
    gameResults: ["game_results.json", { results: [] }],
    youth: ["youth_intake.json", { teams: [] }],
    supercupStandings: ["supercup/standings.json", { sections: [] }],
    supercupLeaders: ["supercup/leaders.json", { sections: [] }],
    supercupResults: ["supercup/game_results.json", { results: [] }]
  };
  const ATTR_KEYS = ["Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", "Psd", "Prd", "Stl", "Blk", "Qkn", "Str", "Jmp", "Sta"];
  const ATTRIBUTE_HISTORY_FIELDS = [
    ["overall", "OVR", "Overall", true],
    ["potential", "POT", "Potential", false],
    ["Ins", "INS", "Inside", true],
    ["Jps", "JPS", "Jump Shot", false],
    ["Fts", "FTS", "Free Throw", false],
    ["3ps", "3PS", "Three", false],
    ["Hnd", "HND", "Handle", false],
    ["Pas", "PAS", "Pass", false],
    ["Orb", "ORB", "Offensive Rebound", false],
    ["Drb", "DRB", "Defensive Rebound", true],
    ["Psd", "PSD", "Post Defense", false],
    ["Prd", "PRD", "Perimeter Defense", false],
    ["Stl", "STL", "Steal", false],
    ["Blk", "BLK", "Block", false],
    ["Qkn", "QKN", "Quickness", true],
    ["Str", "STR", "Strength", false],
    ["Jmp", "JMP", "Jump", false],
    ["Sta", "STA", "Stamina", false]
  ];
  const FUTURE_POOL_ATTRS = [
    ["INS", "InsideScoring", "PotInside"],
    ["JPS", "JumpShot", "PotJumpShot"],
    ["FTS", "FtShot", "PotFtShot"],
    ["3PS", "3pShot", "Pot3pShot"],
    ["HND", "Handling", "PotHandling"],
    ["PAS", "Passing", "PotPassing"],
    ["ORB", "OReb", "PotOReb"],
    ["DRB", "DReb", "PotDReb"],
    ["PSD", "PostDefense", "PotPostDefense"],
    ["PRD", "PerimeterDefense", "PotPerimeterDefense"],
    ["STL", "Stealing", "PotStealing"],
    ["BLK", "Blocking", "PotBlocking"],
    ["QKN", "Quickness", ""],
    ["JMP", "Jumping", ""],
    ["STR", "Strength", ""],
    ["STA", "Stamina", ""],
    ["IA", "InjuryAvoidance", ""]
  ];
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
    "ac sparta praha": "acspartapraha.png",
    "arsenal": "arsenal.png",
    tottenham: "tottenham.jpg",
    "tottenham hotspur": "tottenham.jpg",
    valencia: "valencia.jpg"
  };
  const CANONICAL_TEAM_NAMES_BY_FILE = {
    roster16: "AC Sparta Praha",
    roster20: "Monaco",
    roster23: "Arsenal"
  };
  const LEGACY_TEAM_NAMES = {
    "sheffield united": "AC Sparta Praha",
    sheffield: "AC Sparta Praha",
    "sporting cp": "Arsenal"
  };

  const state = {
    index: null,
    playerIndex: null,
    currentPlayers: [],
    currentTeams: [],
    futurePoolPlayers: [],
    seasonCache: new Map(),
    seasonFeedPromises: new Map(),
    playerProfileCache: new Map(),
    coreReady: null,
    currentReady: null
  };

  const HIDDEN_PLAYER_NAMES = new Set(["vincent askew"]);

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
  const canonicalTeamName = (team, file = "") => {
    const rosterId = fileStem(file).toLowerCase();
    const clean = String(team || "").trim();
    return CANONICAL_TEAM_NAMES_BY_FILE[rosterId] || LEGACY_TEAM_NAMES[clean.toLowerCase()] || clean;
  };
  const logoFor = (team, file = "") => {
    const canonical = canonicalTeamName(team, file).toLowerCase();
    return LOGO_MAP[canonical] ? `${LOGO_ROOT}${LOGO_MAP[canonical]}` : "";
  };
  const teamLink = (file, label) => `<a href="team.htm?id=${encodeURIComponent(fileStem(file))}">${esc(canonicalTeamName(label || fileStem(file), file))}</a>`;
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

  function youthPlayerIdentity(player, season) {
    const name = String(player?.name || "").trim();
    if (!name) return null;
    const playerId = String(player?.playerId || "").trim();
    const archivedKey = playerId && season ? state.playerIndex?.seasonMaps?.[season]?.[`${playerId}.htm`] : "";
    if (archivedKey) {
      return (state.playerIndex?.identities || []).find((identity) => identity.key === archivedKey) || null;
    }
    const height = heightTextFromInches(player.Height);
    const candidates = (state.playerIndex?.identities || []).filter((identity) => {
      if (String(identity.name || "").toLowerCase() !== name.toLowerCase()) return false;
      return !height || String(identity.height || "") === height;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }

  function youthPlayerLink(player, season) {
    const name = String(player?.name || "").trim();
    if (!name) return "";
    const identity = youthPlayerIdentity(player, season);
    if (identity) return `<a href="player.htm?key=${encodeURIComponent(identity.key)}">${esc(name)}</a>`;
    return esc(name);
  }

  function youthPeakRatings(player, season) {
    const appearances = youthPlayerIdentity(player, season)?.appearances || [];
    const maximum = (field) => appearances.reduce((peak, appearance) => {
      const value = num(appearance[field]);
      return value === null ? peak : Math.max(peak ?? value, value);
    }, null);
    const peakAppearance = appearances.reduce((peak, appearance) => {
      const value = num(appearance.overall);
      return value !== null && (peak === null || value > num(peak.overall)) ? appearance : peak;
    }, null);
    return { overall: maximum("overall"), potential: maximum("potential"), season: peakAppearance?.season || "" };
  }

  function youthDevelopmentMeta(player, season, ratedPlayer = {}) {
    const appearances = youthPlayerIdentity(player, season)?.appearances || [];
    const intakeAppearance = appearances.find((appearance) => appearance.season === season) || {};
    const peak = youthPeakRatings(player, season);
    const listedOvr = num(player?.overall ?? ratedPlayer.overall);
    const listedPot = num(player?.potential ?? ratedPlayer.potential);
    const initialOvr = listedOvr && listedOvr > 0 ? listedOvr : num(intakeAppearance.overall);
    const initialPot = listedPot && listedPot > 0 ? listedPot : num(intakeAppearance.potential);
    const peakOvr = num(peak.overall);
    const developmentSeasons = appearances.filter((appearance) => seasonNumber(appearance.season) > seasonNumber(season)).length;
    const wildcard = initialPot !== null && initialPot >= 115;
    const mature = developmentSeasons >= 5;
    const versusPot = peakOvr !== null && initialPot !== null && initialPot > 0 ? peakOvr - initialPot : null;
    const outcome = versusPot === null
      ? "-"
      : versusPot >= 10
        ? "Home Run"
        : versusPot >= 0
          ? "Reached POT"
          : wildcard && mature
            ? "Bust"
            : wildcard
              ? "Developing"
              : "Below POT";
    return {
      initialOvr,
      initialPot,
      peakOvr,
      peakPot: num(peak.potential),
      peakSeason: peak.season,
      developmentSeasons,
      wildcard,
      mature,
      versusPot,
      outcome
    };
  }

  async function fetchJson(path, fallback, options = {}) {
    try {
      const response = await fetch(path, { cache: options.cache || "no-store" });
      if (!response.ok) return fallback;
      return await response.json();
    } catch (_error) {
      return fallback;
    }
  }

  async function initCore() {
    if (state.coreReady) return state.coreReady;
    state.coreReady = (async () => {
      [state.index, state.playerIndex] = await Promise.all([
        fetchJson(`${HISTORY_ROOT}index.json`, { seasons: [] }),
        fetchJson(`${HISTORY_ROOT}player_index.json`, { identities: [], seasonMaps: {} })
      ]);
      const hiddenKeys = new Set((state.playerIndex.identities || [])
        .filter((identity) => HIDDEN_PLAYER_NAMES.has(String(identity.name || "").trim().toLowerCase()))
        .map((identity) => identity.key));
      state.playerIndex.identities = (state.playerIndex.identities || [])
        .filter((identity) => !hiddenKeys.has(identity.key));
      Object.values(state.playerIndex.seasonMaps || {}).forEach((seasonMap) => {
        Object.keys(seasonMap || {}).forEach((playerFile) => {
          if (hiddenKeys.has(seasonMap[playerFile])) delete seasonMap[playerFile];
        });
      });
      renderTopbar();
    })();
    return state.coreReady;
  }

  async function ensureCurrentData() {
    if (!state.currentReady) {
      state.currentReady = Promise.all([
        fetchJson(`${CURRENT_DB}teams.json`, []),
        fetchJson(`${CURRENT_DB}players.json`, [])
      ]).then(([teams, players]) => {
        state.currentTeams = teams;
        state.currentPlayers = players;
      });
    }
    await state.currentReady;
  }

  async function loadSeason(season, feeds = Object.keys(SEASON_FEEDS)) {
    if (!state.seasonCache.has(season)) state.seasonCache.set(season, { season });
    const data = state.seasonCache.get(season);
    const base = `${HISTORY_ROOT}${season}/database/`;
    const requested = Array.isArray(feeds) ? feeds : [feeds];
    await Promise.all(requested.map(async (feed) => {
      if (Object.prototype.hasOwnProperty.call(data, feed)) return;
      const config = SEASON_FEEDS[feed];
      if (!config) throw new Error(`Unknown history feed: ${feed}`);
      const requestKey = `${season}:${feed}`;
      if (!state.seasonFeedPromises.has(requestKey)) {
        state.seasonFeedPromises.set(requestKey, fetchJson(`${base}${config[0]}`, config[1], { cache: "no-store" })
          .then((value) => { data[feed] = value; })
          .finally(() => { state.seasonFeedPromises.delete(requestKey); }));
      }
      await state.seasonFeedPromises.get(requestKey);
    }));
    return data;
  }

  async function allSeasonData(feeds = Object.keys(SEASON_FEEDS)) {
    return Promise.all((state.index?.seasons || []).map((s) => loadSeason(s.season, feeds)));
  }

  function playerProfileBucket(key) {
    return String(key || "").toLowerCase().match(/[a-z0-9]/)?.[0] || "_";
  }

  async function loadPlayerProfile(key) {
    const bucket = playerProfileBucket(key);
    if (!state.playerProfileCache.has(bucket)) {
      state.playerProfileCache.set(bucket, fetchJson(
        `${HISTORY_ROOT}player_profiles/${encodeURIComponent(bucket)}.json`,
        { players: {} },
        { cache: "no-store" }
      ));
    }
    const payload = await state.playerProfileCache.get(bucket);
    return payload?.players?.[key] || null;
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
    const tbody = tableEl?.tBodies?.[0];
    if (!tableEl || !tbody) return;
    const index = Number(header.dataset.sortIndex);
    const current = header.getAttribute("aria-sort");
    const next = current === "ascending" ? "descending" : "ascending";
    const direction = next === "ascending" ? 1 : -1;
    const rows = Array.from(tbody.children).filter((row) => !row.classList.contains("intake-class-detail-row"));

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
    rows.forEach((row) => {
      tbody.appendChild(row);
      const detailId = row.dataset.detailId;
      if (detailId) {
        const detailRow = document.getElementById(detailId);
        if (detailRow) tbody.appendChild(detailRow);
      }
    });
  }

  function setupSortableTables(root = document) {
    root.querySelectorAll("table.sortable-table").forEach((tableEl) => {
      Array.from(tableEl.tBodies?.[0]?.children || []).filter((row) => !row.classList.contains("intake-class-detail-row")).forEach((row, index) => {
        if (!row.dataset.originalIndex) row.dataset.originalIndex = String(index);
      });
    });
    setupTableTools(root);
  }

  function tableToolKey(tableEl) {
    const section = tableEl.closest(".reference-section")?.querySelector("h2")?.textContent || "";
    const headers = Array.from(tableEl.querySelectorAll("thead th")).map((th) => th.textContent.trim()).join("|");
    return `history-table:${window.location.pathname}${window.location.search}:${section}:${headers}`;
  }

  function tableVisibleColumnIndexes(tableEl) {
    return Array.from(tableEl.querySelectorAll("thead th"))
      .map((th, index) => th.hidden ? null : index)
      .filter((index) => index !== null);
  }

  function tableCsvValue(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function tableCsv(tableEl) {
    const columns = tableVisibleColumnIndexes(tableEl);
    const rows = [
      Array.from(tableEl.querySelectorAll("thead th")),
      ...Array.from(tableEl.tBodies?.[0]?.children || []).filter((row) => !row.hidden && !row.classList.contains("intake-class-detail-row")).map((row) => Array.from(row.children))
    ];
    return rows
      .map((cells) => columns.map((index) => tableCsvValue(cells[index]?.textContent || "")).join(","))
      .join("\n");
  }

  function applyTableFilter(tableEl, query) {
    const q = String(query || "").trim().toLowerCase();
    Array.from(tableEl.tBodies?.[0]?.children || []).filter((row) => !row.classList.contains("intake-class-detail-row")).forEach((row) => {
      const detailRow = row.dataset.detailId ? document.getElementById(row.dataset.detailId) : null;
      const searchableText = `${row.textContent} ${detailRow?.textContent || ""}`.toLowerCase();
      const matches = !q || searchableText.includes(q);
      row.hidden = !matches;
      if (detailRow) detailRow.hidden = !matches || detailRow.dataset.expanded !== "true";
    });
  }

  function applyColumnPreset(tableEl, preset) {
    const headers = Array.from(tableEl.querySelectorAll("thead th"));
    const keyPattern = /^(#|rank|season|date|team|player|person|pos|tier|award|w-l|record|ovr|pot|value|pts|diff|move)$/i;
    const show = headers.map((th, index) => {
      if (preset === "all") return true;
      if (preset === "compact") return index < Math.min(headers.length, 6);
      return index === 0 || keyPattern.test(th.textContent.trim());
    });
    if (!show.some(Boolean)) show[0] = true;
    const rows = [tableEl.tHead?.rows?.[0], ...Array.from(tableEl.tBodies?.[0]?.children || [])].filter(Boolean);
    rows.forEach((row) => {
      if (row.classList.contains("intake-class-detail-row")) return;
      Array.from(row.children).forEach((cell, index) => {
        cell.hidden = !show[index];
      });
    });
  }

  async function copyTable(tableEl, button) {
    const csv = tableCsv(tableEl);
    try {
      await navigator.clipboard.writeText(csv);
      if (button) {
        const label = button.textContent;
        button.textContent = "Copied";
        setTimeout(() => { button.textContent = label; }, 1200);
      }
    } catch (_error) {
      const area = document.createElement("textarea");
      area.value = csv;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  function exportTableCsv(tableEl) {
    const blob = new Blob([tableCsv(tableEl)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const section = tableEl.closest(".reference-section")?.querySelector("h2")?.textContent || "history-table";
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug(section) || "history-table"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setupTableTools(root = document) {
    root.querySelectorAll(".table-wrap").forEach((wrap, index) => {
      const tableEl = wrap.querySelector("table.ref-table");
      if (!tableEl || wrap.dataset.toolsReady) return;
      wrap.dataset.toolsReady = "1";
      tableEl.dataset.tableIndex = tableEl.dataset.tableIndex || String(index);
      const key = tableToolKey(tableEl);
      const savedFilter = localStorage.getItem(`${key}:filter`) || "";
      const savedPreset = localStorage.getItem(`${key}:preset`) || "all";
      const headers = tableEl.querySelectorAll("thead th").length;
      const tools = document.createElement("div");
      tools.className = "table-tools";
      tools.innerHTML = `
        <label><span>Filter</span><input class="table-filter-input" type="search" value="${esc(savedFilter)}" placeholder="Filter rows"></label>
        ${headers > 6 ? `<label><span>Columns</span><select class="table-column-preset"><option value="all">All</option><option value="compact">Compact</option><option value="key">Key</option></select></label>` : ""}
        <button type="button" class="table-copy-button">Copy</button>
        <button type="button" class="table-export-button">CSV</button>`;
      wrap.parentNode.insertBefore(tools, wrap);

      const filterInput = $(".table-filter-input", tools);
      const presetSelect = $(".table-column-preset", tools);
      filterInput?.addEventListener("input", () => {
        localStorage.setItem(`${key}:filter`, filterInput.value);
        applyTableFilter(tableEl, filterInput.value);
      });
      presetSelect?.addEventListener("change", () => {
        localStorage.setItem(`${key}:preset`, presetSelect.value);
        applyColumnPreset(tableEl, presetSelect.value);
      });
      $(".table-copy-button", tools)?.addEventListener("click", (event) => copyTable(tableEl, event.currentTarget));
      $(".table-export-button", tools)?.addEventListener("click", () => exportTableCsv(tableEl));
      if (presetSelect) presetSelect.value = savedPreset;
      applyColumnPreset(tableEl, presetSelect?.value || "all");
      applyTableFilter(tableEl, savedFilter);
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

  function youthSeasonSelector(selected, id = "seasonSelect") {
    return `<select id="${id}"><option value="all" ${selected === "all" ? "selected" : ""}>All Seasons</option>${(state.index?.seasons || []).map((s) => `<option value="${esc(s.season)}" ${s.season === selected ? "selected" : ""}>${esc(s.label || s.season)}</option>`).join("")}</select>`;
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
        team: canonicalTeamName(team.team, team.rosterFile),
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

  function bestPlayerForTeam(season, teamName) {
    return (state.playerIndex?.identities || []).flatMap((identity) => (identity.appearances || [])
      .filter((appearance) => appearance.season === season && sameTeamName(appearance.team, teamName))
      .map((appearance) => ({ ...appearance, name: identity.name })))
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

  async function rankedLatestSeasonPlayers({ limit = 12 } = {}) {
    const season = latestSeason();
    return (state.playerIndex?.identities || []).flatMap((identity) => (identity.appearances || [])
      .filter((appearance) => appearance.season === season)
      .map((appearance) => ({
        key: identity.key,
        name: identity.name,
        pos: appearance.pos,
        team: appearance.team,
        season,
        overall: num(appearance.overall) || 0,
        potential: appearance.potential,
        playerFile: appearance.playerFile,
        identity
      })))
      .filter((row) => row.overall > 0)
      .sort((a, b) => b.overall - a.overall || String(a.name || "").localeCompare(String(b.name || "")))
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
          <div class="history-nav-item"><a class="history-nav-link" href="index.htm">Archive Home</a><div class="history-mega" id="megaHome"><div class="mega-line"><strong>Jump:</strong> <a href="players.htm">Players</a> | <a href="teams.htm">Teams</a> | <a href="leaders.htm">Leaders</a> | <a href="records.htm">Records</a> | <a href="compare.htm">Compare</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="players.htm">Players</a><div class="history-mega" id="megaPlayers"><div class="empty">Loading greats...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="teams.htm">Teams</a><div class="history-mega" id="megaTeams"><div class="empty">Loading teams...</div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="season.htm">Seasons</a><div class="history-mega" id="megaSeasons"></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="story.htm">League Story</a><div class="history-mega"><div class="mega-line"><strong>Explore:</strong> <a href="story.htm#timeline">Timeline</a> | <a href="story.htm#dynasties">Dynasties &amp; Journeys</a> | <a href="story.htm#rivalries">Rivalries</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="leaders.htm">Leaders</a><div class="history-mega"><div class="mega-line"><strong>Leaderboards:</strong> <a href="leaders.htm">Player Leaders</a> | <a href="season.htm">Season Summaries</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="records.htm">Records</a><div class="history-mega"><div class="mega-line"><strong>All-Time:</strong> <a href="records.htm#career-records">Career Totals</a> | <a href="records.htm#game-highs">Single-Game Highs</a> | <a href="records.htm#franchise-records">Franchises</a></div><div class="mega-line"><strong>Database Sections:</strong> <a href="finance.htm">Finance</a> | <a href="finance.htm#cap-history">Cap History</a> | <a href="finance.htm#earnings">Player Earnings</a> | <a href="future-pool.htm">Future Pool</a> | <a href="future-pool.htm#potential-ratings">Potential Ratings</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="supercup.htm">Super Cup</a><div class="history-mega"><div class="mega-line"><strong>Cup Archive:</strong> <a href="supercup.htm#knockout">Knockout Bracket</a> | <a href="supercup.htm#group-stage">Group Stage</a> | <a href="supercup.htm#cup-leaders">Stat Leaders</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="youth-intake.htm">Youth Intake</a><div class="history-mega"><div class="mega-line"><strong>Youth History:</strong> <a href="youth-intake.htm">Youth Intake</a> | <a href="youth-intake.htm?season=all">All Seasons</a> | <a href="development-stats.htm">Development Stats</a></div></div></div>
          <div class="history-nav-item"><a class="history-nav-link" href="compare.htm">Compare</a><div class="history-mega"><div class="mega-line"><strong>Compare:</strong> <a href="compare.htm?type=players">Players</a> | <a href="compare.htm?type=teams">Teams</a></div></div></div>
        </nav>
      </header>`;
    setupSearch();
    renderMegaMenus();
  }

  async function renderMegaMenus() {
    const allTime = await rankedPlayers({ limit: 10 });
    const current = await rankedLatestSeasonPlayers({ limit: 10 });
    $("#megaPlayers").innerHTML = `
      <div class="mega-line"><strong>All-Time Greats:</strong> ${allTime.map((p) => `<a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a>`).join(" | ") || "No archived players"}</div>
      <div class="mega-line"><strong>Current Greats:</strong> ${current.map((p) => p.key ? `<a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a>` : esc(p.name)).join(" | ") || "No current players"}</div>`;

    const season = await loadSeason(latestSeason(), ["standings"]);
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
    const logo = logoFor(teamName, file);
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
      const playerRows = (state.playerIndex?.identities || [])
        .filter((p) => String(p.name || "").toLowerCase().includes(query))
        .slice(0, 8)
        .map((p) => `<a class="history-result" href="player.htm?key=${encodeURIComponent(p.key)}"><span>${esc(p.name)}</span><small>Player</small></a>`);
      const latest = await loadSeason(latestSeason(), ["standings"]);
      const teamRows = allTeamsFromLatest(latest)
        .filter((t) => String(t.team || "").toLowerCase().includes(query))
        .slice(0, 8)
        .map((t) => `<a class="history-result" href="team.htm?id=${encodeURIComponent(t.id)}"><span>${esc(t.team)}</span><small>Team</small></a>`);
      const seasonRows = (state.index?.seasons || [])
        .filter((s) => `${s.season} ${s.label || ""}`.toLowerCase().includes(query))
        .slice(0, 4)
        .map((s) => `<a class="history-result" href="season.htm?season=${encodeURIComponent(s.season)}"><span>${esc(s.label || s.season)}</span><small>Season</small></a>`);
      const keywordLinks = [
        { terms: ["home", "archive", "dashboard"], label: "Archive Home", href: "index.htm" },
        { terms: ["players", "greats", "active", "retired"], label: "Player Directory", href: "players.htm" },
        { terms: ["teams", "clubs", "franchises"], label: "Team Directory", href: "teams.htm" },
        { terms: ["season", "standings", "champions", "promoted", "promotion", "relegated", "relegation"], label: "Season Summary", href: "season.htm" },
        { terms: ["story", "timeline", "dynasty", "dynasties", "journey", "rivalry", "rivalries", "derby"], label: "League Story", href: "story.htm" },
        { terms: ["leaders", "leaderboard"], label: "Leaderboards", href: "leaders.htm" },
        { terms: ["records", "all time", "career", "highs", "mvp", "points", "rebounds", "assists", "championships", "awards"], label: "League Records", href: "records.htm" },
        { terms: ["finance", "salary", "cap", "payroll", "earnings", "contract"], label: "Finance History", href: "finance.htm" },
        { terms: ["future", "pool", "prospects", "ratings", "potential"], label: "Future Player Pool", href: "future-pool.htm" },
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
    const current = await rankedLatestSeasonPlayers({ limit: 1 });
    return { teams, champion, promoted, relegated, allTime: allTime[0], current: current[0] };
  }

  function dashboardCard(label, title, body, href = "") {
    const inner = `<div class="dashboard-card-label">${esc(label)}</div><strong>${title}</strong><p>${body}</p>`;
    return href ? `<a class="dashboard-card" href="${href}">${inner}</a>` : `<div class="dashboard-card">${inner}</div>`;
  }

  function storyTeam(team, file) {
    if (!team) return `<span class="muted">Unavailable</span>`;
    return teamMini(canonicalTeamName(team, file), file);
  }

  function storyPlayer(person, key) {
    return key ? `<a href="player.htm?key=${encodeURIComponent(key)}">${esc(person)}</a>` : esc(person || "Unavailable");
  }

  function renderStoryPreview(stories) {
    const latest = (stories.timeline || []).at(-1);
    const era = (stories.eras || [])[0];
    const rivalry = (stories.rivalries || [])[0];
    if (!latest && !era && !rivalry) return "";
    return `<section class="reference-section story-preview" aria-labelledby="story-preview-title">
      <div class="section-heading-row"><div><div class="eyebrow">Across the archive</div><h2 id="story-preview-title">League Story</h2></div><a class="section-link" href="story.htm">Explore the full story</a></div>
      <div class="dashboard-grid story-preview-grid">
        ${dashboardCard("Latest Chapter", esc(latest?.label || "Archive"), `${latest?.championships?.length || 0} league champions${latest?.supercup?.team ? ` | Super Cup: ${esc(latest.supercup.team)}` : ""}`, "story.htm#timeline")}
        ${dashboardCard("Leading Era", esc(era?.team || "Club eras"), `${esc(era?.classification || "Era")} | ${esc(era?.startLabel || "-")} to ${esc(era?.endLabel || "-")}`, "story.htm#dynasties")}
        ${dashboardCard("Featured Rivalry", esc(rivalry?.name || "Rivalries"), `${rivalry?.combined?.games || 0} meetings${rivalry?.location ? ` | ${esc(rivalry.location)}` : ""}`, "story.htm#rivalries")}
      </div>
    </section>`;
  }

  function timelineMovement(rows, marker) {
    if (!rows?.length) return `<span class="muted">None</span>`;
    return rows.map((row) => `<span class="story-movement-item">${storyTeam(row.team, row.file)} ${movementBadge(marker)}</span>`).join("");
  }

  function renderTimelineSeason(season) {
    const champions = (season.championships || []).map((champion) => `<div class="story-fact-row"><span>${esc(champion.tier)}</span><strong>${storyTeam(champion.champion, champion.championFile)}</strong><small>over ${storyTeam(champion.opponent, champion.opponentFile)}</small></div>`).join("");
    const awards = (season.awards || []).filter((award) => award.tier === "CLB").slice(0, 5);
    const leaders = (season.leaders || []).filter((leader) => leader.tier === "CLB").slice(0, 5);
    return `<article class="story-season-card">
      <div class="story-season-marker" aria-hidden="true"></div>
      <header class="story-season-head">
        <div><div class="eyebrow">Completed Season</div><h3>${esc(season.label)}</h3></div>
        <a class="section-link" href="season.htm?season=${encodeURIComponent(season.season)}">Full season</a>
      </header>
      <div class="story-season-grid">
        <section><h4>Champions</h4>${champions || `<div class="empty">Championship archive unavailable</div>`}
          <div class="story-fact-row story-supercup-row"><span>SUPER CUP</span><strong>${storyTeam(season.supercup?.team, season.supercup?.file)}</strong>${season.supercup?.opponent ? `<small>over ${esc(season.supercup.opponent)}</small>` : ""}</div>
        </section>
        <section><h4>Season Honours</h4>${awards.map((award) => `<div class="story-fact-row"><span>${esc(award.award)}</span><strong>${storyPlayer(award.person, award.playerKey)}</strong><small>${esc(award.team)}</small></div>`).join("") || `<div class="empty">Major awards unavailable</div>`}</section>
        <section><h4>CLB Leaders</h4>${leaders.map((leader) => `<div class="story-fact-row"><span>${esc(leader.category)}</span><strong>${storyPlayer(leader.player, leader.playerKey)}</strong><small>${esc(leader.value)} | ${esc(leader.team)}</small></div>`).join("") || `<div class="empty">Leader archive unavailable</div>`}</section>
      </div>
      <footer class="story-season-footer">
        <div><strong>Best regular season</strong>${storyTeam(season.bestRegularSeason?.team, season.bestRegularSeason?.file)} <span>${esc(season.bestRegularSeason?.wins ?? "-")}-${esc(season.bestRegularSeason?.losses ?? "-")}</span></div>
        <div><strong>Promoted</strong>${timelineMovement(season.promoted, "P")}</div>
        <div><strong>Relegated</strong>${timelineMovement(season.relegated, "R")}</div>
      </footer>
    </article>`;
  }

  function renderEraCard(era, index) {
    const tierPath = (era.seasons || []).map((season, seasonIndex) => `<span class="era-tier-node tier-${esc(String(season.tier || "").toLowerCase())}"><strong>${esc(season.tier)}</strong><small>${esc(season.label)}</small></span>${seasonIndex < era.seasons.length - 1 ? `<i aria-hidden="true">→</i>` : ""}`).join("");
    const milestones = (era.milestones || []).map((milestone) => `<li>${esc(milestone)}</li>`).join("");
    return `<article class="era-card">
      <header><span class="story-rank">${index + 1}</span>${logoFor(era.team, era.file) ? `<img src="${logoFor(era.team, era.file)}" alt="">` : ""}<div><div class="eyebrow">${esc(era.classification)}</div><h3>${teamLink(era.file, era.team)}</h3><p>${esc(era.startLabel)}–${esc(era.endLabel)}</p></div></header>
      <div class="era-summary"><span><strong>${esc(era.wins)}-${esc(era.losses)}</strong> record</span><span><strong>${esc(era.titleCount)}</strong> titles</span><span><strong>${esc(era.promotions)}</strong> promotions</span><span><strong>${percent(era.pct)}</strong> win rate</span></div>
      <div class="era-tier-path" aria-label="Tier path">${tierPath}</div>
      ${milestones ? `<ul class="era-milestones">${milestones}</ul>` : `<p class="muted">Sustained high finishes across this era.</p>`}
    </article>`;
  }

  function rivalryGameText(game) {
    if (!game?.team) return "Unavailable";
    return `${esc(game.team)} ${esc(game.pointsFor)}-${esc(game.pointsAgainst)} ${esc(game.opponent)} <span class="muted">${esc(game.label || "")} ${esc(game.date || "")}</span>`;
  }

  function renderRivalryCard(rivalry, index) {
    const left = rivalry.teams?.[0] || {};
    const right = rivalry.teams?.[1] || {};
    const home = rivalry.venueSplits?.home || {};
    const away = rivalry.venueSplits?.away || {};
    const seasonRows = (rivalry.seasons || []).map((season) => `<tr><td>${esc(season.label)}</td><td class="num">${esc(season.games)}</td><td>${esc(season.wins)}-${esc(season.losses)}</td><td class="num">${esc(season.leagueGames)}</td><td class="num">${esc(season.supercupGames)}</td><td class="num">${season.avgDiff > 0 ? "+" : ""}${esc(season.avgDiff)}</td></tr>`);
    const gameRows = (rivalry.games || []).map((game) => {
      const matchup = game.venue === "Away" ? `${game.team} @ ${game.opponent}` : `${game.opponent} @ ${game.team}`;
      const score = game.venue === "Away" ? `${game.pointsFor}-${game.pointsAgainst}` : `${game.pointsAgainst}-${game.pointsFor}`;
      return `<tr><td>${esc(game.label || seasonLabel(game.season))}</td><td>${esc(game.date || "-")}</td><td>${esc(game.competition)}</td><td>${esc(matchup)}</td><td class="num">${esc(score)}</td><td><strong>${esc(game.won ? game.team : game.opponent)}</strong></td></tr>`;
    });
    return `<article class="rivalry-card">
      <header class="rivalry-head">
        <span class="story-rank">${index + 1}</span>
        <div class="rivalry-team">${logoFor(left.team, left.file) ? `<img src="${logoFor(left.team, left.file)}" alt="">` : ""}<strong>${teamLink(left.file, left.team)}</strong></div>
        <div class="rivalry-title"><div class="eyebrow">${rivalry.manual ? "Named Rivalry" : "Archive Matchup"}</div><h3>${esc(rivalry.name)}</h3><div class="history-meta">${rivalry.featured ? `<span class="pill story-featured">Featured</span>` : ""}${rivalry.location ? `<span class="pill">${esc(rivalry.location)}</span>` : ""}</div></div>
        <div class="rivalry-team">${logoFor(right.team, right.file) ? `<img src="${logoFor(right.team, right.file)}" alt="">` : ""}<strong>${teamLink(right.file, right.team)}</strong></div>
      </header>
      <div class="rivalry-summary"><span><strong>${esc(rivalry.combined?.games || 0)}</strong> meetings</span><span><strong>${esc(rivalry.combined?.wins || 0)}-${esc(rivalry.combined?.losses || 0)}</strong> ${esc(left.team)} record</span><span><strong>${esc(home.wins || 0)}-${esc(home.losses || 0)}</strong> vs ${esc(right.team)}</span><span><strong>${esc(away.wins || 0)}-${esc(away.losses || 0)}</strong> @ ${esc(right.team)}</span><span><strong>${esc(rivalry.combined?.avgDiff || 0)}</strong> avg margin</span><span><strong>${esc(rivalry.supercup?.games || 0)}</strong> Super Cup</span></div>
      <details><summary>Season series, individual results and notable games</summary>
        ${table(["Season", "Games", `${left.team} W-L`, "League", "Super Cup", "Avg Diff"], seasonRows, "No season splits available")}
        <div class="rivalry-notables"><p><strong>Closest:</strong> ${rivalryGameText(rivalry.notableGames?.closest)}</p><p><strong>Highest scoring:</strong> ${rivalryGameText(rivalry.notableGames?.highestScoring)}</p><p><strong>Largest win:</strong> ${rivalry.notableGames?.largestWin?.margin ? `+${esc(rivalry.notableGames.largestWin.margin)} | ${esc(rivalry.notableGames.largestWin.score)} <span class="muted">${esc(rivalry.notableGames.largestWin.label || "")}</span>` : "Unavailable"}</p></div>
        <h4 class="rivalry-results-heading">Every Archived Result</h4>
        ${table(["Season", "Date", "Competition", "Matchup", "Score", "Winner"], gameRows, "No individual game results available")}
      </details>
    </article>`;
  }

  async function renderStory() {
    const stories = await fetchJson(`${HISTORY_ROOT}history_stories.json`, { timeline: [], eras: [], rivalries: [], methodology: {} }, { cache: "no-store" });
    const timeline = stories.timeline || [];
    const eras = stories.eras || [];
    const visibleEras = eras.slice(0, 2);
    const rivalries = stories.rivalries || [];
    const featuredRivalries = rivalries.filter((rivalry) => rivalry.featured);
    const automaticRivalries = rivalries.filter((rivalry) => !rivalry.manual).slice(0, 5);
    $("#history-app").innerHTML = `
      <section class="history-hero story-hero"><div class="eyebrow">Completed seasons through ${esc(stories.throughLabel || seasonLabel(latestSeason()))}</div><h1>The Story of the ESL</h1><p>Every champion, climb, dominant era and defining matchup in the completed archive.</p><div class="history-meta"><span class="pill">${timeline.length} Seasons</span><span class="pill">${visibleEras.length} Featured Eras</span><span class="pill">${featuredRivalries.length} Featured Rivalries</span><span class="pill">Top ${automaticRivalries.length} Automatic Rivalries</span></div></section>
      <nav class="story-anchor-nav" aria-label="League story sections"><a href="#timeline">Timeline</a><a href="#dynasties">Dynasties &amp; Journeys</a><a href="#rivalries">Rivalries</a></nav>
      <section class="story-section" id="timeline"><div class="story-section-heading"><div><div class="eyebrow">Season by season</div><h2>League Timeline</h2></div><p>Completed seasons shown chronologically.</p></div><div class="story-timeline">${timeline.map(renderTimelineSeason).join("") || `<div class="empty">No completed seasons have been archived.</div>`}</div></section>
      <section class="story-section" id="dynasties"><div class="story-section-heading"><div><div class="eyebrow">Winning and upward movement</div><h2>Dynasties &amp; Journeys</h2></div><p>${esc(stories.methodology?.era || "Ranked contiguous club eras.")}</p></div><div class="era-grid">${visibleEras.map(renderEraCard).join("") || `<div class="empty">No club era currently meets the qualification threshold.</div>`}</div></section>
      <section class="story-section" id="rivalries"><div class="story-section-heading"><div><div class="eyebrow">Close, frequent and local</div><h2>Rivalries</h2></div><p>${esc(stories.methodology?.rivalry || "Ranked archived matchups.")}</p></div>
        <div class="story-subsection-heading"><h3>Featured Rivalries</h3><span>${featuredRivalries.length} named matchups</span></div>
        <div class="rivalry-list">${featuredRivalries.map(renderRivalryCard).join("") || `<div class="empty">No featured rivalries are configured.</div>`}</div>
        <div class="story-subsection-heading"><h3>Top 5 Automatic Rivalries</h3><span>Ranked from archived results</span></div>
        <div class="rivalry-list">${automaticRivalries.map(renderRivalryCard).join("") || `<div class="empty">No automatic rivalries currently meet the archive threshold.</div>`}</div>
      </section>`;
  }

  async function renderIndex() {
    const season = await loadSeason(latestSeason(), ["standings", "leaders"]);
    const stories = await fetchJson(`${HISTORY_ROOT}history_stories.json`, { timeline: [], eras: [], rivalries: [] });
    const facts = await dashboardFacts(season);
    const allTimeGreats = await rankedPlayers({ limit: 8 });
    const currentGreats = await rankedLatestSeasonPlayers({ limit: 8 });
    $("#history-app").innerHTML = `
      <section class="dashboard-grid">
        ${dashboardCard("Top Club", teamMini(facts.champion.team, facts.champion.rosterFile), `${esc(facts.champion.wins)}-${esc(facts.champion.losses)} in ${esc(facts.champion.tier)} with a ${esc(facts.champion.diff)} point diff.`)}
        ${dashboardCard("All-Time Peak", `<a href="player.htm?key=${encodeURIComponent(facts.allTime?.key || "")}">${esc(facts.allTime?.name || "No player")}</a>`, `${ratingChip("OVR", facts.allTime?.overall)} ${esc(facts.allTime?.team || "")} | ${esc(seasonLabel(facts.allTime?.season))}`)}
        ${dashboardCard("Current Legend", facts.current?.key ? `<a href="player.htm?key=${encodeURIComponent(facts.current.key)}">${esc(facts.current.name || "No current player")}</a>` : esc(facts.current?.name || "No current player"), `${facts.current ? `${ratingChip("OVR", facts.current.overall)} ${esc(facts.current.team || "")} | ${esc(seasonLabel(facts.current.season))}` : "No current season players yet."}`)}
        ${dashboardCard("Movement Watch", "Promotion / Relegation", `${facts.promoted.map((team) => esc(team.team)).join(", ") || "No promotion spots"}${facts.relegated.length ? ` | Down: ${facts.relegated.map((team) => esc(team.team)).join(", ")}` : ""}`, "season.htm#standings")}
      </section>
      ${renderStoryPreview(stories)}
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Latest Season Standings</h2>${renderStandings(season)}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Season Index</h2>${table(["Season", "Summary", "Leaders", "Super Cup", "Youth"], (state.index.seasons || []).map((s) => `<tr><td>${esc(s.label || s.season)}</td><td><a href="season.htm?season=${s.season}">Summary</a></td><td><a href="leaders.htm?season=${s.season}">Leaders</a></td><td><a href="supercup.htm?season=${s.season}">Cup</a></td><td><a href="youth-intake.htm?season=${s.season}">Youth Intake</a></td></tr>`))}</section>
          <section class="reference-section"><h2>All-Time Greats</h2>${table(["Player", "Peak", "Season"], allTimeGreats.map((p) => `<tr><td><a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a></td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`), "No archived players")}</section>
          <section class="reference-section"><h2>Current Greats</h2>${table(["Player", "Peak", "Season"], currentGreats.map((p) => `<tr><td>${p.key ? `<a href="player.htm?key=${encodeURIComponent(p.key)}">${esc(p.name)}</a>` : esc(p.name)}</td><td>${ratingChip("OVR", p.overall)}</td><td>${esc(seasonLabel(p.season))}</td></tr>`), "No current season players")}</section>
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
    const season = await loadSeason(latestSeason(), ["standings"]);
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
    return `<div class="chart-wrap career-chart-wrap"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label || "Archive chart")}">
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
    const tierSize = 100;
    const maxRank = tierSize * 3;
    const x = (index) => pad.left + (positionHistory.length === 1 ? (width - pad.left - pad.right) / 2 : index * ((width - pad.left - pad.right) / (positionHistory.length - 1)));
    const y = (rank) => pad.top + (rank - 1) * ((height - pad.top - pad.bottom) / Math.max(1, maxRank - 1));
    const chartRank = (standing) => {
      const tierOffset = (tierSortValue(standing.tier) - 1) * tierSize;
      const position = Number(standing.position || 1);
      const teamCount = Math.max(1, Number(standing.teamCount || 1));
      const tierPosition = teamCount === 1
        ? tierSize / 2
        : 1 + ((position - 1) / (teamCount - 1)) * (tierSize - 1);
      return tierOffset + tierPosition;
    };
    const points = positionHistory.map(({ standing }, index) => `${x(index)},${y(chartRank(standing))}`).join(" ");
    const bands = ["CLB", "ELB", "ECL"].map((tier, index) => {
      const y1 = y(index * tierSize + 1);
      const y2 = y((index + 1) * tierSize);
      return `<rect class="tier-band tier-band-${index}" x="${pad.left}" y="${y1}" width="${width - pad.left - pad.right}" height="${Math.max(1, y2 - y1)}"></rect><text class="tier-label" x="12" y="${(y1 + y2) / 2 + 4}">${tier}</text>`;
    }).join("");
    const dots = positionHistory.map(({ season, standing }, index) => {
      const marker = movementMarker(standing.tier, standing.position, standing.teamCount);
      const rank = chartRank(standing);
      return `<g class="position-dot ${marker === "C" ? "champion" : marker === "P" ? "promoted" : marker === "R" ? "relegated" : ""}">
        <circle cx="${x(index)}" cy="${y(rank)}" r="4"></circle>
        ${marker ? `<text x="${x(index) + 9}" y="${y(rank) + 4}" text-anchor="start">${marker}</text>` : ""}
        <title>${esc(seasonLabel(season))}: ${esc(standing.tier)} #${esc(standing.position)}, ${esc(standing.wins)}-${esc(standing.losses)}, Diff ${esc(standing.diff)}</title>
      </g>`;
    }).join("");
    const labels = positionHistory.map(({ season }, index) => `<text x="${x(index)}" y="${height - 12}" text-anchor="middle">${esc(seasonLabel(season).replace(/^Season\s*/i, "S"))}</text>`).join("");
    return `<div class="chart-wrap"><svg class="history-chart position-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="All-tier league position chart">${bands}<polyline class="position-line" points="${points}"></polyline>${dots}${labels}</svg></div>`;
  }

  function sameTeamName(left, right) {
    return slug(canonicalTeamName(left)) === slug(canonicalTeamName(right));
  }

  function supercupPerformance(data, teamName) {
    const rounds = supercupRoundGames(data);
    const groupTeam = (data.supercupStandings.sections || [])
      .flatMap((section) => section.teams || [])
      .find((team) => sameTeamName(team.team, teamName));
    const playoffGames = rounds.flatMap((round) => round.games || []);
    const appearedInKnockout = playoffGames.some((game) => (
      sameTeamName(game.homeTeamName, teamName) || sameTeamName(game.awayTeamName, teamName)
    ));

    if (!groupTeam && !appearedInKnockout) {
      return { label: "Unavailable", key: "unavailable" };
    }
    if (!appearedInKnockout) {
      return { label: "Group Stage", key: "group-stage" };
    }

    for (let index = 0; index < rounds.length; index += 1) {
      const round = rounds[index];
      const game = (round.games || []).find((item) => (
        sameTeamName(item.homeTeamName, teamName) || sameTeamName(item.awayTeamName, teamName)
      ));
      if (!game) continue;

      const won = sameTeamName(game.winnerName, teamName);
      const isFinal = index === rounds.length - 1;
      if (isFinal) {
        return won
          ? { label: "Champion", key: "champion" }
          : { label: "Runner-up", key: "runner-up" };
      }
      if (!won) {
        return { label: round.title, key: slug(round.title) };
      }
    }

    return { label: "Knockout Stage", key: "knockout-stage" };
  }

  async function teamSupercupHistory(positionHistory, teamName) {
    return Promise.all(positionHistory.map(async ({ season }) => {
      const data = await loadSeason(season, ["supercupStandings", "supercupResults"]);
      return { season, performance: supercupPerformance(data, teamName) };
    }));
  }

  function supercupFinishBadge(performance) {
    const result = performance || { label: "Unavailable", key: "unavailable" };
    return `<span class="supercup-finish is-${esc(result.key)}">${esc(result.label)}</span>`;
  }

  function renderTeamSupercupHistory(history) {
    const rows = history.map(({ season, performance }) => `<tr class="${performance.key === "champion" ? "supercup-champion-row" : ""}">
      <td><a href="supercup.htm?season=${encodeURIComponent(season)}">${esc(seasonLabel(season))}</a></td>
      <td>${supercupFinishBadge(performance)}</td>
    </tr>`);
    return table(["Season", "Finish"], rows, "No archived Super Cup history");
  }

  async function renderTeamTimeline(positionHistory, id, supercupHistory) {
    const rows = await Promise.all(positionHistory.map(async ({ season, standing }) => {
      const best = bestPlayerForTeam(season, standing.team);
      const marker = movementMarker(standing.tier, standing.position, standing.teamCount);
      const cup = supercupHistory.find((entry) => entry.season === season)?.performance;
      return `<article class="timeline-card">
        <div><strong>${esc(seasonLabel(season))}</strong><span>${esc(standing.tier)} #${esc(standing.position)}</span></div>
        <p>${esc(standing.wins)}-${esc(standing.losses)} (${percent(standing.pct)}) | Diff ${esc(standing.diff)} | ${esc(standing.last10 || "")}</p>
        <p>Best player: ${best ? playerLink(season, best.playerFile, best.name) + ` ${ratingChip("OVR", best.overall)}` : "Unavailable"}</p>
        <p class="timeline-cup">Super Cup: ${supercupFinishBadge(cup)}</p>
        ${movementBadge(marker)}
      </article>`;
    }));
    return `<div class="timeline-grid">${rows.join("")}</div>`;
  }

  function parseAccoladeTotal(label) {
    const match = String(label || "").match(/^(.*?):\s*(\d+)$/);
    return {
      label: cleanAccoladeLabel(match ? match[1] : label),
      count: match ? Number(match[2]) : ""
    };
  }

  function cleanAccoladeLabel(label) {
    return String(label || "").replace(/\s*\|\s*$/, "").trim();
  }

  function normalizeAccoladeKey(label) {
    return cleanAccoladeLabel(label)
      .toLowerCase()
      .replace(/\b1st\b/g, "first")
      .replace(/\b2nd\b/g, "second")
      .replace(/\ball-defense\b/g, "all-defensive")
      .replace(/\s+/g, " ");
  }

  function accoladeDetail(item) {
    let group = String(item.group || "").trim();
    let award = cleanAccoladeLabel(item.award);
    let tier = "";
    const groupTier = String(group.match(/^(CLB|ELB|ECL)\b/i)?.[1] || "").toUpperCase();
    const awardTier = String(award.match(/^(CLB|ELB|ECL)\s+/i)?.[1] || "").toUpperCase();
    if (awardTier) {
      tier = awardTier;
      award = award.replace(/^(CLB|ELB|ECL)\s+/i, "").trim();
    } else if (groupTier) {
      tier = groupTier;
      group = group.replace(/^(CLB|ELB|ECL)\s*/i, "").trim();
    }
    const period = /^\d{4}$/.test(group) ? group : item.fallbackPeriod || "";
    const context = tier || (/^\d{4}$/.test(group) ? "" : group);
    return { context, period, tier, award, team: item.team || "" };
  }

  function renderAccolades(accolades) {
    const totals = new Map();
    const grouped = new Map();
    accolades.forEach((item) => {
      if (item.isTotal || String(item.group || "").toLowerCase() === "total") {
        const total = parseAccoladeTotal(item.award);
        if (!total.label) return;
        totals.set(total.label, Math.max(Number(totals.get(total.label) || 0), Number(total.count || 0)));
        return;
      }
      const detail = accoladeDetail(item);
      if (!detail.award) return;
      const groupKey = detail.period || item.archiveSeason || "";
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(detail);
    });

    const totalItems = Array.from(totals.entries())
      .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));
    const totalHtml = totalItems.length ? `
      <div class="accolade-total-grid">
        ${totalItems.map(([label, count]) => `<div class="accolade-total"><strong>${esc(count)}</strong><span>${esc(label)}</span></div>`).join("")}
      </div>` : "";

    const groupLabel = (key) => /^\d{4}$/.test(key) ? key : seasonLabel(key);
    const groupSort = (key) => /^\d{4}$/.test(key) ? Number(key) : seasonNumber(key);
    const seasonHtml = Array.from(grouped.entries())
      .sort((a, b) => groupSort(a[0]) - groupSort(b[0]))
      .map(([groupKey, rows]) => {
        const unique = new Map();
        rows.forEach((row) => {
          const key = `${row.tier}|${normalizeAccoladeKey(row.award)}`;
          const existing = unique.get(key);
          if (!existing) {
            unique.set(key, row);
            return;
          }
          if (!existing.context && row.context) existing.context = row.context;
          if (!existing.team && row.team) existing.team = row.team;
        });
        const uniqueRows = Array.from(unique.values());
        return `<article class="accolade-season">
          <h3>${esc(groupLabel(groupKey))}</h3>
          <div class="accolade-list">
            ${uniqueRows.map((row) => `<div class="accolade-item"><span>${esc(row.context)}</span><strong>${esc(row.award)}</strong>${row.team ? `<em>${esc(row.team)}</em>` : ""}</div>`).join("")}
          </div>
        </article>`;
      }).join("");

    if (!totalHtml && !seasonHtml) return `<div class="empty">No archived accolades</div>`;
    return `${totalHtml}${seasonHtml ? `<div class="accolade-season-grid">${seasonHtml}</div>` : ""}`;
  }

  function attributeHistoryNumber(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const parsed = Number(raw.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function attributeHistoryCell(rows, rowIndex, key) {
    const raw = String(rows[rowIndex]?.[key] ?? "").trim();
    if (!raw) return "-";
    const current = attributeHistoryNumber(raw);
    let previous = null;
    for (let index = rowIndex - 1; index >= 0; index -= 1) {
      previous = attributeHistoryNumber(rows[index]?.[key]);
      if (previous !== null) break;
    }
    let deltaHtml = "";
    if (current !== null && previous !== null && current !== previous) {
      const delta = current - previous;
      const direction = delta > 0 ? "is-up" : "is-down";
      const signed = delta > 0 ? `+${delta}` : String(delta);
      const aria = delta > 0 ? `increased by ${delta}` : `decreased by ${Math.abs(delta)}`;
      deltaHtml = `<span class="attribute-delta ${direction}" aria-label="${aria}">(${signed})</span>`;
    }
    return `<span class="attribute-value">${esc(raw)}</span>${deltaHtml}`;
  }

  function renderAttributeHistory(appearances) {
    const rows = (appearances || []).slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season));
    if (!rows.length) return `<div class="empty">No archived attribute history</div>`;
    const headers = ATTRIBUTE_HISTORY_FIELDS.map(([, label, title, groupStart]) => (
      `<th class="${groupStart ? "attribute-group-start" : ""}" title="${esc(title)}">${esc(label)}</th>`
    )).join("");
    const body = rows.map((row, rowIndex) => {
      const values = ATTRIBUTE_HISTORY_FIELDS.map(([key, , , groupStart]) => (
        `<td class="num${groupStart ? " attribute-group-start" : ""}">${attributeHistoryCell(rows, rowIndex, key)}</td>`
      )).join("");
      return `<tr><td>${esc(row.seasonLabel || seasonLabel(row.season))}</td><td>${esc(row.team || "FA")}</td>${values}</tr>`;
    }).join("");
    return `<div class="table-wrap attribute-history-wrap"><table class="ref-table attribute-history-table"><thead><tr><th>Season</th><th>Team</th>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  async function renderPlayer() {
    const identity = findIdentityByParam();
    if (!identity) {
      $("#history-app").innerHTML = `<section class="history-hero"><h1>Player Not Found</h1><p class="muted">Use a history player key from search or an archived season map.</p></section>`;
      return;
    }
    await ensureCurrentData();
    const appearances = identity.appearances || [];
    const snapshots = [];
    const accolades = [];
    for (const appearance of appearances) {
      const data = await loadSeason(appearance.season, ["seasonAwards"]);
      const player = {
        overall: appearance.overall,
        potential: appearance.potential,
        pos: appearance.pos,
        age: appearance.age,
        teamLabel: appearance.team,
        team: appearance.team
      };
      snapshots.push({ season: appearance.season, player });
      (data.seasonAwards.sections || []).forEach((section) => (section.awards || []).filter((award) => award.personFile === appearance.playerFile).forEach((award) => {
        accolades.push({
          archiveSeason: appearance.season,
          fallbackPeriod: String(seasonLabel(appearance.season)).match(/\d{4}/)?.[0] || "",
          group: section.title,
          award: award.award,
          team: award.team
        });
      }));
    }
    const peak = snapshots.slice().sort((a, b) => (num(b.player.overall) || 0) - (num(a.player.overall) || 0))[0] || { player: {}, season: "" };
    const profile = await loadPlayerProfile(identity.key);
    if (profile?.peakPlayer && Object.keys(profile.peakPlayer).length) peak.player = profile.peakPlayer;
    const latestStats = profile?.latestStats;
    const earnings = profile?.earnings || { total: 0, history: [] };
    (profile?.awards || []).forEach((award) => accolades.push({
      archiveSeason: identity.latestSeason,
      group: award.season,
      award: award.award,
      isTotal: Boolean(award.isTotal) || String(award.season || "").toLowerCase() === "total"
    }));
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
          <section class="reference-section"><h2>Attribute History</h2><p class="muted">Season-end ratings with changes from the previous archived season.</p>${renderAttributeHistory(appearances)}</section>
          <section class="reference-section"><h2>Player Stats</h2>${playerStatsView.controls}${playerStatsView.tableHtml}</section>
          <section class="reference-section"><h2>Accolades</h2>${renderAccolades(accolades)}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Peak Snapshot</h2><p><strong>${esc(seasonLabel(peak.season))}</strong> | ${esc(peak.player.pos || "")} | ${esc(peak.player.teamLabel || peak.player.team || "")}</p><p>${ratingChip("OVR", peak.player.overall)} ${ratingChip("POT", peak.player.potential)}</p>${table(["Attribute", "Value"], ATTR_KEYS.map((key) => `<tr><td>${esc(key)}</td><td class="num">${esc(peak.player[key])}</td></tr>`), "No peak attributes")}</section>
          <section class="reference-section"><h2>Archived Earnings</h2><p><strong>${formatMoney(earnings.total)}</strong> across completed archive seasons</p>${table(["Season", "Team", "Salary"], (earnings.history || []).map((row) => `<tr><td>${esc(row.label || seasonLabel(row.season))}</td><td>${esc(row.team || "-")}</td><td class="num">${formatMoney(row.salary)}</td></tr>`), "No archived salary history")}</section>
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

  function matchupRecord(record) {
    return `${record?.wins || 0}-${record?.losses || 0}`;
  }

  function renderTeamHeadToHead(feed, teamName) {
    const key = String(teamName || "").trim().toLowerCase();
    const teamRecord = feed?.teams?.[key];
    const opponents = teamRecord?.opponents || [];
    const rows = opponents.map((row) => {
      const largest = row.combined?.largestWin || {};
      const biggestWin = largest.margin
        ? `+${esc(largest.margin)} (${esc(largest.score)}) &middot; ${esc(largest.competition || "")} &middot; ${esc(largest.label || "")}`
        : "-";
      const diff = Number(row.combined?.avgDiff || 0);
      return `<tr>
        <td>${teamMini(row.opponent, row.file)}</td>
        <td class="num">${matchupRecord(row.league)}</td>
        <td class="num">${matchupRecord(row.supercup)}</td>
        <td class="num"><strong>${matchupRecord(row.combined)}</strong></td>
        <td class="num">${percent(row.combined?.pct)}</td>
        <td class="num">${oneDecimal(row.combined?.avgPointsFor)}</td>
        <td class="num">${oneDecimal(row.combined?.avgPointsAgainst)}</td>
        <td class="num">${diff > 0 ? "+" : ""}${oneDecimal(diff)}</td>
        <td>${biggestWin}</td>
      </tr>`;
    });
    return `<section class="reference-section" id="head-to-head">
      <h2>Head-to-Head Records</h2>
      <p class="muted">All completed archive seasons through ${esc(feed?.throughLabel || seasonLabel(latestSeason()))}. League excludes preseason; Super Cup includes its regular season and playoffs.</p>
      ${table(["Opponent", "League W-L", "Super Cup W-L", "Combined W-L", "Win%", "Avg PF", "Avg PA", "Diff", "Biggest Win"], rows, "No archived head-to-head games")}
    </section>`;
  }

  async function renderTeam() {
    const id = fileStem(params().get("id") || params().get("team") || "");
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected, ["teams", "standings", "players", "teamStats", "seasonAwards", "youth"]);
    const team = (data.teams || []).find((t) => fileStem(t.file || t.id) === id) || (data.standings.sections || []).flatMap((s) => s.teams || []).find((t) => fileStem(t.rosterFile) === id);
    if (!team) {
      $("#history-app").innerHTML = `<section class="history-hero"><h1>Team Not Found</h1></section>`;
      return;
    }
    const rosterFile = team.file || team.rosterFile || `${id}.htm`;
    const teamName = canonicalTeamName(team.name || team.team, rosterFile);
    const standing = selectedTeamStanding(data, id);
    const players = (data.players || []).filter((p) => fileStem(p.team) === id || p.teamLabel === teamName).sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0));
    const teamStats = (data.teamStats.teams || []).find((row) => fileStem(row.file) === id) || {};
    const headToHeadPromise = fetchJson(`${HISTORY_ROOT}head_to_head.json`, { throughLabel: seasonLabel(latestSeason()), teams: {} }, { cache: "no-store" });
    const positionHistory = await teamPositionHistory(id);
    const supercupHistory = await teamSupercupHistory(positionHistory, teamName);
    const timelineHtml = await renderTeamTimeline(positionHistory, id, supercupHistory);
    const headToHead = await headToHeadPromise;
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
          <section class="reference-section"><h2>Super Cup History</h2>${renderTeamSupercupHistory(supercupHistory)}</section>
          <section class="reference-section"><h2>Awards</h2>${table(["Group", "Award", "Person"], (data.seasonAwards.sections || []).flatMap((section) => (section.awards || []).filter((award) => fileStem(award.teamFile) === id).map((award) => `<tr><td>${esc(section.title)}</td><td>${esc(award.award)}</td><td>${esc(award.person)}</td></tr>`)), "No season awards")}</section>
          <section class="reference-section"><h2>Youth Intake</h2>${renderYouthTeam(data, teamName, 5)}</section>
        </div>
      </div>
      ${renderTeamHeadToHead(headToHead, teamName)}`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`team.htm?id=${encodeURIComponent(id)}&season=${encodeURIComponent(event.target.value)}`); });
  }

  function youthRatedPlayer(data, p) {
    if (p.overall !== undefined || p.potential !== undefined) return p;
    const appearance = (youthPlayerIdentity(p, data.season)?.appearances || [])
      .find((item) => item.season === data.season);
    return appearance || {};
  }

  function renderYouthTeam(data, teamName, limit = Infinity) {
    const youthTeam = (data.youth.teams || []).find((row) => row.team === teamName);
    const players = (youthTeam?.intakePlayers || []).slice(0, limit);
    return table(["Player", "Pos", "Age", "OVR", "POT", "Peak OVR", "Peak Season", "Outcome"], players.map((p) => {
      const ratedPlayer = youthRatedPlayer(data, p);
      const peak = youthPeakRatings(p, data.season);
      const development = youthDevelopmentMeta(p, data.season, ratedPlayer);
      return `<tr><td>${youthPlayerLink(p, data.season)}</td><td>${esc(p.Position)}</td><td class="num">${esc(p.Age)}</td><td>${ratingChip("OVR", ratedPlayer.overall)}</td><td>${ratingChip("POT", ratedPlayer.potential)}</td><td>${ratingChip("OVR", peak.overall)}</td><td>${esc(peak.season ? seasonLabel(peak.season) : "-")}</td><td>${esc(development.outcome)}</td></tr>`;
    }), "No archived youth intake");
  }

  function renderYouthAllTeams(data) {
    const rows = (data.youth.teams || []).flatMap((team) => (team.intakePlayers || []).map((p) => {
      const ratedPlayer = youthRatedPlayer(data, p);
      const peak = youthPeakRatings(p, data.season);
      const development = youthDevelopmentMeta(p, data.season, ratedPlayer);
      return `<tr><td>${esc(team.team)}</td><td>${youthPlayerLink(p, data.season)}</td><td>${esc(p.Position)}</td><td class="num">${esc(p.Age)}</td><td>${ratingChip("OVR", ratedPlayer.overall)}</td><td>${ratingChip("POT", ratedPlayer.potential)}</td><td>${ratingChip("OVR", peak.overall)}</td><td>${esc(peak.season ? seasonLabel(peak.season) : "-")}</td><td>${esc(development.outcome)}</td></tr>`;
    }));
    return table(["Team", "Player", "Pos", "Age", "OVR", "POT", "Peak OVR", "Peak Season", "Outcome"], rows, "No archived youth intake");
  }

  function renderYouthAllSeasons(allData, selectedTeam) {
    const rows = allData.flatMap((seasonData) => (seasonData.youth.teams || [])
      .filter((team) => selectedTeam === "all" || team.team === selectedTeam)
      .flatMap((team) => (team.intakePlayers || []).map((p) => {
        const ratedPlayer = youthRatedPlayer(seasonData, p);
        const peak = youthPeakRatings(p, seasonData.season);
        const development = youthDevelopmentMeta(p, seasonData.season, ratedPlayer);
        return `<tr><td>${esc(seasonLabel(seasonData.season))}</td><td>${esc(team.team)}</td><td>${youthPlayerLink(p, seasonData.season)}</td><td>${esc(p.Position)}</td><td class="num">${esc(p.Age)}</td><td>${ratingChip("OVR", ratedPlayer.overall)}</td><td>${ratingChip("POT", ratedPlayer.potential)}</td><td>${ratingChip("OVR", peak.overall)}</td><td>${esc(peak.season ? seasonLabel(peak.season) : "-")}</td><td>${esc(development.outcome)}</td></tr>`;
      })));
    return table(["Season", "Team", "Player", "Pos", "Age", "OVR", "POT", "Peak OVR", "Peak Season", "Outcome"], rows, "No archived youth intake");
  }

  function futurePoolNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
  }

  function futurePoolDisplay(value) {
    return value === undefined || value === null || value === "" ? "-" : String(value);
  }

  function futurePoolRating(player, currentField, potentialField, usePotential) {
    const value = usePotential && potentialField ? player[potentialField] : player[currentField];
    return futurePoolDisplay(value === undefined || value === null || value === "" ? player[currentField] : value);
  }

  function futurePoolTier(player) {
    return futurePoolDisplay(player.tier || player.Tier || player.tierRaw);
  }

  function futurePoolRows(players, usePotential) {
    const headers = ["#", "Player", "Tier", "Pos", "Age", "Ht", "Wt", "POT"].concat(FUTURE_POOL_ATTRS.map(([label]) => label));
    const rows = players.map((player, index) => {
      const cells = [
        `<td class="num">${index + 1}</td>`,
        `<td>${esc(player.name || `${player.FirstName || ""} ${player.LastName || ""}`.trim() || "Unnamed Player")}</td>`,
        `<td>${esc(futurePoolTier(player))}</td>`,
        `<td>${esc(player.Position || "-")}</td>`,
        `<td class="num">${esc(futurePoolDisplay(player.Age))}</td>`,
        `<td class="num">${esc(heightTextFromInches(player.Height) || "-")}</td>`,
        `<td class="num">${esc(futurePoolDisplay(player.Weight))}</td>`,
        `<td>${ratingChip("POT", player.potential || player.POT)}</td>`
      ];
      FUTURE_POOL_ATTRS.forEach(([, currentField, potentialField]) => {
        cells.push(`<td class="num">${esc(futurePoolRating(player, currentField, potentialField, usePotential))}</td>`);
      });
      return `<tr>${cells.join("")}</tr>`;
    });
    return table(headers, rows, "No future pool players match these filters");
  }

  function filteredFuturePoolPlayers() {
    const p = params();
    const selectedPos = p.get("pos") || "all";
    const selectedTier = p.get("tier") || "all";
    const search = String(p.get("q") || "").trim().toLowerCase();
    const limitValue = p.get("limit") || "100";
    const limit = limitValue === "all" ? Infinity : Number(limitValue) || 100;
    const players = Array.isArray(state.futurePoolPlayers) ? state.futurePoolPlayers : [];
    return players
      .filter((player) => selectedPos === "all" || String(player.Position || "") === selectedPos)
      .filter((player) => selectedTier === "all" || futurePoolTier(player) === selectedTier)
      .filter((player) => !search || String(player.name || `${player.FirstName || ""} ${player.LastName || ""}`).toLowerCase().includes(search))
      .sort((a, b) => futurePoolNumber(b.potential || b.POT) - futurePoolNumber(a.potential || a.POT) || String(a.name || "").localeCompare(String(b.name || "")))
      .slice(0, limit);
  }

  async function loadFuturePoolPlayers() {
    if (Array.isArray(state.futurePoolPlayers) && state.futurePoolPlayers.length) return state.futurePoolPlayers;
    state.futurePoolPlayers = await fetchJson(`${CURRENT_DB}future_players.json`, []);
    return state.futurePoolPlayers;
  }

  async function renderFuturePool() {
    const players = await loadFuturePoolPlayers();
    const p = params();
    const selectedPos = p.get("pos") || "all";
    const selectedTier = p.get("tier") || "all";
    const selectedLimit = p.get("limit") || "100";
    const selectedView = p.get("view") === "potential" ? "potential" : "current";
    const search = p.get("q") || "";
    const positions = Array.from(new Set(players.map((player) => player.Position).filter(Boolean))).sort();
    const tiers = Array.from(new Set(players.map((player) => futurePoolTier(player)).filter((tier) => tier && tier !== "-"))).sort();
    const visible = filteredFuturePoolPlayers();
    const usePotential = selectedView === "potential";
    const tableTitle = usePotential ? "Potential Ratings" : "Current Ratings";
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Future Pool Controls</h2><div class="filter-bar future-pool-controls">
        <label>Table <select id="futureView"><option value="current" ${selectedView === "current" ? "selected" : ""}>Current</option><option value="potential" ${selectedView === "potential" ? "selected" : ""}>Potential</option></select></label>
        <label>Search <input id="futureSearch" type="search" value="${esc(search)}" placeholder="Player name"></label>
        <label>Pos <select id="futurePos"><option value="all">All</option>${positions.map((pos) => `<option value="${esc(pos)}" ${selectedPos === pos ? "selected" : ""}>${esc(pos)}</option>`).join("")}</select></label>
        <label>Tier <select id="futureTier"><option value="all">All</option>${tiers.map((tier) => `<option value="${esc(tier)}" ${selectedTier === tier ? "selected" : ""}>${esc(tier)}</option>`).join("")}</select></label>
        <label>Rows <select id="futureLimit">${["50", "100", "250", "all"].map((limit) => `<option value="${limit}" ${selectedLimit === limit ? "selected" : ""}>${limit === "all" ? "All" : `Top ${limit}`}</option>`).join("")}</select></label>
      </div></section>
      <section class="reference-section" id="${usePotential ? "potential-ratings" : "current-ratings"}"><h2>${tableTitle} <span class="muted">${visible.length} shown</span></h2>${futurePoolRows(visible, usePotential)}</section>`;
    const update = () => {
      const next = new URL("future-pool.htm", window.location.href);
      const query = String($("#futureSearch")?.value || "").trim();
      if (query) next.searchParams.set("q", query);
      next.searchParams.set("view", $("#futureView")?.value || selectedView);
      next.searchParams.set("pos", $("#futurePos")?.value || selectedPos);
      next.searchParams.set("tier", $("#futureTier")?.value || selectedTier);
      next.searchParams.set("limit", $("#futureLimit")?.value || selectedLimit);
      navigate(next.href);
    };
    ["futureView", "futurePos", "futureTier", "futureLimit"].forEach((id) => $(`#${id}`)?.addEventListener("change", update));
    $("#futureSearch")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        update();
      }
    });
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
    const seasons = await allSeasonData(["standings"]);
    return seasons.map((data) => {
      const standing = selectedTeamStanding(data, id);
      return standing.team ? { season: data.season, standing } : null;
    }).filter(Boolean).sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season));
  }

  function competitiveResults(data) {
    return (data.gameResults?.results || data.game_results?.results || [])
      .filter((game) => !String(game.section || "").toLowerCase().includes("preseason"))
      .filter((game) => Number.isFinite(Number(game.homeScore)) && Number.isFinite(Number(game.awayScore)));
  }

  function leaderCategoryByTitle(data, patterns) {
    const wanted = patterns.map((pattern) => String(pattern).toLowerCase());
    return leaderCategories(data).find(({ category }) => {
      const title = String(category.title || "").toLowerCase();
      return wanted.some((pattern) => title.includes(pattern));
    });
  }

  function seasonAwardRows(data, patterns = []) {
    const wanted = patterns.map((pattern) => String(pattern).toLowerCase());
    return (data.seasonAwards.sections || []).flatMap((section) => (section.awards || [])
      .filter((award) => !wanted.length || wanted.some((pattern) => String(award.award || "").toLowerCase().includes(pattern)))
      .map((award) => ({ section, award })));
  }

  function teamStatLeader(data, key, side = "team", higherIsBetter = true) {
    return (data.teamStats.teams || []).slice().sort((a, b) => {
      const av = num(a.stats?.[key]?.[side]?.value);
      const bv = num(b.stats?.[key]?.[side]?.value);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return higherIsBetter ? bv - av : av - bv;
    })[0] || {};
  }

  function renderSeasonRecap(data) {
    const selected = data.season;
    const teams = allTeamsFromLatest(data);
    const teamFiles = new Map(teams.map((team) => [slug(team.team), team.rosterFile]));
    const champion = teams.slice().sort((a, b) => teamOverallRank(a) - teamOverallRank(b))[0] || {};
    const promoted = teams.filter((row) => movementMarker(row.tier, row.position, row.teamCount) === "P");
    const relegated = teams.filter((row) => movementMarker(row.tier, row.position, row.teamCount) === "R");
    const awardHighlights = seasonAwardRows(data, ["most valuable", "rookie", "defender", "6th", "sixth", "gm"]).slice(0, 8);
    const leaderHighlights = ["points", "rebounds", "assists", "steals", "blocks"].map((key) => {
      const match = leaderCategoryByTitle(data, [key]);
      const leader = match?.category?.leaders?.[0];
      return leader ? { key, tier: match.tier, category: match.category, leader } : null;
    }).filter(Boolean);
    const topPlayers = (state.playerIndex?.identities || []).flatMap((identity) => (identity.appearances || [])
      .filter((appearance) => appearance.season === selected)
      .map((appearance) => ({ ...appearance, name: identity.name, key: identity.key })))
      .filter((player) => num(player.overall) !== null)
      .sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))
      .slice(0, 8);
    const blowouts = competitiveResults(data).slice().sort((a, b) => (num(b.margin) || 0) - (num(a.margin) || 0)).slice(0, 6);
    const shootouts = competitiveResults(data).slice().sort((a, b) => ((num(b.homeScore) || 0) + (num(b.awayScore) || 0)) - ((num(a.homeScore) || 0) + (num(a.awayScore) || 0))).slice(0, 6);
    const pointsLeader = teamStatLeader(data, "points");
    const defenseLeader = teamStatLeader(data, "points", "opponent", false);
    const marginLeader = teamStatLeader(data, "points", "margin");
    const rebLeader = teamStatLeader(data, "rebounds");
    const astLeader = teamStatLeader(data, "assists");

    return `
      <section class="dashboard-grid season-recap-grid">
        ${dashboardCard("Champion", teamMini(champion.team, champion.rosterFile), `${esc(champion.wins)}-${esc(champion.losses)} in ${esc(champion.tier)} with a ${esc(champion.diff)} point diff.`)}
        ${dashboardCard("Best Attack", teamMini(pointsLeader.team, pointsLeader.file), `${esc(pointsLeader.stats?.points?.team?.value ?? "-")} PPG, rank ${esc(pointsLeader.stats?.points?.team?.totalRank ?? "-")}.`)}
        ${dashboardCard("Best Defense", teamMini(defenseLeader.team, defenseLeader.file), `${esc(defenseLeader.stats?.points?.opponent?.value ?? "-")} opponent PPG.`)}
        ${dashboardCard("Movement", "Promotion / Relegation", `${promoted.map((team) => esc(team.team)).join(", ") || "No promoted teams"}${relegated.length ? ` | Down: ${relegated.map((team) => esc(team.team)).join(", ")}` : ""}`, "#standings")}
      </section>
      <div class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Season Award Snapshot</h2>${table(["Tier", "Award", "Person", "Team"], awardHighlights.map(({ section, award }) => `<tr><td>${esc(section.title)}</td><td>${esc(award.award)}</td><td>${playerLink(selected, award.personFile, award.person)}</td><td>${teamLink(award.teamFile, award.team)}</td></tr>`), "No archived season awards")}</section>
          <section class="reference-section"><h2>Stat Leaders Snapshot</h2>${table(["Category", "Tier", "Player", "Team", "Value"], leaderHighlights.map(({ tier, category, leader }) => `<tr><td>${esc(category.title)}</td><td>${esc(tier)}</td><td>${playerLink(selected, leader.playerFile, leader.player)}</td><td>${teamLink(leader.teamFile, leader.teamName)}</td><td class="num">${esc(leader.valueText || leader.value)}</td></tr>`), "No leader highlights")}</section>
          <section class="reference-section"><h2>Highest Rated Players</h2>${table(["Player", "Pos", "Team", "Age", "OVR", "POT"], topPlayers.map((player) => {
            return `<tr><td><a href="player.htm?key=${encodeURIComponent(player.key)}">${esc(player.name)}</a></td><td>${esc(player.pos)}</td><td>${teamLink(teamFiles.get(slug(player.team)), player.team)}</td><td class="num">${esc(player.age)}</td><td>${ratingChip("OVR", player.overall)}</td><td>${ratingChip("POT", player.potential)}</td></tr>`;
          }), "No player ratings archived")}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Team Identity</h2>${table(["Trait", "Team", "Value"], [
            `<tr><td>Point Margin</td><td>${teamMini(marginLeader.team, marginLeader.file)}</td><td class="num">${esc(marginLeader.stats?.points?.margin?.value ?? "-")}</td></tr>`,
            `<tr><td>Rebounding</td><td>${teamMini(rebLeader.team, rebLeader.file)}</td><td class="num">${esc(rebLeader.stats?.rebounds?.team?.value ?? "-")}</td></tr>`,
            `<tr><td>Passing</td><td>${teamMini(astLeader.team, astLeader.file)}</td><td class="num">${esc(astLeader.stats?.assists?.team?.value ?? "-")}</td></tr>`
          ], "No team stat leaders")}</section>
          <section class="reference-section"><h2>Biggest Wins</h2>${table(["Date", "Winner", "Loser", "Score", "Margin"], blowouts.map((game) => `<tr><td>${esc(game.date)}</td><td>${teamLink(game.winner, game.winnerName)}</td><td>${teamLink(game.loser, game.loserName)}</td><td class="num">${esc(game.homeScore)}-${esc(game.awayScore)}</td><td class="num">${esc(game.margin)}</td></tr>`), "No game results archived")}</section>
          <section class="reference-section"><h2>Highest Scoring Games</h2>${table(["Date", "Matchup", "Score", "Total"], shootouts.map((game) => `<tr><td>${esc(game.date)}</td><td>${teamLink(game.awayTeam, game.awayTeamName)} at ${teamLink(game.homeTeam, game.homeTeamName)}</td><td class="num">${esc(game.awayScore)}-${esc(game.homeScore)}</td><td class="num">${esc((num(game.homeScore) || 0) + (num(game.awayScore) || 0))}</td></tr>`), "No game results archived")}</section>
        </div>
      </div>`;
  }

  async function renderSeason() {
    const selected = selectedSeasonOrLatest();
    const data = await loadSeason(selected, ["standings", "leaders", "teamStats", "awards", "seasonAwards", "gameResults", "supercupStandings", "supercupLeaders"]);
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Season Controls</h2><div class="filter-bar">
        <label>Season ${seasonSelector(selected)}</label>
        <div class="history-meta"><span class="pill">${(data.standings.sections || []).length} Divisions</span><span class="pill">Archive Only</span></div>
      </div></section>
      ${renderSeasonRecap(data)}
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

  function statValue(row, key) {
    const value = row?.[key];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function oneDecimal(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return String(Math.round(n * 10) / 10);
  }

  function compareEdge(left, right, higherIsBetter = true) {
    const a = Number(left);
    const b = Number(right);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "-";
    const diff = a - b;
    if (Math.abs(diff) < 0.001) return "Even";
    const leader = higherIsBetter ? (diff > 0 ? "A" : "B") : (diff < 0 ? "A" : "B");
    return `${leader} +${oneDecimal(Math.abs(diff))}`;
  }

  function compareRankEdge(left, right) {
    return compareEdge(left, right, false);
  }

  function compareTextEdge(left, right) {
    if (!left || !right) return "-";
    return String(left) === String(right) ? "Even" : "-";
  }

  function compareMatrix(title, rows) {
    const rendered = rows.filter(Boolean).map((row) => `<tr><td>${esc(row.label)}</td><td>${row.aHtml ?? esc(row.a ?? "-")}</td><td>${row.bHtml ?? esc(row.b ?? "-")}</td><td>${esc(row.edge ?? "-")}</td></tr>`);
    return `<section class="reference-section compare-summary"><h2>${esc(title)}</h2>${table(["Metric", "A", "B", "Edge"], rendered, "Choose both sides to compare")}</section>`;
  }

  function playerStatRows(stat) {
    return stat?.stats?.season_averages?.rows || [];
  }

  function playerCareerRow(stat) {
    return playerStatRows(stat).find((row) => String(row.season || "").toLowerCase() === "career") || {};
  }

  function bestPlayerStatSeason(stat, key) {
    return playerStatRows(stat)
      .filter((row) => String(row.season || "").toLowerCase() !== "career")
      .sort((a, b) => (statValue(b, key) || 0) - (statValue(a, key) || 0))[0] || {};
  }

  async function playerCompareSummary(key) {
    const identity = (state.playerIndex?.identities || []).find((item) => item.key === key);
    if (!identity) return null;
    const appearances = identity.appearances || [];
    const awardKeys = new Set();
    let weeklyAwards = 0;
    for (const appearance of appearances) {
      const data = await loadSeason(appearance.season, ["seasonAwards", "awards"]);
      (data.seasonAwards.sections || []).forEach((section) => (section.awards || [])
        .filter((award) => award.personFile === appearance.playerFile)
        .forEach((award) => awardKeys.add(`${appearance.season}|${section.title}|${award.award}|${award.personFile}`)));
      (data.awards.sections || []).forEach((section) => (section.categories || []).forEach((category) => (category.awards || [])
        .filter((award) => award.playerFile === appearance.playerFile)
        .forEach((award) => {
          weeklyAwards += 1;
          awardKeys.add(`${appearance.season}|${section.title}|${category.title}|${award.date}|${award.playerFile}`);
        })));
    }
    const peak = appearances.slice().sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || {};
    const latestStat = (await loadPlayerProfile(key))?.latestStats || {};
    const career = playerCareerRow(latestStat);
    const bestPpg = bestPlayerStatSeason(latestStat, "pts");
    const bestRpg = bestPlayerStatSeason(latestStat, "drb");
    const reb = (statValue(career, "orb") || 0) + (statValue(career, "drb") || 0);
    return {
      name: identity.name,
      seasons: appearances.length,
      peak,
      career,
      ppg: statValue(career, "pts"),
      rpg: reb || null,
      apg: statValue(career, "ast"),
      spg: statValue(career, "stl"),
      bpg: statValue(career, "blk"),
      fgPct: statValue(career, "fg_pct"),
      threePct: statValue(career, "3p_pct"),
      ftPct: statValue(career, "ft_pct"),
      awards: awardKeys.size,
      weeklyAwards,
      bestPpg,
      bestRpg
    };
  }

  async function teamCompareSummary(id) {
    if (!id) return null;
    const seasons = await allSeasonData(["standings", "teamStats", "seasonAwards", "awards"]);
    const history = [];
    const statRows = [];
    let seasonAwards = 0;
    let weeklyAwards = 0;
    seasons.forEach((data) => {
      const standing = selectedTeamStanding(data, id);
      if (standing.team) history.push({ season: data.season, standing });
      const stats = (data.teamStats.teams || []).find((row) => fileStem(row.file) === id);
      if (stats) statRows.push(stats);
      (data.seasonAwards.sections || []).forEach((section) => (section.awards || [])
        .filter((award) => fileStem(award.teamFile) === id)
        .forEach(() => { seasonAwards += 1; }));
      (data.awards.sections || []).forEach((section) => (section.categories || []).forEach((category) => (category.awards || [])
        .filter((award) => fileStem(award.teamFile) === id)
        .forEach(() => { weeklyAwards += 1; })));
    });
    const wins = history.reduce((sum, row) => sum + (num(row.standing.wins) || 0), 0);
    const losses = history.reduce((sum, row) => sum + (num(row.standing.losses) || 0), 0);
    const bestFinish = history.slice().sort((a, b) => teamOverallRank(a.standing) - teamOverallRank(b.standing))[0];
    const avgFinish = history.length ? history.reduce((sum, row) => sum + (num(row.standing.position) || 0), 0) / history.length : null;
    const avgDiff = history.length ? history.reduce((sum, row) => sum + (num(row.standing.diff) || 0), 0) / history.length : null;
    const avgStat = (key, side = "team") => {
      const values = statRows.map((row) => num(row.stats?.[key]?.[side]?.value)).filter((value) => value !== null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    return {
      seasons: history.length,
      wins,
      losses,
      winPct: wins + losses ? wins / (wins + losses) : null,
      bestFinish,
      avgFinish,
      avgDiff,
      promotions: history.filter((row) => row.standing.marker === "P").length,
      relegations: history.filter((row) => row.standing.marker === "R").length,
      titles: history.filter((row) => row.standing.marker === "C").length,
      points: avgStat("points"),
      opponentPoints: avgStat("points", "opponent"),
      rebounds: avgStat("rebounds"),
      assists: avgStat("assists"),
      awards: seasonAwards + weeklyAwards,
      seasonAwards,
      weeklyAwards
    };
  }

  function renderPlayerCompareSummary(a, b) {
    if (!a || !b) return "";
    const aPeak = num(a.peak.overall);
    const bPeak = num(b.peak.overall);
    return `
      ${compareMatrix("Player Ratings", [
        { label: "Archived Seasons", a: a.seasons, b: b.seasons, edge: compareEdge(a.seasons, b.seasons) },
        { label: "Peak OVR", aHtml: ratingChip("OVR", a.peak.overall), bHtml: ratingChip("OVR", b.peak.overall), edge: compareEdge(aPeak, bPeak) },
        { label: "Peak Season", a: seasonLabel(a.peak.season), b: seasonLabel(b.peak.season), edge: compareTextEdge(a.peak.season, b.peak.season) },
        { label: "Peak Team", a: a.peak.team, b: b.peak.team, edge: compareTextEdge(a.peak.team, b.peak.team) }
      ])}
      ${compareMatrix("Player Stats & Awards", [
        { label: "Career PPG", a: oneDecimal(a.ppg), b: oneDecimal(b.ppg), edge: compareEdge(a.ppg, b.ppg) },
        { label: "Career RPG", a: oneDecimal(a.rpg), b: oneDecimal(b.rpg), edge: compareEdge(a.rpg, b.rpg) },
        { label: "Career APG", a: oneDecimal(a.apg), b: oneDecimal(b.apg), edge: compareEdge(a.apg, b.apg) },
        { label: "Career SPG", a: oneDecimal(a.spg), b: oneDecimal(b.spg), edge: compareEdge(a.spg, b.spg) },
        { label: "Career BPG", a: oneDecimal(a.bpg), b: oneDecimal(b.bpg), edge: compareEdge(a.bpg, b.bpg) },
        { label: "FG%", a: percent(a.fgPct), b: percent(b.fgPct), edge: compareEdge(a.fgPct, b.fgPct) },
        { label: "3P%", a: percent(a.threePct), b: percent(b.threePct), edge: compareEdge(a.threePct, b.threePct) },
        { label: "FT%", a: percent(a.ftPct), b: percent(b.ftPct), edge: compareEdge(a.ftPct, b.ftPct) },
        { label: "Best PPG Season", a: `${oneDecimal(a.bestPpg.pts)} (${a.bestPpg.season || "-"})`, b: `${oneDecimal(b.bestPpg.pts)} (${b.bestPpg.season || "-"})`, edge: compareEdge(a.bestPpg.pts, b.bestPpg.pts) },
        { label: "Awards / Honors", a: a.awards, b: b.awards, edge: compareEdge(a.awards, b.awards) },
        { label: "Weekly / Monthly Awards", a: a.weeklyAwards, b: b.weeklyAwards, edge: compareEdge(a.weeklyAwards, b.weeklyAwards) }
      ])}`;
  }

  function renderTeamCompareSummary(a, b) {
    if (!a || !b) return "";
    const bestA = a.bestFinish?.standing;
    const bestB = b.bestFinish?.standing;
    return `
      ${compareMatrix("Team Results", [
        { label: "Archived Seasons", a: a.seasons, b: b.seasons, edge: compareEdge(a.seasons, b.seasons) },
        { label: "Total Record", a: `${a.wins}-${a.losses}`, b: `${b.wins}-${b.losses}`, edge: compareEdge(a.wins, b.wins) },
        { label: "Win%", a: percent(a.winPct), b: percent(b.winPct), edge: compareEdge(a.winPct, b.winPct) },
        { label: "Best Finish", a: `${bestA?.tier || "-"} #${bestA?.position || "-"}`, b: `${bestB?.tier || "-"} #${bestB?.position || "-"}`, edge: compareRankEdge(teamOverallRank(bestA || {}), teamOverallRank(bestB || {})) },
        { label: "Average Finish", a: oneDecimal(a.avgFinish), b: oneDecimal(b.avgFinish), edge: compareRankEdge(a.avgFinish, b.avgFinish) },
        { label: "Average Diff", a: oneDecimal(a.avgDiff), b: oneDecimal(b.avgDiff), edge: compareEdge(a.avgDiff, b.avgDiff) },
        { label: "Titles", a: a.titles, b: b.titles, edge: compareEdge(a.titles, b.titles) },
        { label: "Promotions", a: a.promotions, b: b.promotions, edge: compareEdge(a.promotions, b.promotions) },
        { label: "Relegations", a: a.relegations, b: b.relegations, edge: compareEdge(a.relegations, b.relegations, false) }
      ])}
      ${compareMatrix("Team Stats & Awards", [
        { label: "Avg PTS", a: oneDecimal(a.points), b: oneDecimal(b.points), edge: compareEdge(a.points, b.points) },
        { label: "Avg OPP PTS", a: oneDecimal(a.opponentPoints), b: oneDecimal(b.opponentPoints), edge: compareEdge(a.opponentPoints, b.opponentPoints, false) },
        { label: "Avg REB", a: oneDecimal(a.rebounds), b: oneDecimal(b.rebounds), edge: compareEdge(a.rebounds, b.rebounds) },
        { label: "Avg AST", a: oneDecimal(a.assists), b: oneDecimal(b.assists), edge: compareEdge(a.assists, b.assists) },
        { label: "Awards / Honors", a: a.awards, b: b.awards, edge: compareEdge(a.awards, b.awards) },
        { label: "Season Awards", a: a.seasonAwards, b: b.seasonAwards, edge: compareEdge(a.seasonAwards, b.seasonAwards) },
        { label: "Weekly / Monthly Awards", a: a.weeklyAwards, b: b.weeklyAwards, edge: compareEdge(a.weeklyAwards, b.weeklyAwards) }
      ])}`;
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

  function supercupTeamHistoryLink(data, team) {
    const archivedTeam = (data.teams || []).find((row) => sameTeamName(row.name || row.team, team))
      || (data.standings.sections || []).flatMap((section) => section.teams || []).find((row) => sameTeamName(row.team, team));
    const file = archivedTeam?.file || archivedTeam?.rosterFile || archivedTeam?.id || "";
    const teamHtml = supercupTeam(team);
    return file
      ? `<a class="cup-team-link" href="team.htm?id=${encodeURIComponent(fileStem(file))}">${teamHtml}</a>`
      : teamHtml;
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
      ? ["Round of 16", "Quarterfinals", "Semifinals", "Final"]
      : grouped.map((_round, index) => `Round ${index + 1}`);
    return grouped.map((round, index) => ({ ...round, title: titles[index] }));
  }

  function supercupMatchCard(game, seeds, data) {
    const winner = game.winnerName;
    const teams = [
      { name: game.awayTeamName, score: game.awayScore },
      { name: game.homeTeamName, score: game.homeScore }
    ].sort((a, b) => (seeds.get(a.name) || 99) - (seeds.get(b.name) || 99));
    return `<article class="cup-match">
      ${teams.map((team) => `<div class="cup-match-row ${team.name === winner ? "winner" : ""}"><span class="cup-seed">#${esc(seeds.get(team.name) || "-")}</span>${supercupTeamHistoryLink(data, team.name)}<strong class="cup-score">${esc(team.score)}</strong></div>`).join("")}
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
        <div class="cup-round-matches">${round.games.map((game) => supercupMatchCard(game, seeds, data)).join("")}</div>
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
    const data = await loadSeason(selected, ["teams", "standings", "supercupStandings", "supercupLeaders", "supercupResults"]);
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

  function recordPlayerAnchor(record) {
    return record?.identity?.key
      ? `<a href="player.htm?key=${encodeURIComponent(record.identity.key)}">${esc(record.identity.name)}</a>`
      : esc(record?.name || "Unknown Player");
  }

  function recordNumber(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString("en-US") : "-";
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "-";
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }

  function recordLeaderboard(title, records, rowKey, limit, valueLabel = "Total", formatter = recordNumber) {
    const ranked = records
      .map((record) => ({ record, value: statValue(record[rowKey.source], rowKey.key) }))
      .filter(({ value }) => value !== null && value > 0)
      .sort((a, b) => b.value - a.value || String(a.record.identity?.name || "").localeCompare(String(b.record.identity?.name || "")))
      .slice(0, limit);
    return `<section class="reference-section"><h2>${esc(title)}</h2>${table(
      ["Rank", "Player", "Team", valueLabel],
      ranked.map(({ record, value }, index) => `<tr><td class="num">${index + 1}</td><td>${recordPlayerAnchor(record)}</td><td>${esc(record.appearance?.team || "-")}</td><td class="num">${formatter(value)}</td></tr>`),
      `No ${title.toLowerCase()} available`
    )}</section>`;
  }

  async function renderFinance() {
    const feed = await fetchJson(`${HISTORY_ROOT}finance_history.json`, { throughLabel: seasonLabel(latestSeason()), capHistory: [], earnings: [] }, { cache: "no-store" });
    const identityMap = new Map((state.playerIndex?.identities || []).map((identity) => [identity.key, identity]));
    const p = params();
    const selectedSeason = p.get("season") || "all";
    const selectedTeam = p.get("team") || "all";
    const teams = Array.from(new Map((feed.capHistory || []).map((row) => [row.file || row.team, { file: row.file, team: row.team }])).values())
      .sort((a, b) => String(a.team).localeCompare(String(b.team)));
    const filtered = (feed.capHistory || []).filter((row) =>
      (selectedSeason === "all" || row.season === selectedSeason)
      && (selectedTeam === "all" || row.file === selectedTeam)
    );
    const latestId = latestSeason();
    const latestRows = (feed.capHistory || []).filter((row) => row.season === latestId && (selectedTeam === "all" || row.file === selectedTeam));
    const payrollLeader = latestRows.slice().sort((a, b) => Number(b.salary || 0) - Number(a.salary || 0))[0];
    const roomLeader = latestRows.slice().sort((a, b) => Number(b.capRoom || 0) - Number(a.capRoom || 0))[0];
    const earnings = (feed.earnings || []).map((row) => ({ ...row, identity: identityMap.get(row.key) || { key: row.key, name: row.name } }));
    const earningsLeader = earnings[0];
    const capRows = filtered.slice().sort((a, b) => seasonNumber(b.season) - seasonNumber(a.season) || String(a.team).localeCompare(String(b.team)));
    const paidLink = (row) => row?.highestPaid?.key
      ? `<a href="player.htm?key=${encodeURIComponent(row.highestPaid.key)}">${esc(row.highestPaid.name)}</a>`
      : esc(row?.highestPaid?.name || "-");

    $("#history-app").innerHTML = `
      <section class="history-hero">
        <div class="eyebrow">Archive Finance Database</div>
        <h1>Salary and Cap History</h1>
        <div class="history-meta"><span class="pill">Through ${esc(feed.throughLabel || seasonLabel(latestId))}</span><span class="pill">${feed.capHistory?.length || 0} Team Seasons</span><span class="pill">Estimated Archived Earnings</span></div>
      </section>
      <section class="reference-section compact-controls"><h2>Finance Controls</h2><div class="filter-bar">
        <label>Season <select id="financeSeason"><option value="all">All</option>${(state.index?.seasons || []).map((row) => `<option value="${esc(row.season)}" ${selectedSeason === row.season ? "selected" : ""}>${esc(row.label || row.season)}</option>`).join("")}</select></label>
        <label>Team <select id="financeTeam"><option value="all">All</option>${teams.map((row) => `<option value="${esc(row.file)}" ${selectedTeam === row.file ? "selected" : ""}>${esc(row.team)}</option>`).join("")}</select></label>
      </div></section>
      <section class="dashboard-grid">
        ${dashboardCard("Largest Latest Payroll", payrollLeader ? teamMini(payrollLeader.team, payrollLeader.file) : "-", formatMoney(payrollLeader?.salary))}
        ${dashboardCard("Most Latest Cap Room", roomLeader ? teamMini(roomLeader.team, roomLeader.file) : "-", formatMoney(roomLeader?.capRoom))}
        ${dashboardCard("Archived Earnings Leader", earningsLeader ? recordPlayerAnchor(earningsLeader) : "-", formatMoney(earningsLeader?.total))}
        ${dashboardCard("Archive Coverage", `${feed.capHistory?.length || 0} team seasons`, `${earnings.length} paid players`)}
      </section>
      <section class="reference-section" id="cap-history"><h2>Team Cap History</h2><p class="muted">Season-end archived snapshots. Exceptions and cap room reflect the state of the original cap report when that season was archived.</p>${table(
        ["Season", "Team", "Payroll", "Cap Room", "Budget Room", "Mid Exception", "Low Exception", "Highest-Paid Player", "Salary"],
        capRows.map((row) => `<tr><td>${esc(row.label || seasonLabel(row.season))}</td><td>${teamMini(row.team, row.file)}</td><td class="num">${formatMoney(row.salary)}</td><td class="num">${formatMoney(row.capRoom)}</td><td class="num">${formatMoney(row.budgetRoom)}</td><td class="num">${formatMoney(row.midException)}</td><td class="num">${formatMoney(row.lowException)}</td><td>${paidLink(row)}</td><td class="num">${formatMoney(row.highestPaid?.salary)}</td></tr>`),
        "No cap history matches these filters"
      )}</section>
      <section class="reference-section" id="earnings"><h2>Estimated Player Earnings</h2><p class="muted">Sum of each player's salary in completed archived seasons only. It is not a full pre-archive career earnings figure.</p>${table(
        ["Rank", "Player", "Archived Seasons Paid", "Estimated Earnings"],
        earnings.slice(0, 100).map((row, index) => `<tr><td class="num">${index + 1}</td><td>${recordPlayerAnchor(row)}</td><td class="num">${row.history?.length || 0}</td><td class="num">${formatMoney(row.total)}</td></tr>`),
        "No archived earnings available"
      )}</section>`;
    const update = () => navigate(`finance.htm?season=${encodeURIComponent($("#financeSeason")?.value || "all")}&team=${encodeURIComponent($("#financeTeam")?.value || "all")}`);
    $("#financeSeason")?.addEventListener("change", update);
    $("#financeTeam")?.addEventListener("change", update);
  }

  async function renderRecords() {
    const feed = await fetchJson(`${HISTORY_ROOT}league_records.json`, {
      throughLabel: seasonLabel(latestSeason()),
      players: [],
      awards: [],
      championships: [],
      championshipTotals: [],
      franchises: []
    });
    const identities = new Map((state.playerIndex?.identities || []).map((identity) => [identity.key, identity]));
    const records = (feed.players || []).map((record) => ({
      ...record,
      identity: identities.get(record.key) || { key: record.key, name: record.name },
      appearance: { team: record.team, season: record.season }
    }));
    const awards = (feed.awards || []).map((record) => ({
      ...record,
      identity: identities.get(record.key) || { key: record.key, name: record.name }
    }));
    const championships = feed.championships || [];
    const titleTotals = feed.championshipTotals || [];
    const franchises = feed.franchises || [];
    const hasPlayoffRecords = records.some((record) => (statValue(record.playoffs, "g") || 0) > 0);
    const selectedLimit = ["10", "25", "50"].includes(params().get("limit")) ? params().get("limit") : "10";
    const limit = Number(selectedLimit);
    const through = feed.throughLabel || seasonLabel(latestSeason());
    const pointsLeader = records.slice().sort((a, b) => (statValue(b.career, "pts") || 0) - (statValue(a.career, "pts") || 0))[0];
    const gamePointsLeader = records.slice().sort((a, b) => (statValue(b.highs, "pts") || 0) - (statValue(a.highs, "pts") || 0))[0];
    const titleLeader = titleTotals[0];
    const awardLeader = awards[0];
    const seasonDisplay = (season) => (state.index?.seasons || []).find((item) => String(item.label || "").startsWith(String(season)))?.label || season;

    $("#history-app").innerHTML = `
      <section class="history-hero">
        <div class="eyebrow">Archive Record Book</div>
        <h1>League Records</h1>
        <div class="history-meta"><span class="pill">Through ${esc(through)}</span><span class="pill">${records.length} Players</span><span class="pill">${championships.length} Championships</span></div>
      </section>
      <section class="reference-section compact-controls"><h2>Record Controls</h2><div class="filter-bar">
        <label>Rows <select id="recordsLimit">${["10", "25", "50"].map((value) => `<option value="${value}" ${selectedLimit === value ? "selected" : ""}>Top ${value}</option>`).join("")}</select></label>
        <div class="history-meta"><span class="pill">Completed Seasons Only</span><span class="pill">Career Highs = Single Game</span></div>
      </div></section>
      <section class="dashboard-grid">
        ${dashboardCard("Career Scoring", recordPlayerAnchor(pointsLeader), `${recordNumber(statValue(pointsLeader?.career, "pts"))} points`)}
        ${dashboardCard("Single-Game Points", recordPlayerAnchor(gamePointsLeader), `${recordNumber(statValue(gamePointsLeader?.highs, "pts"))} points`)}
        ${dashboardCard("Most Championships", titleLeader ? teamMini(titleLeader.team, titleLeader.file) : "No champion", `${recordNumber(titleLeader?.titles)} titles`)}
        ${dashboardCard("Major Awards", awardLeader ? recordPlayerAnchor(awardLeader) : "No winner", `${recordNumber(awardLeader?.total)} awards`)}
      </section>
      <div id="career-records">
        <section class="reference-section"><h2>Career Records <span class="muted">Regular season totals</span></h2><p class="muted">The latest archived Career row is used once per historical player; archived seasons are not added together twice.</p></section>
        <div class="history-grid three">
          ${recordLeaderboard("Career Points", records, { source: "career", key: "pts" }, limit)}
          ${recordLeaderboard("Career Rebounds", records, { source: "career", key: "reb" }, limit)}
          ${recordLeaderboard("Career Assists", records, { source: "career", key: "ast" }, limit)}
          ${recordLeaderboard("Career Steals", records, { source: "career", key: "stl" }, limit)}
          ${recordLeaderboard("Career Blocks", records, { source: "career", key: "blk" }, limit)}
          ${recordLeaderboard("Career Games", records, { source: "career", key: "g" }, limit)}
        </div>
        <section class="reference-section"><h2>Expanded Career Totals</h2><p class="muted">Volume and possession records from the latest archived Career totals row for each player.</p></section>
        <div class="history-grid three">
          ${recordLeaderboard("Career Minutes", records, { source: "career", key: "min" }, limit)}
          ${recordLeaderboard("Career Field Goals", records, { source: "career", key: "fgm" }, limit)}
          ${recordLeaderboard("Career Three-Pointers", records, { source: "career", key: "3pm" }, limit)}
          ${recordLeaderboard("Career Free Throws", records, { source: "career", key: "ftm" }, limit)}
          ${recordLeaderboard("Career Turnovers", records, { source: "career", key: "to" }, limit)}
          ${recordLeaderboard("Career Plus/Minus", records, { source: "career", key: "plus_minus" }, limit)}
        </div>
        <section class="reference-section"><h2>Career Efficiency</h2><p class="muted">Efficiency values come from the export's Career efficiency row and are not summed across archive snapshots.</p></section>
        <div class="history-grid three">
          ${recordLeaderboard("Career PER", records, { source: "efficiency", key: "per" }, limit, "PER")}
          ${recordLeaderboard("Career EWA", records, { source: "efficiency", key: "ewa" }, limit, "EWA")}
          ${recordLeaderboard("Career True Shooting", records, { source: "efficiency", key: "ts_pct" }, limit, "TS%", percent)}
          ${recordLeaderboard("Efficiency Plus/Minus", records, { source: "efficiency", key: "plus_minus" }, limit, "+/-")}
        </div>
      </div>
      <div id="game-highs">
        <section class="reference-section"><h2>Single-Game Records <span class="muted">Player Career Highs</span></h2><p class="muted">These values come directly from each player's Career Highs table. The export does not attach a date or opponent to the record.</p></section>
        <div class="history-grid three">
          ${recordLeaderboard("Single-Game Points", records, { source: "highs", key: "pts" }, limit, "High")}
          ${recordLeaderboard("Single-Game Rebounds", records, { source: "highs", key: "reb" }, limit, "High")}
          ${recordLeaderboard("Single-Game Assists", records, { source: "highs", key: "ast" }, limit, "High")}
          ${recordLeaderboard("Single-Game Steals", records, { source: "highs", key: "stl" }, limit, "High")}
          ${recordLeaderboard("Single-Game Blocks", records, { source: "highs", key: "blk" }, limit, "High")}
          ${recordLeaderboard("Single-Game Threes", records, { source: "highs", key: "3pm" }, limit, "High")}
          ${recordLeaderboard("Single-Game Field Goals", records, { source: "highs", key: "fgm" }, limit, "High")}
          ${recordLeaderboard("Single-Game Free Throws", records, { source: "highs", key: "ftm" }, limit, "High")}
          ${recordLeaderboard("Single-Game Turnovers", records, { source: "highs", key: "to" }, limit, "High")}
        </div>
      </div>
      <div id="playoff-records">
        <section class="reference-section"><h2>Playoff Records</h2><p class="muted">Career playoff games and per-game production from each player's archived playoff Career row.</p></section>
        ${hasPlayoffRecords ? `<div class="history-grid three">
          ${recordLeaderboard("Playoff Games", records, { source: "playoffs", key: "g" }, limit)}
          ${recordLeaderboard("Playoff Points Per Game", records, { source: "playoffs", key: "pts" }, limit, "PPG")}
          ${recordLeaderboard("Playoff Rebounds Per Game", records, { source: "playoffs", key: "reb" }, limit, "RPG")}
          ${recordLeaderboard("Playoff Assists Per Game", records, { source: "playoffs", key: "ast" }, limit, "APG")}
          ${recordLeaderboard("Playoff Steals Per Game", records, { source: "playoffs", key: "stl" }, limit, "SPG")}
          ${recordLeaderboard("Playoff Blocks Per Game", records, { source: "playoffs", key: "blk" }, limit, "BPG")}
        </div>` : `<div class="empty">The completed archives currently contain zero playoff games in every player playoff table. This section will populate automatically once a future archive includes valid playoff statistics.</div>`}
      </div>
      <section class="reference-section" id="franchise-records"><h2>Franchise Record Book</h2><p class="muted">Regular-season standings and game results across completed archive seasons. Highest scoring is points per game; biggest victory excludes preseason.</p>${table(
        ["Team", "Seasons", "W", "L", "Win%", "Titles", "Best Season", "Worst Season", "Highest Scoring", "Biggest Victory"],
        franchises.map((row) => `<tr><td>${teamMini(row.team, row.file)}</td><td class="num">${row.seasons}</td><td class="num">${row.wins}</td><td class="num">${row.losses}</td><td class="num">${(Number(row.pct || 0) * 100).toFixed(1)}%</td><td class="num">${row.titles}</td><td>${esc(row.bestSeason?.label || "-")} (${esc(row.bestSeason?.wins ?? "-")}-${esc(row.bestSeason?.losses ?? "-")})</td><td>${esc(row.worstSeason?.label || "-")} (${esc(row.worstSeason?.wins ?? "-")}-${esc(row.worstSeason?.losses ?? "-")})</td><td>${esc(row.highestScoring?.points ?? "-")} <span class="muted">${esc(row.highestScoring?.label || "")}</span></td><td>${row.biggestVictory?.margin ? `+${esc(row.biggestVictory.margin)} vs ${esc(row.biggestVictory.opponent)} <span class="muted">${esc(row.biggestVictory.label)}</span>` : "-"}</td></tr>`),
        "No franchise records available"
      )}</section>
      <div id="honours" class="history-grid main-rail">
        <div>
          <section class="reference-section"><h2>Major Award Leaders</h2>${table(
            ["Rank", "Player", "MVP", "DPOY", "ROTY", "6MOY", "MIP", "Total"],
            awards.slice(0, limit).map((record, index) => `<tr><td class="num">${index + 1}</td><td>${recordPlayerAnchor(record)}</td><td class="num">${record.MVP}</td><td class="num">${record.DPOY}</td><td class="num">${record.ROTY}</td><td class="num">${record["6MOY"]}</td><td class="num">${record.MIP}</td><td class="num">${record.total}</td></tr>`),
            "No archived major awards"
          )}</section>
        </div>
        <div>
          <section class="reference-section"><h2>Championship Totals</h2>${table(
            ["Rank", "Team", "Titles", "Winning Seasons"],
            titleTotals.map((record, index) => `<tr><td class="num">${index + 1}</td><td>${teamMini(record.team, record.file)}</td><td class="num">${record.titles}</td><td>${esc(record.wins.join(", "))}</td></tr>`),
            "Championship history unavailable"
          )}</section>
        </div>
      </div>
      <section class="reference-section"><h2>Championship History</h2>${table(
        ["Season", "Competition", "Champion", "Finalist"],
        championships.map((record) => `<tr><td>${esc(seasonDisplay(record.season))}</td><td>${esc(record.tier)}</td><td>${teamMini(record.champion, record.championFile)}</td><td>${teamMini(record.opponent, record.opponentFile)}</td></tr>`),
        "Championship history unavailable"
      )}</section>`;
    $("#recordsLimit")?.addEventListener("change", (event) => navigate(`records.htm?limit=${encodeURIComponent(event.target.value)}`));
  }

  async function renderLeaders() {
    const selected = selectedSeasonOrLatest();
    await ensureCurrentData();
    const data = await loadSeason(selected, ["leaders", "standings"]);
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
    let leaders = (active?.category?.leaders || []).map((leader) => {
      const identity = identityForSeasonPlayer(selected, leader.playerFile);
      const player = (identity?.appearances || []).find((appearance) => appearance.season === selected) || {};
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
    const requestedSeason = params().get("season");
    const selected = requestedSeason || "all";
    const allData = selected === "all" ? await allSeasonData(["youth"]) : [];
    const data = selected === "all"
      ? allData.at(-1) || { season: latestSeason(), youth: { teams: [] } }
      : await loadSeason(selected, ["youth"]);
    const teamNames = Array.from(new Set((selected === "all" ? allData.flatMap((seasonData) => seasonData.youth.teams || []) : data.youth.teams || []).map((row) => row.team)))
      .sort((a, b) => a.localeCompare(b));
    const teams = teamNames.map((team) => ({ team }));
    const selectedTeam = params().get("team") || "all";
    const team = teams.find((row) => row.team === selectedTeam) || {};
    const visibleTeams = selectedTeam === "all" ? teams : teams.filter((row) => row.team === selectedTeam);
    const intakeTitle = selected === "all"
      ? (selectedTeam === "all" ? "All Seasons Intake" : `${team.team || "Team"} &middot; All Seasons Intake`)
      : (selectedTeam === "all" ? "All Teams Intake" : `${team.team || "Team"} Intake`);
    const intakeHtml = selected === "all"
      ? renderYouthAllSeasons(allData, selectedTeam)
      : (selectedTeam === "all" ? renderYouthAllTeams(data) : renderYouthTeam(data, team.team));
    $("#history-app").innerHTML = `
      <section class="history-hero"><h1>Youth Intake</h1><p class="muted">Archived intake players by season and team, with an all-seasons view.</p></section>
      <section class="reference-section"><h2>${esc(intakeTitle)}</h2><div class="filter-bar intake-filter-bar">
        <label>Season ${youthSeasonSelector(selected)}</label>
        <label>Team <select id="teamSelect"><option value="all" ${selectedTeam === "all" ? "selected" : ""}>All</option>${teams.map((row) => `<option value="${esc(row.team)}" ${row.team === selectedTeam ? "selected" : ""}>${esc(row.team)}</option>`).join("")}</select></label>
      </div>${visibleTeams.length ? intakeHtml : `<div class="empty">No archived youth intake</div>`}</section>`;
    $("#seasonSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(event.target.value)}&team=${encodeURIComponent(selectedTeam)}`); });
    $("#teamSelect")?.addEventListener("change", (event) => { navigate(`youth-intake.htm?season=${encodeURIComponent(selected)}&team=${encodeURIComponent(event.target.value)}`); });
  }

  async function renderDevelopmentStats() {
    const allData = await allSeasonData(["youth"]);
    const teamNames = Array.from(new Set(allData.flatMap((seasonData) => (seasonData.youth.teams || []).map((row) => row.team)))).sort((a, b) => a.localeCompare(b));
    const selectedTeam = params().get("team") || "all";
    const selectedView = params().get("view") === "franchises" ? "franchises" : "classes";
    const analyticsPlayers = allData.flatMap((seasonData) => (seasonData.youth.teams || [])
      .filter((row) => selectedTeam === "all" || row.team === selectedTeam)
      .flatMap((row) => (row.intakePlayers || []).map((player) => {
        const rated = youthRatedPlayer(seasonData, player);
        return {
          player,
          season: seasonData.season,
          team: row.team,
          ...youthDevelopmentMeta(player, seasonData.season, rated)
        };
      })))
      .filter((row) => row.peakOvr !== null && row.peakOvr > 0);
    const summarizeYouth = (rows, { topTwoPeak = false } = {}) => {
      const matureWildcards = rows.filter((row) => row.wildcard && row.mature);
      const peakRows = topTwoPeak && rows.length >= 3
        ? rows.slice().sort((a, b) => b.peakOvr - a.peakOvr).slice(0, 2)
        : rows;
      return {
        count: rows.length,
        avgPeak: peakRows.length ? peakRows.reduce((sum, row) => sum + row.peakOvr, 0) / peakRows.length : 0,
        peakPlayersCounted: peakRows.length,
        hits: rows.filter((row) => row.wildcard).length,
        matureWildcards: matureWildcards.length,
        busts: matureWildcards.filter((row) => row.peakOvr < row.initialPot).length,
        homeRuns: rows.filter((row) => row.outcome === "Home Run").length
      };
    };
    const classGroups = new Map();
    const franchiseGroups = new Map();
    analyticsPlayers.forEach((row) => {
      const classKey = `${row.season}|${row.team}`;
      if (!classGroups.has(classKey)) classGroups.set(classKey, []);
      classGroups.get(classKey).push(row);
      if (!franchiseGroups.has(row.team)) franchiseGroups.set(row.team, []);
      franchiseGroups.get(row.team).push(row);
    });
    const classAnalytics = Array.from(classGroups.entries()).map(([key, rows]) => {
      const [seasonId, teamName] = key.split("|");
      return { season: seasonId, team: teamName, members: rows, ...summarizeYouth(rows, { topTwoPeak: true }) };
    }).sort((a, b) => b.avgPeak - a.avgPeak);
    const franchiseAnalytics = Array.from(franchiseGroups.entries()).map(([teamName, rows]) => {
      const elitePoolCount = Math.min(rows.length, Math.max(3, Math.ceil(rows.length * 0.25)));
      const elitePlayers = rows.slice().sort((a, b) => b.peakOvr - a.peakOvr).slice(0, elitePoolCount);
      const weights = elitePlayers.map((_player, index) => elitePlayers.length === 1 ? 1 : 2 - index / (elitePlayers.length - 1));
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      const elitePoolScore = weightTotal
        ? elitePlayers.reduce((sum, player, index) => sum + player.peakOvr * weights[index], 0) / weightTotal
        : 0;
      return { team: teamName, members: rows, elitePoolCount, elitePoolScore, ...summarizeYouth(rows) };
    }).sort((a, b) => b.elitePoolScore - a.elitePoolScore);
    const development = analyticsPlayers.map((row) => ({
      ...row,
      gain: row.peakOvr - (row.initialOvr || row.peakOvr)
    }))
      .sort((a, b) => b.gain - a.gain || b.versusPot - a.versusPot);
    const overallYouth = summarizeYouth(analyticsPlayers);
    const bestClass = classAnalytics[0];
    const biggestGain = development[0];
    const classesTable = table(["Rank", "Season", "Team", "Players", "Top-2 Avg Peak OVR", "Elite Prospect Rate", "Bust Rate", "Home Run Rate"], classAnalytics.slice(0, 25).map((row, index) => {
      const detailId = `intake-class-${slug(row.season)}-${slug(row.team)}-${index}`;
      const preview = row.members.map((member) => member.player.name).join(", ");
      const playerRows = row.members.slice().sort((a, b) => b.peakOvr - a.peakOvr).map((member) => `<div class="intake-player-grid-row" role="row"><div role="cell">${youthPlayerLink(member.player, member.season)}</div><div role="cell">${esc(member.player.Position || "-")}</div><div role="cell">${ratingChip("OVR", member.initialOvr)}</div><div role="cell">${ratingChip("POT", member.initialPot)}</div><div role="cell">${ratingChip("OVR", member.peakOvr)}</div><div role="cell">${esc(member.peakSeason ? seasonLabel(member.peakSeason) : "-")}</div><div role="cell">${esc(member.outcome)}</div></div>`).join("");
      return `<tr class="intake-class-summary" data-detail-id="${esc(detailId)}"><td class="num">${index + 1}</td><td>${esc(seasonLabel(row.season))}</td><td><button class="intake-class-toggle" type="button" aria-expanded="false" aria-controls="${esc(detailId)}" data-preview="${esc(preview)}" title="${esc(preview)}"><span>${esc(row.team)}</span><span class="intake-class-chevron" aria-hidden="true">&#9656;</span></button></td><td class="num">${row.count}</td><td class="num">${oneDecimal(row.avgPeak)}</td><td class="num">${oneDecimal(row.hits * 100 / row.count)}%</td><td class="num">${row.matureWildcards ? `${oneDecimal(row.busts * 100 / row.matureWildcards)}%` : "-"}</td><td class="num">${row.count ? `${oneDecimal(row.homeRuns * 100 / row.count)}%` : "-"}</td></tr><tr class="intake-class-detail-row" id="${esc(detailId)}" data-expanded="false" hidden><td colspan="8"><div class="intake-player-grid" role="table" aria-label="${esc(row.team)} ${esc(seasonLabel(row.season))} intake players"><div class="intake-player-grid-row header" role="row"><div role="columnheader">Player</div><div role="columnheader">Pos</div><div role="columnheader">Intake OVR</div><div role="columnheader">Intake POT</div><div role="columnheader">Peak OVR</div><div role="columnheader">Peak Season</div><div role="columnheader">Outcome</div></div>${playerRows}</div></td></tr>`;
    }), "No evaluated intake classes");
    const franchisesTable = table(["Rank", "Team", "Elite Pool", "Elite Pool Score", "Elite Prospect Rate", "Bust Rate", "Home Run Rate"], franchiseAnalytics.map((row, index) => {
      const detailId = `intake-franchise-${slug(row.team)}-${index}`;
      const preview = row.members.map((member) => member.player.name).join(", ");
      const playerRows = row.members.slice().sort((a, b) => seasonNumber(a.season) - seasonNumber(b.season) || b.peakOvr - a.peakOvr).map((member) => `<div class="intake-player-grid-row" role="row"><div role="cell">${youthPlayerLink(member.player, member.season)}</div><div role="cell">${esc(seasonLabel(member.season))}</div><div role="cell">${ratingChip("OVR", member.initialOvr)}</div><div role="cell">${ratingChip("POT", member.initialPot)}</div><div role="cell">${ratingChip("OVR", member.peakOvr)}</div><div role="cell">${esc(member.peakSeason ? seasonLabel(member.peakSeason) : "-")}</div><div role="cell">${esc(member.outcome)}</div></div>`).join("");
      return `<tr class="intake-class-summary" data-detail-id="${esc(detailId)}"><td class="num">${index + 1}</td><td><button class="intake-class-toggle" type="button" aria-expanded="false" aria-controls="${esc(detailId)}" data-preview="${esc(preview)}" title="${esc(preview)}"><span>${esc(row.team)}</span><span class="intake-class-chevron" aria-hidden="true">&#9656;</span></button></td><td class="num">${row.elitePoolCount}/${row.count}</td><td class="num">${oneDecimal(row.elitePoolScore)}</td><td class="num">${row.count ? `${oneDecimal(row.hits * 100 / row.count)}%` : "-"}</td><td class="num">${row.matureWildcards ? `${oneDecimal(row.busts * 100 / row.matureWildcards)}%` : "-"}</td><td class="num">${row.count ? `${oneDecimal(row.homeRuns * 100 / row.count)}%` : "-"}</td></tr><tr class="intake-class-detail-row" id="${esc(detailId)}" data-expanded="false" hidden><td colspan="7"><div class="intake-player-grid franchise-player-grid" role="table" aria-label="${esc(row.team)} franchise intake players"><div class="intake-player-grid-row header" role="row"><div role="columnheader">Player</div><div role="columnheader">Intake Season</div><div role="columnheader">Intake OVR</div><div role="columnheader">Intake POT</div><div role="columnheader">Peak OVR</div><div role="columnheader">Peak Season</div><div role="columnheader">Outcome</div></div>${playerRows}</div></td></tr>`;
    }), "No franchise development data");
    $("#history-app").innerHTML = `
      <section class="history-hero"><h1>Development Stats</h1><p class="muted">Youth development outcomes across every archived season.</p></section>
      <section class="reference-section compact-controls"><h2>Development Controls</h2><div class="filter-bar">
        <label>Team <select id="teamSelect"><option value="all" ${selectedTeam === "all" ? "selected" : ""}>All</option>${teamNames.map((teamName) => `<option value="${esc(teamName)}" ${teamName === selectedTeam ? "selected" : ""}>${esc(teamName)}</option>`).join("")}</select></label>
      </div></section>
      <section class="dashboard-grid compact-summary">
        ${dashboardCard("Best Intake Class", bestClass ? `${esc(bestClass.team)} &middot; ${esc(seasonLabel(bestClass.season))}` : "-", `${oneDecimal(bestClass?.avgPeak)} top-two average peak OVR`)}
        ${dashboardCard("Elite Prospect Rate", overallYouth.count ? `${oneDecimal(overallYouth.hits * 100 / overallYouth.count)}%` : "-", `${overallYouth.hits}/${overallYouth.count} players entered with 115+ POT`)}
        ${dashboardCard("Biggest Development Gain", biggestGain ? youthPlayerLink(biggestGain.player, biggestGain.season) : "-", biggestGain ? `+${biggestGain.gain} OVR` : "No evaluated players")}
      </section>
      <section class="reference-section"><div class="section-tabs"><a class="section-tab ${selectedView === "classes" ? "active" : ""}" href="development-stats.htm?team=${encodeURIComponent(selectedTeam)}&view=classes">Intake Classes</a><a class="section-tab ${selectedView === "franchises" ? "active" : ""}" href="development-stats.htm?team=${encodeURIComponent(selectedTeam)}&view=franchises">Franchises</a></div>
        <h2>${selectedView === "classes" ? "Best Intake Classes" : "Franchise Development"}</h2>${selectedView === "classes" ? classesTable : franchisesTable}
      </section>
      <section class="reference-section"><h2>Biggest Development Surprises</h2>${table(["Player", "Team", "Intake POT", "Peak OVR", "vs POT", "Outcome"], development.slice(0, 25).map((row) => `<tr><td>${youthPlayerLink(row.player, row.season)}</td><td>${esc(row.team)}</td><td>${ratingChip("POT", row.initialPot)}</td><td>${ratingChip("OVR", row.peakOvr)}</td><td class="num">${row.versusPot === null ? "-" : `${row.versusPot >= 0 ? "+" : ""}${row.versusPot}`}</td><td>${esc(row.outcome)}</td></tr>`), "No development data")}</section>
      <details class="development-definitions"><summary>How outcomes work</summary><p>Class average peak OVR uses the best two players when a class has three or more. Franchise rank uses an Elite Pool Score based on the top 25% of its intake players by peak OVR, with at least three players when available. Rank weights decrease linearly from 2&times; for the best player to 1&times; for the lowest player in the pool, then normalize into one comparable score. Elite Prospect = an intake player who entered with at least 115 POT. Bust = an Elite Prospect who has not reached initial POT after five post-intake archive seasons. Development home run = peak OVR at least 10 points above initial POT. Elite Prospects inside that five-season window remain developing.</p></details>`;
    $("#teamSelect")?.addEventListener("change", (event) => { navigate(`development-stats.htm?team=${encodeURIComponent(event.target.value)}&view=${encodeURIComponent(selectedView)}`); });
    const toggleIntakeClass = (summaryRow) => {
      const detailRow = document.getElementById(summaryRow?.dataset.detailId || "");
      if (!detailRow) return;
      const willOpen = detailRow.hidden;
      $$(".intake-class-detail-row").forEach((row) => {
        row.hidden = true;
        row.dataset.expanded = "false";
      });
      $$(".intake-class-toggle").forEach((button) => button.setAttribute("aria-expanded", "false"));
      if (willOpen) {
        detailRow.hidden = false;
        detailRow.dataset.expanded = "true";
        $(".intake-class-toggle", summaryRow)?.setAttribute("aria-expanded", "true");
      }
    };
    $$(".intake-class-toggle").forEach((button) => button.addEventListener("click", () => toggleIntakeClass(button.closest("tr"))));
    $$(".intake-class-summary").forEach((row) => row.addEventListener("click", (event) => {
      if (event.target.closest("button, a")) return;
      toggleIntakeClass(row);
    }));
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

  function comparePlayerSearchOptions() {
    return (state.playerIndex?.identities || [])
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((identity) => {
        const peak = (identity.appearances || []).slice().sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || {};
        const status = identityStatus(identity).label;
        const label = `${identity.name} | ${identity.height || "No height"} | ${status} | Peak ${peak.overall || "-"} ${seasonLabel(peak.season)}`;
        return `<option value="${esc(label)}" data-key="${esc(identity.key)}"></option>`;
      })
      .join("");
  }

  function comparePlayerInputValue(key) {
    const identity = (state.playerIndex?.identities || []).find((item) => item.key === key);
    if (!identity) return "";
    const peak = (identity.appearances || []).slice().sort((a, b) => (num(b.overall) || 0) - (num(a.overall) || 0))[0] || {};
    return `${identity.name} | ${identity.height || "No height"} | ${identityStatus(identity).label} | Peak ${peak.overall || "-"} ${seasonLabel(peak.season)}`;
  }

  function selectedComparePlayerKey(input) {
    const value = String(input?.value || "").trim();
    if (!value) return "";
    const option = $$("#comparePlayerOptions option").find((item) => item.value === value);
    if (option?.dataset.key) return option.dataset.key;
    const exactMatches = (state.playerIndex?.identities || []).filter((identity) => String(identity.name || "").toLowerCase() === value.toLowerCase());
    return exactMatches.length === 1 ? exactMatches[0].key : "";
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
    const latest = await loadSeason(latestSeason(), ["standings"]);
    const team = allTeamsFromLatest(latest).find((row) => row.id === id);
    const history = await teamPositionHistory(id);
    const bestFinish = history.slice().sort((a, b) => teamOverallRank(a.standing) - teamOverallRank(b.standing))[0];
    return `<section class="reference-section compare-card"><h2>${teamMini(team?.team || id, team?.rosterFile || `${id}.htm`)}</h2>
      <div class="history-meta"><span class="pill">${history.length} Seasons</span><span class="pill">Best: ${esc(bestFinish?.standing?.tier || "-")} #${esc(bestFinish?.standing?.position || "-")}</span></div>
      ${teamPositionChart(history)}
      ${table(["Season", "Tier", "Pos", "W-L", "Diff", "Move"], history.map(({ season, standing }) => `<tr><td>${esc(seasonLabel(season))}</td><td>${esc(standing.tier)}</td><td class="num">${esc(standing.position)}</td><td>${esc(standing.wins)}-${esc(standing.losses)}</td><td class="num">${esc(standing.diff)}</td><td>${movementBadge(standing.marker)}</td></tr>`), "No team history")}</section>`;
  }

  async function renderCompare() {
    const p = params();
    const type = p.get("type") === "teams" ? "teams" : "players";
    if (type === "players") await ensureCurrentData();
    if (type === "teams") await loadSeason(latestSeason(), ["standings"]);
    const a = p.get("a") || "";
    const b = p.get("b") || "";
    const options = type === "teams" ? comparePickerOptions(type) : "";
    const pickerHtml = type === "teams" ? `
        <label>First <select id="compareA"><option value="">Choose</option>${options}</select></label>
        <label>Second <select id="compareB"><option value="">Choose</option>${options}</select></label>`
      : `
        <datalist id="comparePlayerOptions">${comparePlayerSearchOptions()}</datalist>
        <label>First <input id="compareA" class="compare-search-input" list="comparePlayerOptions" placeholder="Search player" value="${esc(comparePlayerInputValue(a))}" autocomplete="off"></label>
        <label>Second <input id="compareB" class="compare-search-input" list="comparePlayerOptions" placeholder="Search player" value="${esc(comparePlayerInputValue(b))}" autocomplete="off"></label>`;
    const cards = type === "teams" ? [await teamCompareCard(a), await teamCompareCard(b)] : [await playerCompareCard(a), await playerCompareCard(b)];
    const summaries = a && b
      ? (type === "teams" ? [await teamCompareSummary(a), await teamCompareSummary(b)] : [await playerCompareSummary(a), await playerCompareSummary(b)])
      : [null, null];
    const summaryHtml = type === "teams" ? renderTeamCompareSummary(summaries[0], summaries[1]) : renderPlayerCompareSummary(summaries[0], summaries[1]);
    $("#history-app").innerHTML = `
      <section class="reference-section compact-controls"><h2>Compare Controls</h2><div class="filter-bar">
        <label>Type <select id="compareType"><option value="players" ${type === "players" ? "selected" : ""}>Players</option><option value="teams" ${type === "teams" ? "selected" : ""}>Teams</option></select></label>
        ${pickerHtml}
      </div></section>
      ${summaryHtml}
      <div class="history-grid">${cards.join("")}</div>`;
    if (type === "teams") {
      $("#compareA").value = a;
      $("#compareB").value = b;
    }
    $("#compareType")?.addEventListener("change", (event) => navigate(`compare.htm?type=${encodeURIComponent(event.target.value)}`));
    const update = () => {
      const first = type === "teams" ? $("#compareA")?.value || "" : selectedComparePlayerKey($("#compareA"));
      const second = type === "teams" ? $("#compareB")?.value || "" : selectedComparePlayerKey($("#compareB"));
      navigate(`compare.htm?type=${encodeURIComponent(type)}&a=${encodeURIComponent(first)}&b=${encodeURIComponent(second)}`);
    };
    if (type === "teams") {
      ["compareA", "compareB"].forEach((id) => $(`#${id}`)?.addEventListener("change", update));
    } else {
      const updateIfResolved = (event) => {
        if (selectedComparePlayerKey(event.target) || !String(event.target.value || "").trim()) update();
      };
      ["compareA", "compareB"].forEach((id) => {
        $(`#${id}`)?.addEventListener("change", updateIfResolved);
        $(`#${id}`)?.addEventListener("input", updateIfResolved);
      });
    }
  }

  function pageFromLocation() {
    const file = window.location.pathname.split("/").pop() || "index.htm";
    if (file === "players.htm") return "players";
    if (file === "teams.htm") return "teams";
    if (file === "player.htm") return "player";
    if (file === "team.htm") return "team";
    if (file === "season.htm") return "season";
    if (file === "story.htm") return "story";
    if (file === "leaders.htm") return "leaders";
    if (file === "records.htm") return "records";
    if (file === "finance.htm") return "finance";
    if (file === "future-pool.htm") return "future-pool";
    if (file === "supercup.htm") return "supercup";
    if (file === "youth-intake.htm") return "youth";
    if (file === "development-stats.htm") return "youth-development";
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
    if (page === "story") await renderStory();
    if (page === "leaders") await renderLeaders();
    if (page === "records") await renderRecords();
    if (page === "finance") await renderFinance();
    if (page === "future-pool") await renderFuturePool();
    if (page === "supercup") await renderSupercupPage();
    if (page === "youth") await renderYouth();
    if (page === "youth-development") await renderDevelopmentStats();
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


