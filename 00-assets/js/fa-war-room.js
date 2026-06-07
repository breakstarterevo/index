(function () {
  "use strict";

  var FREE_AGENTS_PATH = "../../00-build/database/freeagents.json";
  var PLAYERS_PATH = "../../00-build/database/players.json";
  var TEAMS_PATH = "../../00-build/database/teams.json";
  var PLAYER_STATS_PATH = "../../00-build/database/player_stats.json";
  var CAP_REPORT_PATH = "../../00-build/database/capreport.json";
  var SETTINGS_KEY = "leagueSiteSettings";
  var STORAGE_PREFIX = "esl-fa-war-room:v1:";
  var TEAM_COLOR_FALLBACK = "#111b36";
  var MAX_RAISE_NO_BIRD = 5;
  var MAX_RAISE_BIRD = 7.5;
  var MAX_YEARS_NO_BIRD = 4;
  var MAX_YEARS_BIRD = 5;
  var MAX_SALARY_ONE_YEAR_NO_BIRD = 15000000;
  var MAX_SALARY_ONE_YEAR_BIRD = 20000000;
  var MAX_SALARY_MULTI_YEAR = 25000000;
  var teamColorCache = {};
  var TABLE_RATINGS = [
    ["INS", "Ins"],
    ["JPS", "Jps"],
    ["FTS", "Fts"],
    ["3PS", "3ps"],
    ["HND", "Hnd"],
    ["PAS", "Pas"],
    ["ORB", "Orb"],
    ["DRB", "Drb"],
    ["PSD", "Psd"],
    ["PRD", "Prd"],
    ["STL", "Stl"],
    ["BLK", "Blk"],
    ["QKN", "Qkn"],
    ["STR", "Str"],
    ["JMP", "Jmp"],
    ["STA", "Sta"]
  ];

  var ROUNDS = {
    round1: { label: "FA Round 1", normalLimit: 3, birdUnlimited: true },
    round2: { label: "FA Round 2", normalLimit: 10, birdUnlimited: false },
    round3: { label: "FA Round 3 + Preseason", normalLimit: 10, birdUnlimited: false }
  };

  var state = {
    players: [],
    playerIndex: {},
    playerStats: [],
    capReport: [],
    teams: [],
    bids: [],
    selectedTeam: "",
    selectedRound: "round1",
    selectedPlayerFile: "",
    sortKey: "ovr",
    sortDirection: "desc",
    showRatings: false,
    dataError: ""
  };
  var playerLinkTimer = null;
  var popoverTimer = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeName(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function numberValue(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function heightValue(value) {
    var match = String(value || "").match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return 0;
    return Number(match[1]) * 12 + Number(match[2]);
  }

  function ratingTierClass(value) {
    var rating = numberValue(value);
    if (rating >= 151) return "rating-purple";
    if (rating >= 115) return "rating-blue";
    if (rating >= 100) return "rating-green";
    if (rating >= 80) return "rating-yellow";
    return "rating-orange";
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? " selected" : "") + ">" + esc(label) + "</option>";
  }

  function playerKey(player) {
    return clean(player && (player.file || player.url || player.name));
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
          if (!raw && frameDocument && frameDocument.documentElement) {
            raw = frameDocument.documentElement.textContent || "";
          }
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

  function loadText(path) {
    return fetch(path, { cache: "no-store" }).then(function (response) {
      if (!response.ok) throw new Error("Unable to load " + path);
      return response.text();
    }).catch(function () {
      return loadTextFromFrame(path);
    });
  }

  function loadTextFromFrame(path) {
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
          raw = frameDocument && frameDocument.documentElement ? frameDocument.documentElement.innerHTML : "";
          frame.remove();
          if (!raw) {
            reject(new Error("No HTML data found at " + path));
            return;
          }
          resolve(raw);
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

  function normalizeHexColor(value) {
    var match = String(value || "").match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    var hex;
    if (!match) return "";
    hex = match[1];
    if (hex.length === 3) {
      hex = hex.split("").map(function (character) {
        return character + character;
      }).join("");
    }
    return "#" + hex.toUpperCase();
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

  function applyTeamColor(color) {
    document.documentElement.style.setProperty("--fa-accent", normalizeHexColor(color) || TEAM_COLOR_FALLBACK);
  }

  function getSettings() {
    try {
      return JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function storageKey() {
    return STORAGE_PREFIX + (state.selectedTeam || "no-team") + ":" + state.selectedRound;
  }

  function loadBids() {
    try {
      state.bids = JSON.parse(window.localStorage.getItem(storageKey()) || "[]") || [];
    } catch (error) {
      state.bids = [];
    }
  }

  function saveBids() {
    window.localStorage.setItem(storageKey(), JSON.stringify(state.bids));
  }

  function teamById(id) {
    return state.teams.find(function (team) {
      return team.id === id;
    }) || null;
  }

  function teamMatchesValue(team, value) {
    var target = normalizeName(value);
    if (!team || !target) return false;
    return normalizeName(team.id) === target ||
      normalizeName(team.name) === target ||
      normalizeName(team.file) === target ||
      normalizeName(team.url) === target;
  }

  function resolveTeamId(value) {
    var team = state.teams.find(function (entry) {
      return teamMatchesValue(entry, value);
    });
    return team ? team.id : "";
  }

  function selectedTeamName() {
    var teamSelect = byId("fa-team");
    var selectedId = state.selectedTeam || (teamSelect && teamSelect.value) || "";
    var team = teamById(selectedId);
    return team ? team.name : "Select Team";
  }

  function selectedTeamRecord() {
    return teamById(state.selectedTeam);
  }

  function capEntryMatchesTeam(entry, team) {
    if (!entry || !team) return false;
    return normalizeName(entry.team) === normalizeName(team.name) ||
      normalizeName(entry.rosterFile) === normalizeName(team.file) ||
      normalizeName(entry.rosterUrl) === normalizeName(team.url);
  }

  function selectedTeamCapEntry() {
    var team = selectedTeamRecord();
    var sections = Array.isArray(state.capReport) ? state.capReport : [];
    var found = null;

    sections.some(function (section) {
      return (section.entries || []).some(function (entry) {
        if (!capEntryMatchesTeam(entry, team)) return false;
        found = Object.assign({ tierTitle: section.title || "" }, entry);
        return true;
      });
    });

    return found;
  }

  function hardCapFromEntry(entry) {
    var title = normalizeName(entry && entry.tierTitle);
    if (title.indexOf("championsleague") >= 0) return 100000000;
    if (title.indexOf("europaleague") >= 0) return 70000000;
    if (title.indexOf("conferenceleague") >= 0) return 50000000;
    if (entry && Number.isFinite(Number(entry.salary)) && Number.isFinite(Number(entry.capRoom))) {
      return Number(entry.salary) + Number(entry.capRoom);
    }
    return null;
  }

  function updateTeamColor() {
    var team = selectedTeamRecord();
    var requestTeam = state.selectedTeam;
    var path;

    if (!team || !team.file) {
      applyTeamColor(TEAM_COLOR_FALLBACK);
      return;
    }

    if (teamColorCache[team.id]) {
      applyTeamColor(teamColorCache[team.id]);
      return;
    }

    path = "../../rosters/" + team.file;
    loadText(path).then(function (html) {
      var color = extractTeamColor(html) || TEAM_COLOR_FALLBACK;
      teamColorCache[team.id] = color;
      if (state.selectedTeam === requestTeam) applyTeamColor(color);
    }).catch(function () {
      if (state.selectedTeam === requestTeam) applyTeamColor(TEAM_COLOR_FALLBACK);
    });
  }

  function playerByFile(file) {
    return state.players.find(function (player) {
      return playerKey(player) === file;
    }) || null;
  }

  function playerIdFromFile(file) {
    var match = String(file || "").match(/player(\d+)\.html?$/i);
    return match ? "player" + match[1] : "";
  }

  function buildPlayerIndex(players) {
    var index = {};

    (players || []).forEach(function (player) {
      var id = playerIdFromUrl(player && player.url) || playerIdFromFile(player && player.file);
      var file = clean(player && (player.file || (player.url || "").split("/").pop()));

      if (id) index[id] = player;
      if (file) index[file] = player;
    });

    return index;
  }

  function enrichedPlayer(player) {
    var id = playerIdFromFile(player && player.file) || playerIdFromUrl(player && player.url);
    var match = state.playerIndex[id] || state.playerIndex[player && player.file] || {};

    return Object.assign({}, match, player, {
      potentials: player && player.potentials ? player.potentials : (match.potentials || {})
    });
  }

  function statsForPlayer(player) {
    var id = playerIdFromFile(player && player.file) || playerIdFromUrl(player && player.url);
    var nameKey = normalizeName(player && player.name);
    return state.playerStats.find(function (entry) {
      return playerIdFromUrl(entry && entry.url) === id ||
        clean(entry && entry.playerId) === id ||
        normalizeName(entry && entry.name) === nameKey;
    }) || null;
  }

  function bidByFile(file) {
    return state.bids.find(function (bid) {
      return bid.file === file;
    }) || null;
  }

  function isBirdEligible(player) {
    return !!player && !!state.selectedTeam && clean(player.lastTeamId) === state.selectedTeam;
  }

  function playerIdFromUrl(url) {
    var match = String(url || "").match(/player(\d+)\.html?$/i);
    return match ? "player" + match[1] : "";
  }

  function normalizePlayerHref(url) {
    var playerId = playerIdFromUrl(url);
    var href = clean(url);
    if (playerId) return "./unified-player.htm?id=" + encodeURIComponent(playerId);
    if (!href) return "#";
    if (/^https?:/i.test(href)) return href;
    href = href.replace(/^\.\//, "../../");
    href = href.replace(/^\.\.\//, "../../");
    if (/^players\//i.test(href)) return "../../" + href;
    return href;
  }

  function parseSalary(raw) {
    var text = clean(raw).toLowerCase();
    var multiplier = 1;
    var number;

    if (!text) return null;
    if (/^(min|minimum)$/.test(text)) return 0;
    if (/(m|mil|mill|million)\b/i.test(text)) multiplier = 1000000;
    if (/(k|thousand)\b/i.test(text)) multiplier = 1000;
    number = Number(text.replace(/[$,%\s,]/g, "").replace(/(m|mil|mill|million|k|thousand)$/i, ""));
    if (!Number.isFinite(number)) return null;
    return Math.round(number * multiplier);
  }

  function parseRaise(raw) {
    var value = Number(clean(raw).replace("%", ""));
    return Number.isFinite(value) ? value : null;
  }

  function formatPercent(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toFixed(1) + "%";
  }

  function formatSalaryForCopy(raw) {
    if (/^(min|minimum)$/i.test(clean(raw))) return clean(raw);
    var amount = parseSalary(raw);
    if (amount == null) return clean(raw);
    if (amount >= 1000000 && amount % 100000 === 0) {
      return "$" + (amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1) + "M";
    }
    return "$" + amount.toLocaleString();
  }

  function formatRaise(raw) {
    var value = parseRaise(raw);
    return value == null ? clean(raw) : formatPercent(value);
  }

  function maxRaiseForBird(isBird) {
    return isBird ? MAX_RAISE_BIRD : MAX_RAISE_NO_BIRD;
  }

  function maxYearsForBird(isBird) {
    return isBird ? MAX_YEARS_BIRD : MAX_YEARS_NO_BIRD;
  }

  function maxStartingSalary(isBird, years) {
    if (numberValue(years) > 1) return MAX_SALARY_MULTI_YEAR;
    return isBird ? MAX_SALARY_ONE_YEAR_BIRD : MAX_SALARY_ONE_YEAR_NO_BIRD;
  }

  function populateRaiseOptions(maxRaise, selected) {
    var select = byId("fa-raise");
    var selectedValue = parseRaise(selected);
    var options = [];
    var value;

    for (value = 0; value <= maxRaise + 0.001; value += 0.5) {
      options.push(option(formatPercent(value), formatPercent(value), selectedValue != null && Math.abs(selectedValue - value) < 0.001));
    }

    select.innerHTML = options.join("");
    if (selectedValue != null && selectedValue <= maxRaise) {
      select.value = formatPercent(selectedValue);
    } else {
      select.value = formatPercent(Math.min(maxRaise, selectedValue == null ? 0 : selectedValue));
    }
  }

  function updateContractControls() {
    var isBird = !!byId("fa-bird").checked;
    var currentRaise = byId("fa-raise").value || "0.0%";
    byId("fa-years").max = String(maxYearsForBird(isBird));
    populateRaiseOptions(maxRaiseForBird(isBird), currentRaise);
  }

  function sortedBids() {
    return state.bids.slice().sort(function (left, right) {
      return clean(left.name).localeCompare(clean(right.name));
    });
  }

  function normalBids() {
    return state.bids.filter(function (bid) {
      return !bid.bird;
    });
  }

  function validateBids() {
    var warnings = [];
    var round = ROUNDS[state.selectedRound] || ROUNDS.round1;
    var capEntry = selectedTeamCapEntry();
    var hardCap = hardCapFromEntry(capEntry);
    var seen = {};
    var names = state.bids.map(function (bid) {
      return clean(bid.name);
    });
    var sortedNames = names.slice().sort(function (left, right) {
      return left.localeCompare(right);
    });

    state.bids.forEach(function (bid) {
      var key = normalizeName(bid.name);
      var player = playerByFile(bid.file);
      var salary = parseSalary(bid.salary);
      var raise = parseRaise(bid.raise);
      var years = numberValue(bid.years);
      var maxYears = maxYearsForBird(bid.bird);
      var maxRaise = maxRaiseForBird(bid.bird);
      var maxSalary = maxStartingSalary(bid.bird, years);
      var projectedSalary = capEntry && salary != null ? Number(capEntry.salary || 0) + salary : null;

      if (seen[key]) {
        warnings.push({ type: "bad", title: "Duplicate", text: bid.name + " appears more than once." });
      }
      seen[key] = true;
      if (!clean(bid.salary) || !clean(bid.raise) || !clean(bid.years)) {
        warnings.push({ type: "bad", title: "Missing field", text: bid.name + " needs salary, annual raise, and years." });
      }
      if (clean(bid.salary) && salary == null) {
        warnings.push({ type: "bad", title: "Salary format", text: bid.name + " has an unreadable salary. Use values like 15000000, $15M, 15m, or 15mil." });
      }
      if (bid.bird && player && !isBirdEligible(player)) {
        warnings.push({ type: "warn", title: "Bird check", text: bid.name + " is marked as Bird Rights but is not flagged as eligible for the selected team." });
      }
      if (years > maxYears) {
        warnings.push({ type: "bad", title: "Contract length", text: bid.name + " exceeds the " + maxYears + "-year maximum" + (bid.bird ? " for Bird Rights." : " without Bird Rights.") });
      }
      if (raise != null && raise > maxRaise) {
        warnings.push({ type: "bad", title: "Annual raise", text: bid.name + " exceeds the " + formatPercent(maxRaise) + " annual increase maximum." });
      }
      if (raise != null && Math.round(raise * 2) !== raise * 2) {
        warnings.push({ type: "bad", title: "Annual raise", text: bid.name + " must use 0.5% intervals." });
      }
      if (salary != null && salary > maxSalary) {
        warnings.push({ type: "bad", title: "Starting salary", text: bid.name + " exceeds the " + formatSalaryForCopy(maxSalary) + " starting salary maximum." });
      }
      if (capEntry && salary != null && hardCap != null && projectedSalary > hardCap) {
        warnings.push({
          type: "bad",
          title: "Hard cap",
          text: bid.name + " would put " + selectedTeamName() + " at " + formatSalaryForCopy(projectedSalary) + " against a " + formatSalaryForCopy(hardCap) + " hard cap. Current salary: " + (capEntry.salaryText || formatSalaryForCopy(capEntry.salary)) + "; cap room: " + (capEntry.capRoomText || formatSalaryForCopy(capEntry.capRoom)) + "."
        });
      }
    });

    if (normalBids().length > round.normalLimit) {
      warnings.push({
        type: "bad",
        title: "Round limit",
        text: round.label + " allows " + round.normalLimit + " normal bids" + (round.birdUnlimited ? " plus Bird Rights bids." : ".")
      });
    }

    if (names.join("|") !== sortedNames.join("|")) {
      warnings.push({ type: "warn", title: "Alphabetical", text: "Copy output will be sorted alphabetically for submission." });
    }

    return warnings;
  }

  function renderTeams() {
    var settings = getSettings();
    var favorite = clean(settings.favoriteTeam);
    var selected = state.selectedTeam || resolveTeamId(favorite) || (state.teams[0] && state.teams[0].id) || "";
    state.selectedTeam = selected;
    byId("fa-team").innerHTML = state.teams.map(function (team) {
      return option(team.id, team.name, team.id === selected);
    }).join("");
  }

  function renderPositions() {
    var positions = Array.from(new Set(state.players.map(function (player) {
      return clean(player.pos);
    }).filter(Boolean))).sort();
    byId("fa-position").innerHTML = option("", "All", true) + positions.map(function (pos) {
      return option(pos, pos, false);
    }).join("");
  }

  function visiblePlayers() {
    var query = normalizeName(byId("fa-search").value);
    var pos = clean(byId("fa-position").value);
    var minOvr = numberValue(byId("fa-min-ovr").value);
    var maxAge = numberValue(byId("fa-max-age").value);
    var personality = clean(byId("fa-personality").value);
    var birdFilter = clean(byId("fa-bird-filter").value);

    return state.players.filter(function (player) {
      var playerOvr = numberValue(player.currentRating || player.overall);
      var playerAge = numberValue(player.age);
      if (query && normalizeName(player.name).indexOf(query) < 0) return false;
      if (pos && clean(player.pos) !== pos) return false;
      if (minOvr && playerOvr < minOvr) return false;
      if (maxAge && playerAge > maxAge) return false;
      if (personality === "winner" && numberValue(player.playForWinner) < 70) return false;
      if (personality === "loyalty" && numberValue(player.loyalty) < 70) return false;
      if (personality === "greed" && numberValue(player.greed) < 70) return false;
      if (personality === "happy" && numberValue(player.happiness) < 70) return false;
      if (birdFilter === "eligible" && !isBirdEligible(player)) return false;
      if (birdFilter === "known" && !clean(player.lastTeam)) return false;
      if (birdFilter === "unknown" && clean(player.lastTeam)) return false;
      return true;
    });
  }

  function playerSortValue(player, key) {
    if (key === "name") return clean(player.name).toLowerCase();
    if (key === "pos") return clean(player.pos).toLowerCase();
    if (key === "age") return numberValue(player.age);
    if (key === "ovr") return numberValue(player.currentRating || player.overall);
    if (key === "pot") return numberValue(player.futureRating || player.potential);
    if (key === "height") return heightValue(player.ht);
    if (TABLE_RATINGS.some(function (rating) { return rating[1] === key; })) return numberValue(player[key]);
    if (key === "winner") return numberValue(player.playForWinner);
    if (key === "loyalty") return numberValue(player.loyalty);
    if (key === "greed") return numberValue(player.greed);
    if (key === "happiness") return numberValue(player.happiness);
    if (key === "lastTeam") return clean(player.lastTeam).toLowerCase();
    return "";
  }

  function sortPlayers(players) {
    var key = state.sortKey;
    var direction = state.sortDirection === "asc" ? 1 : -1;

    return players.slice().sort(function (left, right) {
      var leftValue = playerSortValue(left, key);
      var rightValue = playerSortValue(right, key);
      var result;

      if (typeof leftValue === "number" || typeof rightValue === "number") {
        result = numberValue(leftValue) - numberValue(rightValue);
      } else {
        result = String(leftValue).localeCompare(String(rightValue));
      }

      if (result === 0) {
        result = clean(left.name).localeCompare(clean(right.name));
      }

      return result * direction;
    });
  }

  function renderSortHeaders() {
    document.querySelectorAll(".fa-sort").forEach(function (button) {
      var active = button.getAttribute("data-sort") === state.sortKey;
      button.classList.toggle("is-active", active);
      button.classList.toggle("is-asc", active && state.sortDirection === "asc");
    });
  }

  function tableColumnCount() {
    return 11 + (state.showRatings ? TABLE_RATINGS.length : 0);
  }

  function renderPlayerTableHead() {
    var ratingHeaders = state.showRatings ? TABLE_RATINGS.map(function (rating) {
      return '<th class="fa-col-skill"><button class="fa-sort" type="button" data-sort="' + esc(rating[1]) + '">' + esc(rating[0]) + "</button></th>";
    }).join("") : "";

    byId("fa-player-head").innerHTML = [
      "<tr>",
      '<th><button class="fa-sort" type="button" data-sort="name">Player</button></th>',
      '<th class="fa-col-pos"><button class="fa-sort" type="button" data-sort="pos">Pos</button></th>',
      '<th class="fa-col-age"><button class="fa-sort" type="button" data-sort="age">Age</button></th>',
      '<th class="fa-col-rating"><button class="fa-sort" type="button" data-sort="ovr">OVR</button></th>',
      '<th class="fa-col-rating"><button class="fa-sort" type="button" data-sort="pot">POT</button></th>',
      '<th class="fa-col-height"><button class="fa-sort" type="button" data-sort="height">Ht</button></th>',
      ratingHeaders,
      '<th class="fa-col-personality"><button class="fa-sort" type="button" data-sort="winner">Win</button></th>',
      '<th class="fa-col-personality"><button class="fa-sort" type="button" data-sort="loyalty">Loy</button></th>',
      '<th class="fa-col-personality"><button class="fa-sort" type="button" data-sort="greed">Greed</button></th>',
      '<th class="fa-col-personality"><button class="fa-sort" type="button" data-sort="happiness">Happy</button></th>',
      '<th><button class="fa-sort" type="button" data-sort="lastTeam">Last Team</button></th>',
      "</tr>"
    ].join("");
  }

  function selectPlayerRow(file) {
    state.selectedPlayerFile = file;
    document.querySelectorAll("#fa-player-body tr[data-player-file]").forEach(function (row) {
      row.classList.toggle("is-selected", row.getAttribute("data-player-file") === file);
    });
  }

  function latestSeasonRow(statsEntry) {
    var rows = statsEntry && statsEntry.stats && statsEntry.stats.season_averages && Array.isArray(statsEntry.stats.season_averages.rows)
      ? statsEntry.stats.season_averages.rows
      : [];
    return rows.find(function (row) {
      return clean(row.season) && clean(row.season).toLowerCase() !== "career";
    }) || null;
  }

  function popoverStat(label, value) {
    return '<div class="fa-popover-stat"><span>' + esc(label) + '</span><strong>' + esc(value == null || value === "" ? "-" : value) + "</strong></div>";
  }

  function popoverRating(label, player, key) {
    var potentials = player && player.potentials ? player.potentials : {};
    var value = player && player[key];
    var potential = potentials[key];
    var potentialText = potential == null || potential === "" ? "" : " (" + potential + ")";

    return '<div class="fa-popover-rating"><span>' + esc(label) + '</span><strong>' + esc(value == null || value === "" ? "-" : value) + '</strong><em>' + esc(potentialText) + "</em></div>";
  }

  function combinedRebounds(row) {
    var orb = numberValue(row && row.orb);
    var drb = numberValue(row && row.drb);
    var total = orb + drb;
    return total ? total.toFixed(orb % 1 || drb % 1 ? 1 : 0) : row && row.reb || "-";
  }

  function renderPlayerPopover(player) {
    var profile = enrichedPlayer(player);
    var stats = statsForPlayer(profile);
    var row = latestSeasonRow(stats);
    var groups = [
      { title: "Offense", ratings: [["INS", "Ins"], ["JPS", "Jps"], ["3PS", "3ps"], ["HND", "Hnd"], ["PAS", "Pas"]] },
      { title: "Defense", ratings: [["ORB", "Orb"], ["DRB", "Drb"], ["PSD", "Psd"], ["PRD", "Prd"], ["STL", "Stl"], ["BLK", "Blk"]] },
      { title: "Physical", ratings: [["QKN", "Qkn"], ["JMP", "Jmp"], ["STR", "Str"], ["STA", "Sta"]] }
    ];
    var ratings = groups.map(function (group) {
      return '<section class="fa-popover-rating-group"><h4>' + esc(group.title) + "</h4>" +
        group.ratings.map(function (rating) {
          return popoverRating(rating[0], profile, rating[1]);
        }).join("") +
        "</section>";
    }).join("");
    var recent = [
      popoverStat("PTS", row && row.pts),
      popoverStat("REB", row && combinedRebounds(row)),
      popoverStat("AST", row && row.ast)
    ].join("");

    return [
      '<div class="fa-popover-head">',
      '  <div><h3 class="fa-popover-name">' + esc(profile.name) + "</h3>",
      '  <div class="fa-popover-meta">' + esc([profile.lastTeam || "FA", profile.pos, profile.age ? "Age " + profile.age : "", profile.ht].filter(Boolean).join(" | ")) + "</div></div>",
      '  <div class="fa-popover-overall"><strong>' + esc(profile.currentRating || profile.overall || "-") + '</strong><span>OVR</span><small>POT ' + esc(profile.futureRating || profile.potential || "-") + "</small></div>",
      "</div>",
      '<div class="fa-popover-ratings">' + ratings + "</div>",
      '<section class="fa-popover-stats"><h4>Stats</h4><div class="fa-popover-stat-grid">' + recent + "</div></section>"
    ].join("");
  }

  function positionPopover(anchor) {
    var popover = byId("fa-player-popover");
    var rect = anchor.getBoundingClientRect();
    var top = Math.max(10, rect.bottom + 8);
    var left = Math.min(Math.max(10, rect.left), window.innerWidth - popover.offsetWidth - 10);

    if (top + popover.offsetHeight > window.innerHeight - 10) {
      top = Math.max(10, rect.top - popover.offsetHeight - 8);
    }

    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  function showPlayerPopover(anchor) {
    var row = anchor && anchor.closest("tr[data-player-file]");
    var player = row ? playerByFile(row.getAttribute("data-player-file")) : null;
    var popover = byId("fa-player-popover");

    if (!player || !popover) return;
    window.clearTimeout(popoverTimer);
    popover.innerHTML = renderPlayerPopover(player);
    popover.classList.add("is-open");
    positionPopover(anchor);
  }

  function queuePlayerPopover(anchor) {
    window.clearTimeout(popoverTimer);
    popoverTimer = window.setTimeout(function () {
      showPlayerPopover(anchor);
    }, 260);
  }

  function hidePlayerPopover() {
    window.clearTimeout(popoverTimer);
    var popover = byId("fa-player-popover");
    if (popover) popover.classList.remove("is-open");
  }

  function renderPlayers() {
    var players = sortPlayers(visiblePlayers());
    var body = byId("fa-player-body");
    var colSpan = tableColumnCount();
    document.body.classList.toggle("fa-ratings-expanded", state.showRatings);
    byId("fa-layout").classList.toggle("is-ratings-expanded", state.showRatings);
    byId("fa-player-table").classList.toggle("is-expanded", state.showRatings);
    renderPlayerTableHead();
    renderSortHeaders();
    byId("fa-list-status").textContent = players.length + " shown / " + state.players.length + " total";

    if (state.dataError) {
      body.innerHTML = '<tr><td colspan="' + colSpan + '">' + esc(state.dataError) + "</td></tr>";
      return;
    }

    if (!players.length) {
      body.innerHTML = '<tr><td colspan="' + colSpan + '">No free agents match these filters.</td></tr>';
      return;
    }

    body.innerHTML = players.map(function (player) {
      var file = playerKey(player);
      var selected = state.selectedPlayerFile === file ? " is-selected" : "";
      var bird = isBirdEligible(player) ? ' <span class="fa-chip"><strong>Bird</strong></span>' : "";
      var ratingCells = state.showRatings ? TABLE_RATINGS.map(function (rating) {
        return '<td class="fa-col-skill">' + esc(player[rating[1]] == null || player[rating[1]] === "" ? "-" : player[rating[1]]) + "</td>";
      }).join("") : "";
      return [
        '<tr class="' + selected + '" data-player-file="' + esc(file) + '">',
        '<td><a class="fa-player-link" href="' + esc(normalizePlayerHref(player.url)) + '">' + esc(player.name) + "</a>" + bird + "</td>",
        '<td class="fa-col-pos">' + esc(player.pos || "-") + "</td>",
        '<td class="fa-col-age">' + esc(player.age || "-") + "</td>",
        '<td class="fa-col-rating"><span class="fa-rating ' + esc(ratingTierClass(player.currentRating)) + '">' + esc(player.currentRating || "-") + "</span></td>",
        '<td class="fa-col-rating"><span class="fa-rating ' + esc(ratingTierClass(player.futureRating)) + '">' + esc(player.futureRating || "-") + "</span></td>",
        '<td class="fa-col-height">' + esc(player.ht || "-") + "</td>",
        ratingCells,
        '<td class="fa-col-personality">' + esc(player.playForWinner || "-") + "</td>",
        '<td class="fa-col-personality">' + esc(player.loyalty || "-") + "</td>",
        '<td class="fa-col-personality">' + esc(player.greed || "-") + "</td>",
        '<td class="fa-col-personality">' + esc(player.happiness || "-") + "</td>",
        "<td>" + esc(player.lastTeam || "Unknown") + "</td>",
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderWarnings() {
    var warnings = validateBids();
    var wrap = byId("fa-warnings");
    wrap.innerHTML = warnings.map(function (warning) {
      return '<div class="fa-warning' + (warning.type === "bad" ? " fa-warning--bad" : "") + '">' +
        '<span class="fa-warning-title">' + esc(warning.title) + "</span>" +
        esc(warning.text) +
        "</div>";
    }).join("");
  }

  function renderBidList() {
    var list = byId("fa-bid-list");
    var round = ROUNDS[state.selectedRound] || ROUNDS.round1;
    var normalCount = normalBids().length;
    var birdCount = state.bids.length - normalCount;
    byId("fa-bid-count").textContent = normalCount + "/" + round.normalLimit + " normal" + (birdCount ? " + " + birdCount + " Bird" : "");

    if (!state.bids.length) {
      list.innerHTML = '<div class="fa-empty">Double-click a free agent to add a bid.</div>';
      return;
    }

    list.innerHTML = sortedBids().map(function (bid) {
      return [
        '<div class="fa-bid-row">',
        '<div class="fa-bid-main">',
        '<div class="fa-bid-name">' + esc(bid.name) + (bid.bird ? ' <span class="fa-chip"><strong>Bird</strong></span>' : "") + "</div>",
        '<div class="fa-bid-meta">' + esc(formatSalaryForCopy(bid.salary)) + " | " + esc(formatRaise(bid.raise)) + " | " + esc(bid.years) + " years</div>",
        "</div>",
        '<div class="fa-row-actions">',
        '<button class="fa-button fa-button--secondary" type="button" data-edit-bid="' + esc(bid.file) + '">Edit</button>',
        '<button class="fa-button fa-button--danger" type="button" data-delete-bid="' + esc(bid.file) + '">Remove</button>',
        "</div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function renderOutput() {
    var round = ROUNDS[state.selectedRound] || ROUNDS.round1;
    var bids = sortedBids();
    var lines = [selectedTeamName() + " - " + round.label + " Bids", ""];
    var separator = "\u2014";
    var index = 1;

    function bidLine(bid) {
      return [
        index++ + ".",
        bid.name + (bid.bird ? " (Bird Rights)" : ""),
        separator,
        formatSalaryForCopy(bid.salary),
        separator,
        formatRaise(bid.raise),
        separator,
        clean(bid.years) + " years"
      ].join(" ");
      return [
        index++ + ".",
        bid.name + (bid.bird ? " (Bird Rights)" : ""),
        "—",
        formatSalaryForCopy(bid.salary),
        "—",
        formatRaise(bid.raise),
        "—",
        clean(bid.years) + " years"
      ].join(" ");
    }

    bids.forEach(function (bid) { lines.push(bidLine(bid)); });

    byId("fa-output").value = lines.join("\n").trim();
  }

  function renderAll() {
    renderPlayers();
    renderWarnings();
    renderBidList();
    renderOutput();
  }

  function openDrawer(player) {
    var bid;
    var cards;
    if (!player) return;
    state.selectedPlayerFile = playerKey(player);
    bid = bidByFile(state.selectedPlayerFile);
    byId("fa-drawer-name").textContent = player.name;
    byId("fa-drawer-meta").textContent = [player.pos, player.age ? "Age " + player.age : "", player.ht].filter(Boolean).join(" | ");
    cards = [
      ["OVR/POT", (player.currentRating || "-") + " / " + (player.futureRating || "-")],
      ["Last Team", player.lastTeam || "Unknown"],
      ["Winner", player.playForWinner || "-"],
      ["Loyalty", player.loyalty || "-"],
      ["Greed", player.greed || "-"],
      ["Happiness", player.happiness || "-"]
    ];
    byId("fa-drawer-cards").innerHTML = cards.map(function (card) {
      return '<div class="fa-mini-card"><span class="fa-mini-label">' + esc(card[0]) + '</span><span class="fa-mini-value">' + esc(card[1]) + "</span></div>";
    }).join("");
    byId("fa-salary").value = bid ? bid.salary : "Min";
    byId("fa-years").value = bid ? bid.years : "1";
    byId("fa-bird").checked = bid ? !!bid.bird : isBirdEligible(player);
    updateContractControls();
    byId("fa-raise").value = formatRaise(bid ? bid.raise : "0.0%");
    byId("fa-notes").value = bid ? bid.notes || "" : "";
    byId("fa-save-bid").textContent = bid ? "Update Bid" : "Add Bid";
    byId("fa-remove-bid").disabled = !bid;
    byId("fa-open-player").href = normalizePlayerHref(player.url);
    byId("fa-drawer").setAttribute("aria-hidden", "false");
    document.body.classList.add("fa-drawer-open");
    renderPlayers();
  }

  function closeDrawer() {
    byId("fa-drawer").setAttribute("aria-hidden", "true");
    document.body.classList.remove("fa-drawer-open");
  }

  function saveCurrentBid() {
    var player = playerByFile(state.selectedPlayerFile);
    var bid;
    if (!player) return;
    bid = {
      file: state.selectedPlayerFile,
      name: player.name,
      salary: clean(byId("fa-salary").value),
      raise: clean(byId("fa-raise").value),
      years: clean(byId("fa-years").value),
      bird: byId("fa-bird").checked,
      notes: clean(byId("fa-notes").value)
    };
    state.bids = state.bids.filter(function (entry) {
      return entry.file !== bid.file;
    });
    state.bids.push(bid);
    saveBids();
    renderAll();
    closeDrawer();
  }

  function removeBid(file) {
    state.bids = state.bids.filter(function (bid) {
      return bid.file !== file;
    });
    saveBids();
    renderAll();
  }

  function bindEvents() {
    ["fa-search", "fa-position", "fa-min-ovr", "fa-max-age", "fa-personality", "fa-bird-filter"].forEach(function (id) {
      byId(id).addEventListener("input", renderPlayers);
      byId(id).addEventListener("change", renderPlayers);
    });

    byId("fa-player-head").addEventListener("click", function (event) {
      var button = event.target.closest(".fa-sort");
      var key;
      if (!button) return;
      key = button.getAttribute("data-sort") || "ovr";
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = ["name", "pos", "lastTeam"].indexOf(key) >= 0 ? "asc" : "desc";
      }
      renderPlayers();
    });

    byId("fa-show-ratings").addEventListener("change", function () {
      state.showRatings = this.checked;
      renderPlayers();
    });

    byId("fa-team").addEventListener("change", function () {
      state.selectedTeam = this.value;
      loadBids();
      updateTeamColor();
      renderAll();
    });

    byId("fa-round").addEventListener("change", function () {
      state.selectedRound = this.value;
      loadBids();
      renderAll();
    });

    byId("fa-player-body").addEventListener("click", function (event) {
      var row = event.target.closest("tr[data-player-file]");
      var link = event.target.closest(".fa-player-link");
      if (!row) return;
      if (link) {
        event.preventDefault();
        window.clearTimeout(playerLinkTimer);
        playerLinkTimer = window.setTimeout(function () {
          window.location.href = link.href;
        }, 220);
      }
      selectPlayerRow(row.getAttribute("data-player-file"));
    });

    byId("fa-player-body").addEventListener("mouseover", function (event) {
      var link = event.target.closest(".fa-player-link");
      if (link) queuePlayerPopover(link);
    });

    byId("fa-player-body").addEventListener("mouseout", function (event) {
      var link = event.target.closest(".fa-player-link");
      if (link) hidePlayerPopover();
    });

    byId("fa-player-body").addEventListener("focusin", function (event) {
      var link = event.target.closest(".fa-player-link");
      if (link) showPlayerPopover(link);
    });

    byId("fa-player-body").addEventListener("focusout", function (event) {
      if (event.target.closest(".fa-player-link")) hidePlayerPopover();
    });

    byId("fa-player-body").addEventListener("pointerdown", function (event) {
      var link = event.target.closest(".fa-player-link");
      if (link) showPlayerPopover(link);
    });

    byId("fa-player-body").addEventListener("pointerup", function (event) {
      if (event.target.closest(".fa-player-link")) {
        window.setTimeout(hidePlayerPopover, 500);
      }
    });

    byId("fa-player-body").addEventListener("dblclick", function (event) {
      var row = event.target.closest("tr[data-player-file]");
      var player;
      if (!row) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(playerLinkTimer);
      hidePlayerPopover();
      player = playerByFile(row.getAttribute("data-player-file"));
      openDrawer(player);
    });

    byId("fa-bid-list").addEventListener("click", function (event) {
      var edit = event.target.closest("[data-edit-bid]");
      var remove = event.target.closest("[data-delete-bid]");
      if (edit) {
        openDrawer(playerByFile(edit.getAttribute("data-edit-bid")));
      }
      if (remove) {
        removeBid(remove.getAttribute("data-delete-bid"));
      }
    });

    byId("fa-save-bid").addEventListener("click", saveCurrentBid);
    byId("fa-remove-bid").addEventListener("click", function () {
      removeBid(state.selectedPlayerFile);
      closeDrawer();
    });
    byId("fa-bird").addEventListener("change", updateContractControls);
    byId("fa-close").addEventListener("click", closeDrawer);
    byId("fa-drawer-backdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeDrawer();
    });
    byId("fa-copy").addEventListener("click", function () {
      var text = byId("fa-output").value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        byId("fa-output").select();
        document.execCommand("copy");
      }
      byId("fa-copy").textContent = "Copied";
      window.setTimeout(function () {
        byId("fa-copy").textContent = "Copy";
      }, 1200);
    });
  }

  function init() {
    Promise.all([
      loadJson(FREE_AGENTS_PATH),
      loadJson(TEAMS_PATH),
      loadJson(PLAYER_STATS_PATH),
      loadJson(PLAYERS_PATH),
      loadJson(CAP_REPORT_PATH).catch(function () { return { sections: [] }; })
    ]).then(function (results) {
      state.players = (results[0].players || []).slice();
      state.teams = (results[1] || []).slice().sort(function (left, right) {
        return clean(left.name).localeCompare(clean(right.name));
      });
      state.playerStats = results[2].players || [];
      state.playerIndex = buildPlayerIndex(results[3] || []);
      state.capReport = results[4].sections || [];
      renderTeams();
      renderPositions();
      loadBids();
      updateTeamColor();
      bindEvents();
      renderAll();
    }).catch(function (error) {
      state.dataError = error && error.message ? error.message : "Unable to load FA data.";
      bindEvents();
      renderAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
