(function () {
  "use strict";

  var core = window.LeagueSiteCore;
  var PLAYER_RATING_STYLE_ID = "player-rating-pill-styles";
  var ROSTER_RATING_STYLE_ID = "roster-rating-pill-styles";

  if (!core) {
    return;
  }

  function ensurePlayerRatingStyles() {
    if (document.getElementById(PLAYER_RATING_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = PLAYER_RATING_STYLE_ID;
    style.textContent = [
      ".player-rating-pills-row td { padding-top: 6px; vertical-align: top; }",
      ".player-rating-pill-cell { white-space: nowrap; }",
      ".player-rating-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; padding: 2px 8px; border-radius: 999px; color: #ffffff; font: 700 10px/1 Inter, Tahoma, Arial, sans-serif; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.18); }",
      ".player-rating-pill--na { background: rgba(255, 255, 255, 0.18); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.28); box-shadow: none; }",
      ".player-rating-pill-separator { display: inline-block; margin-right: 6px; color: rgba(255, 255, 255, 0.92); font: 700 12px/1 Inter, Tahoma, Arial, sans-serif; }"
    ].join("");
    document.head.appendChild(style);
  }

  function ensureRosterRatingStyles() {
    if (document.getElementById(ROSTER_RATING_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = ROSTER_RATING_STYLE_ID;
    style.textContent = [
      ".roster-rating-pill-host { text-align: center; }",
      ".roster-rating-pill { align-items: center; border-radius: 999px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22); color: #ffffff !important; display: inline-block; font-family: Inter, Tahoma, Arial, sans-serif; font-size: 12px; font-style: normal; font-variant: normal; font-weight: 600; justify-content: center; line-height: 1.05; min-height: 0; min-width: 28px; padding: 2px 7px; text-align: center; text-decoration: none; text-indent: 0; text-shadow: 0 1px 1px rgba(15, 23, 42, 0.35); vertical-align: middle; white-space: nowrap; }",
      ".roster-rating-pill--na { background: rgba(148, 163, 184, 0.35); color: #e2e8f0; text-shadow: none; }"
    ].join("");
    document.head.appendChild(style);
  }

  function getCurrentPlayerPath() {
    return window.location.pathname.replace(/\\/g, "/").toLowerCase();
  }

  function findCurrentPlayerRecord(players) {
    var currentPath = getCurrentPlayerPath();
    var currentFile = currentPath.split("/").pop();
    var currentNameNode = document.querySelector("body > table:first-of-type td.teamheader table td.teamheader");
    var currentName = core.normalizeName(currentNameNode ? currentNameNode.textContent : "");

    return (players || []).find(function (player) {
      var playerUrl = String(player && player.url ? player.url : "").replace(/\\/g, "/").toLowerCase();
      var playerFile = playerUrl.split("/").pop();
      if (playerFile && currentFile && playerFile === currentFile) {
        return true;
      }

      if (playerUrl && currentPath && currentPath.indexOf(playerUrl.replace("../", "/")) !== -1) {
        return true;
      }

      return currentName && core.normalizeName(player && player.name) === currentName;
    }) || null;
  }

  function getColorBarCells() {
    return Array.prototype.slice.call(
      document.querySelectorAll("body > table:first-of-type td.teamheader table td[bgcolor]")
    ).slice(0, 2);
  }

  function formatRatingValue(value) {
    var text = String(value || "").trim();
    return text || "N/A";
  }

  function createRatingPill(text, backgroundColor, fallbackClassName) {
    var pill = document.createElement("span");
    pill.className = "player-rating-pill" + (fallbackClassName ? " " + fallbackClassName : "");
    pill.textContent = text;
    if (backgroundColor) {
      pill.style.backgroundColor = backgroundColor;
    }
    return pill;
  }

  function buildPlayerRecordMaps(players) {
    var byFile = {};
    var byName = {};

    (players || []).forEach(function (player) {
      var file = core.getPlayerFileFromUrl(player && player.url ? player.url : "");
      var normalizedName = core.normalizeName(player && player.name);

      if (file) {
        byFile[file] = player;
      }

      if (normalizedName && !byName[normalizedName]) {
        byName[normalizedName] = player;
      }
    });

    return {
      byFile: byFile,
      byName: byName
    };
  }

  function findRosterRatingColor(cell) {
    var colorNode = cell && cell.querySelector("[bgcolor]");
    return colorNode ? colorNode.getAttribute("bgcolor") || "" : "";
  }

  function findRosterPlayerRecord(row, playerMaps) {
    var playerLink = row.querySelector('a[href*="player"]');
    var playerCell = row.children[1];
    var file = playerLink ? core.getPlayerFileFromUrl(playerLink.getAttribute("href") || "") : "";
    var name = core.normalizeName(playerCell ? playerCell.textContent : "");

    if (file && playerMaps.byFile[file]) {
      return playerMaps.byFile[file];
    }

    return name && playerMaps.byName[name] ? playerMaps.byName[name] : null;
  }

  function findLinkedPlayerRecord(row, playerMaps) {
    var playerLink = row.querySelector('a[href*="player"]');
    var file = playerLink ? core.getPlayerFileFromUrl(playerLink.getAttribute("href") || "") : "";
    var name = core.normalizeName(playerLink ? playerLink.textContent : "");

    if (file && playerMaps.byFile[file]) {
      return playerMaps.byFile[file];
    }

    return name && playerMaps.byName[name] ? playerMaps.byName[name] : null;
  }

  function setRosterRatingCell(cell, value) {
    var text = formatRatingValue(value);

    cell.dataset.sortValue = text === "N/A" ? "" : String(value);
    cell.title = text === "N/A" ? "Rating unavailable" : text;
  }

  function createRosterRatingPill(text, backgroundColor) {
    var pill = document.createElement("span");

    pill.className = "roster-rating-pill" + (text === "N/A" ? " roster-rating-pill--na" : "");
    pill.textContent = text;
    if (backgroundColor && text !== "N/A") {
      pill.style.backgroundColor = backgroundColor;
    }
    return pill;
  }

  function setRosterRatingCellDisplay(cell, value, showNumbers) {
    var text = formatRatingValue(value);
    var color = findRosterRatingColor(cell);

    setRosterRatingCell(cell, value);

    if (!showNumbers) {
      return;
    }

    cell.classList.add("roster-rating-pill-host");
    cell.innerHTML = "";
    cell.appendChild(createRosterRatingPill(text, color));
  }

  function enhanceRosterRatingTables(players) {
    if (!core.isRosterPage()) {
      return;
    }

    var settings = core.getSettings();
    var showNumbers = settings.rosterRatingDisplay === "numbers";
    var playerMaps = buildPlayerRecordMaps(players);
    var tables = Array.prototype.slice.call(document.querySelectorAll("table"));
    var enhancedCount = 0;

    tables.forEach(function (table) {
      var headerRow = Array.prototype.slice.call(table.querySelectorAll("tr")).find(function (row) {
        return row.querySelector("td.header");
      });
      var headerCells = headerRow ? Array.prototype.slice.call(headerRow.querySelectorAll("td.header")) : [];
      var curIndex = -1;
      var futIndex = -1;

      if (!headerCells.length) {
        return;
      }

      headerCells.forEach(function (headerCell, index) {
        var label = String(headerCell.textContent || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
        if (label.indexOf("CUR") === 0) {
          curIndex = index;
        } else if (label.indexOf("FUT") === 0) {
          futIndex = index;
        }
      });

      if (curIndex === -1 || futIndex === -1) {
        return;
      }

      Array.prototype.slice.call(table.querySelectorAll("tr.row1, tr.row2")).forEach(function (row) {
        var cells = row.children;
        var player = findRosterPlayerRecord(row, playerMaps);
        var curCell = cells[curIndex];
        var futCell = cells[futIndex];

        if (!curCell || !futCell || !player) {
          return;
        }

        setRosterRatingCellDisplay(curCell, player.overall, showNumbers);
        setRosterRatingCellDisplay(futCell, player.potential, showNumbers);
        enhancedCount += 1;
      });
    });

    if (enhancedCount) {
      ensureRosterRatingStyles();
    }
  }

  function isFreeAgentOrDraftPage() {
    var path = String(window.location.pathname || "").replace(/\\/g, "/");
    return /\/(?:freeagents|potentialfreeagents|draft)\.htm$/i.test(path);
  }

  function getDirectHeaderRow(table) {
    return Array.prototype.slice.call(table.rows || []).find(function (row) {
      return row.querySelector("td.header");
    }) || null;
  }

  function getRatingColumnIndexes(headerRow) {
    var result = { curIndex: -1, futIndex: -1 };
    var headerCells = headerRow ? Array.prototype.slice.call(headerRow.children) : [];

    headerCells.forEach(function (headerCell, index) {
      var label = String(headerCell.textContent || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
      if (label.indexOf("CUR") === 0) {
        result.curIndex = index;
      } else if (label.indexOf("FUT") === 0) {
        result.futIndex = index;
      }
    });

    return result;
  }

  function enhanceFreeAgentAndDraftRatingTables(players) {
    if (!isFreeAgentOrDraftPage()) {
      return;
    }

    var settings = core.getSettings();
    var showNumbers = settings.rosterRatingDisplay === "numbers";
    var playerMaps = buildPlayerRecordMaps(players);
    var enhancedCount = 0;

    Array.prototype.slice.call(document.querySelectorAll("table")).forEach(function (table) {
      var headerRow = getDirectHeaderRow(table);
      var ratingColumns = getRatingColumnIndexes(headerRow);

      if (ratingColumns.curIndex === -1 || ratingColumns.futIndex === -1) {
        return;
      }

      Array.prototype.slice.call(table.querySelectorAll("tr.row1, tr.row2")).forEach(function (row) {
        var player = findLinkedPlayerRecord(row, playerMaps);
        var curCell = row.children[ratingColumns.curIndex];
        var futCell = row.children[ratingColumns.futIndex];

        if (!player || !curCell || !futCell) {
          return;
        }

        setRosterRatingCellDisplay(curCell, player.overall, showNumbers);
        setRosterRatingCellDisplay(futCell, player.potential, showNumbers);
        enhancedCount += 1;
      });
    });

    if (enhancedCount) {
      ensureRosterRatingStyles();
    }
  }

  function injectPlayerRatingPills(player) {
    if (!core.isPlayerPage()) {
      return;
    }

    var headerTable = document.querySelector("body > table:first-of-type td.teamheader table");
    var headerRow = headerTable && headerTable.querySelector("tr");
    var colorCells = getColorBarCells();

    if (!headerTable || !headerRow || colorCells.length < 2 || headerTable.querySelector(".player-rating-pills-row")) {
      return;
    }

    ensurePlayerRatingStyles();

    var overallColor = colorCells[0].getAttribute("bgcolor") || "";
    var potentialColor = colorCells[1].getAttribute("bgcolor") || overallColor;
    var overallText = formatRatingValue(player && player.overall);
    var potentialText = formatRatingValue(player && player.potential);

    var ratingRow = document.createElement("tr");
    ratingRow.className = "player-rating-pills-row";

    var overallCell = document.createElement("td");
    overallCell.className = "player-rating-pill-cell";
    overallCell.appendChild(
      createRatingPill(overallText, overallText === "N/A" ? "" : overallColor, overallText === "N/A" ? "player-rating-pill--na" : "")
    );

    var potentialCell = document.createElement("td");
    potentialCell.className = "player-rating-pill-cell";
    var separator = document.createElement("span");
    separator.className = "player-rating-pill-separator";
    separator.textContent = "/";
    separator.setAttribute("aria-label", "OVR slash POT");
    separator.title = "OVR/POT";
    potentialCell.appendChild(separator);
    potentialCell.appendChild(
      createRatingPill(potentialText, potentialText === "N/A" ? "" : potentialColor, potentialText === "N/A" ? "player-rating-pill--na" : "")
    );

    var spacerCell = document.createElement("td");

    ratingRow.appendChild(overallCell);
    ratingRow.appendChild(potentialCell);
    ratingRow.appendChild(spacerCell);

    headerTable.appendChild(ratingRow);
  }

  function initPlayerRatings() {
    if (!core.isPlayerPage()) {
      return;
    }

    core.loadJsonData("players.json")
      .then(function (players) {
        injectPlayerRatingPills(findCurrentPlayerRecord(players));
      })
      .catch(function () {
        injectPlayerRatingPills(null);
      });
  }

  function initRosterRatings() {
    if (!core.isRosterPage() && !isFreeAgentOrDraftPage()) {
      return;
    }

    core.loadJsonData("players.json")
      .then(function (players) {
        enhanceRosterRatingTables(players);
        enhanceFreeAgentAndDraftRatingTables(players);
      })
      .catch(function () {
        enhanceRosterRatingTables([]);
        enhanceFreeAgentAndDraftRatingTables([]);
      });
  }

  function enhanceRosterStickyTables() {
    var settings = core.getSettings();

    if (!core.isRosterPage() || settings.rosterStickyTables === "off") {
      return;
    }

    function syncStickyTable(table) {
      var headerRow = table.rows && table.rows.length > 1 ? table.rows[1] : null;
      var firstHeaderCell = headerRow && headerRow.cells.length > 1 ? headerRow.cells[0] : null;
      var secondHeaderCell = headerRow && headerRow.cells.length > 1 ? headerRow.cells[1] : null;

      if (!firstHeaderCell || !secondHeaderCell) {
        return;
      }

      var stickyCol1Width = Math.ceil(firstHeaderCell.getBoundingClientRect().width);
      var stickyCol2Width = Math.ceil(secondHeaderCell.getBoundingClientRect().width);

      if (table.classList.contains("roster-sticky-table--dual")) {
        stickyCol1Width = Math.max(stickyCol1Width, 34);
        stickyCol2Width = Math.min(stickyCol2Width, 100);
        [3, 4, 5].forEach(function (cellIndex) {
          if (headerRow.cells[cellIndex]) {
            headerRow.cells[cellIndex].style.width = "42px";
            headerRow.cells[cellIndex].style.minWidth = "42px";
            headerRow.cells[cellIndex].style.maxWidth = "42px";
          }
        });
      }

      table.style.setProperty("--sticky-col-1-width", stickyCol1Width + "px");
      table.style.setProperty("--sticky-col-2-width", stickyCol2Width + "px");

      Array.prototype.slice.call(table.rows).forEach(function (row, rowIndex) {
        if (rowIndex === 0) {
          return;
        }

        [0, 1].forEach(function (cellIndex) {
          var cell = row.cells[cellIndex];
          if (!cell) {
            return;
          }

          if (table.classList.contains("roster-sticky-table--name-only") && cellIndex === 1) {
            cell.style.backgroundColor = "";
            return;
          }

          var backgroundColor = rowIndex === 1
            ? window.getComputedStyle(cell).backgroundColor
            : window.getComputedStyle(row).backgroundColor;

          cell.style.backgroundColor = backgroundColor && backgroundColor !== "rgba(0, 0, 0, 0)"
            ? backgroundColor
            : "";
        });
      });
    }

    Array.prototype.slice.call(document.querySelectorAll('table[width="800"]')).forEach(function (table) {
      var titleCell = table.querySelector("tr:first-child td.tableheader");
      var title = titleCell ? titleCell.textContent.replace(/\u00a0/g, " ").trim() : "";
      var headerRow = table.rows && table.rows.length > 1 ? table.rows[1] : null;
      var firstHeaderCell = headerRow && headerRow.cells.length > 1 ? headerRow.cells[0] : null;
      var secondHeaderCell = headerRow && headerRow.cells.length > 1 ? headerRow.cells[1] : null;

      var isDualStickyTable = /^(Attributes|Potentials)$/i.test(title);
      var isNameStickyTable = /^(Season Stats|Season Shooting|Season Efficiency|Career Stats|Career Shooting|Career Efficiency)$/i.test(title);

      if ((!isDualStickyTable && !isNameStickyTable) || !firstHeaderCell || !secondHeaderCell) {
        return;
      }

      if (!table.classList.contains("roster-sticky-table")) {
        table.classList.add("roster-sticky-table");
      }

      table.classList.toggle("roster-sticky-table--dual", isDualStickyTable);
      table.classList.toggle("roster-sticky-table--name-only", isNameStickyTable);

      if (!table.parentElement || !table.parentElement.classList.contains("roster-sticky-table-wrap")) {
        var wrapper = document.createElement("div");
        wrapper.className = "roster-sticky-table-wrap";
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }

      if (table.dataset.stickySortBound !== "true") {
        table.dataset.stickySortBound = "true";
        Array.prototype.slice.call(table.querySelectorAll("td.header")).forEach(function (header) {
          header.addEventListener("click", function () {
            window.setTimeout(function () {
              syncStickyTable(table);
            }, 0);
          });
        });
      }

      syncStickyTable(table);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPlayerRatings();
    initRosterRatings();
    enhanceRosterStickyTables();
  });
})();
