(function () {
  "use strict";

  var core = window.LeagueSiteCore;
  var SEARCH_STYLE_ID = "player-search-styles";
  var WAIVER_TABLE_STYLE_ID = "waiver-table-styles";
  var PLAYER_PREVIEW_STYLE_ID = "player-preview-pill-styles";

  if (!core) {
    return;
  }

  function ensureSearchStyles() {
    if (document.getElementById(SEARCH_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = SEARCH_STYLE_ID;
    style.textContent = [
      "#player-search-root { position: fixed; top: 14px; right: 18px; z-index: 120; width: min(300px, calc(100vw - 40px)); }",
      ".player-search { position: relative; width: 100%; padding: 10px; border: 1px solid rgba(148, 163, 184, 0.5); border-radius: 10px; background: rgba(255, 255, 255, 0.96); box-shadow: 0 10px 26px rgba(15, 23, 42, 0.12); backdrop-filter: blur(8px); }",
      ".player-search__label { display: block; margin-bottom: 6px; font: 700 11px/1.2 Inter, Tahoma, Arial, sans-serif; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; }",
      ".player-search__input { width: 100%; height: 38px; padding: 0 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #0f172a; font: 500 13px/1.4 Inter, Tahoma, Arial, sans-serif; }",
      ".player-search__input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }",
      ".player-search__dropdown { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 121; max-height: 240px; overflow-y: auto; border: 1px solid #dbe3ee; border-radius: 10px; background: #fff; box-shadow: 0 14px 28px rgba(15, 23, 42, 0.16); }",
      ".player-search__dropdown[hidden] { display: none; }",
      ".player-search__option { display: block; width: 100%; padding: 10px 11px; border: 0; border-bottom: 1px solid #eef2f7; background: transparent; color: #0f172a; text-align: left; cursor: pointer; }",
      ".player-search__option:last-child { border-bottom: 0; }",
      ".player-search__option:hover, .player-search__option:focus { background: #f8fafc; outline: none; }",
      ".player-search__name { display: block; font: 600 12px/1.3 Inter, Tahoma, Arial, sans-serif; }",
      ".player-search__meta { display: block; margin-top: 2px; font: 500 10px/1.3 Inter, Tahoma, Arial, sans-serif; color: #475569; }",
      ".player-search__submeta { display: block; margin-top: 3px; font: 500 10px/1.3 Inter, Tahoma, Arial, sans-serif; color: #64748b; }",
      ".player-search__empty { padding: 10px 11px; font: 500 11px/1.4 Inter, Tahoma, Arial, sans-serif; color: #64748b; }",
      "@media (max-width: 900px) { #player-search-root { position: sticky; top: 8px; right: auto; margin: 0 0 12px auto; } .player-search { padding: 8px; } }"
    ].join("");
    document.head.appendChild(style);
  }

  function ensureWaiverTableStyles() {
    if (document.getElementById(WAIVER_TABLE_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = WAIVER_TABLE_STYLE_ID;
    style.textContent = [
      "#waiver-database-root { margin: 0; max-width: 100%; }",
      ".waiver-database { margin: 0 0 10px; }",
      ".waiver-database__title { margin: 0; font: 700 17pt/1.1 Inter, Tahoma, Arial, sans-serif; color: #1e293b; letter-spacing: -0.02em; }",
      ".waiver-database__title-rule { margin: 6px 0 10px; border: 0; border-top: 1px solid #cbd5e1; }",
      ".waiver-database__section-title { margin: 0 0 6px; padding: 0 8px; font: 700 11pt/1.2 Inter, Tahoma, Arial, sans-serif; color: #1e293b; }",
      ".waiver-database__subtitle { margin: 6px 0 8px; font: 500 8.5pt/1.3 Inter, Tahoma, Arial, sans-serif; color: #64748b; }",
      ".waiver-database__controls { display: flex; flex-wrap: wrap; gap: 4px; align-items: end; margin: 0 0 10px; }",
      ".waiver-database__control { display: flex; flex-direction: column; gap: 4px; }",
      ".waiver-database__control--search { min-width: 220px; flex: 1 1 220px; }",
      ".waiver-database__control label { font: 700 7.5pt/1.1 Inter, Tahoma, Arial, sans-serif; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }",
      ".waiver-database__control input, .waiver-database__control select { height: 28px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #0f172a; font: 500 8.5pt/1.1 Inter, Tahoma, Arial, sans-serif; }",
      ".waiver-database__control input:focus, .waiver-database__control select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12); }",
      ".waiver-database__clear { height: 28px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; color: #0f172a; font: 600 8.5pt/1 Inter, Tahoma, Arial, sans-serif; cursor: pointer; }",
      ".waiver-database__clear:hover { background: #eef2f7; }",
      ".waiver-database__top-scroll { overflow-x: auto; overflow-y: hidden; height: 14px; margin: 0 0 4px; }",
      ".waiver-database__top-scroll-inner { height: 1px; }",
      ".waiver-database__table-wrap { overflow-x: auto; border-radius: 0; box-shadow: none; }",
      ".waiver-database__table { width: 100%; min-width: 1155px; border-collapse: collapse; background: #ffffff; table-layout: fixed; }",
      ".waiver-database__table td.header { position: sticky; top: 0; z-index: 2; padding: 6px 3px; background: #990000; color: #ffffff !important; font: 700 var(--waiver-header-font-size, 7.5pt)/1.05 Inter, Tahoma, Arial, sans-serif; text-align: center; white-space: nowrap; }",
      ".waiver-database__table td.header--sortable { cursor: pointer; user-select: none; }",
      ".waiver-database__table td.header--left, .waiver-database__table tbody td.main--left { text-align: left; }",
      ".waiver-database__table tbody td.main { padding: 5px 7px; border-bottom: 0; font: 400 14pt/1.2 Inter, Tahoma, Arial, sans-serif; color: #1e293b; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
      ".waiver-database__table tbody tr.row1 { background: #f1f5f9; }",
      ".waiver-database__table tbody tr.row2 { background: #e2e8f0; }",
      ".waiver-database__table tbody tr.row1:hover { background: #e8f0fe; }",
      ".waiver-database__table tbody tr.row2:hover { background: #dbeafe; }",
      ".waiver-database__sort-indicator { margin-left: 3px; opacity: 0.55; font-size: 8px; }",
      ".waiver-database__table col.player { width: 150px; }",
      ".waiver-database__table col.team { width: 100px; }",
      ".waiver-database__table col.small { width: 40px; }",
      ".waiver-database__table col.medium { width: 50px; }",
      ".waiver-database__player-link { color: #4a4a6a; font-weight: 500; text-decoration: none; }",
      ".waiver-database__player-link:hover { text-decoration: underline; }"
    ].join("");

    document.head.appendChild(style);
  }

  function createSearchMarkup(root) {
    root.innerHTML = [
      '<div class="player-search">',
      '  <label class="player-search__label" for="player-search-input">Player Search</label>',
      '  <input class="player-search__input" id="player-search-input" type="search" placeholder="Search players" autocomplete="off" />',
      '  <div class="player-search__dropdown" id="player-search-dropdown" hidden></div>',
      "</div>"
    ].join("");
  }

  function ensureSearchRoot() {
    return null;
  }

  function ensureWaiverTableRoot() {
    if (!core.isWaiverWirePage()) {
      return null;
    }

    var existingRoot = document.getElementById("waiver-database-root");
    if (existingRoot) {
      return existingRoot;
    }

    var footerRule = document.querySelector("hr");
    var root = document.createElement("div");
    root.id = "waiver-database-root";

    if (footerRule && footerRule.parentNode) {
      footerRule.parentNode.insertBefore(root, footerRule);
    } else {
      document.body.appendChild(root);
    }

    return root;
  }

  function appendSelectOption(select, value, label) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  function uniqueValues(items, key) {
    var values = items
      .map(function (item) {
        return item[key] || "";
      })
      .filter(Boolean)
      .filter(function (value, index, array) {
        return array.indexOf(value) === index;
      });

    values.sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });

    return values;
  }

  function clearDataRows(tbody) {
    while (tbody.children.length > 1) {
      tbody.removeChild(tbody.lastChild);
    }
  }

  function applyWaiverHeaderState(headRow, state) {
    Array.from(headRow.children).forEach(function (cell) {
      var indicator = cell.querySelector(".waiver-database__sort-indicator");
      if (!indicator) {
        return;
      }

      if (cell.dataset.sortKey === state.sortKey) {
        indicator.textContent = state.sortDirection === "asc" ? "v" : "^";
        indicator.style.opacity = "1";
      } else {
        indicator.textContent = "-";
        indicator.style.opacity = "0.55";
      }
    });
  }

  function parseHeightValue(value) {
    var match = String(value || "").match(/^(\d+)-(\d+)$/);
    if (!match) {
      return null;
    }

    return parseInt(match[1], 10) * 12 + parseInt(match[2], 10);
  }

  function compareWaiverPlayers(a, b, sortKey, sortDirection) {
    var direction = sortDirection === "desc" ? -1 : 1;
    var aValue = a[sortKey] || "";
    var bValue = b[sortKey] || "";
    var aHeight = parseHeightValue(aValue);
    var bHeight = parseHeightValue(bValue);
    var aNumber = parseFloat(aValue);
    var bNumber = parseFloat(bValue);

    if (aHeight !== null && bHeight !== null) {
      return (aHeight - bHeight) * direction;
    }

    if (!isNaN(aNumber) && !isNaN(bNumber)) {
      return (aNumber - bNumber) * direction;
    }

    return aValue.toString().localeCompare(bValue.toString(), undefined, { sensitivity: "base" }) * direction;
  }

  function getVisiblePlayers(players, state) {
    return players
      .filter(function (player) {
        var haystack = [player.name, player.teamName, player.pos].join(" ").toLowerCase();
        var matchesQuery = !state.query || haystack.indexOf(state.query) !== -1;
        var matchesTeam = !state.team || player.teamName === state.team;
        var matchesPos = !state.pos || player.pos === state.pos;
        return matchesQuery && matchesTeam && matchesPos;
      })
      .sort(function (a, b) {
        return compareWaiverPlayers(a, b, state.sortKey, state.sortDirection);
      });
  }

  function updateWaiverTableFontSize(table) {
    if (!table) {
      return;
    }

    var playerCol = table.querySelector("col.player");
    var teamCol = table.querySelector("col.team");
    var smallCol = table.querySelector("col.small");
    var playerWidth = playerCol ? parseInt(playerCol.style.width || playerCol.getAttribute("width") || 150, 10) : 150;
    var teamWidth = teamCol ? parseInt(teamCol.style.width || teamCol.getAttribute("width") || 110, 10) : 110;
    var statWidth = smallCol ? parseInt(smallCol.style.width || smallCol.getAttribute("width") || 42, 10) : 42;
    var containerWidth = table.parentElement ? table.parentElement.clientWidth : 0;
    var tableWidth = Math.max(table.scrollWidth, 1);
    var scale = containerWidth > 0 ? Math.min(containerWidth / tableWidth, 1) : 1;
    var baseHeader = 8;
    var baseCell = 9;
    var compressedHeader = Math.max(7, Math.min(baseHeader, Math.floor((statWidth * scale) / 4.3)));
    var compressedCell = Math.max(7, Math.min(baseCell, Math.floor((Math.min(playerWidth, teamWidth, statWidth) * scale) / 4.7)));

    table.style.setProperty("--waiver-header-font-size", compressedHeader + "px");
    table.style.setProperty("--waiver-cell-font-size", compressedCell + "px");
  }

  function syncWaiverScrollbars(topScroll, tableWrap, topScrollInner, table) {
    if (!topScroll || !tableWrap || !topScrollInner || !table) {
      return;
    }

    topScrollInner.style.width = table.scrollWidth + "px";

    if (!topScroll.dataset.bound) {
      topScroll.addEventListener("scroll", function () {
        tableWrap.scrollLeft = topScroll.scrollLeft;
      });

      tableWrap.addEventListener("scroll", function () {
        topScroll.scrollLeft = tableWrap.scrollLeft;
      });

      topScroll.dataset.bound = "true";
    }
  }

  function buildWaiverTable(players) {
    var columns = [
      { key: "name", label: "Player" },
      { key: "teamName", label: "Team" },
      { key: "pos", label: "Pos" },
      { key: "age", label: "Age" },
      { key: "ht", label: "Ht" },
      { key: "wt", label: "Wt" },
      { key: "Ins", label: "INS" },
      { key: "Jps", label: "JPS" },
      { key: "Fts", label: "FT" },
      { key: "3ps", label: "3PS" },
      { key: "Hnd", label: "HND" },
      { key: "Pas", label: "PAS" },
      { key: "Orb", label: "ORB" },
      { key: "Drb", label: "DRB" },
      { key: "Psd", label: "PSD" },
      { key: "Prd", label: "PRD" },
      { key: "Stl", label: "STL" },
      { key: "Blk", label: "BLK" },
      { key: "Qkn", label: "QKN" },
      { key: "Jmp", label: "JMP" },
      { key: "Str", label: "STR" },
      { key: "Sta", label: "STA" }
    ];
    var sortOptions = [
      { key: "name", label: "Player" },
      { key: "teamName", label: "Team" },
      { key: "pos", label: "Position" },
      { key: "age", label: "Age" },
      { key: "ht", label: "Height" },
      { key: "Ins", label: "INS" },
      { key: "Jps", label: "JPS" },
      { key: "Fts", label: "FT" },
      { key: "3ps", label: "3PS" },
      { key: "Pas", label: "PAS" },
      { key: "Orb", label: "ORB" },
      { key: "Drb", label: "DRB" },
      { key: "Stl", label: "STL" },
      { key: "Blk", label: "BLK" },
      { key: "Sta", label: "STA" }
    ];
    var container = document.createElement("section");
    var title = document.createElement("h1");
    var titleRule = document.createElement("hr");
    var sectionTitle = document.createElement("div");
    var subtitle = document.createElement("p");
    var controls = document.createElement("div");
    var searchControl = document.createElement("div");
    var searchLabel = document.createElement("label");
    var searchInput = document.createElement("input");
    var teamControl = document.createElement("div");
    var teamLabel = document.createElement("label");
    var teamSelect = document.createElement("select");
    var posControl = document.createElement("div");
    var posLabel = document.createElement("label");
    var posSelect = document.createElement("select");
    var sortControl = document.createElement("div");
    var sortLabel = document.createElement("label");
    var sortSelect = document.createElement("select");
    var directionControl = document.createElement("div");
    var directionLabel = document.createElement("label");
    var directionSelect = document.createElement("select");
    var clearButton = document.createElement("button");
    var topScroll = document.createElement("div");
    var topScrollInner = document.createElement("div");
    var tableWrap = document.createElement("div");
    var table = document.createElement("table");
    var colgroup = document.createElement("colgroup");
    var tbody = document.createElement("tbody");
    var headRow = document.createElement("tr");
    var state = {
      query: "",
      team: "",
      pos: "",
      sortKey: "name",
      sortDirection: "asc"
    };

    container.className = "waiver-database";
    title.className = "waiver-database__title";
    titleRule.className = "waiver-database__title-rule";
    sectionTitle.className = "waiver-database__section-title";
    subtitle.className = "waiver-database__subtitle";
    controls.className = "waiver-database__controls";
    searchControl.className = "waiver-database__control waiver-database__control--search";
    teamControl.className = "waiver-database__control";
    posControl.className = "waiver-database__control";
    sortControl.className = "waiver-database__control";
    directionControl.className = "waiver-database__control";
    clearButton.className = "waiver-database__clear";
    topScroll.className = "waiver-database__top-scroll";
    topScrollInner.className = "waiver-database__top-scroll-inner";
    tableWrap.className = "waiver-database__table-wrap";
    table.className = "waiver-database__table";

    title.textContent = "Waiver Wire";
    sectionTitle.textContent = "Attributes";
    subtitle.textContent = players.length + " players shown from the shared player database.";

    searchLabel.textContent = "Search";
    searchInput.type = "search";
    searchInput.placeholder = "Player or team";

    teamLabel.textContent = "Team";
    posLabel.textContent = "Position";
    sortLabel.textContent = "Sort By";
    directionLabel.textContent = "Order";
    clearButton.type = "button";
    clearButton.textContent = "Clear";

    appendSelectOption(teamSelect, "", "All Teams");
    uniqueValues(players, "teamName").forEach(function (teamName) {
      appendSelectOption(teamSelect, teamName, teamName);
    });

    appendSelectOption(posSelect, "", "All Positions");
    uniqueValues(players, "pos").forEach(function (pos) {
      appendSelectOption(posSelect, pos, pos);
    });

    sortOptions.forEach(function (option) {
      appendSelectOption(sortSelect, option.key, option.label);
    });

    appendSelectOption(directionSelect, "asc", "Ascending");
    appendSelectOption(directionSelect, "desc", "Descending");

    searchControl.appendChild(searchLabel);
    searchControl.appendChild(searchInput);
    teamControl.appendChild(teamLabel);
    teamControl.appendChild(teamSelect);
    posControl.appendChild(posLabel);
    posControl.appendChild(posSelect);
    sortControl.appendChild(sortLabel);
    sortControl.appendChild(sortSelect);
    directionControl.appendChild(directionLabel);
    directionControl.appendChild(directionSelect);

    controls.appendChild(searchControl);
    controls.appendChild(teamControl);
    controls.appendChild(posControl);
    controls.appendChild(sortControl);
    controls.appendChild(directionControl);
    controls.appendChild(clearButton);

    columns.forEach(function (column) {
      var col = document.createElement("col");
      var cell = document.createElement("td");
      var indicator = document.createElement("span");

      if (column.key === "name") {
        col.className = "player";
      } else if (column.key === "teamName") {
        col.className = "team";
      } else if (column.key === "ht" || column.key === "wt") {
        col.className = "medium";
      } else {
        col.className = "small";
      }

      cell.className = "header";
      if (column.key === "name" || column.key === "teamName") {
        cell.classList.add("header--left");
      }
      cell.textContent = column.label;
      cell.dataset.sortKey = column.key;
      cell.classList.add("header--sortable");
      indicator.className = "waiver-database__sort-indicator";
      indicator.textContent = column.key === state.sortKey ? "v" : "-";
      cell.appendChild(indicator);
      cell.addEventListener("click", function () {
        if (state.sortKey === column.key) {
          state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = column.key;
          state.sortDirection = "asc";
        }

        sortSelect.value = state.sortKey;
        directionSelect.value = state.sortDirection;
        renderBody();
      });

      colgroup.appendChild(col);
      headRow.appendChild(cell);
    });

    tbody.appendChild(headRow);

    topScroll.appendChild(topScrollInner);
    table.appendChild(colgroup);
    table.appendChild(tbody);
    container.appendChild(title);
    container.appendChild(titleRule);
    container.appendChild(sectionTitle);
    container.appendChild(subtitle);
    container.appendChild(controls);
    container.appendChild(topScroll);
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);

    searchInput.addEventListener("input", function () {
      state.query = searchInput.value.trim().toLowerCase();
      renderBody();
    });

    teamSelect.addEventListener("change", function () {
      state.team = teamSelect.value;
      renderBody();
    });

    posSelect.addEventListener("change", function () {
      state.pos = posSelect.value;
      renderBody();
    });

    sortSelect.addEventListener("change", function () {
      state.sortKey = sortSelect.value;
      renderBody();
    });

    directionSelect.addEventListener("change", function () {
      state.sortDirection = directionSelect.value;
      renderBody();
    });

    clearButton.addEventListener("click", function () {
      state.query = "";
      state.team = "";
      state.pos = "";
      state.sortKey = "name";
      state.sortDirection = "asc";
      searchInput.value = "";
      teamSelect.value = "";
      posSelect.value = "";
      sortSelect.value = "name";
      directionSelect.value = "asc";
      renderBody();
    });

    sortSelect.value = state.sortKey;
    directionSelect.value = state.sortDirection;
    syncWaiverScrollbars(topScroll, tableWrap, topScrollInner, table);
    renderBody();
    updateWaiverTableFontSize(table);

    window.addEventListener("resize", function () {
      updateWaiverTableFontSize(table);
      syncWaiverScrollbars(topScroll, tableWrap, topScrollInner, table);
    });

    return container;

    function renderBody() {
      clearDataRows(tbody);
      applyWaiverHeaderState(headRow, state);

      var visiblePlayers = getVisiblePlayers(players, state);

      visiblePlayers.forEach(function (player, index) {
        var row = document.createElement("tr");
        row.className = index % 2 === 0 ? "row1" : "row2";

        columns.forEach(function (column) {
          var cell = document.createElement("td");
          cell.className = "main";

          if (column.key === "name") {
            var link = document.createElement("a");
            link.className = "waiver-database__player-link";
            link.href = core.getPlayerPageUrl(player.url);
            link.textContent = player.name || "";
            cell.classList.add("main--left");
            cell.appendChild(link);
          } else if (column.key === "teamName") {
            cell.classList.add("main--left");
            cell.textContent = player[column.key] || "";
          } else {
            cell.textContent = player[column.key] || "";
          }

          row.appendChild(cell);
        });

        tbody.appendChild(row);
      });

      subtitle.textContent = visiblePlayers.length + " players shown from the shared player database.";
      updateWaiverTableFontSize(table);
      syncWaiverScrollbars(topScroll, tableWrap, topScrollInner, table);
    }
  }

  function isRewriteEligiblePlayerHref(href) {
    var h = String(href || "").toLowerCase();
    return Boolean(core.getPlayerFileFromUrl(href)) && h.indexOf("unified-player") === -1 && h.indexOf("id=player") === -1;
  }

  function enhancePlayerAnchorHref(link) {
    if (!link || !link.getAttribute) {
      return;
    }

    var href = link.getAttribute("href") || "";

    if (link.dataset.leaguePlayerDestBound === "true") {
      if (link.dataset.leagueLegacyPlayerHref) {
        link.setAttribute("href", core.getPlayerPageUrl(link.dataset.leagueLegacyPlayerHref));
      }
      return;
    }

    if (!isRewriteEligiblePlayerHref(href)) {
      return;
    }

    link.dataset.leagueLegacyPlayerHref = href;
    link.dataset.leaguePlayerDestBound = "true";
    link.setAttribute("href", core.getPlayerPageUrl(href));
  }

  function applyPlayerPageLinksToAnchors() {
    Array.prototype.slice.call(document.querySelectorAll('a[href*="player"]')).forEach(enhancePlayerAnchorHref);
  }

  function isRewriteEligibleTeamHref(href) {
    var h = String(href || "").toLowerCase();
    return Boolean(core.getRosterFileFromUrl(href)) && h.indexOf("unified-roster") === -1 && h.indexOf("file=roster") === -1;
  }

  function enhanceTeamAnchorHref(link) {
    if (!link || !link.getAttribute) {
      return;
    }

    var href = link.getAttribute("href") || "";

    if (link.dataset.leagueTeamDestBound === "true") {
      if (link.dataset.leagueLegacyTeamHref) {
        link.setAttribute("href", core.getTeamPageUrl(link.dataset.leagueLegacyTeamHref));
      }
      return;
    }

    if (!isRewriteEligibleTeamHref(href)) {
      return;
    }

    link.dataset.leagueLegacyTeamHref = href;
    link.dataset.leagueTeamDestBound = "true";
    link.setAttribute("href", core.getTeamPageUrl(href));
  }

  function applyTeamPageLinksToAnchors() {
    Array.prototype.slice.call(document.querySelectorAll('a[href*="roster"]')).forEach(enhanceTeamAnchorHref);
  }

  function applyPageDestinationLinksToAnchors() {
    applyPlayerPageLinksToAnchors();
    applyTeamPageLinksToAnchors();
  }

  function getPlayerPreviewAttr(player, key) {
    var aliases = {
      Ins: ["Ins", "InsideScoring"],
      Jps: ["Jps", "JumpShot"],
      Fts: ["Fts", "FtShot"],
      "3ps": ["3ps", "3pShot"],
      Hnd: ["Hnd", "Handling"],
      Pas: ["Pas", "Passing"],
      Orb: ["Orb", "OffRebounding"],
      Drb: ["Drb", "DefRebounding"],
      Psd: ["Psd", "PostDefense"],
      Prd: ["Prd", "PerimeterDefense"],
      Stl: ["Stl", "Stealing"],
      Blk: ["Blk", "Blocking"],
      Qkn: ["Qkn", "Quickness"],
      Jmp: ["Jmp", "Jumping"],
      Str: ["Str", "Strength"],
      Sta: ["Sta", "Stamina"]
    };
    var keys = aliases[key] || [key];
    var i;

    for (i = 0; i < keys.length; i += 1) {
      if (player[keys[i]] !== undefined && player[keys[i]] !== null && player[keys[i]] !== "") {
        return player[keys[i]];
      }
    }

    return "--";
  }

  function ensurePlayerPreviewStyles() {
    if (document.getElementById(PLAYER_PREVIEW_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = PLAYER_PREVIEW_STYLE_ID;
    style.textContent = [
      ".player-preview-pill { --preview-primary: #111b36; --preview-secondary: #f4d35e; --preview-ink: #10131b; position: fixed; z-index: 5000; width: min(300px, calc(100vw - 16px)); max-height: calc(100dvh - 16px); overflow: auto; -webkit-overflow-scrolling: touch; border: 1px solid color-mix(in srgb, var(--preview-primary) 35%, transparent); border-top: 4px solid var(--preview-primary); border-radius: 12px; background: #fffdf8; color: var(--preview-ink); box-shadow: 0 18px 42px rgba(15,23,42,.24); padding: 9px; font-family: Inter, Tahoma, Arial, sans-serif; overscroll-behavior: contain; }",
      ".player-preview-pill[hidden] { display: none; }",
      ".player-preview-pill__head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; border-bottom: 1px solid #ddd5c6; padding-bottom: 8px; margin-bottom: 9px; }",
      ".player-preview-pill__name { margin: 0; font: 800 15px/1.1 Inter, Tahoma, Arial, sans-serif; color: var(--preview-primary); }",
      ".player-preview-pill__meta { margin: 3px 0 0; color: #6a5f4d; font: 700 10px/1.2 Inter, Tahoma, Arial, sans-serif; letter-spacing: .09em; text-transform: uppercase; }",
      ".player-preview-pill__rating { display: grid; gap: 3px; min-width: 52px; text-align: right; }",
      ".player-preview-pill__rating strong { color: var(--preview-primary); font-size: 18px; line-height: 1; }",
      ".player-preview-pill__rating span { color: #6a5f4d; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; font-weight: 800; }",
      ".player-preview-pill__attrs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }",
      ".player-preview-pill__col { min-width: 0; border: 1px solid #ddd5c6; background: #faf8f2; padding: 6px 5px; }",
      ".player-preview-pill__col-title { margin: 0 0 4px; color: var(--preview-primary); font-size: 8px; letter-spacing: .1em; text-transform: uppercase; font-weight: 900; }",
      ".player-preview-pill__attr { display: flex; justify-content: space-between; gap: 4px; padding: 1px 0; border-bottom: 1px solid rgba(221,213,198,.7); font-size: 10px; line-height: 1.08; }",
      ".player-preview-pill__attr:last-child { border-bottom: 0; }",
      ".player-preview-pill__attr span { color: #6a5f4d; font-weight: 800; }",
      ".player-preview-pill__attr strong { color: #10131b; font-weight: 900; }",
      ".player-preview-pill__pra { margin-top: 9px; border: 1px solid var(--preview-primary); background: linear-gradient(135deg, var(--preview-primary), color-mix(in srgb, var(--preview-primary) 78%, #000)); color: #fff; padding: 7px; }",
      ".player-preview-pill__pra-title { margin: 0 0 6px; color: rgba(255,255,255,.76); font-size: 9px; letter-spacing: .13em; text-transform: uppercase; font-weight: 900; }",
      ".player-preview-pill__pra-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }",
      ".player-preview-pill__pra-item { min-width: 0; }",
      ".player-preview-pill__pra-item span { display: block; color: rgba(255,255,255,.7); font-size: 9px; letter-spacing: .09em; text-transform: uppercase; font-weight: 800; }",
      ".player-preview-pill__pra-item strong { display: block; margin-top: 1px; color: #fff; font-size: 16px; line-height: 1; }",
      'a[href*="player"] { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }',
      "@media (max-width: 420px) { .player-preview-pill { width: calc(100vw - 12px); max-height: calc(100dvh - 12px); padding: 8px; } .player-preview-pill__head { padding-bottom: 6px; margin-bottom: 7px; } .player-preview-pill__attrs { gap: 4px; } .player-preview-pill__col { padding: 5px 4px; } .player-preview-pill__col-title { font-size: 7.5px; margin-bottom: 3px; } .player-preview-pill__attr { font-size: 9px; padding: 1px 0; } .player-preview-pill__pra { margin-top: 7px; padding: 6px; } .player-preview-pill__pra-item strong { font-size: 14px; } }"
    ].join("");
    document.head.appendChild(style);
  }

  function normalizePreviewTeamName(teamName) {
    return String(teamName || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  }

  function getPlayerPreviewTheme(player) {
    var teamName = player.teamLabel || player.teamName || player.team || "";
    var teamKey = normalizePreviewTeamName(teamName);
    var themes = {
      acmilan: { primary: "#d00027", secondary: "#050505" },
      afcrichmond: { primary: "#1d2d86", secondary: "#f0c33c" },
      ajax: { primary: "#d71920", secondary: "#ffffff" },
      astonvilla: { primary: "#670e36", secondary: "#95bfe5" },
      atleticomadrid: { primary: "#c8102e", secondary: "#0b2f6b" },
      barcelona: { primary: "#004d98", secondary: "#a50044" },
      bayernmunich: { primary: "#dc052d", secondary: "#0066b2" },
      benfica: { primary: "#e30613", secondary: "#f4c430" },
      brighton: { primary: "#0057b8", secondary: "#ffffff" },
      chelsea: { primary: "#034694", secondary: "#dba111" },
      crystalpalace: { primary: "#1b458f", secondary: "#c4122e" },
      flfart: { primary: "#e83e5f", secondary: "#ffffff" },
      intermilan: { primary: "#0057b8", secondary: "#000000" },
      juventus: { primary: "#111111", secondary: "#ffffff" },
      manchestercity: { primary: "#6cabdd", secondary: "#1c2c5b" },
      manchesterunited: { primary: "#da291c", secondary: "#fbe122" },
      marseille: { primary: "#2faee0", secondary: "#ffffff" },
      monaco: { primary: "#d91023", secondary: "#ffffff" },
      parisstgermain: { primary: "#004170", secondary: "#da291c" },
      parisgermain: { primary: "#004170", secondary: "#da291c" },
      realmadrid: { primary: "#552583", secondary: "#febe10" },
      acspartapraha: { primary: "#000000", secondary: "#c71d20" },
      arsenal: { primary: "#db0007", secondary: "#d3bc8d" },
      tottenhamhotspur: { primary: "#132257", secondary: "#ffffff" },
      valencia: { primary: "#f15a24", secondary: "#000000" }
    };

    return themes[teamKey] || { primary: "#111b36", secondary: "#f4d35e" };
  }

  function applyPlayerPreviewTheme(preview, player) {
    var theme = getPlayerPreviewTheme(player);

    preview.style.setProperty("--preview-primary", theme.primary);
    preview.style.setProperty("--preview-secondary", theme.secondary);
  }

  function buildPlayerPreviewStatIndex(leadersData) {
    var index = {};
    var sections = Array.isArray(leadersData) ? leadersData : leadersData && leadersData.sections ? leadersData.sections : [];
    var wanted = { points: "points", rebounds: "rebounds", assists: "assists" };

    sections.forEach(function (section) {
      (section.categories || []).forEach(function (category) {
        var slug = String(category.slug || category.title || "").toLowerCase().replace(/\s+/g, "-");
        var statKey = wanted[slug];

        if (!statKey) {
          return;
        }

        (category.leaders || []).forEach(function (leader) {
          var file = core.getPlayerFileFromUrl(leader.playerUrl || leader.playerFile);

          if (!file) {
            return;
          }

          if (!index[file]) {
            index[file] = {};
          }

          if (index[file][statKey] === undefined) {
            index[file][statKey] = {
              value: leader.valueText || leader.value || "--",
              rank: leader.rank || null
            };
          }
        });
      });
    });

    return index;
  }

  function buildPlayerPreviewMarkup(player, stats) {
    var groups = [
      { title: "Offense", attrs: [["INS", "Ins"], ["JPS", "Jps"], ["3PS", "3ps"], ["HND", "Hnd"], ["PAS", "Pas"]] },
      { title: "Defense", attrs: [["ORB", "Orb"], ["DRB", "Drb"], ["PSD", "Psd"], ["PRD", "Prd"], ["STL", "Stl"], ["BLK", "Blk"]] },
      { title: "Physical", attrs: [["QKN", "Qkn"], ["JMP", "Jmp"], ["STR", "Str"], ["STA", "Sta"]] }
    ];
    var overall = player.overall || player.ovr || "--";
    var meta = [player.teamLabel || player.teamName || player.team, player.pos, player.age ? "Age " + player.age : ""].filter(Boolean).join(" | ");
    var pra = {
      points: stats && stats.points !== undefined ? stats.points : null,
      rebounds: stats && stats.rebounds !== undefined ? stats.rebounds : null,
      assists: stats && stats.assists !== undefined ? stats.assists : null
    };

    function statLabel(label, stat) {
      if (!stat || !stat.rank) {
        return label;
      }

      return label + " #" + stat.rank;
    }

    function statValue(stat) {
      return stat && stat.value !== undefined ? stat.value : "--";
    }

    return [
      '<div class="player-preview-pill__head">',
      "  <div>",
      '    <h3 class="player-preview-pill__name">' + core.escapeHtml(player.name || "Unknown Player") + "</h3>",
      '    <p class="player-preview-pill__meta">' + core.escapeHtml(meta || "Player profile") + "</p>",
      "  </div>",
      '  <div class="player-preview-pill__rating"><strong>' + core.escapeHtml(overall) + "</strong><span>OVR</span></div>",
      "</div>",
      '<div class="player-preview-pill__attrs">',
      groups.map(function (group) {
        return [
          '<section class="player-preview-pill__col">',
          '  <h4 class="player-preview-pill__col-title">' + group.title + "</h4>",
          group.attrs.map(function (attr) {
            return '<div class="player-preview-pill__attr"><span>' + attr[0] + "</span><strong>" + core.escapeHtml(getPlayerPreviewAttr(player, attr[1])) + "</strong></div>";
          }).join(""),
          "</section>"
        ].join("");
      }).join(""),
      "</div>",
      '<section class="player-preview-pill__pra">',
      '  <p class="player-preview-pill__pra-title">Top 25 Ranks</p>',
      '  <div class="player-preview-pill__pra-grid">',
      '    <div class="player-preview-pill__pra-item"><span>' + core.escapeHtml(statLabel("PTS", pra.points)) + "</span><strong>" + core.escapeHtml(statValue(pra.points)) + "</strong></div>",
      '    <div class="player-preview-pill__pra-item"><span>' + core.escapeHtml(statLabel("REB", pra.rebounds)) + "</span><strong>" + core.escapeHtml(statValue(pra.rebounds)) + "</strong></div>",
      '    <div class="player-preview-pill__pra-item"><span>' + core.escapeHtml(statLabel("AST", pra.assists)) + "</span><strong>" + core.escapeHtml(statValue(pra.assists)) + "</strong></div>",
      "  </div>",
      "</section>"
    ].join("");
  }

  function positionPlayerPreview(preview, x, y) {
    var margin = 8;
    var viewport = window.visualViewport || { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
    var rect;
    var left;
    var top;
    var minLeft = viewport.offsetLeft + margin;
    var minTop = viewport.offsetTop + margin;
    var maxLeft;
    var maxTop;

    preview.hidden = false;
    rect = preview.getBoundingClientRect();
    maxLeft = viewport.offsetLeft + viewport.width - rect.width - margin;
    maxTop = viewport.offsetTop + viewport.height - rect.height - margin;
    left = minLeft <= maxLeft ? minLeft : viewport.offsetLeft;
    top = Math.max(minTop, Math.min(y + 12, maxTop));
    preview.style.left = left + "px";
    preview.style.top = top + "px";
  }

  function initPlayerPreviewPill() {
    var longPressTimer = null;
    var suppressNextClick = false;
    var startPoint = null;
    var preview;
    var playerIndex = {};
    var statIndex = {};

    function hidePreview() {
      if (preview) {
        preview.hidden = true;
      }
    }

    function findPlayerLink(target) {
      var link = target && target.closest ? target.closest('a[href*="player"]') : null;
      return link && core.getPlayerFileFromUrl(link.getAttribute("href")) ? link : null;
    }

    function showPreview(link, x, y) {
      var file = core.getPlayerFileFromUrl(link.getAttribute("href"));
      var player = playerIndex[file];

      if (!player) {
        return;
      }

      suppressNextClick = true;
      applyPlayerPreviewTheme(preview, player);
      preview.innerHTML = buildPlayerPreviewMarkup(player, statIndex[file]);
      positionPlayerPreview(preview, x, y);
    }

    ensurePlayerPreviewStyles();
    preview = document.createElement("aside");
    preview.className = "player-preview-pill";
    preview.hidden = true;
    preview.setAttribute("aria-live", "polite");
    document.body.appendChild(preview);

    Promise.all([core.loadJsonData("players.json"), core.loadJsonData("leaders.json").catch(function () { return { sections: [] }; })])
      .then(function (results) {
        (results[0] || []).forEach(function (player) {
          var file = core.getPlayerFileFromUrl(player.url);

          if (file) {
            playerIndex[file] = player;
          }
        });

        statIndex = buildPlayerPreviewStatIndex(results[1]);
      })
      .catch(function () {
        playerIndex = {};
        statIndex = {};
      });

    document.addEventListener("pointerdown", function (event) {
      var link = findPlayerLink(event.target);

      if (preview && !preview.hidden && (!link || !preview.contains(event.target))) {
        hidePreview();
        return;
      }

      if (!link || event.button > 0) {
        return;
      }

      startPoint = { x: event.clientX, y: event.clientY };
      window.clearTimeout(longPressTimer);
      longPressTimer = window.setTimeout(function () {
        event.preventDefault();
        showPreview(link, startPoint.x, startPoint.y);
      }, 450);
    });

    document.addEventListener("pointermove", function (event) {
      if (!startPoint) {
        return;
      }

      if (Math.abs(event.clientX - startPoint.x) > 10 || Math.abs(event.clientY - startPoint.y) > 10) {
        window.clearTimeout(longPressTimer);
      }
    });

    document.addEventListener("pointerup", function () {
      window.clearTimeout(longPressTimer);
      startPoint = null;
    });

    document.addEventListener("pointercancel", function () {
      window.clearTimeout(longPressTimer);
      startPoint = null;
    });

    document.addEventListener("click", function (event) {
      if (suppressNextClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextClick = false;
        return;
      }

      if (preview && !preview.hidden && !preview.contains(event.target)) {
        hidePreview();
      }
    }, true);

    document.addEventListener("contextmenu", function (event) {
      if (findPlayerLink(event.target)) {
        event.preventDefault();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        hidePreview();
      }
    });

    window.addEventListener("scroll", hidePreview, true);
  }

  function initPlayerSearch(teamMap) {
    var root = ensureSearchRoot();
    if (!root) {
      return;
    }

    ensureSearchStyles();
    createSearchMarkup(root);

    var input = document.getElementById("player-search-input");
    var dropdown = document.getElementById("player-search-dropdown");

    core.loadJsonData("players.json")
      .then(function (players) {
        var searchIndex = core.enrichPlayers(players, teamMap).map(function (player) {
          return {
            name: player.name || "",
            url: core.normalizePlayerUrl(player.url),
            team: player.team || "",
            teamName: player.teamName || "",
            pos: player.pos || "",
            age: player.age || "",
            ht: player.ht || "",
            wt: player.wt || "",
            searchName: (player.name || "").toLowerCase()
          };
        });

        function navigateToPlayer(player) {
          window.location.href = core.getPlayerPageUrl(player.url);
        }

        input.addEventListener("input", function () {
          var query = input.value.trim().toLowerCase();
          if (!query) {
            dropdown.hidden = true;
            dropdown.innerHTML = "";
            return;
          }

          var matches = searchIndex
            .filter(function (player) {
              return player.searchName.indexOf(query) !== -1;
            })
            .slice(0, 8);

          core.renderResults(dropdown, matches, navigateToPlayer);
        });

        input.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            var query = input.value.trim().toLowerCase();
            var firstMatch = searchIndex.find(function (player) {
              return player.searchName.indexOf(query) !== -1;
            });

            if (firstMatch) {
              event.preventDefault();
              navigateToPlayer(firstMatch);
            }
          } else if (event.key === "Escape") {
            dropdown.hidden = true;
          }
        });

        document.addEventListener("click", function (event) {
          if (!root.contains(event.target)) {
            dropdown.hidden = true;
          }
        });
      })
      .catch(function () {
        root.innerHTML = "";
      });
  }

  function initWaiverDatabaseTable(teamMap) {
    var root = ensureWaiverTableRoot();
    if (!root) {
      return;
    }

    ensureWaiverTableStyles();

    core.loadJsonData("players.json")
      .then(function (players) {
        var enrichedPlayers = core.enrichPlayers(players, teamMap);

        root.innerHTML = "";
        root.appendChild(buildWaiverTable(enrichedPlayers));
        applyPageDestinationLinksToAnchors();
      })
      .catch(function () {
        root.innerHTML = "";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPlayerPreviewPill();
    core.loadJsonData("teams.json")
      .then(function (teams) {
        var teamMap = core.buildTeamMap(teams);
        initPlayerSearch(teamMap);
        initWaiverDatabaseTable(teamMap);
        applyPageDestinationLinksToAnchors();
      })
      .catch(function () {
        initPlayerSearch({});
        initWaiverDatabaseTable({});
        applyPageDestinationLinksToAnchors();
      });
  });
})();
