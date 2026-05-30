(function () {
  "use strict";

  var PLAYERS_PATH = "../../00-build/database/players.json";
  var TEAMS_PATH = "../../00-build/database/teams.json";
  var INJURIES_PATH = "../../00-build/database/injuries.json";
  var TRACKER_CSV = "https://docs.google.com/spreadsheets/d/1ZCa_G7E9h6Z7Yf6gdFCBL9Aj4nhi92Um2rxb0rgDYew/gviz/tq?tqx=out:csv";
  var STORAGE_KEY = "esl-camps-planner:v1";
  var SETTINGS_KEY = "leagueSiteSettings";

  var REGULAR_LIMIT = 3;
  var TENDENCY_LIMIT = 2;
  var DEVELOPMENT_LIMIT = 2;
  var INJURY_LIMIT = 1;
  var REGULAR_CAREER_LIMIT = 3;
  var REHAB_CAREER_LIMIT = 1;
  var TEAM_COLOR_FALLBACK = "#111b36";
  var teamColorCache = {};

  var SKILLS = [
    "Ins", "Jps", "Fts", "3ps", "Hnd", "Pas",
    "Orb", "Drb", "Psd", "Prd", "Stl", "Blk",
    "Qkn", "Jmp", "Str", "Sta"
  ];
  var PHYSICAL_SKILLS = ["Qkn", "Jmp", "Str", "Sta"];
  var DEVELOPMENT_SKILLS = SKILLS.filter(function (skill) {
    return PHYSICAL_SKILLS.indexOf(skill) < 0;
  });
  var TENDENCIES = [
    { key: "three", label: "3pt tendency" },
    { key: "fouling", label: "fouling" },
    { key: "injuryAvoidance", label: "injury avoidance" }
  ];
  var DEVELOPMENT_BUDGET_BY_COLOR = {
    "#307B1A": 4,
    "#EDBE30": 8,
    "#F2662A": 10
  };
  var CAMP_TYPES = [
    { value: "regular", label: "Regular Camp" },
    { value: "tendency", label: "Tendency Camp" },
    { value: "development", label: "Development Camp" },
    { value: "injury", label: "Injury Camp" },
    { value: "media", label: "Media Camp" }
  ];

  var state = {
    teams: [],
    players: [],
    injuries: [],
    tracker: new Map(),
    entries: [],
    selectedTeam: "",
    trackerLoaded: false,
    trackerError: "",
    dataError: "",
    seasonKey: ""
  };

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

  function signed(value) {
    var number = numberValue(value);
    return number > 0 ? "+" + number : String(number);
  }

  function ordinal(value) {
    var number = Math.abs(numberValue(value));
    var mod100 = number % 100;
    if (mod100 >= 11 && mod100 <= 13) return number + "th";
    if (number % 10 === 1) return number + "st";
    if (number % 10 === 2) return number + "nd";
    if (number % 10 === 3) return number + "rd";
    return number + "th";
  }

  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? " selected" : "") + ">" + esc(label) + "</option>";
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
    document.documentElement.style.setProperty("--camp-accent", normalizeHexColor(color) || TEAM_COLOR_FALLBACK);
  }

  function selectedTeamRecord() {
    return state.teams.find(function (team) {
      return team.id === state.selectedTeam;
    }) || null;
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

  function renderTeamLink() {
    var team = selectedTeamRecord();
    var link = byId("teamLink");
    if (!link) return;
    link.href = team && team.file ? "./unified-roster.htm?file=" + encodeURIComponent(team.file) : "./league%20dashboard.htm";
    link.setAttribute("aria-label", team && team.name ? "Open " + team.name + " team page" : "Open selected team page");
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var value = "";
    var inQuotes = false;
    var index;
    var character;
    var next;

    for (index = 0; index < String(text || "").length; index += 1) {
      character = text[index];
      next = text[index + 1];

      if (inQuotes) {
        if (character === '"' && next === '"') {
          value += '"';
          index += 1;
        } else if (character === '"') {
          inQuotes = false;
        } else {
          value += character;
        }
      } else if (character === '"') {
        inQuotes = true;
      } else if (character === ",") {
        row.push(value);
        value = "";
      } else if (character === "\n") {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if (character !== "\r") {
        value += character;
      }
    }

    if (value || row.length) {
      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  function loadTracker() {
    return fetch(TRACKER_CSV, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Career tracker could not be loaded.");
        return response.text();
      })
      .then(function (text) {
        var rows = parseCsv(text);
        var headers = rows.shift() || [];
        var nameIndex = headers.findIndex(function (header) { return clean(header).toLowerCase() === "name"; });
        var regularIndex = headers.findIndex(function (header) { return clean(header).toLowerCase() === "reg camp"; });
        var rehabIndex = headers.findIndex(function (header) { return clean(header).toLowerCase() === "rehab camp"; });

        if (nameIndex < 0) throw new Error("Career tracker is missing a Name column.");

        rows.forEach(function (row) {
          var name = clean(row[nameIndex]);
          if (!name) return;
          state.tracker.set(normalizeName(name), {
            name: name,
            regular: regularIndex >= 0 ? numberValue(row[regularIndex]) : 0,
            rehab: rehabIndex >= 0 ? numberValue(row[rehabIndex]) : 0
          });
        });
        state.trackerLoaded = true;
      })
      .catch(function (error) {
        return loadTrackerJsonp().catch(function () {
          state.trackerError = error && error.message ? error.message : "Career tracker could not be loaded.";
        });
      });
  }

  function loadTrackerJsonp() {
    return new Promise(function (resolve, reject) {
      var callbackName = "__campTrackerJsonp" + Date.now() + Math.floor(Math.random() * 10000);
      var script = document.createElement("script");
      var url = TRACKER_CSV.replace("tqx=out:csv", "tqx=responseHandler:" + callbackName);

      window[callbackName] = function (payload) {
        try {
          parseTrackerTable(payload && payload.table);
          state.trackerLoaded = true;
          cleanup();
          resolve();
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      function cleanup() {
        delete window[callbackName];
        script.remove();
      }

      script.src = url;
      script.async = true;
      script.addEventListener("error", function () {
        cleanup();
        reject(new Error("Career tracker JSONP load failed."));
      });
      document.head.appendChild(script);
    });
  }

  function cellValue(cell) {
    if (!cell) return "";
    if (cell.v != null) return cell.v;
    if (cell.f != null) return cell.f;
    return "";
  }

  function parseTrackerTable(table) {
    var columns = table && Array.isArray(table.cols) ? table.cols : [];
    var rows = table && Array.isArray(table.rows) ? table.rows : [];
    var nameIndex = columns.findIndex(function (column) { return clean(column.label).toLowerCase() === "name"; });
    var regularIndex = columns.findIndex(function (column) { return clean(column.label).toLowerCase() === "reg camp"; });
    var rehabIndex = columns.findIndex(function (column) { return clean(column.label).toLowerCase() === "rehab camp"; });

    if (nameIndex < 0) throw new Error("Career tracker is missing a Name column.");

    rows.forEach(function (row) {
      var cells = row && Array.isArray(row.c) ? row.c : [];
      var name = clean(cellValue(cells[nameIndex]));
      if (!name) return;
      state.tracker.set(normalizeName(name), {
        name: name,
        regular: regularIndex >= 0 ? numberValue(cellValue(cells[regularIndex])) : 0,
        rehab: rehabIndex >= 0 ? numberValue(cellValue(cells[rehabIndex])) : 0
      });
    });
  }

  function teamPlayers() {
    return state.players
      .filter(function (player) { return player.team === state.selectedTeam; })
      .sort(function (a, b) {
        return numberValue(b.overall) - numberValue(a.overall) ||
          String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      });
  }

  function getPlayer(playerId) {
    return state.players.find(function (player) {
      return String(player.playerId || player.url || player.name) === String(playerId);
    }) || null;
  }

  function playerKey(player) {
    return String(player && (player.playerId || player.url || player.name) || "");
  }

  function playerHref(player) {
    var match = String(player && (player.playerId || player.url) || "").match(/player(\d+)/i);
    return match ? "./unified-player.htm?id=player" + encodeURIComponent(match[1]) : "#";
  }

  function trackerFor(player) {
    return state.tracker.get(normalizeName(player && player.name)) || { regular: 0, rehab: 0 };
  }

  function isPlayerInjured(player) {
    var playerName = normalizeName(player && player.name);
    return state.injuries.some(function (injury) {
      return normalizeName(injury.name) === playerName;
    });
  }

  function injuryFor(player) {
    var playerName = normalizeName(player && player.name);
    return state.injuries.find(function (injury) {
      return normalizeName(injury.name) === playerName;
    }) || null;
  }

  function potentialBudget(player) {
    return DEVELOPMENT_BUDGET_BY_COLOR[String(player && player.potentialFutureColor || "").toUpperCase()] || 0;
  }

  function skillLabel(skill) {
    return String(skill || "").toLowerCase();
  }

  function selectedCampType() {
    return byId("campType").value || "regular";
  }

  function selectedPlayer() {
    return getPlayer(byId("playerSelect").value);
  }

  function allocationCounts() {
    return state.entries.reduce(function (counts, entry) {
      if (entry.type === "regular") counts.regular += 1;
      if (entry.type === "tendency") counts.tendency += 1;
      if (entry.type === "development") counts.development += 1;
      if (entry.type === "injury") counts.injury += 1;
      if (entry.type === "media") counts.media += 1;
      return counts;
    }, { regular: 0, tendency: 0, development: 0, injury: 0, media: 0 });
  }

  function inputsForSelector(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function pointValues(selector) {
    var values = {};
    inputsForSelector(selector).forEach(function (input) {
      values[input.getAttribute("data-key")] = numberValue(input.value);
    });
    return values;
  }

  function pointLine(values, labels) {
    var parts = [];
    Object.keys(values || {}).forEach(function (key) {
      var value = numberValue(values[key]);
      var label = labels && labels[key] ? labels[key] : skillLabel(key);
      if (value) parts.push(signed(value) + " " + label);
    });
    return parts.join(" ");
  }

  function campLabel(entry, countsBefore) {
    var player = getPlayer(entry.playerId);
    var tracker = player ? trackerFor(player) : { regular: 0, rehab: 0 };
    if (entry.type === "regular") {
      return "Regular Camp (" + ordinal(tracker.regular + (countsBefore.regularByPlayer[entry.playerId] || 0) + 1) + " career)";
    }
    if (entry.type === "tendency") {
      return "Tendency Camp " + (countsBefore.tendency + 1) + "/" + TENDENCY_LIMIT;
    }
    if (entry.type === "development") {
      return "Development Camp " + (countsBefore.development + 1) + "/" + DEVELOPMENT_LIMIT;
    }
    if (entry.type === "injury") {
      return entry.injuryMode === "painkillers" ? "Painkillers Camp" : "Rehab Camp";
    }
    return "Media Camp " + (countsBefore.media + 1);
  }

  function entryLine(entry) {
    var labels = {
      three: "3pt tendency",
      fouling: "fouling",
      injuryAvoidance: "injury avoidance"
    };

    if (entry.type === "regular" || entry.type === "development" || entry.type === "media") {
      return pointLine(entry.points);
    }
    if (entry.type === "tendency") {
      return pointLine(entry.points, labels);
    }
    if (entry.type === "injury") {
      return entry.injuryMode === "painkillers" ? "Halve remaining injury time" : "Restore injury rating drops";
    }
    return "";
  }

  function entriesWithLabels() {
    var counts = { tendency: 0, development: 0, media: 0, regularByPlayer: {} };
    return state.entries.map(function (entry) {
      var label = campLabel(entry, counts);
      if (entry.type === "tendency") counts.tendency += 1;
      if (entry.type === "development") counts.development += 1;
      if (entry.type === "media") counts.media += 1;
      if (entry.type === "regular") {
        counts.regularByPlayer[entry.playerId] = (counts.regularByPlayer[entry.playerId] || 0) + 1;
      }
      return {
        entry: entry,
        label: label,
        line: entryLine(entry)
      };
    });
  }

  function templateText() {
    var grouped = [];
    var byPlayer = new Map();
    entriesWithLabels().forEach(function (item) {
      var player = getPlayer(item.entry.playerId);
      var key = item.entry.playerId;
      var group;
      if (!player) return;
      if (!byPlayer.has(key)) {
        group = { player: player, items: [] };
        byPlayer.set(key, group);
        grouped.push(group);
      }
      byPlayer.get(key).items.push(item);
    });

    return grouped.map(function (group) {
      var lines = [group.player.name];
      group.items.forEach(function (item) {
        lines.push(item.label);
        if (item.line) lines.push(item.line);
      });
      return lines.join("\n");
    }).join("\n\n");
  }

  function warningList() {
    var warnings = [];
    var counts = allocationCounts();
    var byPlayer = new Map();
    var nonInjuryEntriesByPlayer = {};
    var typeCountsByPlayer = new Map();
    var regularPlanCountByPlayer = {};
    var rehabPlanCountByPlayer = {};

    if (state.dataError) warnings.push({ bad: true, text: state.dataError });
    if (state.trackerError) warnings.push({ text: "Career tracker unavailable: " + state.trackerError });

    if (counts.regular > REGULAR_LIMIT) warnings.push({ bad: true, text: "Regular team allocation exceeds 3 (" + counts.regular + "/3)." });
    if (counts.tendency > TENDENCY_LIMIT) warnings.push({ bad: true, text: "Tendency team allocation exceeds 2 (" + counts.tendency + "/2)." });
    if (counts.development > DEVELOPMENT_LIMIT) warnings.push({ bad: true, text: "Development team allocation exceeds 2 (" + counts.development + "/2)." });
    if (counts.injury > INJURY_LIMIT) warnings.push({ bad: true, text: "Injury team allocation exceeds 1 (" + counts.injury + "/1)." });

    state.entries.forEach(function (entry) {
      var player = getPlayer(entry.playerId);
      var map;
      var typeKey;
      var tracker;
      var physicalTotal;
      var total;
      var injury;
      if (!player) return;

      if (!byPlayer.has(entry.playerId)) byPlayer.set(entry.playerId, new Set());
      if (!typeCountsByPlayer.has(entry.playerId)) typeCountsByPlayer.set(entry.playerId, {});
      map = typeCountsByPlayer.get(entry.playerId);
      typeKey = entry.type === "injury" ? entry.injuryMode : entry.type;

      if (entry.type !== "injury") {
        byPlayer.get(entry.playerId).add(entry.type);
        nonInjuryEntriesByPlayer[entry.playerId] = (nonInjuryEntriesByPlayer[entry.playerId] || 0) + 1;
      }

      map[typeKey] = (map[typeKey] || 0) + 1;
      if (map[typeKey] > 1 && entry.type !== "media") {
        warnings.push({ bad: true, text: player.name + " has " + map[typeKey] + " " + typeKey + " camp entries." });
      }

      if (entry.type === "regular") {
        tracker = trackerFor(player);
        regularPlanCountByPlayer[entry.playerId] = (regularPlanCountByPlayer[entry.playerId] || 0) + 1;
        if (state.trackerLoaded && tracker.regular + regularPlanCountByPlayer[entry.playerId] > REGULAR_CAREER_LIMIT) {
          warnings.push({ bad: true, text: player.name + " would exceed the Regular Camp career limit (" + (tracker.regular + regularPlanCountByPlayer[entry.playerId]) + "/3)." });
        }
        physicalTotal = PHYSICAL_SKILLS.reduce(function (sum, key) {
          return sum + Math.max(0, numberValue(entry.points[key]));
        }, 0);
        total = Object.keys(entry.points || {}).reduce(function (sum, key) {
          return sum + Math.max(0, numberValue(entry.points[key]));
        }, 0);
        if (physicalTotal > 5) warnings.push({ bad: true, text: player.name + " Regular Camp physical allocation exceeds +5 (" + physicalTotal + "/5)." });
        if (total !== 10) warnings.push({ text: player.name + " Regular Camp uses " + total + "/10 points." });
      }

      if (entry.type === "tendency") {
        total = Object.keys(entry.points || {}).reduce(function (sum, key) {
          return sum + Math.abs(numberValue(entry.points[key]));
        }, 0);
        if (total > 10) warnings.push({ bad: true, text: player.name + " Tendency Camp exceeds 10 total tendency movement (" + total + "/10)." });
        if (total === 0) warnings.push({ text: player.name + " Tendency Camp has no tendency movement." });
      }

      if (entry.type === "development") {
        total = Object.keys(entry.points || {}).reduce(function (sum, key) {
          return sum + Math.max(0, numberValue(entry.points[key]));
        }, 0);
        if (numberValue(player.age) > 24) warnings.push({ bad: true, text: player.name + " is age " + player.age + " and is not Development Camp eligible." });
        if (!potentialBudget(player)) warnings.push({ bad: true, text: player.name + " has an unsupported potential colour for automatic Development Camp planning." });
        if (potentialBudget(player) && total !== potentialBudget(player)) {
          warnings.push({ text: player.name + " Development Camp uses " + total + "/" + potentialBudget(player) + " points." });
        }
      }

      if (entry.type === "injury") {
        injury = injuryFor(player);
        if (!injury) warnings.push({ bad: true, text: player.name + " is not listed in the injury feed for " + (entry.injuryMode === "painkillers" ? "Painkillers" : "Rehab") + "." });
        if (entry.injuryMode === "rehab") {
          tracker = trackerFor(player);
          rehabPlanCountByPlayer[entry.playerId] = (rehabPlanCountByPlayer[entry.playerId] || 0) + 1;
          if (state.trackerLoaded && tracker.rehab + rehabPlanCountByPlayer[entry.playerId] > REHAB_CAREER_LIMIT) {
            warnings.push({ bad: true, text: player.name + " would exceed the Rehab Camp career limit (" + (tracker.rehab + rehabPlanCountByPlayer[entry.playerId]) + "/1)." });
          }
        }
        warnings.push({ text: player.name + " Injury Camp requires -10 Injury Avoidance to be applied." });
      }

      if (entry.type === "media") {
        total = Object.keys(entry.points || {}).reduce(function (sum, key) {
          return sum + Math.max(0, numberValue(entry.points[key]));
        }, 0);
        if (total !== 3) warnings.push({ text: player.name + " Media Camp uses " + total + "/3 points." });
      }
    });

    byPlayer.forEach(function (types, playerId) {
      var player = getPlayer(playerId);
      if (types.size > 2 && player) {
        warnings.push({ bad: true, text: player.name + " has more than two non-injury camp types this season." });
      }
      if ((nonInjuryEntriesByPlayer[playerId] || 0) > 2 && player) {
        warnings.push({ bad: true, text: player.name + " uses " + nonInjuryEntriesByPlayer[playerId] + "/2 non-injury camps this season." });
      }
    });

    if (!warnings.length) warnings.push({ good: true, text: "No warnings for the current camp plan." });
    return warnings;
  }

  function savePlan() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        team: state.selectedTeam,
        seasonKey: state.seasonKey,
        entries: state.entries
      }));
    } catch (error) {
      // Planner still works without local storage.
    }
  }

  function favoriteTeamId() {
    var settings;
    var favorite;
    try {
      settings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (error) {
      settings = {};
    }
    favorite = normalizeName(settings.favoriteTeam);
    if (!favorite) return "";
    return (state.teams.find(function (team) {
      return normalizeName(team && team.name) === favorite;
    }) || {}).id || "";
  }

  function restorePlan() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved && saved.seasonKey && state.seasonKey && saved.seasonKey !== state.seasonKey) {
        window.localStorage.removeItem(STORAGE_KEY);
        state.entries = [];
        return;
      }
      if (saved && Array.isArray(saved.entries)) state.entries = saved.entries.filter(function (entry) {
        return entry && entry.playerId && entry.type;
      });
      if (saved && saved.team && state.entries.length) state.selectedTeam = saved.team;
    } catch (error) {
      state.entries = [];
    }
  }

  function computeSeasonKey(players) {
    var years = [];
    (players || []).forEach(function (player) {
      (player.contracts || []).forEach(function (contract) {
        var year = numberValue(contract.year);
        if (year && numberValue(contract.salary) > 0) years.push(year);
      });
    });
    if (!years.length) return "";
    return "contract-year:" + Math.min.apply(Math, years);
  }

  function renderTeamPicker() {
    var picker = byId("teamSelect");
    var selected = state.selectedTeam || (state.teams[0] && state.teams[0].id) || "";
    state.selectedTeam = selected;
    picker.innerHTML = state.teams.map(function (team) {
      return option(team.id, team.name, team.id === selected);
    }).join("");
  }

  function renderCampTypePicker() {
    byId("campType").innerHTML = CAMP_TYPES.map(function (type, index) {
      return option(type.value, type.label, index === 0);
    }).join("");
  }

  function renderPlayerPicker() {
    var players = teamPlayers();
    byId("playerSelect").innerHTML = players.map(function (player, index) {
      var meta = [player.pos, player.age ? "Age " + player.age : "", player.overall ? "OVR " + player.overall : ""].filter(Boolean).join(" | ");
      return option(playerKey(player), player.name + (meta ? " - " + meta : ""), index === 0);
    }).join("");
    byId("formStatus").textContent = players.length ? players.length + " roster players" : "No players found";
    renderPlayerLink();
  }

  function renderPlayerLink() {
    var link = byId("playerLink");
    var player = selectedPlayer();
    var href = playerHref(player);
    link.href = href;
    link.textContent = "Open";
    link.setAttribute("aria-label", player ? "Open " + player.name + " player page" : "Open selected player page");
    if (href === "#") {
      link.setAttribute("aria-disabled", "true");
      link.tabIndex = -1;
    } else {
      link.removeAttribute("aria-disabled");
      link.tabIndex = 0;
    }
  }

  function inputMarkup(key, label, value, min, max, currentValue) {
    var labelText = currentValue == null || currentValue === "" ? label : label + " " + currentValue;
    var current = currentValue == null || currentValue === "" ? "" : numberValue(currentValue);
    return '<label class="camp-control">' +
      '<span class="camp-label">' + esc(labelText) + "</span>" +
      '<span class="camp-range-wrap">' +
        '<input class="camp-range camp-point-input" data-key="' + esc(key) + '" data-current="' + esc(current) + '" type="range" step="1" min="' + esc(min == null ? -99 : min) + '" max="' + esc(max == null ? 99 : max) + '" value="' + esc(value || 0) + '">' +
        '<input class="camp-input camp-range-value" data-key="' + esc(key) + '" type="number" step="1" min="' + esc(min == null ? -99 : min) + '" max="' + esc(max == null ? 99 : max) + '" value="' + esc(value || 0) + '">' +
      "</span>" +
      '<span class="camp-rating-change" data-change-for="' + esc(key) + '"></span>' +
      "</label>";
  }

  function clampValue(value, min, max) {
    return Math.max(numberValue(min), Math.min(numberValue(max), numberValue(value)));
  }

  function renderPointChange(input) {
    var key = input.getAttribute("data-key");
    var current = input.getAttribute("data-current");
    var delta = numberValue(input.value);
    var target = document.querySelector('[data-change-for="' + key + '"]');
    if (!target) return;
    if (current === "") {
      target.textContent = delta ? signed(delta) : "0";
      return;
    }
    if (numberValue(current) + delta > 100) {
      target.textContent = numberValue(current) + " -> 100+; ask in #help for real rating";
      return;
    }
    target.textContent = numberValue(current) + " -> " + (numberValue(current) + delta);
  }

  function syncPointInputs(source) {
    var key = source.getAttribute("data-key");
    var min = source.getAttribute("min");
    var max = source.getAttribute("max");
    var value = clampValue(source.value, min, max);
    document.querySelectorAll('.camp-point-input[data-key="' + key + '"], .camp-range-value[data-key="' + key + '"]').forEach(function (input) {
      input.value = value;
      if (input.classList.contains("camp-point-input")) renderPointChange(input);
    });
  }

  function bindPointInputs() {
    Array.prototype.slice.call(document.querySelectorAll(".camp-point-input, .camp-range-value")).forEach(function (input) {
      input.addEventListener("input", function () {
        syncPointInputs(input);
      });
      if (input.classList.contains("camp-point-input")) renderPointChange(input);
    });
  }

  function renderDetails() {
    var type = selectedCampType();
    var player = selectedPlayer();
    var details = byId("campDetails");
    var help = byId("campHelp");
    var html = "";
    var budget;

    byId("injuryMode").closest(".camp-control").style.display = type === "injury" ? "grid" : "none";

    if (type === "regular") {
      html = '<div class="camp-point-grid">' + SKILLS.map(function (skill) {
        return inputMarkup(skill, skill, 0, 0, 10, player ? player[skill] : "");
      }).join("") + "</div>";
      help.textContent = "Regular Camp is +10 total points, with no more than +5 in Qkn, Jmp, Str, and Sta combined.";
    } else if (type === "tendency") {
      html = '<div class="camp-point-grid camp-point-grid--tendency">' + TENDENCIES.map(function (tendency) {
        return inputMarkup(tendency.key, tendency.label, 0, -10, 10);
      }).join("") + "</div>";
      help.textContent = "Tendency Camp can move up to 10 total points across 3pt tendency, fouling, and injury avoidance.";
    } else if (type === "development") {
      budget = potentialBudget(player);
      html = '<div class="camp-point-grid">' + DEVELOPMENT_SKILLS.map(function (skill) {
        return inputMarkup(skill, skill, 0, 0, budget || 10, player ? player[skill] : "");
      }).join("") + "</div>";
      help.textContent = budget
        ? "Development Camp budget for this player is +" + budget + " skills-only points."
        : "This player's potential colour is not Green, Yellow, or Orange, so the tool will warn if used.";
    } else if (type === "injury") {
      html = '<p class="camp-mini-note">Use the Injury Option selector above. Injury Camps spend the team injury slot and require -10 Injury Avoidance.</p>';
      help.textContent = player && isPlayerInjured(player)
        ? "This player appears in the injury feed."
        : "This player is not currently listed in the injury feed, so the tool will warn.";
    } else {
      html = '<div class="camp-point-grid">' + SKILLS.map(function (skill) {
        return inputMarkup(skill, skill, 0, 0, 3, player ? player[skill] : "");
      }).join("") + "</div>";
      help.textContent = "Media Camps are unlimited in this planner. Each entry should be +3 to one skill.";
    }

    details.innerHTML = html;
    bindPointInputs();
  }

  function renderSummary() {
    var counts = allocationCounts();
    var chips = [
      ["Regular", counts.regular + "/3", counts.regular > REGULAR_LIMIT],
      ["Tendency", counts.tendency + "/2", counts.tendency > TENDENCY_LIMIT],
      ["Development", counts.development + "/2", counts.development > DEVELOPMENT_LIMIT],
      ["Injury", counts.injury + "/1", counts.injury > INJURY_LIMIT],
      ["Media", String(counts.media), false]
    ];
    byId("allocationSummary").innerHTML = chips.map(function (chip) {
      return '<div class="camp-chip' + (chip[2] ? " is-over" : "") + '"><span>' + esc(chip[0]) + '</span><strong>' + esc(chip[1]) + "</strong></div>";
    }).join("");
  }

  function renderEntries() {
    var root = byId("entryList");
    var labeled = entriesWithLabels();
    byId("entryStatus").textContent = state.entries.length ? state.entries.length + " camps added" : "No camps added";

    if (!state.entries.length) {
      root.innerHTML = '<div class="camp-empty">No camps added yet.</div>';
      return;
    }

    root.innerHTML = labeled.map(function (item, index) {
      var player = getPlayer(item.entry.playerId);
      return '<article class="camp-entry">' +
        '<div class="camp-entry-head">' +
          '<div><div class="camp-entry-name">' + esc(player ? player.name : "Unknown Player") + '</div>' +
          '<div class="camp-entry-meta">' + esc(item.label) + '</div></div>' +
          '<button class="camp-button camp-button--danger" type="button" data-remove-entry="' + index + '">Remove</button>' +
        '</div>' +
        '<div class="camp-entry-lines">' + esc(item.line || "No detail line") + '</div>' +
      '</article>';
    }).join("");

    Array.prototype.slice.call(root.querySelectorAll("[data-remove-entry]")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.entries.splice(numberValue(button.getAttribute("data-remove-entry")), 1);
        savePlan();
        render();
      });
    });
  }

  function renderWarnings() {
    var warnings = warningList();
    byId("warningStatus").textContent = warnings.length === 1 && warnings[0].good ? "No warnings" : warnings.length + " warnings";
    byId("warningList").innerHTML = warnings.map(function (warning) {
      return '<li class="' + (warning.good ? "is-good" : (warning.bad ? "is-bad" : "")) + '">' + esc(warning.text) + "</li>";
    }).join("");
  }

  function renderOutput() {
    byId("templateOutput").value = templateText();
  }

  function renderTrackerStatus() {
    if (state.dataError) {
      byId("trackerStatus").textContent = "League data unavailable";
    } else if (state.trackerLoaded) {
      byId("trackerStatus").textContent = "Career tracker loaded";
    } else if (state.trackerError) {
      byId("trackerStatus").textContent = "Tracker unavailable";
    } else {
      byId("trackerStatus").textContent = "Loading career tracker";
    }
  }

  function render() {
    renderTeamPicker();
    renderTeamLink();
    renderPlayerPicker();
    renderDetails();
    renderSummary();
    renderEntries();
    renderWarnings();
    renderOutput();
    renderTrackerStatus();
    updateTeamColor();
  }

  function addCamp() {
    var type = selectedCampType();
    var player = selectedPlayer();
    var entry;
    if (!player) return;

    entry = {
      id: Date.now() + "-" + Math.random().toString(36).slice(2),
      type: type,
      playerId: playerKey(player)
    };

    if (type === "regular") {
      entry.points = pointValues(".camp-point-input");
    } else if (type === "tendency") {
      entry.points = pointValues(".camp-point-input");
    } else if (type === "development") {
      entry.points = pointValues(".camp-point-input");
    } else if (type === "injury") {
      entry.injuryMode = byId("injuryMode").value === "painkillers" ? "painkillers" : "rehab";
    } else if (type === "media") {
      entry.points = pointValues(".camp-point-input");
    }

    state.entries.push(entry);
    savePlan();
    render();
  }

  function bindEvents() {
    byId("teamSelect").addEventListener("change", function () {
      state.selectedTeam = byId("teamSelect").value;
      state.entries = state.entries.filter(function (entry) {
        var player = getPlayer(entry.playerId);
        return player && player.team === state.selectedTeam;
      });
      savePlan();
      render();
    });
    byId("campType").addEventListener("change", renderDetails);
    byId("playerSelect").addEventListener("change", function () {
      renderDetails();
      renderPlayerLink();
    });
    byId("injuryMode").addEventListener("change", renderDetails);
    byId("addCampButton").addEventListener("click", addCamp);
    byId("clearTemplateButton").addEventListener("click", function () {
      byId("templateOutput").value = "";
      byId("copyStatus").textContent = "Template text cleared";
      window.setTimeout(function () { byId("copyStatus").textContent = "Ready to copy"; }, 1600);
    });
    byId("copyButton").addEventListener("click", function () {
      var output = byId("templateOutput");
      output.focus();
      output.select();
      navigator.clipboard.writeText(output.value).then(function () {
        byId("copyStatus").textContent = "Copied";
        window.setTimeout(function () { byId("copyStatus").textContent = "Ready to copy"; }, 1600);
      }).catch(function () {
        document.execCommand("copy");
        byId("copyStatus").textContent = "Copied";
        window.setTimeout(function () { byId("copyStatus").textContent = "Ready to copy"; }, 1600);
      });
    });
  }

  function initialize(data) {
    state.players = data[0] || [];
    state.teams = (data[1] || []).slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    });
    state.injuries = data[2] && Array.isArray(data[2].injuries) ? data[2].injuries : [];
    state.seasonKey = computeSeasonKey(state.players);
    restorePlan();
    if (!state.selectedTeam) state.selectedTeam = favoriteTeamId();
    if (!state.teams.some(function (team) { return team.id === state.selectedTeam; })) {
      state.selectedTeam = state.teams[0] ? state.teams[0].id : "";
      state.entries = [];
    }
    renderCampTypePicker();
    bindEvents();
    render();
  }

  Promise.all([
    loadJson(PLAYERS_PATH),
    loadJson(TEAMS_PATH),
    loadJson(INJURIES_PATH),
    loadTracker()
  ]).then(function (data) {
    initialize(data);
  }).catch(function (error) {
    state.dataError = error && error.message ? error.message : "Unable to load camp planner data.";
    renderCampTypePicker();
    bindEvents();
    render();
  });
})();
