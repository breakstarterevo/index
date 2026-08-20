(function () {
  "use strict";

  var IS_MATCH_CENTRE = /\/match-centre\.htm$/i.test(window.location.pathname);
  var START_PARAMS = new URLSearchParams(window.location.search);
  if (IS_MATCH_CENTRE && START_PARAMS.get("game")) return;

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
    "Paris Saint-Germain": "psg.jpg", "Real Madrid": "realmadrid.jpg", "AC Sparta Praha": "acspartapraha.png",
    "Arsenal": "arsenal.png", "Tottenham Hotspur": "tottenham.jpg", "Valencia": "valencia.jpg"
  };
  var state = {
    allGames: [],
    upcoming: [],
    completed: [],
    selectedIndex: -1,
    dateOrder: "dmy",
    standings: new Map(),
    teamStats: new Map(),
    teams: new Map(),
    players: [],
    playerStats: new Map(),
    injuries: [],
    photos: {},
    favoriteTeamId: "",
    comingMonth: "",
    latestCompletedMonth: "",
    landingFilters: {
      team: "all",
      competition: "all",
      month: "",
      resultsMonth: ""
    }
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

  function localDate(year, month, day) {
    var date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function parseDate(value) {
    var text = String(value || "").trim();
    var iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    var match;
    var day;
    var month;
    var parsed;
    if (iso) return localDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!match) {
      parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : localDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
    day = Number(state.dateOrder === "mdy" ? match[2] : match[1]);
    month = Number(state.dateOrder === "mdy" ? match[1] : match[2]);
    return localDate(Number(match[3]), month, day);
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
  function boxGameId(game) {
    var match = clean(game && (game.boxscoreFile || game.boxscoreUrl)).match(/box\d+-\d+/i);
    return match ? match[0].toLowerCase() : "";
  }
  function previewHref(game) {
    var params = new URLSearchParams();
    params.set("date", game.date || "");
    params.set("away", rosterId(game.awayTeam));
    params.set("home", rosterId(game.homeTeam));
    return "./match-centre.htm?" + params.toString();
  }
  function gameHref(game) {
    var boxId = boxGameId(game);
    return game && game.status === "completed" && boxId
      ? "./match-centre.htm?game=" + encodeURIComponent(boxId)
      : previewHref(game);
  }

  function routeRequest() {
    var params = new URLSearchParams(window.location.search);
    var date = params.get("date") || "";
    var away = rosterId(params.get("away"));
    var home = rosterId(params.get("home"));
    var present = [date, away, home].filter(Boolean).length;
    if (!present) return { mode: "landing", invalid: params.get("notice") === "unavailable" };
    if (present < 3) return { mode: "landing", invalid: true };
    return { mode: "detail", key: [date, away, home].join("|").toLowerCase() };
  }

  function resolveSelectedIndex() {
    var request = routeRequest();
    if (request.mode !== "detail") return -1;
    return state.upcoming.findIndex(function (game) { return gameKey(game) === request.key; });
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
    var match = href.match(/box\d+-\d+/i);
    return match ? "./match-centre.htm?game=" + encodeURIComponent(match[0].toLowerCase()) : (href ? "../../" + href : "");
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

  function daysUntilGame(game) {
    var latestCompleted = state.allGames.filter(function (candidate) {
      return candidate.status === "completed" && candidate.time;
    }).reduce(function (latest, candidate) {
      return Math.max(latest, candidate.time);
    }, 0);
    return latestCompleted && game.time ? Math.max(0, Math.ceil((game.time - latestCompleted) / 86400000)) : 0;
  }

  function isInjuredForGame(player, teamId, game) {
    var daysAhead = daysUntilGame(game);
    return injuriesFor(teamId).some(function (injury) {
      var remaining;
      if (normalize(injury.name) !== normalize(player.name)) return false;
      remaining = Number(injury.length);
      return !Number.isFinite(remaining) || remaining > daysAhead;
    });
  }

  function bbgmTeamOvr(teamId, game) {
    var ratings = playersFor(teamId).filter(function (player) {
      return !isInjuredForGame(player, teamId, game) && Number.isFinite(Number(player.overall));
    }).sort(function (left, right) {
      return numberValue(right.overall) - numberValue(left.overall);
    }).slice(0, 10).map(function (player) {
      return numberValue(player.overall) / 2;
    });
    var predictedMargin = -102.98;
    var index;

    if (!ratings.length) return null;
    while (ratings.length < 10) ratings.push(0);
    for (index = 0; index < 10; index += 1) {
      predictedMargin += 0.3334 * Math.exp(-0.1609 * index) * ratings[index];
    }
    return Math.round((predictedMargin * 50) / 15 + 50);
  }

  function roundLine(value) {
    return Math.max(0.5, Math.round(Math.abs(value) - 0.5) + 0.5);
  }

  function projectedLine(game) {
    var awayOvr = bbgmTeamOvr(game.awayTeam, game);
    var homeOvr = bbgmTeamOvr(game.homeTeam, game);
    var awayDiff = Number(standingFor(game.awayTeam).diff);
    var homeDiff = Number(standingFor(game.homeTeam).diff);
    var hasPerformance = Number.isFinite(awayDiff) && Number.isFinite(homeDiff);
    var homeAdvantage = game.neutralSite ? 0 : 3.3504;
    var rosterMargin;
    var performanceMargin;
    var neutralMargin;
    var homeMargin;
    var favorite;
    var spread;

    if (awayOvr == null || homeOvr == null) return null;
    rosterMargin = 0.3 * (homeOvr - awayOvr);
    performanceMargin = hasPerformance ? homeDiff - awayDiff : null;
    neutralMargin = hasPerformance ? 0.7 * rosterMargin + 0.3 * performanceMargin : rosterMargin;
    homeMargin = neutralMargin + homeAdvantage;
    favorite = homeMargin >= 0 ? "home" : "away";
    spread = roundLine(homeMargin);
    return {
      label: teamAbbr(teamName(game, favorite)) + " -" + spread.toFixed(1),
      favorite: favorite,
      spread: spread,
      awayOvr: awayOvr,
      homeOvr: homeOvr,
      awayDiff: awayDiff,
      homeDiff: homeDiff,
      hasPerformance: hasPerformance,
      homeAdvantage: homeAdvantage
    };
  }

  function monthKey(game) {
    if (!game || !game.dateObj) return "";
    return game.dateObj.getFullYear() + "-" + String(game.dateObj.getMonth() + 1).padStart(2, "0");
  }

  function monthLabel(key) {
    var match = String(key || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return "All upcoming";
    return new Date(Number(match[1]), Number(match[2]) - 1, 1)
      .toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function formatGameDate(game, includeYear) {
    if (!game || !game.dateObj) return clean(game && game.date);
    return game.dateObj.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: includeYear ? "numeric" : undefined
    });
  }

  function teamRecord(teamId) {
    var standing = standingFor(teamId);
    return Number.isFinite(Number(standing.wins)) ? standing.wins + "-" + standing.losses : "—";
  }

  function favoriteTeamId() {
    var settings = window.LeagueSiteCore && LeagueSiteCore.getSettings ? LeagueSiteCore.getSettings() : {};
    var favorite = normalize(settings.favoriteTeam);
    var found = "";
    if (!favorite) return "";
    state.teams.forEach(function (team, id) {
      if (!found && normalize(team && team.name) === favorite) found = id;
    });
    if (found) return found;
    state.upcoming.some(function (game) {
      if (normalize(teamName(game, "away")) === favorite) found = rosterId(game.awayTeam);
      if (normalize(teamName(game, "home")) === favorite) found = rosterId(game.homeTeam);
      return Boolean(found);
    });
    return found;
  }

  function teamIsInGame(game, teamId) {
    var id = rosterId(teamId);
    return rosterId(game && game.awayTeam) === id || rosterId(game && game.homeTeam) === id;
  }

  function landingLogo(name, imageClass, fallbackClass) {
    return '<img class="' + imageClass + '" src="' + esc(logoPath(name)) + '" alt="' + esc(name) + ' logo" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' +
      '<span class="' + fallbackClass + '" hidden>' + esc(initials(name)) + "</span>";
  }

  function renderFeaturedTeam(game, side) {
    var id = rosterId(game[side + "Team"]);
    var name = teamName(game, side);
    return '<div class="preview-featured-team" style="--feature-color:' + esc(teamColor(name, "#111b36")) + '">' +
      landingLogo(name, "preview-featured-logo", "preview-featured-logo-fallback") +
      '<h3 class="preview-featured-name">' + esc(name) + '</h3>' +
      '<div class="preview-featured-record">' + esc(teamRecord(id)) + "</div></div>";
  }

  function renderFeatured(game, isFavorite) {
    var line;
    if (!game) {
      byId("featuredMatch").innerHTML = '<div class="ui-state preview-landing-empty">No upcoming scheduled games were found.</div>';
      return;
    }
    line = projectedLine(game);
    byId("featuredTitle").textContent = isFavorite ? "Your Next Match" : "Next Match";
    byId("featuredNote").textContent = isFavorite ? "Favorite team" : "Earliest scheduled game";
    byId("featuredMatch").innerHTML = '<article class="preview-featured">' +
      renderFeaturedTeam(game, "away") +
      '<div class="preview-featured-centre"><span class="preview-featured-competition">' + esc(game.sectionTitle || "ESL") + '</span>' +
      '<time class="preview-featured-date">' + esc(formatGameDate(game, true)) + '</time>' +
      '<span class="preview-featured-at" aria-hidden="true">@</span>' +
      '<span class="preview-featured-line">' + esc(line ? line.label : "Line unavailable") + '</span>' +
      '<a class="ui-button preview-featured-action" href="' + esc(previewHref(game)) + '">Open Full Preview</a></div>' +
      renderFeaturedTeam(game, "home") + "</article>";
  }

  function renderLandingCard(game) {
    var awayName = teamName(game, "away");
    var homeName = teamName(game, "home");
    var awayId = rosterId(game.awayTeam);
    var homeId = rosterId(game.homeTeam);
    var awayInjuries = injuriesFor(awayId).length;
    var homeInjuries = injuriesFor(homeId).length;
    var line = projectedLine(game);

    function side(name, id, injuryCount) {
      return '<span class="preview-card-team" style="--card-color:' + esc(teamColor(name, "#111b36")) + '">' +
        landingLogo(name, "preview-card-logo", "preview-card-logo-fallback") +
        '<span class="preview-card-abbr">' + esc(teamAbbr(name)) + '</span>' +
        '<span class="preview-card-record">' + esc(teamRecord(id)) + '</span>' +
        '<span class="preview-card-injuries' + (injuryCount ? " has-injuries" : "") + '">' + injuryCount + " OUT</span></span>";
    }

    return '<a class="preview-landing-card" href="' + esc(previewHref(game)) + '" aria-label="Preview ' + esc(awayName + " at " + homeName) + '">' +
      side(awayName, awayId, awayInjuries) +
      '<span class="preview-card-centre"><time class="preview-card-date">' + esc(formatGameDate(game, false)) + '</time>' +
      '<span class="preview-card-at">@</span><span class="preview-card-line">' + esc(line ? line.label : "No line") + "</span></span>" +
      side(homeName, homeId, homeInjuries) + "</a>";
  }

  function renderResultCard(game) {
    var awayName = teamName(game, "away");
    var homeName = teamName(game, "home");
    var awayWinner = rosterId(game.winner) === rosterId(game.awayTeam);
    var homeWinner = rosterId(game.winner) === rosterId(game.homeTeam);

    function side(name, score, winner) {
      return '<span class="match-centre-result-team' + (winner ? " is-winner" : "") +
        '" style="--result-color:' + esc(teamColor(name, "#111b36")) + '">' +
        landingLogo(name, "match-centre-result-logo", "match-centre-result-logo-fallback") +
        '<span class="match-centre-result-name">' + esc(name) + '</span>' +
        '<strong class="match-centre-result-score">' + esc(score == null ? "—" : score) + "</strong></span>";
    }

    return '<a class="match-centre-result-card" href="' + esc(gameHref(game)) +
      '" aria-label="Open final score for ' + esc(awayName + " at " + homeName) + '">' +
      side(awayName, game.awayScore, awayWinner) +
      '<span class="match-centre-result-centre"><span class="match-centre-result-final">Final</span>' +
      '<time class="match-centre-result-date">' + esc(formatGameDate(game, false)) + '</time>' +
      '<span class="match-centre-result-competition">' + esc(game.sectionTitle || "ESL") + "</span></span>" +
      side(homeName, game.homeScore, homeWinner) + "</a>";
  }

  function renderMyTeam() {
    var panel = byId("myTeamPanel");
    var games;
    if (!state.favoriteTeamId) {
      panel.hidden = true;
      return;
    }
    games = state.upcoming.filter(function (game) { return teamIsInGame(game, state.favoriteTeamId); }).slice(0, 3);
    if (!games.length) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    byId("myTeamTitle").textContent = (state.teams.get(state.favoriteTeamId) || {}).name
      ? (state.teams.get(state.favoriteTeamId).name + " Upcoming")
      : "My Team Upcoming";
    byId("myTeamGames").innerHTML = games.map(renderLandingCard).join("");
  }

  function populateLandingFilters() {
    var teams = new Map();
    var competitions = new Map();
    var upcomingMonths = new Set();
    var completedMonths = new Set();
    state.allGames.forEach(function (game) {
      teams.set(rosterId(game.awayTeam), teamName(game, "away"));
      teams.set(rosterId(game.homeTeam), teamName(game, "home"));
      competitions.set(game.sectionSlug || normalize(game.sectionTitle), game.sectionTitle || "ESL");
      if (game.status === "completed") completedMonths.add(monthKey(game));
      else upcomingMonths.add(monthKey(game));
    });
    byId("teamFilter").innerHTML = '<option value="all">All teams</option>' +
      Array.from(teams.entries()).sort(function (a, b) { return a[1].localeCompare(b[1]); }).map(function (entry) {
        return '<option value="' + esc(entry[0]) + '">' + esc(entry[1]) + "</option>";
      }).join("");
    byId("competitionFilter").innerHTML = '<option value="all">All competitions</option>' +
      Array.from(competitions.entries()).map(function (entry) {
        return '<option value="' + esc(entry[0]) + '">' + esc(entry[1]) + "</option>";
      }).join("");
    byId("monthFilter").innerHTML = '<option value="all">All upcoming</option>' +
      Array.from(upcomingMonths).filter(Boolean).sort().map(function (key) {
        return '<option value="' + esc(key) + '">' + esc(monthLabel(key)) + "</option>";
      }).join("");
    if (byId("resultsMonthFilter")) {
      byId("resultsMonthFilter").innerHTML = '<option value="all">All results</option>' +
        Array.from(completedMonths).filter(Boolean).sort().reverse().map(function (key) {
          return '<option value="' + esc(key) + '">' + esc(monthLabel(key)) + "</option>";
        }).join("");
    }
    state.landingFilters.team = state.favoriteTeamId || "all";
    state.landingFilters.competition = "all";
    state.landingFilters.month = state.comingMonth || "all";
    state.landingFilters.resultsMonth = state.latestCompletedMonth || "all";
    byId("teamFilter").value = state.landingFilters.team;
    byId("competitionFilter").value = "all";
    byId("monthFilter").value = state.landingFilters.month;
    if (byId("resultsMonthFilter")) byId("resultsMonthFilter").value = state.landingFilters.resultsMonth;
  }

  function filteredLandingGames() {
    return state.upcoming.filter(function (game) {
      return (state.landingFilters.team === "all" || teamIsInGame(game, state.landingFilters.team)) &&
        (state.landingFilters.competition === "all" || (game.sectionSlug || normalize(game.sectionTitle)) === state.landingFilters.competition) &&
        (state.landingFilters.month === "all" || monthKey(game) === state.landingFilters.month);
    });
  }

  function renderUpcomingGames() {
    var games = filteredLandingGames();
    var groups = new Map();
    games.forEach(function (game) {
      if (!groups.has(game.date)) groups.set(game.date, []);
      groups.get(game.date).push(game);
    });
    byId("upcomingSummary").textContent = games.length + (games.length === 1 ? " game" : " games") +
      (state.landingFilters.month === "all" ? " upcoming" : " in " + monthLabel(state.landingFilters.month));
    byId("upcomingGames").innerHTML = games.length ? Array.from(groups.entries()).map(function (entry) {
      var first = entry[1][0];
      return '<section class="preview-date-group"><h3 class="preview-date-heading">' + esc(formatGameDate(first, true)) + '</h3>' +
        '<div class="preview-match-grid">' + entry[1].map(renderLandingCard).join("") + "</div></section>";
    }).join("") : '<div class="ui-state preview-landing-empty">No upcoming games match these filters.</div>';
  }

  function filteredResultGames() {
    return state.completed.filter(function (game) {
      return (state.landingFilters.team === "all" || teamIsInGame(game, state.landingFilters.team)) &&
        (state.landingFilters.competition === "all" || (game.sectionSlug || normalize(game.sectionTitle)) === state.landingFilters.competition) &&
        (state.landingFilters.resultsMonth === "all" || monthKey(game) === state.landingFilters.resultsMonth);
    });
  }

  function renderRecentResults() {
    var root = byId("recentResults");
    var games;
    if (!root) return;
    games = filteredResultGames();
    byId("resultsSummary").textContent = games.length + (games.length === 1 ? " final" : " finals") +
      (state.landingFilters.resultsMonth === "all" ? "" : " in " + monthLabel(state.landingFilters.resultsMonth));
    root.innerHTML = games.length
      ? games.slice().reverse().map(renderResultCard).join("")
      : '<div class="ui-state preview-landing-empty">No completed games match these filters.</div>';
  }

  function renderLandingLists() {
    renderUpcomingGames();
    renderRecentResults();
    if (byId("filterSummary")) {
      byId("filterSummary").textContent = state.landingFilters.team === "all"
        ? "All teams"
        : ((state.teams.get(state.landingFilters.team) || {}).name || "Favorite team");
    }
    if (byId("allTeamsFilter")) byId("allTeamsFilter").hidden = state.landingFilters.team === "all";
    if (byId("favoriteFilter")) {
      byId("favoriteFilter").hidden = !state.favoriteTeamId || state.landingFilters.team === state.favoriteTeamId;
    }
  }

  function bindLandingEvents() {
    byId("teamFilter").addEventListener("change", function () {
      state.landingFilters.team = this.value;
      renderLandingLists();
    });
    byId("competitionFilter").addEventListener("change", function () {
      state.landingFilters.competition = this.value;
      renderLandingLists();
    });
    byId("monthFilter").addEventListener("change", function () {
      state.landingFilters.month = this.value;
      renderLandingLists();
    });
    if (byId("resultsMonthFilter")) byId("resultsMonthFilter").addEventListener("change", function () {
      state.landingFilters.resultsMonth = this.value;
      renderLandingLists();
    });
    byId("resetFilters").addEventListener("click", function () {
      state.landingFilters = {
        team: state.favoriteTeamId || "all",
        competition: "all",
        month: state.comingMonth || "all",
        resultsMonth: state.latestCompletedMonth || "all"
      };
      byId("teamFilter").value = state.landingFilters.team;
      byId("competitionFilter").value = "all";
      byId("monthFilter").value = state.landingFilters.month;
      if (byId("resultsMonthFilter")) byId("resultsMonthFilter").value = state.landingFilters.resultsMonth;
      renderLandingLists();
    });
    byId("favoriteFilter").addEventListener("click", function () {
      if (!state.favoriteTeamId) return;
      state.landingFilters.team = state.favoriteTeamId;
      byId("teamFilter").value = state.favoriteTeamId;
      renderLandingLists();
    });
    if (byId("allTeamsFilter")) byId("allTeamsFilter").addEventListener("click", function () {
      state.landingFilters.team = "all";
      byId("teamFilter").value = "all";
      renderLandingLists();
    });
  }

  function renderLanding(invalidRoute) {
    var favoriteGames;
    var featured;
    var notice = byId("landingNotice");
    if (byId("boxscoreView")) byId("boxscoreView").hidden = true;
    byId("detailView").hidden = true;
    byId("landingView").hidden = false;
    document.title = IS_MATCH_CENTRE ? "Match Centre - ESL" : "Match Preview - ESL";
    notice.hidden = !invalidRoute;
    notice.textContent = invalidRoute ? "Matchup unavailable. Choose a game below." : "";
    if (invalidRoute) window.history.replaceState({}, "", IS_MATCH_CENTRE ? "./match-centre.htm" : "./match-preview.htm");
    state.favoriteTeamId = favoriteTeamId();
    favoriteGames = state.favoriteTeamId
      ? state.upcoming.filter(function (game) { return teamIsInGame(game, state.favoriteTeamId); })
      : [];
    featured = favoriteGames[0] || state.upcoming[0] || null;
    renderFeatured(featured, Boolean(favoriteGames.length));
    if (state.favoriteTeamId && !favoriteGames.length && featured) {
      byId("featuredNote").textContent = "No remaining favorite-team games · league next";
    }
    if (!IS_MATCH_CENTRE) renderMyTeam();
    populateLandingFilters();
    renderLandingLists();
    bindLandingEvents();
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

  function renderHero(game) {
    var line = projectedLine(game);
    var lineNode = byId("projectedLine");
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
    lineNode.textContent = line ? line.label : "Unavailable";
    lineNode.title = line ? "ESL model: 70% healthy-roster strength, 30% season point differential" : "Healthy roster ratings unavailable";
    document.title = teamName(game, "away") + " @ " + teamName(game, "home") +
      (IS_MATCH_CENTRE ? " - Match Centre" : " - Match Preview");
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
    var selectedGame = state.upcoming[state.selectedIndex];
    var timelineIndex = selectedGame ? state.allGames.findIndex(function (game) {
      return gameKey(game) === gameKey(selectedGame);
    }) : -1;
    if (picker) {
      picker.innerHTML = state.upcoming.map(function (game, index) {
        return '<option value="' + index + '"' + (index === state.selectedIndex ? " selected" : "") + '>' + esc(game.date + " · " + teamName(game, "away") + " @ " + teamName(game, "home")) + "</option>";
      }).join("");
    }
    byId("previousGame").disabled = timelineIndex <= 0;
    byId("nextGame").disabled = timelineIndex < 0 || timelineIndex >= state.allGames.length - 1;
  }

  function renderSelected(replaceUrl) {
    var game = state.upcoming[state.selectedIndex];
    var rows;
    if (!game) return;
    byId("landingView").hidden = true;
    byId("detailView").hidden = false;
    byId("matchHero").hidden = false;
    byId("previewError").hidden = true;
    if (replaceUrl) syncUrl(game, true);
    rows = comparisonRows(game);
    scoreComparisons(rows);
    renderPicker();
    renderHero(game);
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

  function navigateTimeline(delta) {
    var selected = state.upcoming[state.selectedIndex];
    var timelineIndex;
    var target;
    var upcomingIndex;
    if (!selected) return;
    timelineIndex = state.allGames.findIndex(function (game) { return gameKey(game) === gameKey(selected); });
    target = state.allGames[timelineIndex + delta];
    if (!target) return;
    if (target.status === "completed") {
      window.location.href = gameHref(target);
      return;
    }
    upcomingIndex = state.upcoming.findIndex(function (game) { return gameKey(game) === gameKey(target); });
    if (upcomingIndex >= 0) selectIndex(upcomingIndex, true);
  }

  function bindEvents() {
    var picker = byId("matchPicker");
    if (picker) picker.addEventListener("change", function () { selectIndex(Number(picker.value), true); });
    byId("previousGame").addEventListener("click", function () { navigateTimeline(-1); });
    byId("nextGame").addEventListener("click", function () { navigateTimeline(1); });
    window.addEventListener("popstate", function () {
      state.selectedIndex = resolveSelectedIndex();
      if (state.selectedIndex >= 0) renderSelected(false);
      else window.location.reload();
    });
  }

  function showError(message) {
    byId("landingView").hidden = true;
    byId("detailView").hidden = false;
    byId("previewError").hidden = false;
    byId("previewError").textContent = message;
    byId("comparisonBoard").innerHTML = '<div class="ui-state ui-state--error">' + esc(message) + "</div>";
    byId("matchHero").hidden = true;
    byId("previousGame").disabled = true;
    byId("nextGame").disabled = true;
  }

  var initialRequest = routeRequest();
  Promise.all([
    loadJson(DATA.schedule),
    loadJson(DATA.standings),
    initialRequest.mode === "detail" ? loadJson(DATA.teamStats, { teams: [] }) : Promise.resolve({ teams: [] }),
    loadJson(DATA.teams, []),
    loadJson(DATA.players),
    initialRequest.mode === "detail" ? loadJson(DATA.playerStats, { players: [] }) : Promise.resolve({ players: [] }),
    loadJson(DATA.injuries, { injuries: [] }),
    initialRequest.mode === "detail" ? loadJson(DATA.photos, { players: {} }) : Promise.resolve({ players: {} })
  ]).then(function (results) {
    var data = { schedule: results[0], standings: results[1], teamStats: results[2], teams: results[3], players: results[4], playerStats: results[5], injuries: results[6], photos: results[7] };
    var dates = (data.schedule.sections || []).flatMap(function (section) { return (section.days || []).map(function (day) { return day.date; }); });
    state.dateOrder = inferDateOrder(dates);
    buildLookups(data);
    state.allGames = flattenGames(data.schedule);
    state.upcoming = getUpcoming(state.allGames);
    state.completed = state.allGames.filter(function (game) {
      return game.status === "completed" && game.awayTeam && game.homeTeam;
    });
    state.comingMonth = state.upcoming.length ? monthKey(state.upcoming[0]) : "";
    state.latestCompletedMonth = state.completed.length ? monthKey(state.completed[state.completed.length - 1]) : "";
    if (initialRequest.mode !== "detail") {
      renderLanding(initialRequest.invalid);
      return;
    }
    if (IS_MATCH_CENTRE) {
      var requestedGame = state.allGames.find(function (game) { return gameKey(game) === initialRequest.key; });
      if (requestedGame && requestedGame.status === "completed") {
        if (boxGameId(requestedGame)) {
          window.location.replace(gameHref(requestedGame));
          return;
        }
        renderLanding(true);
        return;
      }
    }
    state.selectedIndex = resolveSelectedIndex();
    if (state.selectedIndex < 0) {
      renderLanding(true);
      return;
    }
    bindEvents();
    renderSelected(false);
  }).catch(function (error) {
    showError(error && error.message ? error.message : "Unable to load match preview data.");
  });
}());
