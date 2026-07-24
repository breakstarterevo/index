(function () {
  "use strict";

  var IS_MATCH_CENTRE = /\/match-centre\.htm$/i.test(window.location.pathname);
  var DATA = {
    boxScores: "../../00-build/database/box_scores.json",
    photos: "../../00-build/database/player_photos.json",
    schedule: "../../00-build/database/schedule.json"
  };
  var TEAM_LOGOS = {
    "AC Milan": "acmilan.jpg", "AFC Richmond": "richmond.jpg", "Ajax": "ajax.jpg",
    "Aston Villa": "astonvilla.jpg", "Atletico Madrid": "atletico.jpg", "Barcelona": "barcelona.jpg",
    "Bayern Munich": "bayern.jpg", "Benfica": "benfica.jpg", "Brighton": "brighton.jpg",
    "Chelsea": "chelsea.jpg", "Crystal Palace": "crystalpalace.jpg", "FL Fart": "flfart.jpg",
    "Inter Milan": "intermilan.jpg", "Juventus": "juventus.jpg", "Manchester City": "manchestercity.jpg",
    "Manchester United": "manutd.jpg", "Marseille": "marseille.jpg", "Monaco": "monaco.jpg",
    "Paris Saint-Germain": "psg.jpg", "Real Madrid": "realmadrid.jpg", "Sheffield United": "sheffield.jpg",
    "Sporting CP": "sportingcp.jpg", "Tottenham Hotspur": "tottenham.jpg", "Valencia": "valencia.jpg"
  };
  var state = {
    games: [],
    timeline: [],
    selectedIndex: -1,
    photos: {},
    invalidRoute: false,
    activeTeamSide: "away",
    tableSort: {
      away: { key: "", direction: "desc" },
      home: { key: "", direction: "desc" }
    }
  };

  function byId(id) {
    if (IS_MATCH_CENTRE && id === "previousGame") return document.getElementById("boxPreviousGame");
    if (IS_MATCH_CENTRE && id === "nextGame") return document.getElementById("boxNextGame");
    return document.getElementById(id);
  }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function esc(value) {
    if (window.ESLUnifiedUI && typeof ESLUnifiedUI.escapeHtml === "function") {
      return ESLUnifiedUI.escapeHtml(value);
    }
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function initials(value) {
    return clean(value).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
      return part.charAt(0);
    }).join("").toUpperCase() || "TM";
  }
  function teamAbbr(name) {
    return window.ESLUnifiedUI && typeof ESLUnifiedUI.teamAbbreviation === "function"
      ? ESLUnifiedUI.teamAbbreviation(name)
      : initials(name).slice(0, 3);
  }
  function teamColor(name, fallback) {
    return window.ESLUnifiedUI && typeof ESLUnifiedUI.teamColor === "function"
      ? ESLUnifiedUI.teamColor(name, fallback)
      : (fallback || "#111b36");
  }
  function logoPath(name) {
    return "../../00-assets/photos/" + (TEAM_LOGOS[name] || normalize(name) + ".jpg");
  }
  function rosterHref(teamId) {
    return "./unified-roster.htm?file=" + encodeURIComponent(clean(teamId) + ".htm");
  }
  function playerHref(playerId) {
    return "./unified-player.htm?id=" + encodeURIComponent(clean(playerId));
  }
  function gameId(value) {
    var match = clean(value).match(/box\d+-\d+/i);
    return match ? match[0].toLowerCase() : "";
  }
  function currentRouteId() {
    var params = new URLSearchParams(window.location.search);
    return gameId(params.get("game") || params.get("file") || params.get("box"));
  }
  if (IS_MATCH_CENTRE && !currentRouteId()) return;
  function gameHref(game) {
    return "./match-centre.htm?game=" + encodeURIComponent(game.gameId);
  }

  function rosterId(value) {
    var match = clean(value).match(/roster\d+/i);
    return match ? match[0].toLowerCase() : "";
  }

  function scheduleGameId(game) {
    return gameId(game && (game.boxscoreFile || game.boxscoreUrl));
  }

  function scheduleHref(game) {
    var id = scheduleGameId(game);
    var params;
    if (game && game.status === "completed" && id) {
      return "./match-centre.htm?game=" + encodeURIComponent(id);
    }
    params = new URLSearchParams();
    params.set("date", game.date || "");
    params.set("away", rosterId(game.awayTeam));
    params.set("home", rosterId(game.homeTeam));
    return "./match-centre.htm?" + params.toString();
  }

  function flattenSchedule(schedule) {
    var games = [];
    (schedule && schedule.sections || []).forEach(function (section) {
      (section.days || []).forEach(function (day) {
        (day.games || []).forEach(function (game) {
          if (!game.awayTeam || !game.homeTeam) return;
          games.push(Object.assign({}, game, {
            date: day.date,
            sectionTitle: section.title || "ESL",
            sectionSlug: section.slug || ""
          }));
        });
      });
    });
    return games;
  }
  function loadJson(path, optional) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + path);
      return response.json();
    }).catch(function () {
      return loadJsonFromFrame(path).catch(function (error) {
        if (optional !== undefined) return optional;
        throw error;
      });
    });
  }
  function loadJsonFromFrame(path) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      frame.src = path;
      frame.addEventListener("load", function () {
        var raw = "";
        try {
          raw = frame.contentDocument && frame.contentDocument.body ? frame.contentDocument.body.textContent : "";
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

  function textColor(hex) {
    var value = String(hex || "").replace("#", "");
    var red;
    var green;
    var blue;
    var luminance;
    if (value.length === 3) value = value.split("").map(function (part) { return part + part; }).join("");
    if (!/^[0-9a-f]{6}$/i.test(value)) return "#ffffff";
    red = parseInt(value.slice(0, 2), 16);
    green = parseInt(value.slice(2, 4), 16);
    blue = parseInt(value.slice(4, 6), 16);
    luminance = (0.299 * red + 0.587 * green + 0.114 * blue);
    return luminance > 165 ? "#111b36" : "#ffffff";
  }
  function setTeamStyle(node, color) {
    var ink = textColor(color);
    node.style.setProperty("--box-team-color", color);
    node.style.setProperty("--box-team-text", ink);
    node.style.setProperty("--box-team-muted", ink === "#ffffff" ? "rgba(255,255,255,.75)" : "rgba(17,27,54,.72)");
  }
  function setPanelStyle(node, color) {
    node.style.setProperty("--team-panel-color", color);
    node.style.setProperty("--team-panel-text", textColor(color));
  }
  function formatDate(value) {
    var match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var date;
    if (!match) return value;
    date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function formatPct(value) {
    return value == null || !Number.isFinite(Number(value)) ? "-" : (Number(value) * 100).toFixed(1) + "%";
  }
  function madeAttempted(made, attempted) {
    return (made == null ? "-" : made) + "-" + (attempted == null ? "-" : attempted);
  }
  function signed(value) {
    if (value == null || !Number.isFinite(Number(value))) return "-";
    return Number(value) > 0 ? "+" + value : String(value);
  }
  function statValue(value) {
    return value == null || value === "" ? "-" : value;
  }

  function renderTeamHero(game, side, color) {
    var team = game[side];
    var winner = clean(game.winner) === clean(team.teamId);
    var node = byId(side + "Hero");
    setTeamStyle(node, color);
    node.innerHTML =
      '<a class="boxscore-team-logo-link" href="' + esc(rosterHref(team.teamId)) + '" aria-label="Open ' + esc(team.name) + ' roster">' +
        '<img class="boxscore-team-logo" src="' + esc(logoPath(team.name)) + '" alt="' + esc(team.name) + ' logo" onerror="this.outerHTML=\'<span class=&quot;boxscore-team-logo-fallback&quot;>' + esc(initials(team.name)) + '</span>\'">' +
      "</a>" +
      '<div class="boxscore-team-copy">' +
        '<h1 class="boxscore-team-name"><a href="' + esc(rosterHref(team.teamId)) + '">' + esc(team.name) + "</a></h1>" +
        '<div class="boxscore-team-meta">' + esc(teamAbbr(team.name) + " · " + game.section) + "</div>" +
        (winner ? '<span class="boxscore-winner">Winner</span>' : "") +
      "</div>" +
      '<div class="boxscore-team-score">' + esc(team.score) + "</div>";
  }

  function renderHero(game) {
    var awayColor = teamColor(game.away.name, "#1d3666");
    var homeColor = teamColor(game.home.name, "#111b36");
    var overtimeCount = Math.max(0, (game.away.periods || []).length - 4);
    var winner = clean(game.winner) === clean(game.away.teamId) ? game.away : game.home;
    document.documentElement.style.setProperty("--box-away", awayColor);
    document.documentElement.style.setProperty("--box-home", homeColor);
    renderTeamHero(game, "away", awayColor);
    renderTeamHero(game, "home", homeColor);
    byId("finalLabel").textContent = overtimeCount ? "Final " + (overtimeCount > 1 ? overtimeCount : "") + "OT" : "Final";
    byId("competition").textContent = game.section || "ESL";
    byId("gameDate").textContent = formatDate(game.date);
    byId("gameMargin").textContent = winner.name + " by " + game.margin;
    document.title = game.away.name + " " + game.away.score + ", " + game.home.name + " " + game.home.score +
      (IS_MATCH_CENTRE ? " - Match Centre" : " - Box Score");
  }

  function renderPeriods(game) {
    var labels = (game.away.periods || []).map(function (period) { return period.label; });
    var awayColor = teamColor(game.away.name, "#1d3666");
    var homeColor = teamColor(game.home.name, "#111b36");
    function row(team, color) {
      var periodMap = {};
      (team.periods || []).forEach(function (period) { periodMap[period.label] = period.points; });
      return "<tr><td><span class=\"boxscore-period-team\"><span class=\"boxscore-period-swatch\" style=\"--period-color:" + esc(color) + "\"></span>" +
        esc(teamAbbr(team.name)) + "</span></td>" +
        labels.map(function (label) { return "<td>" + esc(statValue(periodMap[label])) + "</td>"; }).join("") +
        "<td>" + esc(team.score) + "</td></tr>";
    }
    byId("periodScore").innerHTML =
      '<table class="boxscore-period-table"><thead><tr><th>Team</th>' +
      labels.map(function (label) { return "<th>" + esc(label) + "</th>"; }).join("") +
      "<th>Total</th></tr></thead><tbody>" +
      row(game.away, awayColor) + row(game.home, homeColor) +
      "</tbody></table>";
  }

  function comparisonRows(game) {
    return [
      { label: "FG%", away: game.away.percentages.fgPct, home: game.home.percentages.fgPct, format: formatPct, higher: true },
      { label: "3P%", away: game.away.percentages.threePct, home: game.home.percentages.threePct, format: formatPct, higher: true },
      { label: "FT%", away: game.away.percentages.ftPct, home: game.home.percentages.ftPct, format: formatPct, higher: true },
      { label: "REB", away: game.away.totals.reb, home: game.home.totals.reb, format: statValue, higher: true },
      { label: "AST", away: game.away.totals.ast, home: game.home.totals.ast, format: statValue, higher: true },
      { label: "STL", away: game.away.totals.stl, home: game.home.totals.stl, format: statValue, higher: true },
      { label: "BLK", away: game.away.totals.blk, home: game.home.totals.blk, format: statValue, higher: true },
      { label: "TO", away: game.away.totals.to, home: game.home.totals.to, format: statValue, higher: false }
    ];
  }
  function hasEdge(row, side) {
    var away = Number(row.away);
    var home = Number(row.home);
    if (!Number.isFinite(away) || !Number.isFinite(home) || away === home) return false;
    if (side === "away") return row.higher ? away > home : away < home;
    return row.higher ? home > away : home < away;
  }
  function renderComparison(game) {
    byId("teamComparison").innerHTML = comparisonRows(game).map(function (row) {
      return '<div class="boxscore-comparison-stat">' +
        '<strong class="' + (hasEdge(row, "away") ? "has-edge" : "") + '">' + esc(row.format(row.away)) + "</strong>" +
        '<span class="boxscore-comparison-label">' + esc(row.label) + "</span>" +
        '<strong class="' + (hasEdge(row, "home") ? "has-edge" : "") + '">' + esc(row.format(row.home)) + "</strong>" +
      "</div>";
    }).join("");
  }

  function findPlayer(game, playerId) {
    return game.away.players.concat(game.home.players).find(function (player) {
      return clean(player.playerId) === clean(playerId);
    }) || null;
  }
  function playerTeam(game, playerId) {
    return game.away.players.some(function (player) { return clean(player.playerId) === clean(playerId); })
      ? game.away
      : game.home;
  }
  function playerPhoto(player) {
    var photo = state.photos[clean(player.playerId)];
    if (!photo || !photo.url) {
      return '<span class="boxscore-potg-fallback">' + esc(initials(player.name)) + "</span>";
    }
    return '<img class="boxscore-potg-photo" src="' + esc(photo.url) + '" alt="' + esc(player.name) + ' headshot" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=&quot;boxscore-potg-fallback&quot;>' + esc(initials(player.name)) + '</span>\'">';
  }
  function renderPlayerOfGame(game) {
    var award = game.playerOfGame;
    var player = award ? findPlayer(game, award.playerId) : null;
    var team;
    if (!player) {
      byId("potgTeam").textContent = "";
      byId("playerOfGame").innerHTML = '<div class="ui-state">Player of the Game unavailable.</div>';
      return;
    }
    team = playerTeam(game, player.playerId);
    byId("potgTeam").textContent = teamAbbr(team.name);
    byId("playerOfGame").innerHTML =
      '<article class="boxscore-potg">' +
        playerPhoto(player) +
        '<div><a class="boxscore-potg-name" href="' + esc(playerHref(player.playerId)) + '">' + esc(player.name) + "</a>" +
        '<div class="boxscore-potg-statline">' + esc(player.pos + " · " + madeAttempted(player.fgm, player.fga) + " FG · " + signed(player.plusMinus)) + "</div>" +
        '<div class="boxscore-potg-stats">' +
          '<div class="boxscore-potg-stat"><strong>' + esc(player.pts) + '</strong><span>PTS</span></div>' +
          '<div class="boxscore-potg-stat"><strong>' + esc(player.reb) + '</strong><span>REB</span></div>' +
          '<div class="boxscore-potg-stat"><strong>' + esc(player.ast) + '</strong><span>AST</span></div>' +
          '<div class="boxscore-potg-stat"><strong>' + esc(player.stl) + '</strong><span>STL</span></div>' +
        "</div></div>" +
      "</article>";
  }

  function playerRow(player) {
    var plusClass = Number(player.plusMinus) > 0 ? "boxscore-positive" : (Number(player.plusMinus) < 0 ? "boxscore-negative" : "");
    return "<tr>" +
      '<td><a class="boxscore-player-link" href="' + esc(playerHref(player.playerId)) + '">' + esc(player.name) + "</a></td>" +
      "<td>" + esc(player.pos) + "</td>" +
      "<td>" + esc(statValue(player.min)) + "</td>" +
      "<td>" + esc(madeAttempted(player.fgm, player.fga)) + "</td>" +
      "<td>" + esc(madeAttempted(player.threePm, player.threePa)) + "</td>" +
      "<td>" + esc(madeAttempted(player.ftm, player.fta)) + "</td>" +
      "<td>" + esc(statValue(player.orb)) + "</td>" +
      "<td>" + esc(statValue(player.reb)) + "</td>" +
      "<td>" + esc(statValue(player.ast)) + "</td>" +
      "<td>" + esc(statValue(player.stl)) + "</td>" +
      "<td>" + esc(statValue(player.blk)) + "</td>" +
      "<td>" + esc(statValue(player.to)) + "</td>" +
      "<td>" + esc(statValue(player.pf)) + "</td>" +
      '<td class="' + plusClass + '">' + esc(signed(player.plusMinus)) + "</td>" +
      '<td class="boxscore-points">' + esc(statValue(player.pts)) + "</td>" +
    "</tr>";
  }
  function totalsRow(totals) {
    return "<tr><td>Totals</td><td></td><td></td>" +
      "<td>" + esc(madeAttempted(totals.fgm, totals.fga)) + "</td>" +
      "<td>" + esc(madeAttempted(totals.threePm, totals.threePa)) + "</td>" +
      "<td>" + esc(madeAttempted(totals.ftm, totals.fta)) + "</td>" +
      "<td>" + esc(statValue(totals.orb)) + "</td>" +
      "<td>" + esc(statValue(totals.reb)) + "</td>" +
      "<td>" + esc(statValue(totals.ast)) + "</td>" +
      "<td>" + esc(statValue(totals.stl)) + "</td>" +
      "<td>" + esc(statValue(totals.blk)) + "</td>" +
      "<td>" + esc(statValue(totals.to)) + "</td>" +
      "<td>" + esc(statValue(totals.pf)) + "</td><td></td>" +
      '<td class="boxscore-points">' + esc(statValue(totals.pts)) + "</td></tr>";
  }

  var TABLE_COLUMNS = [
    { key: "name", label: "Player", type: "text" },
    { key: "pos", label: "Pos", type: "text" },
    { key: "min", label: "Min", type: "number" },
    { key: "fg", label: "FG", type: "number" },
    { key: "three", label: "3PT", type: "number" },
    { key: "ft", label: "FT", type: "number" },
    { key: "orb", label: "ORB", type: "number" },
    { key: "reb", label: "REB", type: "number" },
    { key: "ast", label: "AST", type: "number" },
    { key: "stl", label: "STL", type: "number" },
    { key: "blk", label: "BLK", type: "number" },
    { key: "to", label: "TO", type: "number" },
    { key: "pf", label: "PF", type: "number" },
    { key: "plusMinus", label: "+/-", type: "number" },
    { key: "pts", label: "PTS", type: "number" }
  ];

  function shootingRate(made, attempted) {
    var attempts = Number(attempted);
    return Number.isFinite(attempts) && attempts > 0 ? Number(made) / attempts : null;
  }

  function playerSortValue(player, key) {
    if (key === "name") return clean(player.name).toLowerCase();
    if (key === "pos") return clean(player.pos).toLowerCase();
    if (key === "fg") return shootingRate(player.fgm, player.fga);
    if (key === "three") return shootingRate(player.threePm, player.threePa);
    if (key === "ft") return shootingRate(player.ftm, player.fta);
    return player[key] == null || player[key] === "" ? null : Number(player[key]);
  }

  function sortedPlayers(team, side) {
    var sort = state.tableSort[side];
    var column = TABLE_COLUMNS.find(function (entry) { return entry.key === sort.key; });
    if (!column) return team.players.slice();

    return team.players.map(function (player, index) {
      return { player: player, index: index, value: playerSortValue(player, sort.key) };
    }).sort(function (left, right) {
      var comparison;
      if (left.value == null && right.value == null) return left.index - right.index;
      if (left.value == null) return 1;
      if (right.value == null) return -1;
      comparison = column.type === "text"
        ? String(left.value).localeCompare(String(right.value))
        : Number(left.value) - Number(right.value);
      if (!comparison) return left.index - right.index;
      return sort.direction === "asc" ? comparison : -comparison;
    }).map(function (entry) {
      return entry.player;
    });
  }

  function sortHeader(column, sort) {
    var active = sort.key === column.key;
    var ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
    var indicator = active ? (sort.direction === "asc" ? " ↑" : " ↓") : "";
    return '<th aria-sort="' + ariaSort + '"><button class="boxscore-sort" type="button" data-sort-key="' +
      esc(column.key) + '" title="Sort by ' + esc(column.label) + '">' + esc(column.label) +
      '<span class="boxscore-sort-indicator" aria-hidden="true">' + indicator + "</span></button></th>";
  }

  function renderTeamTabs(game) {
    ["away", "home"].forEach(function (side) {
      var team = game[side];
      var tab = byId(side + "TableTab");
      var active = state.activeTeamSide === side;
      tab.innerHTML = '<span class="boxscore-tab-name">' + esc(team.name) + '</span><span class="boxscore-tab-score">' + esc(team.score) + "</span>";
      tab.style.setProperty("--team-tab-color", teamColor(team.name, side === "away" ? "#1d3666" : "#111b36"));
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    byId("teamTable").setAttribute("aria-labelledby", state.activeTeamSide + "TableTab");
  }

  function renderTeamTable(game, side) {
    var team = game[side];
    var color = teamColor(team.name, side === "away" ? "#1d3666" : "#111b36");
    var panel = byId("teamTablePanel");
    var sort = state.tableSort[side];
    var players = sortedPlayers(team, side);
    setPanelStyle(panel, color);
    renderTeamTabs(game);
    byId("teamTableTitle").textContent = team.name;
    byId("teamShooting").textContent = "FG " + formatPct(team.percentages.fgPct) + " · 3PT " + formatPct(team.percentages.threePct) + " · FT " + formatPct(team.percentages.ftPct);
    byId("teamTable").innerHTML =
      '<div class="boxscore-table-wrap"><table class="boxscore-table"><thead><tr>' +
      TABLE_COLUMNS.map(function (column) { return sortHeader(column, sort); }).join("") +
      "</tr></thead><tbody>" +
      players.map(playerRow).join("") +
      "</tbody><tfoot>" + totalsRow(team.totals) + "</tfoot></table></div>";
    byId("teamTable").querySelector(".boxscore-table-wrap").addEventListener("scroll", function (event) {
      event.currentTarget.style.setProperty("--box-scroll-left", event.currentTarget.scrollLeft + "px");
    }, { passive: true });
  }

  function updateNavigation() {
    var current;
    var timelineIndex;
    if (IS_MATCH_CENTRE && state.timeline.length) {
      current = state.games[state.selectedIndex];
      timelineIndex = state.timeline.findIndex(function (game) {
        return scheduleGameId(game) === gameId(current && current.gameId);
      });
      byId("previousGame").disabled = timelineIndex <= 0;
      byId("nextGame").disabled = timelineIndex < 0 || timelineIndex >= state.timeline.length - 1;
      return;
    }
    byId("previousGame").disabled = state.selectedIndex <= 0;
    byId("nextGame").disabled = state.selectedIndex < 0 || state.selectedIndex >= state.games.length - 1;
  }
  function renderSelected(replaceUrl) {
    var game = state.games[state.selectedIndex];
    var classicLink = byId("classicBoxLink");
    if (!game) return;
    if (IS_MATCH_CENTRE) {
      byId("boxscoreView").hidden = false;
      byId("landingView").hidden = true;
      byId("detailView").hidden = true;
    }
    byId("boxscoreError").hidden = true;
    byId("boxscoreHero").hidden = false;
    if (replaceUrl) window.history.replaceState({}, "", gameHref(game));
    renderHero(game);
    renderPeriods(game);
    renderComparison(game);
    renderPlayerOfGame(game);
    renderTeamTable(game, state.activeTeamSide);
    classicLink.href = "../../boxes/" + encodeURIComponent(game.boxscoreFile);
    classicLink.hidden = !game.boxscoreFile;
    updateNavigation();
  }
  function selectIndex(index, push) {
    if (index < 0 || index >= state.games.length) return;
    state.selectedIndex = index;
    if (push) window.history.pushState({}, "", gameHref(state.games[index]));
    renderSelected(false);
  }

  function navigateTimeline(delta) {
    var current = state.games[state.selectedIndex];
    var timelineIndex;
    var target;
    if (!current) return;
    timelineIndex = state.timeline.findIndex(function (game) {
      return scheduleGameId(game) === gameId(current.gameId);
    });
    target = state.timeline[timelineIndex + delta];
    if (!target) return;
    window.location.href = scheduleHref(target);
  }
  function resolveIndex() {
    var requested = currentRouteId();
    var index;
    if (!requested) return state.games.length - 1;
    index = state.games.findIndex(function (game) { return gameId(game.gameId || game.boxscoreFile) === requested; });
    if (index < 0) {
      state.invalidRoute = true;
      return state.games.length - 1;
    }
    return index;
  }
  function renderNotice() {
    var notice = byId("routeNotice");
    notice.hidden = !state.invalidRoute;
    notice.textContent = state.invalidRoute ? "That box score is unavailable. Showing the latest completed game." : "";
  }
  function showError(message) {
    byId("boxscoreHero").hidden = true;
    byId("boxscoreError").hidden = false;
    byId("boxscoreError").textContent = message;
  }
  function bindEvents() {
    byId("previousGame").addEventListener("click", function () {
      if (IS_MATCH_CENTRE) navigateTimeline(-1);
      else selectIndex(state.selectedIndex - 1, true);
    });
    byId("nextGame").addEventListener("click", function () {
      if (IS_MATCH_CENTRE) navigateTimeline(1);
      else selectIndex(state.selectedIndex + 1, true);
    });
    document.querySelector(".boxscore-team-tabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-team-side]");
      var game = state.games[state.selectedIndex];
      if (!tab || !game) return;
      state.activeTeamSide = tab.getAttribute("data-team-side") === "home" ? "home" : "away";
      renderTeamTable(game, state.activeTeamSide);
    });
    byId("teamTable").addEventListener("click", function (event) {
      var button = event.target.closest("[data-sort-key]");
      var sort;
      var key;
      var column;
      var game = state.games[state.selectedIndex];
      if (!button || !game) return;
      key = button.getAttribute("data-sort-key");
      column = TABLE_COLUMNS.find(function (entry) { return entry.key === key; });
      if (!column) return;
      sort = state.tableSort[state.activeTeamSide];
      if (sort.key === key) {
        sort.direction = sort.direction === "asc" ? "desc" : "asc";
      } else {
        sort.key = key;
        sort.direction = column.type === "text" ? "asc" : "desc";
      }
      renderTeamTable(game, state.activeTeamSide);
    });
    if (!IS_MATCH_CENTRE) window.addEventListener("popstate", function () {
      state.invalidRoute = false;
      state.selectedIndex = resolveIndex();
      renderNotice();
      renderSelected(false);
    });
  }

  Promise.all([
    loadJson(DATA.boxScores),
    loadJson(DATA.photos, { players: {} }),
    loadJson(DATA.schedule, { sections: [] })
  ]).then(function (results) {
    state.games = Array.isArray(results[0].games) ? results[0].games : [];
    state.photos = results[1] && results[1].players ? results[1].players : {};
    state.timeline = flattenSchedule(results[2]);
    if (!state.games.length) throw new Error("No completed box scores are available.");
    state.selectedIndex = resolveIndex();
    if (IS_MATCH_CENTRE && state.invalidRoute) {
      window.location.replace("./match-centre.htm?notice=unavailable");
      return;
    }
    renderNotice();
    bindEvents();
    renderSelected(!currentRouteId() || state.invalidRoute);
  }).catch(function (error) {
    showError(error && error.message ? error.message : "Unable to load box-score data.");
  });
}());
