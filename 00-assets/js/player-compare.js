(function () {
  "use strict";

  var DATA_URLS = {
    players: "../../00-build/database/players.json",
    playerStats: "../../00-build/database/player_stats.json",
    standings: "../../00-build/database/standings.json",
    injuries: "../../00-build/database/injuries.json"
  };
  var SLOT_COUNT = 4;
  var RATING_GROUPS = [
    { title: "Offense", rows: [["Ins", "INS"], ["Jps", "JPS"], ["Fts", "FTS"], ["3ps", "3PS"], ["Hnd", "HND"], ["Pas", "PAS"], ["Orb", "ORB"]] },
    { title: "Defense", rows: [["Drb", "DRB"], ["Psd", "PSD"], ["Prd", "PRD"], ["Stl", "STL"], ["Blk", "BLK"]] },
    { title: "Physicals", rows: [["Qkn", "QKN"], ["Jmp", "JMP"], ["Str", "STR"], ["Sta", "STA"]] }
  ];
  var CURRENT_STATS = [
    ["min", "MIN"], ["pts", "PTS"], ["orb", "ORB"], ["drb", "DRB"], ["reb", "REB"],
    ["ast", "AST"], ["to", "TO", "low"], ["a_t", "A/T"], ["stl", "STL"], ["blk", "BLK"],
    ["pf", "PF", "low"], ["fg_pct", "FG%"], ["ft_pct", "FT%"], ["3p_pct", "3P%"]
  ];
  var SHOOTING_STATS = [
    ["fgm", "FGM"], ["fga", "FGA"], ["fg_pct", "FG%"], ["ftm", "FTM"], ["fta", "FTA"],
    ["ft_pct", "FT%"], ["3pm", "3PM"], ["3pa", "3PA"], ["in_pct", "IN%"],
    ["js_pct", "JS%"], ["3p_pct", "3P%"]
  ];
  var EFFICIENCY_STATS = [
    ["ts_pct", "TS%"], ["pps", "PPS"], ["usg", "USG"], ["orr", "ORR"], ["drr", "DRR"],
    ["rr", "RR"], ["per", "PER"], ["va", "VA"], ["ewa", "EWA"], ["plus_minus", "+/-"],
    ["oeff", "OEFF"], ["deff", "DEFF"]
  ];
  var TEAM_COLOR_FALLBACK = "#111b36";
  var teamColorCache = {};

  var state = {
    players: [],
    playerStats: [],
    standings: [],
    injuries: [],
    teamDirectory: [],
    selected: ["", "", "", ""],
    visibleSlots: 2,
    activeTab: "ratings",
    activeSearchSlot: -1,
    documentClickBound: false
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeName(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function num(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fmt(value) {
    if (value == null || value === "") return "--";
    if (typeof value === "number") {
      if (Math.abs(value) < 1 && value !== 0) return value.toFixed(3).replace(/^0/, "");
      return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
    }
    return String(value);
  }

  function ratingTierClass(value) {
    var rating = num(value);
    if (rating == null) return "";
    if (rating >= 151) return "rating-purple";
    if (rating >= 115) return "rating-blue";
    if (rating >= 100) return "rating-green";
    if (rating >= 80) return "rating-yellow";
    return "rating-orange";
  }

  function playerIdFromUrl(value) {
    var match = String(value || "").match(/player(\d+)/i);
    return match ? "player" + match[1] : "";
  }

  function playerKey(player) {
    return playerIdFromUrl(player && (player.playerId || player.url)) || normalizeName(player && player.name);
  }

  function params() {
    return new URLSearchParams(window.location.search);
  }

  function playerHref(player) {
    var id = playerKey(player);
    return id && /^player\d+$/i.test(id) ? "./unified-player.htm?id=" + encodeURIComponent(id) : "#";
  }

  function classicHref(player) {
    var match = String(player && player.url || "").match(/player\d+\.htm/i);
    return match ? "../../players/" + match[0] : "#";
  }

  function loadJson(path) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + path);
      return response.json();
    }).catch(function () {
      return loadJsonFromFrame(path);
    });
  }

  function loadJsonFromFrame(path) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      frame.src = path;
      frame.addEventListener("load", function () {
        var frameDocument;
        var raw = "";
        try {
          frameDocument = frame.contentDocument || frame.contentWindow.document;
          raw = frameDocument && frameDocument.body ? frameDocument.body.textContent : "";
          if (!raw && frameDocument && frameDocument.documentElement) raw = frameDocument.documentElement.textContent || "";
          frame.remove();
          resolve(JSON.parse(String(raw || "").replace(/^\uFEFF/, "").trim()));
        } catch (error) {
          frame.remove();
          reject(error);
        }
      });
      frame.addEventListener("error", function () {
        frame.remove();
        reject(new Error("Unable to load " + path));
      });
      document.body.appendChild(frame);
    });
  }

  function buildTeamDirectory(standings) {
    var directory = [];
    (standings || []).forEach(function (section) {
      (section.teams || []).forEach(function (team) {
        directory.push({
          teamId: String(team.rosterFile || "").replace(/\.htm$/i, ""),
          teamName: team.team,
          rosterFile: team.rosterFile
        });
      });
    });
    return directory;
  }

  function findTeam(player) {
    var teamKey = clean(player && player.team);
    var teamLabel = clean(player && player.teamLabel);
    return state.teamDirectory.find(function (team) {
      return team.teamId === teamKey || team.teamName === teamLabel;
    }) || null;
  }

  function findPlayer(id) {
    var key = clean(id);
    if (!key) return null;
    return state.players.find(function (player) {
      return playerKey(player).toLowerCase() === key.toLowerCase();
    }) || state.players.find(function (player) {
      return normalizeName(player.name) === normalizeName(key);
    }) || null;
  }

  function findStats(player) {
    var key = playerKey(player);
    var nameKey = normalizeName(player && player.name);
    return state.playerStats.find(function (record) {
      return playerIdFromUrl(record.url) === key;
    }) || state.playerStats.find(function (record) {
      return normalizeName(record.name) === nameKey;
    }) || null;
  }

  function findInjury(player) {
    var nameKey = normalizeName(player && player.name);
    var teamKey = normalizeName(player && player.teamLabel);
    return state.injuries.find(function (injury) {
      return normalizeName(injury.name) === nameKey && (!teamKey || normalizeName(injury.teamName) === teamKey);
    }) || state.injuries.find(function (injury) {
      return normalizeName(injury.name) === nameKey;
    }) || null;
  }

  function latestSeasonRow(statsRecord, tableName) {
    var table = statsRecord && statsRecord.stats && statsRecord.stats[tableName];
    var rows = table && Array.isArray(table.rows) ? table.rows : [];
    var numericRows = rows.filter(function (row) {
      return Number.isFinite(Number(row.season));
    });
    return numericRows.sort(function (a, b) {
      return Number(b.season) - Number(a.season);
    })[0] || {};
  }

  function selectedPlayers() {
    return state.selected.slice(0, state.visibleSlots).map(findPlayer);
  }

  function selectedPlayerStats() {
    return selectedPlayers().map(function (player) {
      return player ? findStats(player) : null;
    });
  }

  function totalRebounds(row) {
    if (num(row.reb) != null) return num(row.reb);
    if (num(row.orb) != null || num(row.drb) != null) return (num(row.orb) || 0) + (num(row.drb) || 0);
    return null;
  }

  function normalizeHexColor(value) {
    var match = String(value || "").match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    var hex;
    if (!match) return "";
    hex = match[1];
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    return "#" + hex.toUpperCase();
  }

  function loadText(path) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + path);
      return response.text();
    });
  }

  function extractTeamColor(html) {
    var patterns = [
      /td\.teamheader\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i,
      /td\.header\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i,
      /tr\.teamcolor\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i
    ];
    var index;
    var match;
    for (index = 0; index < patterns.length; index += 1) {
      match = String(html || "").match(patterns[index]);
      if (match && normalizeHexColor(match[1])) return normalizeHexColor(match[1]);
    }
    return "";
  }

  function teamColor(player) {
    var team = findTeam(player);
    return teamColorCache[team && team.teamId] || TEAM_COLOR_FALLBACK;
  }

  function loadTeamColors() {
    selectedPlayers().forEach(function (player) {
      var team = findTeam(player);
      if (!team || !team.rosterFile || teamColorCache[team.teamId]) return;
      loadText("../../rosters/" + team.rosterFile).then(function (html) {
        teamColorCache[team.teamId] = extractTeamColor(html) || TEAM_COLOR_FALLBACK;
        renderCards();
      }).catch(function () {
        teamColorCache[team.teamId] = TEAM_COLOR_FALLBACK;
      });
    });
  }

  function playerSearchItems() {
    return state.players
      .filter(function (player) { return player.name && playerKey(player) && (num(player.overall) || 0) >= 50; })
      .sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      })
      .map(function (player) {
        var team = player.teamLabel || player.team || "Team";
        return {
          id: playerKey(player),
          name: player.name,
          team: team,
          meta: [team, player.pos, player.overall ? "OVR " + player.overall : ""].filter(Boolean).join(" | "),
          search: normalizeName([player.name, team, player.pos, player.overall].join(" "))
        };
      });
  }

  function setUrlState() {
    var next = new URLSearchParams();
    state.selected.forEach(function (id, index) {
      if (id && index < state.visibleSlots) next.set("p" + (index + 1), id);
    });
    if (state.activeTab && state.activeTab !== "ratings") next.set("tab", state.activeTab);
    history.replaceState(null, "", window.location.pathname + (next.toString() ? "?" + next.toString() : ""));
  }

  function selectSlot(slotIndex, playerId) {
    state.selected[slotIndex] = playerId || "";
    setUrlState();
    render();
  }

  function removeSlot(slotIndex) {
    if (slotIndex < 2) {
      state.selected[slotIndex] = "";
    } else {
      state.selected.splice(slotIndex, 1);
      state.selected.push("");
      state.visibleSlots = Math.max(2, state.visibleSlots - 1);
    }
    setUrlState();
    render();
  }

  function renderSlotControls() {
    var root = byId("slotControls");
    root.classList.toggle("has-two-slots", state.visibleSlots === 2);
    root.classList.toggle("has-three-slots", state.visibleSlots === 3);
    root.innerHTML = state.selected.slice(0, state.visibleSlots).map(function (id, index) {
      var player = findPlayer(id);
      return '<div class="slot-control" data-slot="' + index + '">' +
        '<label class="slot-label" for="slotSearch' + index + '">Player ' + (index + 1) + '</label>' +
        '<div class="slot-row">' +
          '<input class="slot-search" id="slotSearch' + index + '" type="search" autocomplete="off" spellcheck="false" value="' + esc(player ? player.name : "") + '" placeholder="Search players">' +
          '<button class="slot-clear" type="button" data-remove-slot="' + index + '">' + (index < 2 ? "Clear" : "Remove") + '</button>' +
        '</div>' +
        '<div class="slot-results" id="slotResults' + index + '" hidden></div>' +
      '</div>';
    }).join("") + (state.visibleSlots < SLOT_COUNT
      ? '<div class="add-slot-wrap"><button class="btn-link" id="addPlayerSlot" type="button">Add Player</button></div>'
      : "");
    bindSlotControls();
    if (byId("addPlayerSlot")) {
      byId("addPlayerSlot").addEventListener("click", function () {
        state.visibleSlots = Math.min(SLOT_COUNT, state.visibleSlots + 1);
        setUrlState();
        render();
      });
    }
  }

  function bindSlotControls() {
    var items = playerSearchItems();
    Array.prototype.slice.call(document.querySelectorAll(".slot-control")).forEach(function (control) {
      var slotIndex = Number(control.getAttribute("data-slot"));
      var input = control.querySelector(".slot-search");
      var results = control.querySelector(".slot-results");
      var visible = [];
      var activeIndex = 0;

      function close() {
        results.hidden = true;
      }

      function choose(item) {
        if (!item) return;
        input.value = item.name;
        selectSlot(slotIndex, item.id);
        close();
      }

      function renderResults() {
        var key = normalizeName(input.value);
        visible = items.filter(function (item) {
          return !key || item.search.indexOf(key) >= 0;
        }).slice(0, 12);
        activeIndex = visible.length ? 0 : -1;
        results.innerHTML = visible.length ? visible.map(function (item, index) {
          return '<button class="slot-option ' + (index === activeIndex ? "active" : "") + '" type="button" data-id="' + esc(item.id) + '">' +
            '<strong>' + esc(item.name) + '</strong><span>' + esc(item.meta) + '</span></button>';
        }).join("") : '<button class="slot-option" type="button" disabled><strong>No players found</strong><span>Search</span></button>';
        results.hidden = false;
      }

      function syncActive() {
        Array.prototype.slice.call(results.querySelectorAll(".slot-option")).forEach(function (button, index) {
          button.classList.toggle("active", index === activeIndex);
        });
      }

      input.addEventListener("focus", function () {
        input.select();
        renderResults();
      });
      input.addEventListener("click", renderResults);
      input.addEventListener("input", renderResults);
      input.addEventListener("keydown", function (event) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (results.hidden) renderResults();
          activeIndex = Math.min(visible.length - 1, activeIndex + 1);
          syncActive();
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          if (results.hidden) renderResults();
          activeIndex = Math.max(0, activeIndex - 1);
          syncActive();
        } else if (event.key === "Enter") {
          event.preventDefault();
          if (results.hidden) renderResults();
          choose(visible[activeIndex] || visible[0]);
        } else if (event.key === "Escape") {
          close();
          input.blur();
        }
      });
      results.addEventListener("mousedown", function (event) { event.preventDefault(); });
      results.addEventListener("click", function (event) {
        var button = event.target.closest(".slot-option[data-id]");
        if (!button) return;
        choose(items.find(function (item) { return item.id === button.getAttribute("data-id"); }));
      });
      control.querySelector("[data-remove-slot]").addEventListener("click", function () {
        removeSlot(slotIndex);
      });
    });
    if (!state.documentClickBound) {
      state.documentClickBound = true;
      document.addEventListener("click", function (event) {
        Array.prototype.slice.call(document.querySelectorAll(".slot-control")).forEach(function (control) {
          if (!control.contains(event.target)) control.querySelector(".slot-results").hidden = true;
        });
      });
    }
  }

  function renderCards() {
    var root = byId("playerCards");
    var players = selectedPlayers();
    var stats = selectedPlayerStats();
    root.classList.toggle("has-two-slots", state.visibleSlots === 2);
    root.classList.toggle("has-three-slots", state.visibleSlots === 3);
    root.innerHTML = players.map(function (player, index) {
      var statsRow = player ? latestSeasonRow(stats[index], "season_averages") : {};
      var injury = player ? findInjury(player) : null;
      var color = player ? teamColor(player) : TEAM_COLOR_FALLBACK;
      var team = player ? findTeam(player) : null;
      var meta;
      if (!player) {
        return '<article class="player-card is-empty">' +
          '<div class="card-meta">Slot ' + (index + 1) + '</div>' +
          '<h2 class="player-card-name">Choose a player</h2>' +
          '<div class="card-meta">Use the selector above to add this slot.</div>' +
          '<div class="chip-row"><span class="info-chip">Empty</span></div>' +
          '<div class="card-statline">' + cardStat("PTS", null) + cardStat("REB", null) + cardStat("AST", null) + '</div>' +
          '<div class="nav-actions"><span class="btn-link">Waiting</span></div>' +
        '</article>';
      }
      meta = [player.teamLabel || player.team, player.pos, player.age ? "Age " + player.age : "", player.ht, player.wt ? player.wt + " lbs" : ""].filter(Boolean).join(" | ");
      return '<article class="player-card" style="--slot-color:' + esc(color) + '">' +
        '<div class="card-meta">Player ' + (index + 1) + (team && team.teamName ? " | " + esc(team.teamName) : "") + '</div>' +
        '<h2 class="player-card-name"><a href="' + esc(playerHref(player)) + '">' + esc(player.name) + '</a></h2>' +
        '<div class="card-meta">' + esc(meta) + '</div>' +
        '<div class="chip-row">' +
          (player.overall ? '<span class="rating-chip primary ' + ratingTierClass(player.overall) + '">OVR ' + esc(player.overall) + '</span>' : "") +
          (player.potential ? '<span class="rating-chip primary ' + ratingTierClass(player.potential) + '">POT ' + esc(player.potential) + '</span>' : "") +
          (player.currentSalaryText ? '<span class="info-chip">' + esc(player.currentSalaryText) + '</span>' : "") +
          (injury ? '<span class="info-chip injury-chip">' + esc(injury.injury + " | " + injury.length + "d") + '</span>' : "") +
        '</div>' +
        '<div class="card-statline">' +
          cardStat("PTS", statsRow.pts) +
          cardStat("REB", totalRebounds(statsRow)) +
          cardStat("AST", statsRow.ast) +
        '</div>' +
        '<div class="nav-actions"><a class="btn-link" href="' + esc(classicHref(player)) + '">Classic</a></div>' +
      '</article>';
    }).join("");
  }

  function cardStat(label, value) {
    return '<div class="card-stat"><strong>' + esc(fmt(value)) + '</strong><span>' + esc(label) + '</span></div>';
  }

  function cellNumber(value) {
    var parsed = num(value);
    return parsed == null ? null : parsed;
  }

  function bestIndexes(values, lowWins) {
    var numeric = values.map(cellNumber);
    var available = numeric.filter(function (value) { return value != null; });
    var best;
    if (!available.length) return [];
    best = lowWins ? Math.min.apply(Math, available) : Math.max.apply(Math, available);
    return numeric.map(function (value, index) {
      return value != null && value === best ? index : -1;
    }).filter(function (index) { return index >= 0; });
  }

  function gradeScore(value) {
    var match = clean(value).toUpperCase().match(/^([SABCDF])([+-])?$/);
    var base = { S: 15, A: 12, B: 9, C: 6, D: 3, F: 0 };
    if (!match || base[match[1]] == null) return null;
    return base[match[1]] + (match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0);
  }

  function bestGradeIndexes(values) {
    var scores = values.map(gradeScore);
    var available = scores.filter(function (value) { return value != null; });
    var best;
    if (!available.length) return [];
    best = Math.max.apply(Math, available);
    return scores.map(function (value, index) {
      return value != null && value === best ? index : -1;
    }).filter(function (index) { return index >= 0; });
  }

  function renderCompareTable(rootId, rows, valueGetter) {
    var root = byId(rootId);
    var players = selectedPlayers();
    var headers = players.map(function (player, index) {
      return player ? player.name : "Player " + (index + 1);
    });
    var body = rows.map(function (row) {
      if (row.group) return '<tr class="group-row"><td colspan="' + (state.visibleSlots + 1) + '">' + esc(row.group) + '</td></tr>';
      var values = players.map(function (player, index) {
        return player ? valueGetter(row, player, index) : null;
      });
      var best = bestIndexes(values, row.low === true);
      return '<tr><td><span class="stat-label">' + esc(row.label) + '</span></td>' +
        values.map(function (value, index) {
          return '<td class="' + (best.indexOf(index) >= 0 ? "is-best" : "") + '">' + esc(fmt(value)) + '</td>';
        }).join("") + '</tr>';
    }).join("");
    root.innerHTML = '<table class="compare-table"><thead><tr><th>Metric</th>' +
      headers.map(function (header) { return '<th>' + esc(header) + '</th>'; }).join("") +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderRatingsGrid() {
    var root = byId("ratingsTable");
    var players = selectedPlayers();
    root.style.setProperty("--visible-slots", String(state.visibleSlots));
    root.innerHTML = '<div class="ratings-grid">' + RATING_GROUPS.map(function (group) {
      var rows = group.rows.map(function (row) {
        var values = players.map(function (player) {
          return player ? player[row[0]] : null;
        });
        var best = bestIndexes(values, false);
        return '<div class="rating-compare-row">' +
          '<div class="rating-name">' + esc(row[1]) + '</div>' +
          values.map(function (value, index) {
            return '<div class="rating-mini ' + (best.indexOf(index) >= 0 ? "is-best" : "") + '">' + esc(fmt(value)) + '</div>';
          }).join("") +
        '</div>';
      }).join("");
      return '<section class="rating-card"><h3 class="rating-card-title">' + esc(group.title) + '</h3>' + rows + '</section>';
    }).join("") + '</div>';
  }

  function renderPotentialGrid() {
    var root = byId("potentialTable");
    var players = selectedPlayers();
    root.style.setProperty("--visible-slots", String(state.visibleSlots));
    root.innerHTML = '<div class="ratings-grid">' + RATING_GROUPS.map(function (group) {
      var gradeRows = group.rows.filter(function (row) {
        return players.some(function (player) {
          return player && player.potentials && player.potentials[row[0]] != null && player.potentials[row[0]] !== "";
        });
      });
      if (!gradeRows.length) return "";
      var rows = gradeRows.map(function (row) {
        var values = players.map(function (player) {
          return player && player.potentials ? player.potentials[row[0]] : null;
        });
        var best = bestGradeIndexes(values);
        return '<div class="rating-compare-row">' +
          '<div class="rating-name">' + esc(row[1]) + '</div>' +
          values.map(function (value, index) {
            return '<div class="rating-mini ' + (best.indexOf(index) >= 0 ? "is-best" : "") + '">' + esc(fmt(value)) + '</div>';
          }).join("") +
        '</div>';
      }).join("");
      return '<section class="rating-card"><h3 class="rating-card-title">' + esc(group.title) + '</h3>' + rows + '</section>';
    }).join("") + '</div>';
  }

  function statRows(config) {
    return config.map(function (row) {
      return { key: row[0], label: row[1], low: row[2] === "low" };
    });
  }

  function statCardRows(title, rows, tableName) {
    var players = selectedPlayers();
    var stats = selectedPlayerStats();
    var body = rows.map(function (row) {
      var values = players.map(function (player, index) {
        var data = player ? latestSeasonRow(stats[index], tableName) : {};
        if (row[0] === "reb") return totalRebounds(data);
        return data[row[0]];
      });
      var best = bestIndexes(values, row[2] === "low");
      return '<div class="stat-compare-row">' +
        '<div class="stat-name">' + esc(row[1]) + '</div>' +
        values.map(function (value, index) {
          return '<div class="stat-mini ' + (best.indexOf(index) >= 0 ? "is-best" : "") + '">' + esc(fmt(value)) + '</div>';
        }).join("") +
      '</div>';
    }).join("");
    return '<section class="stat-card"><h3 class="stat-card-title">' + esc(title) + '</h3>' + body + '</section>';
  }

  function renderStatsCards() {
    var root = byId("statsCards");
    root.style.setProperty("--visible-slots", String(state.visibleSlots));
    root.innerHTML = '<div class="stats-card-grid">' +
      statCardRows("Stats", CURRENT_STATS, "season_averages") +
      statCardRows("Shooting", SHOOTING_STATS, "shooting_averages") +
      statCardRows("Efficiency", EFFICIENCY_STATS, "efficiency") +
    '</div>';
  }

  function renderTables() {
    renderRatingsGrid();
    renderPotentialGrid();
    renderStatsCards();
  }

  function renderTabs() {
    var tabs = [
      ["ratings", "Ratings"],
      ["potential", "Potential"],
      ["current", "Stats"]
    ];
    byId("compareTabs").innerHTML = tabs.map(function (tab) {
      return '<button class="tab-btn ' + (state.activeTab === tab[0] ? "active" : "") + '" type="button" data-tab="' + esc(tab[0]) + '">' + esc(tab[1]) + '</button>';
    }).join("");
    Array.prototype.slice.call(document.querySelectorAll(".tab-btn")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.activeTab = button.getAttribute("data-tab") || "ratings";
        setUrlState();
        renderTabs();
        renderActiveSection();
      });
    });
    renderActiveSection();
  }

  function renderActiveSection() {
    ["ratings", "potential", "current"].forEach(function (tab) {
      var section = byId("section-" + tab);
      if (section) section.hidden = tab !== state.activeTab;
    });
  }

  function render() {
    renderSlotControls();
    renderCards();
    renderTables();
    renderTabs();
    loadTeamColors();
  }

  function initSelectedFromUrl() {
    var query = params();
    state.selected = [1, 2, 3, 4].map(function (slot) {
      var value = clean(query.get("p" + slot));
      var player = findPlayer(value);
      return player ? playerKey(player) : "";
    });
    state.visibleSlots = Math.max(2, state.selected.reduce(function (highest, id, index) {
      return id ? Math.max(highest, index + 1) : highest;
    }, 0));
    if (["ratings", "potential", "current"].indexOf(clean(query.get("tab"))) >= 0) {
      state.activeTab = clean(query.get("tab"));
    }
  }

  Promise.all([
    loadJson(DATA_URLS.players),
    loadJson(DATA_URLS.playerStats),
    loadJson(DATA_URLS.standings),
    loadJson(DATA_URLS.injuries)
  ]).then(function (data) {
    state.players = Array.isArray(data[0]) ? data[0] : [];
    state.playerStats = data[1] && Array.isArray(data[1].players) ? data[1].players : [];
    state.standings = data[2] && Array.isArray(data[2].sections) ? data[2].sections : [];
    state.injuries = data[3] && Array.isArray(data[3].injuries) ? data[3].injuries : [];
    state.teamDirectory = buildTeamDirectory(state.standings);
    initSelectedFromUrl();
    render();
  }).catch(function (error) {
    byId("playerCards").innerHTML = '<article class="player-card is-empty"><h2 class="player-card-name">Player compare unavailable</h2><p class="compare-subtitle">' + esc(error.message || "Could not load compare data.") + '</p></article>';
  });
})();
