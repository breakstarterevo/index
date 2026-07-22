(function () {
  "use strict";

  var DATA = {
    schedule: "../../00-build/database/schedule.json",
    standings: "../../00-build/database/standings.json",
    teamStats: "../../00-build/database/team_stats.json",
    teams: "../../00-build/database/teams.json",
    players: "../../00-build/database/players.json",
    playerStats: "../../00-build/database/player_stats.json",
    injuries: "../../00-build/database/injuries.json",
    photos: "../../00-build/database/player_photos.json"
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
    allGames: [],
    upcoming: [],
    selectedIndex: -1,
    dateOrder: "dmy",
    standings: new Map(),
    teamStats: new Map(),
    teams: new Map(),
    players: [],
    playerStats: new Map(),
    injuries: [],
    photos: {}
  };

  function byId(id) { return document.getElementById(id); }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ""); }
  function numberValue(value) { var number = Number(value); return Number.isFinite(number) ? number : 0; }
  function fmt(value, digits) {
    if (value == null || value === "" || !Number.isFinite(Number(value))) return "—";
    return Number(value).toFixed(digits == null ? 1 : digits).replace(/\.0$/, "");
  }
  function esc(value) {
    if (window.ESLUnifiedUI && ESLUnifiedUI.escapeHtml) return ESLUnifiedUI.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function initials(value) {
    return clean(value).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0); }).join("").toUpperCase() || "TM";
  }
  function teamAbbr(value) {
    return window.ESLUnifiedUI && typeof ESLUnifiedUI.teamAbbreviation === "function"
      ? ESLUnifiedUI.teamAbbreviation(value)
      : initials(value).slice(0, 3);
  }

  function teamColor(value, fallback) {
    return window.ESLUnifiedUI && typeof ESLUnifiedUI.teamColor === "function"
      ? ESLUnifiedUI.teamColor(value, fallback)
      : (fallback || "#111b36");
  }

  function applyHeroTeamColor(node, color) {
    node.style.setProperty("--preview-team-color", color);
    node.style.setProperty("--preview-team-text", "#ffffff");
    node.style.setProperty("--preview-team-muted", "rgba(255,255,255,.78)");
  }

  function loadJson(path, optional) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + path);
      return response.json();
    }).catch(function () {
      return loadJsonFromFrame(path).catch(function (error) {
        if (optional) return optional;
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

  function inferDateOrder(values) {
    var order = "";
    (values || []).some(function (value) {
      var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      var first;
      var second;
      if (!match) return false;
      first = Number(match[1]);
      second = Number(match[2]);
      if (first > 12 && second <= 12) { order = "dmy"; return true; }
      if (second > 12 && first <= 12) { order = "mdy"; return true; }
      return false;
    });
    return order || "dmy";
  }

  function parseDate(value) {
    var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var day;
    var month;
    if (!match) return null;
    day = Number(state.dateOrder === "mdy" ? match[2] : match[1]);
    month = Number(state.dateOrder === "mdy" ? match[1] : match[2]);
    return new Date(Number(match[3]), month - 1, day);
  }

  function flattenGames(schedule) {
    var games = [];
    var order = 0;
    (schedule.sections || []).forEach(function (section) {
      (section.days || []).forEach(function (day) {
        (day.games || []).forEach(function (game) {
          var dateObj = parseDate(day.date);
          games.push(Object.assign({}, game, {
            sectionTitle: section.title || "ESL",
            sectionSlug: section.slug || "",
            date: day.date,
            dateObj: dateObj,
            time: dateObj ? dateObj.getTime() : 0,
            order: order
          }));
          order += 1;
        });
      });
    });
    return games;
  }

  function getUpcoming(games) {
    var latestCompleted = games.filter(function (game) { return game.status === "completed" && game.time; })
      .reduce(function (latest, game) { return Math.max(latest, game.time); }, 0);
    return games.filter(function (game) {
      return game.status !== "completed" && game.time && (!latestCompleted || game.time > latestCompleted) && game.awayTeam && game.homeTeam;
    }).sort(function (left, right) { return left.time - right.time || left.order - right.order; });
  }

  function rosterId(value) {
    var match = String(value || "").match(/roster\d+/i);
    return match ? match[0].toLowerCase() : "";
  }

  function buildLookups(data) {
    (data.standings.sections || []).forEach(function (section) {
      (section.teams || []).forEach(function (team) {
        state.standings.set(rosterId(team.rosterFile || team.rosterUrl), Object.assign({}, team, { league: clean(section.title).replace(/\s+Standings$/i, "") }));
      });
    });
    (Array.isArray(data.teamStats.teams) ? data.teamStats.teams : []).forEach(function (team) {
      state.teamStats.set(rosterId(team.teamId || team.file), team);
    });
    (Array.isArray(data.teams) ? data.teams : []).forEach(function (team) {
      state.teams.set(rosterId(team.id || team.file), team);
    });
    (Array.isArray(data.playerStats.players) ? data.playerStats.players : []).forEach(function (player) {
      state.playerStats.set(clean(player.playerId), player);
    });
    state.players = Array.isArray(data.players) ? data.players : [];
    state.injuries = Array.isArray(data.injuries.injuries) ? data.injuries.injuries : [];
    state.photos = data.photos && data.photos.players && typeof data.photos.players === "object" ? data.photos.players : {};
  }

  function gameKey(game) { return [game.date, rosterId(game.awayTeam), rosterId(game.homeTeam)].join("|").toLowerCase(); }
  function previewHref(game) {
    var params = new URLSearchParams();
    params.set("date", game.date || "");
    params.set("away", rosterId(game.awayTeam));
    params.set("home", rosterId(game.homeTeam));
    return "./match-preview.htm?" + params.toString();
  }

  function resolveSelectedIndex() {
    var params = new URLSearchParams(window.location.search);
    var requested = [params.get("date") || "", rosterId(params.get("away")), rosterId(params.get("home"))].join("|").toLowerCase();
    var index = state.upcoming.findIndex(function (game) { return gameKey(game) === requested; });
    return index >= 0 ? index : 0;
  }

  function syncUrl(game, replace) {
    var href = previewHref(game);
    if (replace) window.history.replaceState({}, "", href);
    else window.history.pushState({}, "", href);
  }

  function teamName(game, side) { return clean(game[side + "TeamName"] || (state.teams.get(rosterId(game[side + "Team"])) || {}).name || game[side + "Team"]); }
  function teamHref(teamId) { return "./unified-roster.htm?file=" + encodeURIComponent(rosterId(teamId) + ".htm"); }
  function playerHref(player) {
    var match = String(player.playerId || player.url || "").match(/player\d+/i);
    return match ? "./unified-player.htm?id=" + encodeURIComponent(match[0].toLowerCase()) : "#";
  }
  function boxHref(game) {
    var href = clean(game.boxscoreUrl || (game.boxscoreFile ? "./boxes/" + game.boxscoreFile : "")).replace(/^\.\/+/, "");
    return href ? "../../" + href : "";
  }
  function logoPath(name) { return "../../00-assets/photos/" + (TEAM_LOGOS[name] || normalize(name) + ".jpg"); }

  function standingFor(teamId) { return state.standings.get(rosterId(teamId)) || {}; }
  function statsFor(teamId) { return (state.teamStats.get(rosterId(teamId)) || {}).stats || {}; }
  function injuriesFor(teamId) {
    var id = rosterId(teamId);
    return state.injuries.filter(function (injury) { return rosterId(injury.team || injury.rosterUrl) === id; });
  }
  function playersFor(teamId) {
    var id = rosterId(teamId);
    return state.players.filter(function (player) { return rosterId(player.team) === id; });
  }
  function isInjured(player, teamId) {
    return injuriesFor(teamId).some(function (injury) { return normalize(injury.name) === normalize(player.name); });
  }
  function currentSeasonRow(player) {
    var statPlayer = state.playerStats.get(clean(player.playerId));
    var rows = statPlayer && statPlayer.stats && statPlayer.stats.season_averages && statPlayer.stats.season_averages.rows;
    return (Array.isArray(rows) ? rows : []).filter(function (row) { return Number.isFinite(Number(row.season)); })
      .sort(function (left, right) { return Number(right.season) - Number(left.season); })[0] || null;
  }
  function healthyTopFiveOvr(teamId) {
    var healthy = playersFor(teamId).filter(function (player) { return !isInjured(player, teamId); })
      .sort(function (left, right) { return numberValue(right.overall) - numberValue(left.overall); }).slice(0, 5);
    if (!healthy.length) return null;
    return healthy.reduce(function (sum, player) { return sum + numberValue(player.overall); }, 0) / healthy.length;
  }

  function completedBefore(game, teamId) {
    var id = rosterId(teamId);
    return state.allGames.filter(function (candidate) {
      return candidate.status === "completed" && candidate.time && candidate.time < game.time &&
        (rosterId(candidate.homeTeam) === id || rosterId(candidate.awayTeam) === id);
    }).sort(function (left, right) { return right.time - left.time || right.order - left.order; });
  }
  function recentForm(game, teamId) {
    var id = rosterId(teamId);
    var games = completedBefore(game, id).slice(0, 5);
    var wins = games.filter(function (candidate) { return rosterId(candidate.winner) === id; }).length;
    return { games: games, wins: wins, losses: games.length - wins, pct: games.length ? wins / games.length : null };
  }
  function recordPct(value) {
    var match = String(value || "").match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return null;
    var total = Number(match[1]) + Number(match[2]);
    return total ? Number(match[1]) / total : 0;
  }
  function statValue(teamId, key, field) {
    var node = statsFor(teamId)[key];
    var value = node && node[field || "team"] && node[field || "team"].value;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function comparisonRows(game) {
    var awayId = rosterId(game.awayTeam);
    var homeId = rosterId(game.homeTeam);
    var awayStanding = standingFor(awayId);
    var homeStanding = standingFor(homeId);
    var awayForm = recentForm(game, awayId);
    var homeForm = recentForm(game, homeId);
    var awayPoints = statValue(awayId, "points", "team");
    var homePoints = statValue(homeId, "points", "team");
    var awayAllowed = statValue(awayId, "points", "opponent");
    var homeAllowed = statValue(homeId, "points", "opponent");
    return [
      { label: "Win Percentage", away: Number.isFinite(Number(awayStanding.pct)) ? Number(awayStanding.pct) : null, home: Number.isFinite(Number(homeStanding.pct)) ? Number(homeStanding.pct) : null, format: function (v) { return v == null ? "—" : (v * 100).toFixed(1) + "%"; }, higher: true },
      { label: "Point Differential", away: Number.isFinite(Number(awayStanding.diff)) ? Number(awayStanding.diff) : null, home: Number.isFinite(Number(homeStanding.diff)) ? Number(homeStanding.diff) : null, format: function (v) { return v == null ? "—" : (v > 0 ? "+" : "") + fmt(v, 1); }, higher: true },
      { label: "Last Five", away: awayForm.pct, home: homeForm.pct, format: function (v, side) { var form = side === "away" ? awayForm : homeForm; return form.games.length ? form.wins + "-" + form.losses : "—"; }, higher: true },
      { label: "Venue Record", away: recordPct(awayStanding.road), home: recordPct(homeStanding.home), format: function (v, side) { return clean(side === "away" ? awayStanding.road : homeStanding.home) || "—"; }, higher: true },
      { label: "Points / Game", away: awayPoints != null ? awayPoints : numberValue(awayStanding.pf), home: homePoints != null ? homePoints : numberValue(homeStanding.pf), format: function (v) { return fmt(v, 1); }, higher: true },
      { label: "Points Allowed", away: awayAllowed != null ? awayAllowed : numberValue(awayStanding.pa), home: homeAllowed != null ? homeAllowed : numberValue(homeStanding.pa), format: function (v) { return fmt(v, 1); }, higher: false },
      { label: "Rebound Margin", away: statValue(awayId, "rebounds", "margin"), home: statValue(homeId, "rebounds", "margin"), format: function (v) { return v == null ? "—" : (v > 0 ? "+" : "") + fmt(v, 1); }, higher: true },
      { label: "Healthy Top-5 OVR", away: healthyTopFiveOvr(awayId), home: healthyTopFiveOvr(homeId), format: function (v) { return fmt(v, 1); }, higher: true }
    ];
  }

  function scoreComparisons(rows) {
    var score = { away: 0, home: 0 };
    rows.forEach(function (row) {
      if (row.away == null || row.home == null || Math.abs(row.away - row.home) < 0.000001) {
        row.edge = "tie";
        score.away += 0.5;
        score.home += 0.5;
        return;
      }
      row.edge = row.higher ? (row.away > row.home ? "away" : "home") : (row.away < row.home ? "away" : "home");
      score[row.edge] += 1;
    });
    return score;
  }

  function edgeDetails(game, score) {
    var difference = Math.abs(score.away - score.home);
    var side = score.away === score.home ? "tie" : (score.away > score.home ? "away" : "home");
    var label = difference === 0 ? "Toss-up" : (difference === 1 ? "Slight Edge" : (difference === 2 ? "Moderate Edge" : "Strong Edge"));
    return { side: side, label: label, team: side === "tie" ? "" : teamName(game, side) };
  }

  function renderTeamHero(game, side) {
    var id = rosterId(game[side + "Team"]);
    var name = teamName(game, side);
    var standing = standingFor(id);
    var record = Number.isFinite(Number(standing.wins)) ? standing.wins + "-" + standing.losses : "Record unavailable";
    return '<a class="preview-team-logo-link" href="' + esc(teamHref(id)) + '" aria-label="Open ' + esc(name) + ' roster">' +
      '<img class="preview-team-logo" src="' + esc(logoPath(name)) + '" alt="' + esc(name) + ' logo" onerror="this.outerHTML=\'<span class=&quot;preview-team-logo-fallback&quot;>' + esc(initials(name)) + '</span>\'">' +
      "</a>" +
      '<span class="preview-team-side">' + (side === "away" ? "Away" : "Home") + "</span>" +
      '<h2 class="preview-team-name"><a href="' + esc(teamHref(id)) + '">' + esc(name) + "</a></h2>" +
      '<div class="preview-team-record">' + esc(record) + "</div>" +
      '<div class="preview-team-meta">' + esc([standing.league, standing.streak, Number.isFinite(Number(standing.diff)) ? "Diff " + (Number(standing.diff) > 0 ? "+" : "") + standing.diff : ""].filter(Boolean).join(" · ")) + "</div>";
  }

  function renderHero(game, score) {
    var edge = edgeDetails(game, score);
    var edgeNode = byId("projectedEdge");
    var awayHero = byId("awayTeamHero");
    var homeHero = byId("homeTeamHero");
    var awayColor = teamColor(teamName(game, "away"), "#1d3666");
    var homeColor = teamColor(teamName(game, "home"), "#111b36");
    document.documentElement.style.setProperty("--preview-away", awayColor);
    document.documentElement.style.setProperty("--preview-home", homeColor);
    applyHeroTeamColor(awayHero, awayColor);
    applyHeroTeamColor(homeHero, homeColor);
    awayHero.innerHTML = renderTeamHero(game, "away");
    homeHero.innerHTML = renderTeamHero(game, "home");
    byId("matchCompetition").textContent = (game.sectionTitle || "ESL") + " Match Preview";
    byId("matchDate").textContent = game.dateObj ? game.dateObj.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : game.date;
    edgeNode.className = "preview-edge" + (edge.side === "away" ? " is-away" : (edge.side === "home" ? " is-home" : ""));
    edgeNode.textContent = edge.team ? edge.team + " · " + edge.label : edge.label;
    byId("edgeScore").textContent = fmt(score.away, 1) + "–" + fmt(score.home, 1) + " category score";
    document.title = teamName(game, "away") + " @ " + teamName(game, "home") + " - Match Preview";
  }

  function renderComparison(game, rows) {
    var awayName = teamName(game, "away");
    var homeName = teamName(game, "home");
    byId("comparisonBoard").innerHTML = '<div class="preview-comparison-head"><div>' + esc(teamAbbr(awayName)) + '</div><div>Category</div><div>' + esc(teamAbbr(homeName)) + "</div></div>" + rows.map(function (row) {
      return '<div class="preview-comparison-row"><div class="preview-comparison-value' + (row.edge === "away" ? " has-edge" : "") + '">' + esc(row.format(row.away, "away")) + '</div><div class="preview-comparison-label">' + esc(row.label) + '</div><div class="preview-comparison-value' + (row.edge === "home" ? " has-edge" : "") + '">' + esc(row.format(row.home, "home")) + "</div></div>";
    }).join("");
  }

  function keyPlayers(teamId) {
    return playersFor(teamId).map(function (player) {
      return { player: player, row: currentSeasonRow(player), injured: isInjured(player, teamId) };
    }).sort(function (left, right) {
      return numberValue(right.row && right.row.min) - numberValue(left.row && left.row.min) || numberValue(right.player.overall) - numberValue(left.player.overall);
    }).slice(0, 3);
  }

  function playerPhoto(player) {
    var photo = state.photos[clean(player.playerId)];
    if (!photo || !photo.url) return '<span class="preview-player-photo-fallback">' + esc(initials(player.name)) + "</span>";
    return '<img class="preview-player-photo" src="' + esc(photo.url) + '" alt="' + esc(player.name) + ' headshot" referrerpolicy="no-referrer" onerror="this.outerHTML=\'<span class=&quot;preview-player-photo-fallback&quot;>' + esc(initials(player.name)) + '</span>\'">';
  }

  function renderPlayerCards(teamId, rootId) {
    var rows = keyPlayers(teamId);
    byId(rootId).innerHTML = rows.length ? rows.map(function (entry) {
      var player = entry.player;
      var stats = entry.row || {};
      return '<article class="preview-player-card"><div class="preview-player-top">' + playerPhoto(player) + '<div class="preview-player-copy">' +
        '<a class="preview-player-name" href="' + esc(playerHref(player)) + '">' + esc(player.name) + "</a>" +
        '<div class="preview-player-meta">' + esc([player.pos, "OVR " + (player.overall || "—"), stats.min != null ? fmt(stats.min, 1) + " MIN" : ""].filter(Boolean).join(" · ")) + "</div>" +
        (entry.injured ? '<div class="preview-player-injury">INJURED</div>' : "") +
        '</div></div><div class="preview-player-stats">' +
        '<div class="preview-player-stat"><strong>' + esc(fmt(stats.pts, 1)) + '</strong><span>PTS</span></div>' +
        '<div class="preview-player-stat"><strong>' + esc(fmt(numberValue(stats.orb) + numberValue(stats.drb), 1)) + '</strong><span>REB</span></div>' +
        '<div class="preview-player-stat"><strong>' + esc(fmt(stats.ast, 1)) + '</strong><span>AST</span></div>' +
        "</div></article>";
    }).join("") : '<div class="preview-empty">No player data available.</div>';
  }

  function renderPlayers(game) {
    byId("awayPlayersTitle").textContent = teamName(game, "away") + " Key Players";
    byId("homePlayersTitle").textContent = teamName(game, "home") + " Key Players";
    renderPlayerCards(game.awayTeam, "awayPlayers");
    renderPlayerCards(game.homeTeam, "homePlayers");
  }

  function renderFormTeam(game, side) {
    var id = rosterId(game[side + "Team"]);
    var form = recentForm(game, id);
    var chips = form.games.map(function (candidate) {
      var win = rosterId(candidate.winner) === id;
      var opponent = rosterId(candidate.homeTeam) === id ? candidate.awayTeamName : candidate.homeTeamName;
      return '<span class="preview-form-chip ' + (win ? "win" : "loss") + '" title="' + esc((win ? "Win" : "Loss") + " vs " + opponent) + '">' + (win ? "W" : "L") + "</span>";
    }).join("");
    return '<div class="preview-form-team"><div class="preview-mini-team"><span>' + esc(teamName(game, side)) + '</span><span>' + (form.games.length ? form.wins + "-" + form.losses : "No games") + '</span></div><div class="preview-form-strip">' + (chips || '<span class="preview-empty">No completed games before this matchup.</span>') + "</div></div>";
  }

  function renderForm(game) { byId("formBoard").innerHTML = renderFormTeam(game, "away") + renderFormTeam(game, "home"); }

  function headToHead(game) {
    var awayId = rosterId(game.awayTeam);
    var homeId = rosterId(game.homeTeam);
    return state.allGames.filter(function (candidate) {
      var pair = [rosterId(candidate.awayTeam), rosterId(candidate.homeTeam)];
      return candidate.status === "completed" && candidate.time && candidate.time < game.time && pair.indexOf(awayId) >= 0 && pair.indexOf(homeId) >= 0;
    }).sort(function (left, right) { return right.time - left.time || right.order - left.order; });
  }

  function renderHeadToHead(game) {
    var games = headToHead(game);
    var awayId = rosterId(game.awayTeam);
    var homeId = rosterId(game.homeTeam);
    var awayWins = games.filter(function (candidate) { return rosterId(candidate.winner) === awayId; }).length;
    var homeWins = games.filter(function (candidate) { return rosterId(candidate.winner) === homeId; }).length;
    byId("headToHeadSummary").textContent = games.length ? teamAbbr(teamName(game, "away")) + " " + awayWins + "–" + homeWins + " " + teamAbbr(teamName(game, "home")) : "No previous meetings";
    byId("headToHeadList").innerHTML = games.length ? games.slice(0, 5).map(function (candidate) {
      var score = candidate.awayScore + "–" + candidate.homeScore;
      var scoreHtml = boxHref(candidate) ? '<a class="preview-history-score" href="' + esc(boxHref(candidate)) + '">' + esc(score) + "</a>" : '<span class="preview-history-score">' + esc(score) + "</span>";
      return '<div class="preview-history-row"><span class="preview-history-date">' + esc(candidate.date) + '</span><span class="preview-history-matchup">' + esc(candidate.awayTeamName + " @ " + candidate.homeTeamName) + "</span>" + scoreHtml + "</div>";
    }).join("") : '<div class="preview-empty">These teams have not met yet this season.</div>';
  }

  function injuryTeam(game, side) {
    var id = rosterId(game[side + "Team"]);
    var name = teamName(game, side);
    var entries = injuriesFor(id);
    return '<div class="preview-injury-team"><div class="preview-mini-team"><span>' + esc(name) + '</span><span>' + entries.length + " OUT</span></div>" +
      '<div class="preview-injury-list">' + (entries.length ? entries.map(function (injury) {
        var player = playersFor(id).find(function (candidate) { return normalize(candidate.name) === normalize(injury.name); });
        var playerName = player ? '<a class="preview-injury-name" href="' + esc(playerHref(player)) + '">' + esc(injury.name) + "</a>" : '<span class="preview-injury-name">' + esc(injury.name) + "</span>";
        return '<div class="preview-injury-row"><span>' + playerName + ' <span class="preview-injury-detail">' + esc(injury.injury || "Injury") + '</span></span><strong>' + esc((injury.length || 0) + "d") + "</strong></div>";
      }).join("") : '<div class="preview-empty">No active injuries.</div>') + "</div></div>";
  }

  function renderInjuries(game) { byId("injuryBoard").innerHTML = injuryTeam(game, "away") + injuryTeam(game, "home"); }

  function renderPicker() {
    var picker = byId("matchPicker");
    if (picker) {
      picker.innerHTML = state.upcoming.map(function (game, index) {
        return '<option value="' + index + '"' + (index === state.selectedIndex ? " selected" : "") + '>' + esc(game.date + " · " + teamName(game, "away") + " @ " + teamName(game, "home")) + "</option>";
      }).join("");
    }
    byId("previousGame").disabled = state.selectedIndex <= 0;
    byId("nextGame").disabled = state.selectedIndex < 0 || state.selectedIndex >= state.upcoming.length - 1;
  }

  function renderSelected(replaceUrl) {
    var game = state.upcoming[state.selectedIndex];
    var rows;
    var score;
    if (!game) return;
    if (replaceUrl) syncUrl(game, true);
    rows = comparisonRows(game);
    score = scoreComparisons(rows);
    renderPicker();
    renderHero(game, score);
    renderComparison(game, rows);
    renderPlayers(game);
    renderForm(game);
    renderHeadToHead(game);
    renderInjuries(game);
  }

  function selectIndex(index, push) {
    if (index < 0 || index >= state.upcoming.length) return;
    state.selectedIndex = index;
    syncUrl(state.upcoming[index], !push);
    renderSelected(false);
  }

  function bindEvents() {
    var picker = byId("matchPicker");
    if (picker) picker.addEventListener("change", function () { selectIndex(Number(picker.value), true); });
    byId("previousGame").addEventListener("click", function () { selectIndex(state.selectedIndex - 1, true); });
    byId("nextGame").addEventListener("click", function () { selectIndex(state.selectedIndex + 1, true); });
    window.addEventListener("popstate", function () {
      state.selectedIndex = resolveSelectedIndex();
      renderSelected(false);
    });
  }

  function showError(message) {
    byId("previewError").hidden = false;
    byId("previewError").textContent = message;
    byId("comparisonBoard").innerHTML = '<div class="ui-state ui-state--error">' + esc(message) + "</div>";
    byId("matchHero").hidden = true;
    byId("previousGame").disabled = true;
    byId("nextGame").disabled = true;
  }

  Promise.all([
    loadJson(DATA.schedule), loadJson(DATA.standings), loadJson(DATA.teamStats, { teams: [] }),
    loadJson(DATA.teams, []), loadJson(DATA.players), loadJson(DATA.playerStats, { players: [] }),
    loadJson(DATA.injuries, { injuries: [] }), loadJson(DATA.photos, { players: {} })
  ]).then(function (results) {
    var data = { schedule: results[0], standings: results[1], teamStats: results[2], teams: results[3], players: results[4], playerStats: results[5], injuries: results[6], photos: results[7] };
    var dates = (data.schedule.sections || []).flatMap(function (section) { return (section.days || []).map(function (day) { return day.date; }); });
    state.dateOrder = inferDateOrder(dates);
    buildLookups(data);
    state.allGames = flattenGames(data.schedule);
    state.upcoming = getUpcoming(state.allGames);
    if (!state.upcoming.length) { showError("No upcoming scheduled games were found."); return; }
    state.selectedIndex = resolveSelectedIndex();
    bindEvents();
    renderSelected(true);
  }).catch(function (error) {
    showError(error && error.message ? error.message : "Unable to load match preview data.");
  });
}());
