(function () {
  "use strict";

  var SETTINGS_KEY = "leagueSiteSettings";
  var DEFAULT_VIEWPORT = "width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes";
  var ROSTER_VIEWPORT = "width=500, initial-scale=1.0, minimum-scale=0.85, maximum-scale=5.0, user-scalable=yes";
  var SITE_ROOT_PATH = getSiteRootPath();
  var jsonPromiseCache = {};
  var ABSOLUTE_PATHS = {
    eslMedia: toSitePath("00-eslmedia/homepage.html"),
    eslMediaLogo: toSitePath("00-eslmedia/content/article images/ESLM.png"),
    eslReference: toSitePath("00-assets/html/history/index.htm"),
    depthCharts: toSitePath("00-assets/html/depthcharts.htm"),
    tradeTool: toSitePath("00-assets/html/trade-tool.htm"),
    youthIntake: toSitePath("00-assets/html/youth-intake.htm"),
    unifiedLeaders: toSitePath("00-assets/html/unified-leaders.htm"),
    unifiedStandings: toSitePath("00-assets/html/unified-standings.htm"),
    unifiedTeamLeaders: toSitePath("00-assets/html/unified-team-leaders.htm"),
    settings: toSitePath("00-assets/html/settings.htm"),
    mainIndex: toSitePath("index.htm"),
    leagueDashboard: toSitePath("00-assets/html/league%20dashboard.htm"),
    leagueLogo: toSitePath("00-assets/images/ESLcropped-removebg-preview.png"),
    supercupIndex: toSitePath("00-SuperCup/index.htm"),
    supercupDashboard: toSitePath("00-assets/html/supercup-dashboard.htm"),
    supercupKnockout: toSitePath("00-assets/html/supercup-knockout.htm"),
    supercupLogo: toSitePath("00-assets/images/eslsupercup.png")
  };

  function getSiteRootPath() {
    var path = String(window.location.pathname || "").replace(/\\/g, "/");
    var markers = [
      "/00-assets/",
      "/00-SuperCup/",
      "/00-eslmedia/",
      "/players/",
      "/rosters/",
      "/boxes/"
    ];
    var index = -1;
    var i;

    for (i = 0; i < markers.length; i += 1) {
      index = path.toLowerCase().indexOf(markers[i].toLowerCase());
      if (index >= 0) {
        return index > 0 ? path.slice(0, index) : "";
      }
    }

    index = path.lastIndexOf("/");
    return index > 0 ? path.slice(0, index) : "";
  }

  function toSitePath(relativePath) {
    var cleanPath = String(relativePath || "").replace(/^\/+/, "");
    return (SITE_ROOT_PATH ? SITE_ROOT_PATH + "/" : "/") + cleanPath;
  }

  function getSettings() {
    try {
      return JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function saveSettings(settings) {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings || {}));
  }

  function ensureViewport(content) {
    var viewport = document.querySelector('meta[name="viewport"]');

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.name = "viewport";
      document.head.appendChild(viewport);
    }

    viewport.setAttribute("content", content);
  }

  function isNestedPage() {
    return /\/(players|rosters|boxes)\//i.test(window.location.pathname);
  }

  function isAssetHtmlPage() {
    return /\/00-assets\/html\//i.test(window.location.pathname) || /\\00-assets\\html\\/i.test(window.location.pathname);
  }

  function getBuildJsonPath(filename) {
    if (isNestedPage()) {
      return "../00-build/database/" + filename;
    }

    if (isAssetHtmlPage()) {
      return "../../00-build/database/" + filename;
    }

    return "00-build/database/" + filename;
  }

  function normalizePlayerUrl(url) {
    if (!url) {
      return "#";
    }

    if (!isNestedPage() && url.indexOf("../") === 0) {
      return "./" + url.slice(3);
    }

    return url;
  }

  function loadJsonData(filename) {
    if (!jsonPromiseCache[filename]) {
      var jsonPath = getBuildJsonPath(filename);
      jsonPromiseCache[filename] = fetch(jsonPath)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Failed to load " + filename);
          }
          return response.json();
        })
        .catch(function () {
          return loadJsonDataFromFrame(jsonPath);
        });
    }

    return jsonPromiseCache[filename];
  }

  function loadJsonDataFromFrame(jsonPath) {
    return new Promise(function (resolve, reject) {
      var frame = document.createElement("iframe");
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      frame.src = jsonPath;

      frame.addEventListener("load", function () {
        try {
          var frameDocument = frame.contentDocument || frame.contentWindow.document;
          var raw = "";

          if (frameDocument) {
            if (frameDocument.body && frameDocument.body.textContent) {
              raw = frameDocument.body.textContent;
            }

            if (!raw && frameDocument.documentElement && frameDocument.documentElement.textContent) {
              raw = frameDocument.documentElement.textContent;
            }

            if (!raw) {
              var pre = frameDocument.querySelector("pre");
              raw = pre && pre.textContent ? pre.textContent : "";
            }
          }

          frame.remove();
          raw = String(raw || "").replace(/^\uFEFF/, "").trim();

          if (!raw) {
            reject(new Error("No player data found"));
            return;
          }

          resolve(JSON.parse(raw));
        } catch (error) {
          frame.remove();
          reject(error);
        }
      });

      frame.addEventListener("error", function () {
        frame.remove();
        reject(new Error("Unable to load player data"));
      });

      document.body.appendChild(frame);
    });
  }

  function shouldAttachStandingsSearch() {
    return /\/standings\.htm$/i.test(window.location.pathname) || /\\standings\.htm$/i.test(window.location.pathname);
  }

  function isWaiverWirePage() {
    return /\/waiverwire\.htm$/i.test(window.location.pathname) || /\\waiverwire\.htm$/i.test(window.location.pathname);
  }

  function isMenuPage() {
    return /\/menu\.htm$/i.test(window.location.pathname) || /\\menu\.htm$/i.test(window.location.pathname);
  }

  function isSettingsPage() {
    return /\/settings\.htm$/i.test(window.location.pathname) || /\\settings\.htm$/i.test(window.location.pathname);
  }

  function isSuperCupPage() {
    return /(?:\/|\\)00-supercup(?:\/|\\)/i.test(window.location.pathname);
  }

  function usesSuperCupPlayerPages() {
    var path = String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();

    return path.indexOf("/00-supercup/") !== -1 ||
      /\/00-assets\/html\/(?:supercup-[^/]+|unified-(?:player|roster)-supercup)\.htm$/.test(path);
  }

  function isPlayerPage() {
    return /\/players\/player\d+\.htm$/i.test(window.location.pathname) || /\\players\\player\d+\.htm$/i.test(window.location.pathname);
  }

  function isRosterPage() {
    return /\/rosters\/roster\d+\.htm$/i.test(window.location.pathname) || /\\rosters\\roster\d+\.htm$/i.test(window.location.pathname);
  }

  function shouldUseLegacyViewport() {
    var path = window.location.pathname;
    var rootLegacyPagePattern = /\/(schedule|leaders|playoffleaders|teamleaders|transactions|injuries|freeagents|potentialfreeagents|capreport|draft|staff|awards|seasonawards|champs|humancoaches)\.htm$/i;
    var nestedLegacyPagePattern = /\/(players|boxes|coaches)\/.+\.htm$/i;
    var windowsRootLegacyPagePattern = /\\(schedule|leaders|playoffleaders|teamleaders|transactions|injuries|freeagents|potentialfreeagents|capreport|draft|staff|awards|seasonawards|champs|humancoaches)\.htm$/i;
    var windowsNestedLegacyPagePattern = /\\(players|boxes|coaches)\\.+\.htm$/i;

    return rootLegacyPagePattern.test(path) || nestedLegacyPagePattern.test(path) || windowsRootLegacyPagePattern.test(path) || windowsNestedLegacyPagePattern.test(path);
  }

  function enableMenuFrameScroll() {
    var menuFrame = document.querySelector('frame[name="Options"], iframe[name="Options"]');

    if (!menuFrame) {
      return;
    }

    menuFrame.setAttribute("scrolling", "auto");
    menuFrame.style.overflow = "auto";
  }

  function getParentShellDocument() {
    try {
      if (window.parent === window || !window.parent.document) {
        return null;
      }

      return window.parent.document.querySelector(".site-shell") ? window.parent.document : null;
    } catch (error) {
      return null;
    }
  }

  function setParentMenuOpen(isOpen) {
    var parentDocument = getParentShellDocument();

    if (!parentDocument || !parentDocument.body) {
      return;
    }

    parentDocument.body.classList.toggle("league-menu-open", !!isOpen);
  }

  function syncDataFrameMenuButton() {
    try {
      if (
        window.parent &&
        window.parent.frames &&
        window.parent.frames.data &&
        typeof window.parent.frames.data.__syncLeagueMenuButton === "function"
      ) {
        window.parent.frames.data.__syncLeagueMenuButton();
      }
    } catch (error) {
      return;
    }
  }

  function isParentMenuOpen() {
    var parentDocument = getParentShellDocument();

    if (!parentDocument || !parentDocument.body) {
      return false;
    }

    return parentDocument.body.classList.contains("league-menu-open");
  }

  function normalizeName(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getPlayerFileFromUrl(url) {
    var str = String(url || "");
    var match = str.match(/(?:^|\/)(player\d+\.htm)(?:$|[?#])/i);
    if (match) {
      return match[1].toLowerCase();
    }
    var idMatch = str.match(/[?&]id=(player\d+)(?:&|#|$)/i);
    if (idMatch) {
      return idMatch[1].toLowerCase() + ".htm";
    }
    return "";
  }

  function prefersClassicPlayerPages() {
    return getSettings().playerPageDestination === "classic";
  }

  function getUnifiedPlayerPageHref(id) {
    var isSuperCupPlayerContext = usesSuperCupPlayerPages();
    var pageName = isSuperCupPlayerContext ? "unified-player-supercup.htm" : "unified-player.htm";

    if (isAssetHtmlPage()) {
      return "./" + pageName + "?id=" + encodeURIComponent(id);
    }

    if (isNestedPage()) {
      if (isSuperCupPlayerContext) {
        return "../../00-assets/html/" + pageName + "?id=" + encodeURIComponent(id);
      }
      return "../00-assets/html/" + pageName + "?id=" + encodeURIComponent(id);
    }

    if (isSuperCupPlayerContext) {
      return "../00-assets/html/" + pageName + "?id=" + encodeURIComponent(id);
    }

    return "./00-assets/html/" + pageName + "?id=" + encodeURIComponent(id);
  }

  function getPlayerPageUrl(url) {
    var raw = String(url || "");
    if (prefersClassicPlayerPages()) {
      var idFromUnified = raw.match(/[?&]id=(player\d+)(?:&|#|$)/i);
      if (idFromUnified) {
        return normalizePlayerUrl("../players/" + idFromUnified[1].toLowerCase() + ".htm");
      }
      return normalizePlayerUrl(raw);
    }

    var file = getPlayerFileFromUrl(url);
    var id = file ? file.replace(/\.htm$/i, "") : "";

    if (!id) {
      return normalizePlayerUrl(url);
    }

    return getUnifiedPlayerPageHref(id);
  }

  function buildTeamMap(teams) {
    return (teams || []).reduce(function (map, team) {
      if (team && team.id) {
        map[team.id] = team.name || team.id;
      }
      return map;
    }, {});
  }

  function enrichPlayers(players, teamMap) {
    return (players || []).map(function (player) {
      var copy = {};

      Object.keys(player || {}).forEach(function (key) {
        copy[key] = player[key];
      });

      copy.teamName = teamMap[player.team] || player.team || "";
      return copy;
    });
  }

  function renderResults(dropdown, matches, navigateToPlayer) {
    dropdown.innerHTML = "";

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "player-search__empty";
      empty.textContent = "No matching players";
      dropdown.appendChild(empty);
      dropdown.hidden = false;
      return;
    }

    matches.forEach(function (player) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "player-search__option";
      var metaBits = [player.teamName, player.pos ? player.pos : null, player.age ? "Age " + player.age : null].filter(Boolean);
      var submetaBits = [player.ht, player.wt ? player.wt + " lbs" : null].filter(Boolean);
      option.innerHTML =
        '<span class="player-search__name">' + escapeHtml(player.name) + "</span>" +
        '<span class="player-search__meta">' +
        escapeHtml(metaBits.join(" | ")) +
        "</span>";
      if (submetaBits.length) {
        option.innerHTML +=
          '<span class="player-search__submeta">' +
          escapeHtml(submetaBits.join(" | ")) +
          "</span>";
      }
      option.addEventListener("click", function () {
        navigateToPlayer(player);
      });
      dropdown.appendChild(option);
    });

    dropdown.hidden = false;
  }

  window.LeagueSiteCore = {
    SETTINGS_KEY: SETTINGS_KEY,
    DEFAULT_VIEWPORT: DEFAULT_VIEWPORT,
    ROSTER_VIEWPORT: ROSTER_VIEWPORT,
    paths: ABSOLUTE_PATHS,
    getSettings: getSettings,
    saveSettings: saveSettings,
    ensureViewport: ensureViewport,
    isNestedPage: isNestedPage,
    isAssetHtmlPage: isAssetHtmlPage,
    getBuildJsonPath: getBuildJsonPath,
    normalizePlayerUrl: normalizePlayerUrl,
    loadJsonData: loadJsonData,
    shouldAttachStandingsSearch: shouldAttachStandingsSearch,
    isWaiverWirePage: isWaiverWirePage,
    isMenuPage: isMenuPage,
    isSettingsPage: isSettingsPage,
    isSuperCupPage: isSuperCupPage,
    usesSuperCupPlayerPages: usesSuperCupPlayerPages,
    isPlayerPage: isPlayerPage,
    isRosterPage: isRosterPage,
    shouldUseLegacyViewport: shouldUseLegacyViewport,
    enableMenuFrameScroll: enableMenuFrameScroll,
    getParentShellDocument: getParentShellDocument,
    setParentMenuOpen: setParentMenuOpen,
    syncDataFrameMenuButton: syncDataFrameMenuButton,
    isParentMenuOpen: isParentMenuOpen,
    normalizeName: normalizeName,
    escapeHtml: escapeHtml,
    getPlayerFileFromUrl: getPlayerFileFromUrl,
    prefersClassicPlayerPages: prefersClassicPlayerPages,
    getPlayerPageUrl: getPlayerPageUrl,
    buildTeamMap: buildTeamMap,
    enrichPlayers: enrichPlayers,
    renderResults: renderResults
  };
})();
