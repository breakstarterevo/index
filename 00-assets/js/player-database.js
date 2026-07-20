(function () {
  "use strict";

  var MANIFEST_URL = "../../00-build/database/player-database/index.json";
  var TAB_NAMES = ["attributes", "potential", "contracts", "regular", "advanced"];
  var STAT_TABS = ["regular", "advanced"];
  var DEFAULT_SORTS = { attributes: "overall", potential: "potential", contracts: "currentSalary", regular: "pts", advanced: "per" };
  var ATTRIBUTE_KEYS = ["Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", "Psd", "Prd", "Stl", "Blk", "Qkn", "Str", "Jmp", "Sta"];
  var POTENTIAL_KEYS = ["Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", "Psd", "Prd", "Stl", "Blk"];
  var cache = {};
  var manifest = null;
  var displayedPlayers = [];
  var state = {
    tab: "attributes", season: "current", lastSnapshot: "current", query: "", status: "all",
    team: "all", position: "all", page: 1, pageSize: 100,
    sorts: { attributes: "overall", potential: "potential", contracts: "currentSalary", regular: "pts", advanced: "per" },
    directions: { attributes: "desc", potential: "desc", contracts: "desc", regular: "desc", advanced: "desc" }
  };

  var elements = {};

  function byId(id) { return document.getElementById(id); }
  function isStatTab(tab) { return STAT_TABS.indexOf(tab) >= 0; }
  function isMissing(value) { return value === null || value === undefined || value === "" || (typeof value === "number" && !isFinite(value)); }
  function safeText(value) { return isMissing(value) ? "—" : String(value); }
  function number(value) { var parsed = Number(value); return isFinite(parsed) ? parsed : null; }
  function upper(value) { return String(value || "").toUpperCase(); }
  function compactSeasonLabel(value) {
    return String(value || "").replace(/(\d{4})-(\d{2})(\d{2})/, function (_, start, century, end) {
      return start + "–" + end;
    });
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (response) {
      if (!response.ok) { throw new Error("Could not load " + url); }
      return response.json();
    });
  }

  function snapshot(id) {
    return (manifest.snapshots || []).find(function (entry) { return entry.id === id; });
  }

  function loadFeed(id) {
    var entry = snapshot(id);
    if (!entry) { return Promise.reject(new Error("Unknown season snapshot: " + id)); }
    if (!cache[id]) {
      cache[id] = fetchJson(new URL(entry.path, new URL(MANIFEST_URL, window.location.href)).href);
    }
    return cache[id];
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var tab = params.get("tab");
    var season = params.get("season");
    var size = Number(params.get("size"));
    if (TAB_NAMES.indexOf(tab) >= 0) { state.tab = tab; }
    if (season) { state.season = season; }
    state.query = params.get("q") || "";
    state.status = params.get("status") || "all";
    state.team = params.get("team") || "all";
    state.position = params.get("pos") || "all";
    state.page = Math.max(1, Number(params.get("page")) || 1);
    if ([50, 100, 200].indexOf(size) >= 0) { state.pageSize = size; }
    if (params.get("sort")) { state.sorts[state.tab] = params.get("sort"); }
    if (["asc", "desc"].indexOf(params.get("dir")) >= 0) { state.directions[state.tab] = params.get("dir"); }
    if (state.season !== "career") { state.lastSnapshot = state.season; }
  }

  function writeUrl() {
    var params = new URLSearchParams();
    params.set("tab", state.tab);
    params.set("season", state.season);
    if (state.query) { params.set("q", state.query); }
    if (state.status !== "all") { params.set("status", state.status); }
    if (state.team !== "all") { params.set("team", state.team); }
    if (state.position !== "all") { params.set("pos", state.position); }
    params.set("sort", state.sorts[state.tab]);
    params.set("dir", state.directions[state.tab]);
    params.set("page", String(state.page));
    params.set("size", String(state.pageSize));
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
  }

  function makeColumn(key, label, getter, options) {
    return Object.assign({ key: key, label: label, get: getter || function (player) { return player[key]; }, format: formatNumber }, options || {});
  }

  function identityColumns(includePosition, includeAge) {
    var columns = [
      makeColumn("name", "Player", function (player) { return player.name; }, { format: formatPlayer, player: true, text: true }),
      makeColumn("team", "Team", function (player) { return player.teamAbbr || player.team; }, { format: safeText, text: true })
    ];
    if (includePosition) { columns.push(makeColumn("pos", "Pos", null, { format: safeText, text: true })); }
    if (includeAge) { columns.push(makeColumn("age", "Age", null, { format: formatInteger })); }
    return columns;
  }

  function columnsForTab() {
    var columns;
    if (state.tab === "attributes") {
      columns = identityColumns(true, true).concat([
        makeColumn("overall", "OVR", null, { format: formatRating }),
        makeColumn("potential", "POT", null, { format: formatRating })
      ]);
      ATTRIBUTE_KEYS.forEach(function (key) {
        columns.push(makeColumn("attr_" + key, upper(key), function (player) { return (player.attributes || {})[key]; }, { format: formatInteger }));
      });
      return columns;
    }
    if (state.tab === "potential") {
      columns = identityColumns(true, false).concat([
        makeColumn("overall", "OVR", null, { format: formatRating }),
        makeColumn("potential", "POT", null, { format: formatRating })
      ]);
      POTENTIAL_KEYS.forEach(function (key) {
        columns.push(makeColumn("pot_" + key, upper(key), function (player) { return (player.potentialGrades || {})[key]; }, { format: formatGrade, text: true }));
      });
      return columns;
    }
    if (state.tab === "contracts") {
      columns = identityColumns(true, true).concat([
        makeColumn("overall", "OVR", null, { format: formatRating }),
        makeColumn("potential", "POT", null, { format: formatRating }),
        makeColumn("currentSalary", "Salary", null, { format: formatCurrency })
      ]);
      contractYears().slice(1).forEach(function (year) {
        columns.push(makeColumn("salary_" + year, year, function (player) { return contractSalary(player, year); }, { format: formatCurrency }));
      });
      columns.push(makeColumn("contractTotal", "Total", contractTotal, { format: formatCurrency }));
      columns.push(makeColumn("contractYears", "Years", function (player) { return (player.contracts || []).length || null; }, { format: formatInteger }));
      return columns;
    }
    if (state.tab === "regular") {
      columns = identityColumns(false, false);
      [
        ["g", "G", formatInteger], ["gs", "GS", formatInteger], ["min", "MIN", formatDecimal], ["pts", "PTS", formatDecimal],
        ["orb", "ORB", formatDecimal], ["drb", "DRB", formatDecimal], ["reb", "REB", formatDecimal], ["ast", "AST", formatDecimal],
        ["to", "TO", formatDecimal], ["a_t", "A/T", formatDecimal], ["stl", "STL", formatDecimal], ["blk", "BLK", formatDecimal],
        ["pf", "PF", formatDecimal], ["fg_pct", "FG%", formatPercent], ["ft_pct", "FT%", formatPercent], ["3p_pct", "3P%", formatPercent]
      ].forEach(function (item) {
        columns.push(makeColumn(item[0], item[1], statGetter("regular", item[0]), { format: item[2] }));
      });
      return columns;
    }
    columns = identityColumns(false, false);
    [["g", "G", formatInteger, "regular"], ["min", "MIN", formatDecimal, "regular"], ["ts_pct", "TS%", formatPercent],
      ["pps", "PPS", formatDecimal], ["usg", "USG", formatDecimal], ["orr", "ORR", formatDecimal], ["drr", "DRR", formatDecimal],
      ["rr", "RR", formatDecimal], ["per", "PER", formatDecimal], ["va", "VA", formatDecimal], ["ewa", "EWA", formatDecimal],
      ["plus_minus", "+/−", formatDecimal], ["oeff", "OEFF", formatDecimal], ["deff", "DEFF", formatDecimal]
    ].forEach(function (item) {
      columns.push(makeColumn(item[0], item[1], statGetter(item[3] || "advanced", item[0]), { format: item[2] }));
    });
    return columns;
  }

  function statGetter(group, key) {
    return function (player) { return (player["display" + group.charAt(0).toUpperCase() + group.slice(1)] || player[group] || {})[key]; };
  }

  function contractYears() {
    return Array.from(new Set(displayedPlayers.reduce(function (years, player) {
      return years.concat((player.contracts || []).map(function (contract) { return String(contract.year); }));
    }, []))).sort(function (left, right) { return Number(left) - Number(right); });
  }

  function contractSalary(player, year) {
    var contract = (player.contracts || []).find(function (item) { return String(item.year) === String(year); });
    return contract ? contract.salary : null;
  }

  function contractTotal(player) {
    return (player.contracts || []).reduce(function (total, contract) { return total + (number(contract.salary) || 0); }, 0) || null;
  }

  function formatNumber(value) { return isMissing(value) ? "—" : safeText(value); }
  function formatInteger(value) { var n = number(value); return n === null ? "—" : String(Math.round(n)); }
  function formatDecimal(value) { var n = number(value); return n === null ? "—" : n.toFixed(1); }
  function formatPercent(value) { var n = number(value); return n === null ? "—" : (n * 100).toFixed(1) + "%"; }
  function formatCurrency(value) {
    var n = number(value);
    if (n === null || n <= 0) { return "—"; }
    if (n >= 1000000) { return "$" + (n / 1000000).toFixed(2).replace(/\.00$/, "") + "M"; }
    if (n >= 1000) { return "$" + (n / 1000).toFixed(0) + "K"; }
    return "$" + n.toFixed(0);
  }
  function formatPlayer(value, player) {
    if (!player.href) { return '<span class="db-player-link">' + escapeHtml(value) + "</span>"; }
    return '<a class="db-player-link" href="' + escapeHtml(player.href) + '">' + escapeHtml(value) + "</a>";
  }
  function ratingTierClass(value) {
    var n = number(value) || 0;
    if (n >= 151) { return "rating-purple"; }
    if (n >= 115) { return "rating-blue"; }
    if (n >= 100) { return "rating-green"; }
    if (n >= 80) { return "rating-yellow"; }
    return "rating-orange";
  }
  function formatRating(value) {
    if (isMissing(value)) { return "—"; }
    return window.ESLUnifiedUI
      ? window.ESLUnifiedUI.ratingBadge(value)
      : '<span class="db-rating ' + ratingTierClass(value) + '">' + escapeHtml(value) + "</span>";
  }
  function formatGrade(value) {
    if (isMissing(value)) { return "—"; }
    var grade = String(value).trim();
    return window.ESLUnifiedUI
      ? window.ESLUnifiedUI.tierBadge(grade)
      : '<span class="db-grade grade-' + escapeHtml(grade.charAt(0).toLowerCase()) + '">' + escapeHtml(grade) + "</span>";
  }
  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function feedPlayers() {
    if (state.season === "career") { return loadFeed(manifest.currentSnapshot); }
    return loadFeed(state.season);
  }

  function preparePlayers() {
    elements.seasonNote.hidden = true;
    return feedPlayers().then(function (feed) {
      var players = (feed.players || []).map(function (player) { return Object.assign({}, player); });
      if (!isStatTab(state.tab)) { return players; }
      if (state.season === "career") {
        players.forEach(function (player) {
          player.displayRegular = player.careerRegular || {};
          player.displayAdvanced = player.careerAdvanced || {};
        });
        return players;
      }
      if (state.season === manifest.currentSnapshot && !manifest.currentHasStats) {
        return loadFeed(manifest.latestCompletedSnapshot).then(function (latest) {
          var byIdentity = {};
          (latest.players || []).forEach(function (player) { if (player.historyKey) { byIdentity[player.historyKey] = player; } });
          players.forEach(function (player) {
            var match = player.historyKey ? byIdentity[player.historyKey] : null;
            player.displayRegular = match ? (match.regular || {}) : {};
            player.displayAdvanced = match ? (match.advanced || {}) : {};
          });
          elements.seasonNote.textContent = "Latest available: " + compactSeasonLabel(manifest.latestCompletedLabel);
          elements.seasonNote.hidden = false;
          return players;
        });
      }
      return players;
    });
  }

  function updateSeasonOptions() {
    var selected = state.season;
    var options = (manifest.snapshots || []).map(function (entry) { return { value: entry.id, label: entry.label }; });
    if (isStatTab(state.tab)) { options.push({ value: "career", label: "Career" }); }
    elements.seasonFilter.innerHTML = options.map(function (option) {
      return '<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + "</option>";
    }).join("");
    if (!options.some(function (option) { return option.value === selected; })) {
      state.season = snapshot(state.lastSnapshot) ? state.lastSnapshot : manifest.currentSnapshot;
    }
    elements.seasonFilter.value = state.season;
  }

  function updatePoolFilters(players) {
    var teams = Array.from(new Set(players.map(function (player) { return player.team; }).filter(Boolean))).sort();
    var positions = Array.from(new Set(players.map(function (player) { return player.pos; }).filter(Boolean))).sort();
    elements.teamFilter.innerHTML = '<option value="all">All teams</option>' + teams.map(optionHtml).join("");
    elements.positionFilter.innerHTML = '<option value="all">All positions</option>' + positions.map(optionHtml).join("");
    if (state.team !== "all" && teams.indexOf(state.team) < 0) { state.team = "all"; }
    if (state.position !== "all" && positions.indexOf(state.position) < 0) { state.position = "all"; }
    elements.teamFilter.value = state.team;
    elements.positionFilter.value = state.position;
  }
  function optionHtml(value) { return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + "</option>"; }

  function compareValues(left, right, direction, textMode) {
    var leftMissing = isMissing(left); var rightMissing = isMissing(right);
    if (leftMissing || rightMissing) { return leftMissing === rightMissing ? 0 : (leftMissing ? 1 : -1); }
    var result;
    if (textMode || number(left) === null || number(right) === null) {
      result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
    } else { result = number(left) - number(right); }
    return direction === "asc" ? result : -result;
  }

  function filteredAndSorted(players, columns) {
    var query = state.query.trim().toLowerCase();
    var filtered = players.filter(function (player) {
      return (!query || String(player.name || "").toLowerCase().indexOf(query) >= 0) &&
        (state.status === "all" || player.status === state.status) &&
        (state.team === "all" || player.team === state.team) &&
        (state.position === "all" || player.pos === state.position);
    });
    var sortKey = state.sorts[state.tab];
    var column = columns.find(function (item) { return item.key === sortKey; }) || columns[0];
    state.sorts[state.tab] = column.key;
    filtered.sort(function (left, right) {
      var compared = compareValues(column.get(left), column.get(right), state.directions[state.tab], column.text);
      return compared || String(left.name).localeCompare(String(right.name));
    });
    return filtered;
  }

  function csvCell(value) {
    if (isMissing(value)) { return ""; }
    if (typeof value === "number") { return String(value); }
    var text = String(value);
    if (/^[=+\-@]/.test(text)) { text = "'" + text; }
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function csvValue(column, player) {
    var value = column.get(player);
    if (isMissing(value)) { return ""; }
    if (/%$/.test(column.label)) { return formatPercent(value); }
    return value;
  }

  function exportCsv() {
    var originalLabel = elements.exportCsv.textContent;
    try {
      var columns = columnsForTab();
      var rows = filteredAndSorted(displayedPlayers, columns);
      var csv = [columns.map(function (column) { return csvCell(column.label); }).join(",")]
        .concat(rows.map(function (player) {
          return columns.map(function (column) { return csvCell(csvValue(column, player)); }).join(",");
        })).join("\r\n");
      var filename = "player-database-" + state.season + "-" + state.tab + ".csv";
      var link = document.createElement("a");
      var urlApi = window.URL || window.webkitURL;
      var objectUrl = "";
      if (urlApi && typeof urlApi.createObjectURL === "function") {
        objectUrl = urlApi.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
        link.href = objectUrl;
      } else {
        link.href = "data:text/csv;charset=utf-8,%EF%BB%BF" + encodeURIComponent(csv);
      }
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      elements.exportCsv.textContent = "Exported " + rows.length + " rows";
      window.setTimeout(function () {
        link.remove();
        if (objectUrl) { urlApi.revokeObjectURL(objectUrl); }
      }, 30000);
    } catch (error) {
      elements.exportCsv.textContent = "Export failed";
      if (window.console && console.error) { console.error("Player database CSV export failed", error); }
    }
    window.setTimeout(function () { elements.exportCsv.textContent = originalLabel; }, 2500);
  }

  function renderTable(players) {
    var columns = columnsForTab();
    var rows = filteredAndSorted(players, columns);
    var pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(Math.max(1, state.page), pages);
    var start = (state.page - 1) * state.pageSize;
    var pageRows = rows.slice(start, start + state.pageSize);
    var activeSort = state.sorts[state.tab];
    elements.table.querySelector("thead").innerHTML = "<tr>" + columns.map(function (column) {
      var active = column.key === activeSort;
      var sort = active ? (state.directions[state.tab] === "asc" ? "ascending" : "descending") : "none";
      return '<th scope="col"' + (column.player ? ' class="db-player ui-sticky"' : "") + ' aria-sort="' + sort + '"><button type="button" data-sort="' + escapeHtml(column.key) + '">' + escapeHtml(column.label) + "</button></th>";
    }).join("") + "</tr>";
    if (!pageRows.length) {
      elements.table.querySelector("tbody").innerHTML = '<tr><td class="db-empty ui-state" colspan="' + columns.length + '">No players match these filters.</td></tr>';
    } else {
      elements.table.querySelector("tbody").innerHTML = pageRows.map(function (player) {
        return "<tr>" + columns.map(function (column) {
          var value = column.get(player);
          return '<td' + (column.player ? ' class="db-player ui-sticky"' : "") + ">" + column.format(value, player) + "</td>";
        }).join("") + "</tr>";
      }).join("");
    }
    elements.resultSummary.textContent = rows.length + " of " + players.length + " players";
    elements.pageInfo.textContent = "Page " + state.page + " of " + pages;
    elements.previousPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= pages;
    elements.tablePanel.setAttribute("aria-labelledby", "tab-" + state.tab);
    bindSortButtons(players);
    writeUrl();
  }

  function bindSortButtons(players) {
    elements.table.querySelectorAll("[data-sort]").forEach(function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-sort");
        if (state.sorts[state.tab] === key) { state.directions[state.tab] = state.directions[state.tab] === "asc" ? "desc" : "asc"; }
        else { state.sorts[state.tab] = key; state.directions[state.tab] = "desc"; }
        state.page = 1;
        renderTable(players);
      });
    });
  }

  function render() {
    elements.resultSummary.textContent = "Loading player database…";
    preparePlayers().then(function (players) {
      displayedPlayers = players;
      updatePoolFilters(players);
      renderTable(players);
    }).catch(showError);
  }

  function showError(error) {
    elements.resultSummary.textContent = "Player database unavailable";
    elements.table.querySelector("thead").innerHTML = "";
    elements.table.querySelector("tbody").innerHTML = '<tr><td class="db-error ui-state ui-state--error">' + escapeHtml(error.message || error) + "</td></tr>";
  }

  function selectTab(tab, preservePage) {
    if (TAB_NAMES.indexOf(tab) < 0) { return; }
    state.tab = tab;
    if (!isStatTab(tab) && state.season === "career") { state.season = snapshot(state.lastSnapshot) ? state.lastSnapshot : manifest.currentSnapshot; }
    if (!preservePage) { state.page = 1; }
    document.querySelectorAll(".db-tab").forEach(function (button) {
      var active = button.getAttribute("data-tab") === tab;
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
    updateSeasonOptions();
    render();
  }

  function bindEvents() {
    var timer;
    elements.search.addEventListener("input", function () {
      clearTimeout(timer); state.query = elements.search.value; state.page = 1;
      timer = setTimeout(function () { renderTable(displayedPlayers); }, 120);
    });
    [elements.statusFilter, elements.teamFilter, elements.positionFilter].forEach(function (control) {
      control.addEventListener("change", function () {
        state.status = elements.statusFilter.value; state.team = elements.teamFilter.value; state.position = elements.positionFilter.value;
        state.page = 1; renderTable(displayedPlayers);
      });
    });
    elements.seasonFilter.addEventListener("change", function () {
      state.season = elements.seasonFilter.value;
      if (state.season !== "career") { state.lastSnapshot = state.season; }
      state.team = "all"; state.position = "all"; state.page = 1; render();
    });
    elements.pageSize.addEventListener("change", function () { state.pageSize = Number(elements.pageSize.value); state.page = 1; renderTable(displayedPlayers); });
    elements.previousPage.addEventListener("click", function () { state.page -= 1; renderTable(displayedPlayers); elements.tablePanel.focus(); });
    elements.nextPage.addEventListener("click", function () { state.page += 1; renderTable(displayedPlayers); elements.tablePanel.focus(); });
    elements.resetFilters.addEventListener("click", function () {
      state.query = ""; state.status = "all"; state.team = "all"; state.position = "all"; state.page = 1;
      elements.search.value = ""; elements.statusFilter.value = "all"; render();
    });
    elements.exportCsv.addEventListener("click", exportCsv);
    document.querySelectorAll(".db-tab").forEach(function (button, index, buttons) {
      button.addEventListener("click", function () { selectTab(button.getAttribute("data-tab")); });
      button.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") { return; }
        event.preventDefault();
        var offset = event.key === "ArrowRight" ? 1 : -1;
        var next = buttons[(index + offset + buttons.length) % buttons.length]; next.focus(); selectTab(next.getAttribute("data-tab"));
      });
    });
  }

  function init() {
    elements = {
      search: byId("playerSearch"), statusFilter: byId("statusFilter"), teamFilter: byId("teamFilter"),
      positionFilter: byId("positionFilter"), seasonFilter: byId("seasonFilter"), resetFilters: byId("resetFilters"),
      exportCsv: byId("exportCsv"),
      resultSummary: byId("resultSummary"), seasonNote: byId("seasonNote"), table: byId("playerTable"),
      tablePanel: byId("databaseTable"), pageSize: byId("pageSize"), previousPage: byId("previousPage"),
      nextPage: byId("nextPage"), pageInfo: byId("pageInfo")
    };
    fetchJson(MANIFEST_URL).then(function (data) {
      manifest = data; readUrl();
      if (!snapshot(state.season) && state.season !== "career") { state.season = manifest.currentSnapshot; state.lastSnapshot = state.season; }
      if (state.season === "career" && !isStatTab(state.tab)) { state.season = manifest.currentSnapshot; }
      elements.search.value = state.query; elements.statusFilter.value = state.status; elements.pageSize.value = String(state.pageSize);
      bindEvents(); updateSeasonOptions(); selectTab(state.tab, true);
    }).catch(showError);
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
}());
