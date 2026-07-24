(function () {
  "use strict";

  var STYLE_ID = "league-index-shell-styles";
  var BREAKPOINT = 760;
  var SETTINGS_KEY = "leagueSiteSettings";
  var HEADER_SEARCH_LIMIT = 8;
  var tickerAutoFrame = 0;
  var tickerAutoPosition = 0;
  var tickerFavoriteOnly = false;
  var tickerPreviewMode = false;
  var tickerCompletedGames = [];
  var tickerScheduledGames = [];

  function isSuperCupIndexPage() {
    return /(?:\/|\\)00-supercup(?:\/|\\)index\.htm$/i.test(window.location.pathname);
  }

  function getSettings() {
    if (isSuperCupIndexPage()) {
      return {};
    }

    try {
      return JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function getDefaultPage() {
    var settings = getSettings();

    if (isSuperCupIndexPage()) {
      return getRepoScopedPath("00-assets/html/supercup-dashboard.htm");
    }

    if (settings.defaultPage === "__unified_team_page__" && settings.defaultTeamPage) {
      return "00-assets/html/unified-roster.htm?file=" + encodeURIComponent(settings.defaultTeamPage);
    }
    return settings.defaultPage || "standings.htm";
  }

  function isCompactWidth() {
    var screenWidth = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    return Math.min(window.innerWidth, screenWidth) <= BREAKPOINT;
  }

  function getRepoScopedPath(relativePath) {
    var path = String(window.location.pathname || "").replace(/\\/g, "/");
    var rootPath = path
      .replace(/\/00-SuperCup\/index\.htm$/i, "")
      .replace(/\/index\.htm$/i, "");
    var cleanPath = String(relativePath || "").replace(/^\/+/, "");

    return (rootPath ? rootPath + "/" : "/") + cleanPath;
  }

  function getCorePath(key, fallback) {
    if (window.LeagueSiteCore && window.LeagueSiteCore.paths && window.LeagueSiteCore.paths[key]) {
      return window.LeagueSiteCore.paths[key];
    }

    return getRepoScopedPath(fallback);
  }

  function getStatusFromDocumentTitle() {
    var match = String(document.title || "").match(/\b(Pre[-\s]?Offseason|Offseason Preview|Sim\s*\d+|FA\s*[12]|FA\s*3(?:\s*\/\s*TC)?|TC|Preseason)\b/i);
    var label;

    if (!match) {
      return "";
    }

    label = match[1].replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
    if (/^(pre[-\s]?offseason|offseason preview)$/i.test(label)) {
      return "Sim 6";
    }
    if (/^sim\s*\d+$/i.test(label)) {
      return "Sim " + label.match(/\d+/)[0];
    }
    if (/^fa\s*[12]$/i.test(label)) {
      return "FA" + label.match(/[123]/)[0];
    }
    if (/^fa\s*3\/tc$/i.test(label)) {
      return "FA3/TC";
    }
    if (/^fa\s*3$/i.test(label)) {
      return "FA3";
    }
    if (/^tc$/i.test(label)) {
      return "TC";
    }
    if (/^preseason$/i.test(label)) {
      return "Preseason";
    }

    return "";
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "html, body { height: 100%; margin: 0; }",
      "body { background: #f7f9fc; overflow: hidden; overflow-x: hidden; padding: 0; }",
      ":root { --site-sidebar-width: 150px; --site-topbar-height: 58px; --site-navy: #111b36; --site-blue: #5ca8ff; --site-line: rgba(148, 163, 184, 0.36); }",
      ".site-shell { display: grid; grid-template-columns: var(--site-sidebar-width) minmax(0, 1fr); grid-template-rows: var(--site-topbar-height) minmax(0, 1fr); height: 100vh; left: 0; position: fixed; right: 0; top: 0; transition: grid-template-columns 0.24s ease; width: 100%; }",
      "body.league-menu-closed .site-shell { grid-template-columns: 0 minmax(0, 1fr); }",
      ".site-topbar { background: #f7f9fc; border-bottom: 0; display: grid; grid-column: 1 / -1; grid-row: 1; grid-template-columns: var(--site-sidebar-width) minmax(0, 1fr) minmax(310px, 430px); min-width: 0; overflow: visible; position: relative; z-index: 25; }",
      ".site-topbar-brand { align-items: center; background: var(--site-navy); border-right: 0; display: flex; height: 100%; justify-content: center; padding: 0 8px; position: relative; }",
      ".site-topbar-logo-link { align-items: center; display: flex; justify-content: center; min-width: 0; position: absolute; left: 50%; text-decoration: none; top: 50%; transform: translate(-50%, -50%); }",
      ".site-topbar-logo { display: block; filter: brightness(0) invert(1); height: 38px; object-fit: contain; width: 38px; }",
      ".site-topbar-logo--supercup { filter: brightness(0) saturate(100%) invert(76%) sepia(39%) saturate(744%) hue-rotate(356deg) brightness(95%) contrast(94%); }",
      ".site-ticker { align-items: stretch; box-shadow: inset 0 -1px 0 rgba(17, 27, 54, 0.18); cursor: grab; display: flex; min-width: 0; overflow-x: auto; overflow-y: hidden; position: relative; scrollbar-width: none; }",
      ".site-ticker::-webkit-scrollbar { display: none; }",
      ".site-ticker.is-dragging { cursor: grabbing; user-select: none; }",
      ".site-ticker-track { align-items: stretch; display: flex; min-width: max-content; }",
      ".site-ticker-filter { align-items: center; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .24); border-radius: 7px; color: #ffffff; cursor: pointer; display: flex; font: 900 9px/1 Inter, Tahoma, Arial, sans-serif; height: 28px; justify-content: center; padding: 0 7px; position: absolute; right: 7px; text-transform: uppercase; top: 50%; transform: translateY(-50%); z-index: 31; }",
      ".site-ticker-filter[hidden] { display: none; }",
      ".site-ticker-filter:hover { background: rgba(142, 197, 255, .18); border-color: rgba(142, 197, 255, .54); color: #8ec5ff; }",
      ".site-ticker-filter.is-active { background: #1d5ea8; border-color: #8ec5ff; color: #ffffff; }",
      ".site-ticker-label { align-items: center; align-self: stretch; background: #f7f9fc; border: 0; border-right: 1px solid #d8e1ee; color: #1d4f91; cursor: pointer; display: flex; flex: 0 0 auto; font: 900 10px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: .12em; padding: 0 12px; text-transform: uppercase; }",
      ".site-ticker-label:hover, .site-ticker-label:focus-visible { background: #edf5ff; outline: 0; }",
      ".site-ticker-label:disabled { cursor: default; opacity: 1; }",
      ".site-score-card { align-items: center; background: #f7f9fc; border-right: 1px solid #d8e1ee; color: #111827; cursor: pointer; display: grid; flex: 0 0 auto; gap: 4px; grid-template-columns: 39px 20px 39px; height: 100%; justify-content: center; min-width: 108px; padding: 3px 7px 2px; text-decoration: none; }",
      ".site-score-card:hover { background: #edf5ff; }",
      ".site-score-team { align-items: center; display: grid; gap: 1px; grid-template-rows: 20px 11px 18px; justify-items: center; min-width: 0; }",
      ".site-score-logo { border-radius: 50%; display: block; height: 19px; object-fit: cover; width: 19px; }",
      ".site-score-abbr { color: #5b6472; font: 900 11px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: .04em; text-align: center; text-transform: uppercase; }",
      ".site-score-pts { color: #111827; font: 950 18px/1 Inter, Tahoma, Arial, sans-serif; text-align: center; }",
      ".site-score-team.is-winner .site-score-pts { color: #1d5ea8; }",
      ".site-score-mid { align-items: center; color: #7b8492; display: grid; gap: 2px; grid-template-rows: 9px 12px; justify-items: center; min-width: 0; }",
      ".site-score-date { font: 950 8px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: .02em; text-align: center; }",
      ".site-score-sep { font: 900 14px/1 Inter, Tahoma, Arial, sans-serif; text-align: center; }",
      ".site-score-card--preview .site-score-team { grid-template-rows: 20px 18px; }",
      ".site-score-card--preview .site-score-sep { color: #1d5ea8; font-size: 16px; }",
      ".site-ticker-empty { align-items: center; color: #5b6472; display: flex; font: 800 12px/1 Inter, Tahoma, Arial, sans-serif; padding: 0 14px; }",
      ".site-shell-search { align-items: center; background: #f7f9fc; box-shadow: inset 0 -1px 0 rgba(17, 27, 54, 0.18); display: flex; gap: 8px; min-width: 0; padding: 0 12px; position: relative; }",
      ".site-shell-search-status { align-items: center; background: #edf5ff; border: 1px solid #c9d3e1; border-radius: 7px; color: #1d4f91; display: flex; flex: 0 0 auto; font: 950 10px/1 Inter, Tahoma, Arial, sans-serif; height: 34px; letter-spacing: .08em; padding: 0 9px; text-transform: uppercase; white-space: nowrap; }",
      ".site-shell-search-input { background: #ffffff; border: 1px solid #c9d3e1; border-radius: 7px; box-sizing: border-box; color: #0f172a; flex: 1 1 auto; font: 700 12px/1.2 Inter, Tahoma, Arial, sans-serif; height: 34px; min-width: 0; outline: none; padding: 0 10px; width: 100%; }",
      ".site-shell-search-input:focus { border-color: #1d5ea8; box-shadow: 0 0 0 3px rgba(29, 94, 168, .14); }",
      ".site-shell-search-results { background: #ffffff; border: 1px solid #c9d3e1; border-radius: 9px; box-shadow: 0 16px 32px rgba(15, 23, 42, .18); display: none; max-height: min(70vh, 420px); overflow: auto; padding: 6px; position: absolute; right: 12px; top: calc(100% + 6px); width: min(420px, calc(100vw - 24px)); z-index: 80; }",
      ".site-shell-search.is-open .site-shell-search-results { display: block; }",
      ".site-shell-search-result { border-radius: 7px; color: #0f172a; display: block; padding: 8px 9px; text-decoration: none; }",
      ".site-shell-search-result:hover, .site-shell-search-result:focus { background: #edf5ff; outline: none; }",
      ".site-shell-search-name { display: block; font: 900 12px/1.2 Inter, Tahoma, Arial, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".site-shell-search-meta { color: #64748b; display: block; font: 700 10px/1.35 Inter, Tahoma, Arial, sans-serif; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }",
      ".site-shell-search-empty { color: #64748b; font: 700 12px/1.4 Inter, Tahoma, Arial, sans-serif; padding: 9px; }",
      "html.league-theme-dark .site-topbar, html.league-theme-dark .site-ticker, html.league-theme-dark .site-score-card { background: #0d1118; }",
      "html.league-theme-dark .site-score-card, html.league-theme-dark .site-ticker-label { border-color: rgba(148, 163, 184, .24); }",
      "html.league-theme-dark .site-score-card:hover { background: #151b25; }",
      "html.league-theme-dark .site-score-abbr, html.league-theme-dark .site-score-mid, html.league-theme-dark .site-ticker-empty { color: #a9b6c8; }",
      "html.league-theme-dark .site-score-pts { color: #edf4ff; }",
      "html.league-theme-dark .site-score-team.is-winner .site-score-pts, html.league-theme-dark .site-ticker-label { color: #8ec5ff; }",
      "html.league-theme-dark .site-ticker-label { background: #0d1118; }",
      "html.league-theme-dark .site-ticker-label:hover, html.league-theme-dark .site-ticker-label:focus-visible { background: #151b25; }",
      "html.league-theme-dark .site-ticker-filter { background: rgba(255, 255, 255, .08); border-color: rgba(148, 163, 184, .34); color: #ffffff; }",
      "html.league-theme-dark .site-ticker-filter:hover { background: rgba(142, 197, 255, .18); color: #8ec5ff; }",
      "html.league-theme-dark .site-ticker-filter.is-active { background: #1d5ea8; border-color: #8ec5ff; color: #ffffff; }",
      "html.league-theme-dark .site-shell-search { background: #0d1118; box-shadow: inset 0 -1px 0 rgba(148, 163, 184, .24); }",
      "html.league-theme-dark .site-shell-search-status { background: #151b25; border-color: rgba(148, 163, 184, .34); color: #8ec5ff; }",
      "html.league-theme-dark .site-shell-search-input { background: #151b25; border-color: rgba(148, 163, 184, .34); color: #f3f7ff; }",
      "html.league-theme-dark .site-shell-search-results { background: #151b25; border-color: rgba(148, 163, 184, .28); box-shadow: 0 16px 32px rgba(0, 0, 0, .36); }",
      "html.league-theme-dark .site-shell-search-result { color: #edf4ff; }",
      "html.league-theme-dark .site-shell-search-result:hover, html.league-theme-dark .site-shell-search-result:focus { background: #1a2537; }",
      "html.league-theme-dark .site-shell-search-meta, html.league-theme-dark .site-shell-search-empty { color: #a9b6c8; }",
      ".site-sidebar { background: var(--site-navy); border-right: 0; grid-column: 1; grid-row: 2; height: 100%; max-width: 150px; min-width: 0; overflow: auto; position: relative; top: 0; transform: translateX(0); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: 150px; z-index: 10; }",
      "body.league-menu-closed .site-sidebar { border-right-color: transparent; overflow: hidden; transform: translateX(-100%); width: 0; }",
      ".site-frame { border: 0; display: block; height: 100%; width: 100%; }",
      ".site-content { grid-column: 2; grid-row: 2; min-width: 0; overflow: hidden; }",
      ".site-menu-toggle { align-items: center; background: transparent; border: 0; border-radius: 0; box-shadow: none; color: #ffffff; cursor: pointer; display: flex; font: 800 24px/1 Inter, Tahoma, Arial, sans-serif; height: 36px; justify-content: center; left: 8px; padding: 0; position: absolute; top: 50%; transform: translateY(-50%); width: 32px; z-index: 30; }",
      ".site-menu-toggle:hover { background: transparent; color: #8ec5ff; }",
      ".site-sidebar-backdrop { display: none; }",
      "body.league-menu-compact .site-shell { grid-template-columns: minmax(0, 1fr); }",
      "body.league-menu-compact .site-topbar { grid-template-columns: 112px minmax(0, 1fr); }",
      "body.league-menu-compact .site-shell-search { display: none; }",
      "body.league-menu-compact .site-content { grid-column: 1; }",
      "body.league-menu-compact .site-sidebar-backdrop { background: rgba(15, 23, 42, 0.36); bottom: 0; display: block; left: min(72vw, 240px); opacity: 0; pointer-events: none; position: fixed; right: 0; top: var(--site-topbar-height); transition: opacity 0.2s ease; z-index: 15; }",
      "body.league-menu-compact.league-menu-open .site-sidebar-backdrop { opacity: 1; pointer-events: auto; }",
      "body.league-menu-compact .site-sidebar { bottom: 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); max-width: 240px; position: fixed; top: var(--site-topbar-height); transform: translateX(-100%); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: min(72vw, 240px); z-index: 20; }",
      "body.league-menu-compact.league-menu-closed .site-sidebar { width: min(72vw, 240px); }",
      "body.league-menu-compact.league-menu-open .site-sidebar { transform: translateX(0); }",
      "@media (max-width: 760px) {",
      "  html, body { height: 100%; min-height: 100%; overflow: hidden; overflow-x: hidden; }",
      "  body { overflow: hidden; overflow-x: hidden; }",
      "  :root { --site-topbar-height: 56px; }",
      "  .site-shell { grid-template-columns: minmax(0, 1fr); grid-template-rows: var(--site-topbar-height) minmax(0, 1fr); height: 100dvh; left: 0; min-width: 0; position: fixed; right: 0; top: 0; width: 100%; }",
      "  .site-topbar { grid-template-columns: 108px minmax(0, 1fr); }",
      "  .site-topbar-brand { grid-column: 1; grid-row: 1; }",
      "  .site-ticker { display: none; }",
      "  .site-ticker-filter { display: none; }",
      "  .site-shell-search { display: flex; grid-column: 2; grid-row: 1; padding: 0 10px; }",
      "  .site-shell-search-status { display: none; }",
      "  body.league-menu-compact .site-shell-search { display: flex; }",
      "  .site-shell-search-results { left: 10px; right: 10px; top: calc(100% + 4px); width: auto; }",
      "  .site-topbar-brand { padding: 0 6px; }",
      "  .site-menu-toggle { left: 6px; }",
      "  .site-topbar-logo { height: 36px; width: 36px; }",
      "  .site-score-card { grid-template-columns: 36px 20px 36px; min-width: 104px; padding-left: 7px; padding-right: 7px; }",
      "  .site-score-pts { font-size: 17px; }",
      "  .site-ticker-label { display: none; }",
      "  .site-content { min-width: 0; overflow: hidden; }",
      "  .site-content .site-frame { min-width: 0; width: 100%; }",
      "  .site-sidebar-backdrop { background: rgba(15, 23, 42, 0.36); bottom: 0; display: block; left: min(72vw, 240px); opacity: 0; pointer-events: none; position: fixed; right: 0; top: var(--site-topbar-height); transition: opacity 0.2s ease; z-index: 15; }",
      "  body.league-menu-open .site-sidebar-backdrop { opacity: 1; pointer-events: auto; }",
      "  .site-sidebar { bottom: 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); max-width: 240px; position: fixed; top: var(--site-topbar-height); transform: translateX(-100%); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: min(72vw, 240px); z-index: 20; }",
      "  body.league-menu-closed .site-sidebar { width: min(72vw, 240px); }",
      "  body.league-menu-open .site-sidebar { transform: translateX(0); }",
      "}",
      "body.league-fluid-content .site-shell { min-width: 0 !important; width: 100vw !important; }",
      "body.league-fluid-content .site-content { min-width: 0 !important; overflow: hidden !important; }",
      "body.league-fluid-content .site-content .site-frame { min-width: 0 !important; width: 100% !important; }"
    ].join("");
    document.head.appendChild(style);
  }

  function makeFrame(className, name, src, title) {
    var frame = document.createElement("iframe");
    frame.className = className;
    frame.name = name;
    frame.src = src;
    frame.title = title;
    return frame;
  }

  function removeLegacyFrameset() {
    var frameset = document.querySelector("frameset");
    if (frameset && frameset.parentNode) {
      frameset.parentNode.removeChild(frameset);
    }
  }

  function ensureBody() {
    if (document.body && document.body.tagName.toLowerCase() !== "frameset") {
      return document.body;
    }

    if (document.body && document.body.parentNode) {
      document.body.parentNode.removeChild(document.body);
    }

    var body = document.createElement("body");
    document.documentElement.appendChild(body);
    return body;
  }

  function ensureShell() {
    var body = ensureBody();
    var existingShell = document.querySelector(".site-shell");

    if (existingShell) {
      return existingShell;
    }

    removeLegacyFrameset();
    body.innerHTML = "";

    var shell = document.createElement("div");
    var topbar = document.createElement("header");
    var brand = document.createElement("div");
    var logoLink = document.createElement("a");
    var logo = document.createElement("img");
    var ticker = document.createElement("section");
    var tickerFilter = document.createElement("button");
    var tickerTrack = document.createElement("div");
    var search = document.createElement("section");
    var searchStatus = document.createElement("div");
    var searchInput = document.createElement("input");
    var searchResults = document.createElement("div");
    var sidebar = document.createElement("aside");
    var content = document.createElement("main");
    var isSuperCup = isSuperCupIndexPage();

    shell.className = "site-shell";
    topbar.className = "site-topbar";
    brand.className = "site-topbar-brand";
    logoLink.className = "site-topbar-logo-link";
    logoLink.href = isSuperCup
      ? getCorePath("supercupDashboard", "00-assets/html/supercup-dashboard.htm")
      : getCorePath("leagueDashboard", "00-assets/html/league%20dashboard.htm");
    logoLink.target = "data";
    logoLink.setAttribute("aria-label", isSuperCup ? "Super Cup dashboard" : "League dashboard");
    logo.className = isSuperCup ? "site-topbar-logo site-topbar-logo--supercup" : "site-topbar-logo";
    logo.src = isSuperCup
      ? getCorePath("supercupLogo", "00-assets/images/eslsupercup.png")
      : getCorePath("leagueLogo", "00-assets/images/ESLcropped-removebg-preview.png");
    logo.alt = isSuperCup ? "ESL Super Cup" : "ESL";
    ticker.className = "site-ticker";
    ticker.setAttribute("aria-label", "Latest scores and upcoming previews");
    tickerFilter.className = "site-ticker-filter";
    tickerFilter.id = "siteTickerFilter";
    tickerFilter.type = "button";
    tickerFilter.textContent = "Fav";
    tickerFilter.setAttribute("aria-label", "Show only favorite team scores");
    tickerFilter.setAttribute("aria-pressed", "false");
    tickerTrack.className = "site-ticker-track";
    tickerTrack.id = "siteTickerTrack";
    tickerTrack.innerHTML = '<span class="site-ticker-empty">Scores loading</span>';
    search.className = "site-shell-search";
    search.id = "siteShellSearch";
    searchStatus.className = "site-shell-search-status";
    searchStatus.textContent = getStatusFromDocumentTitle() || "Sim 2 · Dec 1983";
    searchStatus.title = "Latest league status";
    searchInput.className = "site-shell-search-input";
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.placeholder = "Search pages, players or teams";
    searchInput.setAttribute("aria-label", "Search pages, players or teams");
    searchResults.className = "site-shell-search-results";
    searchResults.setAttribute("role", "listbox");
    sidebar.className = "site-sidebar";
    sidebar.setAttribute("aria-label", "League navigation");
    content.className = "site-content";

    logoLink.appendChild(logo);
    brand.appendChild(logoLink);
    brand.appendChild(tickerFilter);
    ticker.appendChild(tickerTrack);
    search.appendChild(searchStatus);
    search.appendChild(searchInput);
    search.appendChild(searchResults);
    topbar.appendChild(brand);
    topbar.appendChild(ticker);
    topbar.appendChild(search);
    sidebar.appendChild(makeFrame("site-frame", "Options", "menu.htm", "League navigation"));
    content.appendChild(makeFrame("site-frame", "data", getDefaultPage(), "League content"));
    shell.appendChild(topbar);
    shell.appendChild(sidebar);
    shell.appendChild(content);
    body.appendChild(shell);
    return shell;
  }

  function setOpen(isOpen) {
    var button = document.querySelector(".site-menu-toggle");
    var backdrop = document.querySelector(".site-sidebar-backdrop");
    var isNarrow = isCompactWidth();

    document.body.classList.toggle("league-menu-compact", isNarrow);
    document.body.classList.toggle("league-menu-open", isNarrow && isOpen);
    document.body.classList.toggle("league-menu-closed", !isOpen);

    if (button) {
      button.setAttribute("aria-expanded", String(isOpen));
    }

    if (backdrop) {
      backdrop.hidden = !(isNarrow && isOpen);
    }
  }

  function isOpen() {
    if (isCompactWidth()) {
      return document.body.classList.contains("league-menu-open");
    }

    return !document.body.classList.contains("league-menu-closed");
  }

  function closeAfterSidebarNavigation() {
    window.setTimeout(function () {
      setOpen(!isCompactWidth());
    }, 0);
  }

  function ensureMenuStylesheet(menuDocument) {
    var link;

    if (!menuDocument || menuDocument.querySelector('link[href*="00-assets/css/styles.css"]')) {
      return;
    }

    link = menuDocument.createElement("link");
    link.rel = "stylesheet";
    link.href = "00-assets/css/styles.css";
    (menuDocument.head || menuDocument.documentElement).appendChild(link);
  }

  function ensureMenuFrameChrome(menuDocument) {
    var style;

    if (!menuDocument || menuDocument.getElementById("league-menu-parent-chrome")) {
      return;
    }

    style = menuDocument.createElement("style");
    style.id = "league-menu-parent-chrome";
    style.textContent = ".league-menu-feature-row { display: none !important; }";
    (menuDocument.head || menuDocument.documentElement).appendChild(style);
  }

  function loadMenuScript(menuDocument, src) {
    return new Promise(function (resolve, reject) {
      var script;

      if (!menuDocument || menuDocument.querySelector('script[src*="' + src + '"]')) {
        resolve();
        return;
      }

      script = menuDocument.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      (menuDocument.head || menuDocument.documentElement).appendChild(script);
    });
  }

  function ensureRealMenuEnhancements(menuFrame, menuDocument) {
    if (!menuFrame || !menuDocument || menuFrame.dataset.realMenuLoading === "true") {
      return;
    }

    if (menuDocument.querySelector(".league-menu-shell")) {
      return;
    }

    menuFrame.dataset.realMenuLoading = "true";
    ensureMenuStylesheet(menuDocument);
    loadMenuScript(menuDocument, "00-assets/js/core.js")
      .then(function () {
        return loadMenuScript(menuDocument, "00-assets/js/settings.js");
      })
      .then(function () {
        return loadMenuScript(menuDocument, "00-assets/js/menu.js");
      })
      .then(function () {
        menuFrame.dataset.realMenuLoading = "false";
        ensureMenuFrameChrome(menuDocument);
      })
      .catch(function () {
        menuFrame.dataset.realMenuLoading = "false";
      });
  }

  function bindSidebarAutoClose() {
    var menuFrame = document.querySelector('iframe[name="Options"]');

    if (!menuFrame || menuFrame.dataset.autoCloseBound === "true") {
      return;
    }

    function bindMenuDocument() {
      var menuDocument;

      try {
        menuDocument = menuFrame.contentDocument || menuFrame.contentWindow.document;
      } catch (error) {
        return;
      }

      if (!menuDocument || menuDocument.documentElement.dataset.autoCloseBound === "true") {
        ensureRealMenuEnhancements(menuFrame, menuDocument);
        ensureMenuFrameChrome(menuDocument);
        return;
      }

      menuDocument.documentElement.dataset.autoCloseBound = "true";
      ensureRealMenuEnhancements(menuFrame, menuDocument);
      ensureMenuFrameChrome(menuDocument);
      menuDocument.addEventListener("click", function (event) {
        if (event.target && event.target.closest && event.target.closest("a")) {
          closeAfterSidebarNavigation();
        }
      }, true);
    }

    menuFrame.dataset.autoCloseBound = "true";
    menuFrame.addEventListener("load", bindMenuDocument);
    bindMenuDocument();
  }

  function ensureMenuControls() {
    var body = ensureBody();
    var brand = document.querySelector(".site-topbar-brand");
    var button = document.querySelector(".site-menu-toggle");
    var backdrop = document.querySelector(".site-sidebar-backdrop");

    if (!button) {
      button = document.createElement("button");
      button.className = "site-menu-toggle";
      button.type = "button";
      button.setAttribute("aria-label", "Toggle league menu");
      button.setAttribute("aria-expanded", "false");
      button.textContent = "\u2630";
      if (brand) {
        brand.insertBefore(button, brand.firstChild);
      } else {
        body.insertBefore(button, body.firstChild);
      }
    } else if (brand && button.parentNode !== brand) {
      brand.insertBefore(button, brand.firstChild);
    }

    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "site-sidebar-backdrop";
      backdrop.hidden = true;
      body.insertBefore(backdrop, document.querySelector(".site-shell"));
    }

    button.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    backdrop.addEventListener("click", function () {
      setOpen(false);
    });

    window.addEventListener("resize", function () {
      setOpen(isOpen());
    });

    setOpen(!isCompactWidth());
  }

  function loadJson(filename) {
    if (isSuperCupIndexPage()) {
      return fetch(getRepoScopedPath("00-build/database/supercup/" + filename)).then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load Super Cup " + filename);
        }
        return response.json();
      });
    }

    if (window.LeagueSiteCore && window.LeagueSiteCore.loadJsonData) {
      return window.LeagueSiteCore.loadJsonData(filename);
    }

    return fetch(getRepoScopedPath("00-build/database/" + filename)).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load " + filename);
      }
      return response.json();
    });
  }

  function escapeHtml(value) {
    if (window.LeagueSiteCore && window.LeagueSiteCore.escapeHtml) {
      return window.LeagueSiteCore.escapeHtml(value);
    }

    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var scheduleDateOrder = "dmy";

  function inferScheduleDateOrder(values) {
    var order = "";

    (values || []).some(function (value) {
      var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      var first;
      var second;

      if (!match) {
        return false;
      }

      first = Number(match[1]);
      second = Number(match[2]);
      if (first > 12 && second <= 12) {
        order = "dmy";
        return true;
      }
      if (second > 12 && first <= 12) {
        order = "mdy";
        return true;
      }
      return false;
    });

    // Fast Break exports use day/month/year, including fully ambiguous datasets.
    return order || "dmy";
  }

  function parseScheduleDate(value, dateOrder) {
    var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var order = dateOrder || scheduleDateOrder;
    var day;
    var month;

    if (!match) {
      return 0;
    }

    day = Number(order === "mdy" ? match[2] : match[1]);
    month = Number(order === "mdy" ? match[1] : match[2]);
    return new Date(Number(match[3]), month - 1, day).getTime();
  }

  function inferRegularSeasonSimNumber(period) {
    var month = Number(period && period.month);

    if (!month) {
      return "";
    }

    if (month >= 11) {
      return String(month - 10);
    }

    if (month <= 6) {
      return String(month + 2);
    }

    return "";
  }

  function formatDayMonthYear(value, dateOrder) {
    var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    var order = dateOrder || scheduleDateOrder;

    if (!match) {
      return "";
    }

    return [
      String(order === "mdy" ? match[2] : match[1]).padStart(2, "0"),
      String(order === "mdy" ? match[1] : match[2]).padStart(2, "0"),
      match[3]
    ].join("/");
  }

  function getLatestSimEndDate(results) {
    var dateOrder = inferScheduleDateOrder((results || []).map(function (game) {
      return game && game.date;
    }));
    var latest = (results || []).reduce(function (best, game) {
      var time = parseScheduleDate(game && game.date, dateOrder);

      if (!time || (best && time <= best.time)) {
        return best;
      }

      return {
        date: game.date,
        time: time
      };
    }, null);

    return latest ? formatDayMonthYear(latest.date, dateOrder) : "";
  }

  function updateLatestSimStatus() {
    var node = document.querySelector(".site-shell-search-status");
    var titleStatus = getStatusFromDocumentTitle();

    if (!node) {
      return;
    }

    loadJson("monthly/latest_sim_results.json")
      .then(function (data) {
        var period = data && data.period ? data.period : {};
        var simNumber = inferRegularSeasonSimNumber(period);
        var periodLabel = period.label || "";
        var updatedThrough = getLatestSimEndDate(data && data.results);
        var labelParts = [];

        if (titleStatus) {
          labelParts.push(titleStatus);
        } else if (simNumber) {
          labelParts.push("Sim " + simNumber);
        }
        if (periodLabel) {
          labelParts.push(periodLabel.replace(/^([A-Za-z]{3})[a-z]+/, "$1"));
        }

        if (labelParts.length) {
          node.textContent = labelParts.join(" · ");
        }
        if (updatedThrough) {
          node.title = "Latest sim: updated through " + updatedThrough;
        }
      })
      .catch(function () {
        node.textContent = titleStatus || "Sim 2 · Dec 1983";
        node.title = titleStatus ? "Latest league status" : "Latest sim: updated through 31/12/1983";
      });
  }

  function getTeamTickerData(name) {
    var clean = String(name || "").trim();
    var aliases = {
      "AC Milan": ["ACM", "acmilan"],
      "AFC Richmond": ["AFC", "richmond"],
      "Ajax": ["AJX", "ajax"],
      "Aston Villa": ["AVL", "astonvilla"],
      "Atletico Madrid": ["ATM", "atletico"],
      "Barcelona": ["BAR", "barcelona"],
      "Bayern Munich": ["BAY", "bayern"],
      "Benfica": ["BEN", "benfica"],
      "Brighton": ["BRI", "brighton"],
      "Chelsea": ["CHE", "chelsea"],
      "Crystal Palace": ["CRY", "crystalpalace"],
      "FL Fart": ["FLF", "flfart"],
      "Inter Milan": ["INT", "intermilan"],
      "Juventus": ["JUV", "juventus"],
      "Manchester City": ["MCI", "manchestercity"],
      "Manchester United": ["MUN", "manutd"],
      "Marseille": ["MAR", "marseille"],
      "Monaco": ["MON", "monaco"],
      "Paris Saint-Germain": ["PSG", "psg"],
      "Real Madrid": ["RMA", "realmadrid"],
      "Sheffield United": ["SHU", "sheffield"],
      "Sporting CP": ["SCP", "sportingcp"],
      "Tottenham Hotspur": ["TOT", "tottenham"],
      "Valencia": ["VAL", "valencia"]
    };
    var data = aliases[clean];
    var abbr = data ? data[0] : clean.split(/\s+/).map(function (part) {
      return part.charAt(0);
    }).join("").slice(0, 3).toUpperCase();
    var slug = data ? data[1] : clean.toLowerCase().replace(/[^a-z0-9]+/g, "");

    return {
      abbr: abbr || "---",
      img: getRepoScopedPath("00-assets/photos/" + slug + ".jpg")
    };
  }

  function makeScoreCard(game) {
    var away = getTeamTickerData(game.awayTeamName);
    var home = getTeamTickerData(game.homeTeamName);
    var awayWins = Number(game.awayScore) > Number(game.homeScore);
    var boxId = String(game.boxscoreFile || game.boxscoreUrl || "").match(/box\d+-\d+/i);
    var href = boxId
      ? getCorePath("matchCentre", "00-assets/html/match-centre.htm") + "?game=" + encodeURIComponent(boxId[0].toLowerCase())
      : String(game.boxscoreUrl || ("./boxes/" + game.boxscoreFile)).replace(/^\.\//, "");
    var dateText = formatTickerGameDate(game.date);

    function teamHtml(team, score, isWinner) {
      return [
        '<span class="site-score-team' + (isWinner ? " is-winner" : "") + '">',
        '<img class="site-score-logo" src="' + escapeHtml(team.img) + '" alt="" onerror="this.hidden=true">',
        '<span class="site-score-abbr">' + escapeHtml(team.abbr) + "</span>",
        '<span class="site-score-pts">' + escapeHtml(score) + "</span>",
        "</span>"
      ].join("");
    }

    return [
      '<a class="site-score-card" href="' + escapeHtml(href) + '" target="data" title="' + escapeHtml(game.matchupText || "") + '">',
      teamHtml(away, game.awayScore, awayWins),
      '<span class="site-score-mid"><span class="site-score-date">' + escapeHtml(dateText) + '</span><span class="site-score-sep">-</span></span>',
      teamHtml(home, game.homeScore, !awayWins),
      "</a>"
    ].join("");
  }

  function makePreviewCard(game) {
    var away = getTeamTickerData(game.awayTeamName);
    var home = getTeamTickerData(game.homeTeamName);
    var params = new URLSearchParams();
    var href;
    var dateText = formatTickerGameDate(game.date);

    params.set("date", game.date || "");
    params.set("away", game.awayTeam || "");
    params.set("home", game.homeTeam || "");
    href = getCorePath("matchCentre", "00-assets/html/match-centre.htm") + "?" + params.toString();

    function teamHtml(team) {
      return [
        '<span class="site-score-team">',
        '<img class="site-score-logo" src="' + escapeHtml(team.img) + '" alt="" onerror="this.hidden=true">',
        '<span class="site-score-abbr">' + escapeHtml(team.abbr) + "</span>",
        "</span>"
      ].join("");
    }

    return [
      '<a class="site-score-card site-score-card--preview" href="' + escapeHtml(href) + '" target="data" title="Preview ' + escapeHtml(game.awayTeamName + " at " + game.homeTeamName) + '">',
      teamHtml(away),
      '<span class="site-score-mid"><span class="site-score-date">' + escapeHtml(dateText) + '</span><span class="site-score-sep">@</span></span>',
      teamHtml(home),
      "</a>"
    ].join("");
  }

  function formatTickerGameDate(value) {
    var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/);
    var month;
    var day;

    if (!match) {
      return "";
    }

    month = (scheduleDateOrder === "mdy" ? match[1] : match[2]).padStart(2, "0");
    day = (scheduleDateOrder === "mdy" ? match[2] : match[1]).padStart(2, "0");
    return day + "/" + month;
  }

  function normalizeTeamName(value) {
    if (window.LeagueSiteCore && window.LeagueSiteCore.normalizeName) {
      return window.LeagueSiteCore.normalizeName(value);
    }

    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function getFavoriteTeamName() {
    return getSettings().favoriteTeam || "";
  }

  function isFavoriteGame(game) {
    var favorite = normalizeTeamName(getFavoriteTeamName());

    return favorite && (
      normalizeTeamName(game.awayTeamName) === favorite ||
      normalizeTeamName(game.homeTeamName) === favorite
    );
  }

  function gameMonthKey(game) {
    var date = new Date(Number(game && game._tickerTime) || 0);

    if (!Number.isFinite(date.getTime()) || !date.getTime()) {
      return "";
    }

    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function latestMonthGames(games) {
    var latestKey = "";

    (games || []).forEach(function (game) {
      var key = gameMonthKey(game);

      if (key && key > latestKey) {
        latestKey = key;
      }
    });

    if (!latestKey) {
      return games || [];
    }

    return (games || []).filter(function (game) {
      return gameMonthKey(game) === latestKey;
    });
  }

  function comingMonthGames(scheduledGames, completedGames) {
    var latestCompletedTime = (completedGames || []).reduce(function (latest, game) {
      return Math.max(latest, Number(game && game._tickerTime) || 0);
    }, 0);
    var future = (scheduledGames || []).filter(function (game) {
      return (Number(game && game._tickerTime) || 0) > latestCompletedTime;
    }).slice().sort(function (a, b) {
      return a._tickerTime - b._tickerTime || a._tickerOrder - b._tickerOrder;
    });
    var monthKey = future.length ? gameMonthKey(future[0]) : "";

    return monthKey ? future.filter(function (game) {
      return gameMonthKey(game) === monthKey;
    }) : [];
  }

  function getTickerGamesToRender() {
    var games;

    games = tickerPreviewMode
      ? comingMonthGames(tickerScheduledGames, tickerCompletedGames)
      : latestMonthGames(tickerCompletedGames);

    if (!tickerFavoriteOnly) {
      return games;
    }

    return games.filter(isFavoriteGame);
  }

  function updateTickerFilterButton() {
    var button = document.getElementById("siteTickerFilter");
    var favoriteTeam = getFavoriteTeamName();

    if (!button) {
      return;
    }

    button.classList.toggle("is-active", tickerFavoriteOnly);
    button.setAttribute("aria-pressed", String(tickerFavoriteOnly));
    button.title = favoriteTeam
      ? "Show only " + favoriteTeam + (tickerPreviewMode ? " previews" : " scores")
      : "Set a favorite team in settings";
    button.setAttribute("aria-label", favoriteTeam
      ? "Show only " + favoriteTeam + (tickerPreviewMode ? " previews" : " scores")
      : "Set a favorite team in settings");

  }

  function makeTickerModeButton() {
    var isSuperCup = isSuperCupIndexPage();
    var label = tickerPreviewMode ? "Preview" : "Final";
    var action = tickerPreviewMode ? "Show latest completed scores" : "Show upcoming previews";

    return '<button class="site-ticker-label site-ticker-mode" type="button" aria-pressed="' +
      String(tickerPreviewMode) + '" aria-label="' + escapeHtml(isSuperCup ? "Final scores" : action) +
      '" title="' + escapeHtml(isSuperCup ? "Final scores" : action) + '"' +
      (isSuperCup ? " disabled" : "") + ">" + label + "</button>";
  }

  function renderCurrentTickerGames() {
    renderScoreTicker(getTickerGamesToRender());
  }

  function bindTickerFilterButton() {
    var button = document.getElementById("siteTickerFilter");

    if (!button || button.dataset.bound === "true") {
      return;
    }

    button.dataset.bound = "true";
    button.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      tickerFavoriteOnly = !tickerFavoriteOnly;
      updateTickerFilterButton();
      renderCurrentTickerGames();
    });

  }

  function stopScoreTickerAuto() {
    if (tickerAutoFrame) {
      window.cancelAnimationFrame(tickerAutoFrame);
      tickerAutoFrame = 0;
    }
  }

  function startScoreTickerAuto(ticker, loopWidth) {
    var lastTime = 0;
    var lastAutoAt = 0;

    stopScoreTickerAuto();
    tickerAutoPosition = ticker.scrollLeft || 0;

    function tick(time) {
      var elapsed = lastTime ? time - lastTime : 16;
      var hoverPaused = ticker.matches && ticker.matches(":hover");

      lastTime = time;
      if (ticker.dataset.userDragging !== "true" && ticker.dataset.hoverPaused !== "true" && !hoverPaused && loopWidth > 0) {
        tickerAutoPosition += elapsed * 0.035;
        if (tickerAutoPosition >= loopWidth) {
          tickerAutoPosition -= loopWidth;
        }
        ticker.scrollLeft = tickerAutoPosition;
        lastAutoAt = time;
      } else if (time - lastAutoAt > 1800) {
        ticker.dataset.userDragging = "false";
        ticker.classList.remove("is-dragging");
        tickerAutoPosition = ticker.scrollLeft || 0;
      }

      tickerAutoFrame = window.requestAnimationFrame(tick);
    }

    tickerAutoFrame = window.requestAnimationFrame(tick);
  }

  function bindScoreTickerScrub(ticker) {
    var dragState = null;

    if (!ticker || ticker.dataset.scrubBound === "true") {
      return;
    }

    ticker.dataset.scrubBound = "true";
    ticker.addEventListener("mouseenter", function () {
      ticker.dataset.hoverPaused = "true";
    });
    ticker.addEventListener("mouseleave", function () {
      ticker.dataset.hoverPaused = "false";
      tickerAutoPosition = ticker.scrollLeft || 0;
    });

    ticker.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      if (event.target && event.target.closest && event.target.closest(".site-ticker-mode")) {
        return;
      }

      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: ticker.scrollLeft,
        didDrag: false,
        captured: false
      };
    });

    ticker.addEventListener("pointermove", function (event) {
      var deltaX;

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      deltaX = event.clientX - dragState.startX;
      if (Math.abs(deltaX) > 3) {
        dragState.didDrag = true;
        ticker.dataset.userDragging = "true";
        ticker.classList.add("is-dragging");
        if (!dragState.captured && ticker.setPointerCapture) {
          ticker.setPointerCapture(event.pointerId);
          dragState.captured = true;
        }
      }

      if (dragState.didDrag) {
        event.preventDefault();
        ticker.scrollLeft = dragState.startScrollLeft - deltaX;
        tickerAutoPosition = ticker.scrollLeft || 0;
      }
    });

    function finishDrag(event) {
      var didDrag = dragState && dragState.didDrag;

      if (dragState && (!event || event.pointerId === dragState.pointerId)) {
        if (event && ticker.hasPointerCapture && ticker.hasPointerCapture(dragState.pointerId)) {
          ticker.releasePointerCapture(dragState.pointerId);
        }
        dragState = null;
      }

      ticker.classList.remove("is-dragging");
      ticker.dataset.userDragging = "false";
      tickerAutoPosition = ticker.scrollLeft || 0;

      if (didDrag) {
        ticker.dataset.suppressNextClick = "true";
        window.setTimeout(function () {
          ticker.dataset.suppressNextClick = "false";
        }, 120);
      }
    }

    ticker.addEventListener("pointerup", finishDrag);
    ticker.addEventListener("pointercancel", finishDrag);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", function () {
      dragState = null;
      ticker.classList.remove("is-dragging");
      ticker.dataset.userDragging = "false";
      tickerAutoPosition = ticker.scrollLeft || 0;
    });
    ticker.addEventListener("pointerleave", function (event) {
      if (dragState && dragState.didDrag) {
        finishDrag(event);
      }
    });
    ticker.addEventListener("click", function (event) {
      var modeButton = event.target && event.target.closest ? event.target.closest(".site-ticker-mode") : null;
      var scoreLink = event.target && event.target.closest ? event.target.closest(".site-score-card") : null;
      var dataFrame;

      if (ticker.dataset.suppressNextClick === "true") {
        event.preventDefault();
        event.stopPropagation();
        ticker.dataset.suppressNextClick = "false";
        return;
      }

      if (modeButton && !modeButton.disabled) {
        event.preventDefault();
        event.stopPropagation();
        tickerPreviewMode = !tickerPreviewMode;
        updateTickerFilterButton();
        renderCurrentTickerGames();
        return;
      }

      if (scoreLink) {
        dataFrame = document.querySelector('iframe[name="data"]');
        if (dataFrame) {
          event.preventDefault();
          dataFrame.src = scoreLink.getAttribute("href");
        }
      }
    }, true);
    ticker.addEventListener("wheel", function (event) {
      var delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

      if (!delta) {
        return;
      }

      event.preventDefault();
      ticker.scrollLeft += delta;
      tickerAutoPosition = ticker.scrollLeft || 0;
    }, { passive: false });
  }

  function renderScoreTicker(games) {
    var track = document.getElementById("siteTickerTrack");
    var cards;
    var segment;
    var attempts = 0;

    if (!track) {
      return;
    }

    updateTickerFilterButton();
    bindTickerFilterButton();
    bindScoreTickerScrub(track.parentNode);

    if (!games.length) {
      stopScoreTickerAuto();
      track.innerHTML = makeTickerModeButton() + '<span class="site-ticker-empty">' + escapeHtml(
        tickerFavoriteOnly
          ? (getFavoriteTeamName()
            ? (tickerPreviewMode ? "No upcoming games for your favorite team" : "No completed games for your favorite team")
            : "Set a favorite team in settings")
          : (tickerPreviewMode ? "No upcoming games in the coming schedule month" : "No completed games available")
      ) + "</span>";
      return;
    }

    cards = games.map(tickerPreviewMode ? makePreviewCard : makeScoreCard).join("");
    segment = makeTickerModeButton() + cards;
    track.className = "site-ticker-track";
    track.style.removeProperty("--ticker-duration");
    track.innerHTML = segment;
    track.parentNode.scrollLeft = 0;
    stopScoreTickerAuto();

    function maybeScrollTicker() {
      var parentWidth = track.parentNode ? track.parentNode.clientWidth : 0;

      if (!parentWidth && attempts < 4) {
        attempts += 1;
        window.setTimeout(maybeScrollTicker, 100);
        return;
      }

      if (parentWidth && track.scrollWidth > parentWidth) {
        track.innerHTML = segment + segment;
        track.classList.add("is-scrolling");
        startScoreTickerAuto(track.parentNode, track.scrollWidth / 2);
      }
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(maybeScrollTicker);
    });
  }

  function initScoreTicker() {
    loadJson("schedule.json")
      .then(function (schedule) {
        var completedGames = [];
        var scheduledGames = [];
        var order = 0;
        var scheduleDates = [];

        (schedule.sections || []).forEach(function (section) {
          (section.days || []).forEach(function (day) {
            scheduleDates.push(day.date);
          });
        });
        scheduleDateOrder = inferScheduleDateOrder(scheduleDates);

        (schedule.sections || []).forEach(function (section) {
          (section.days || []).forEach(function (day) {
            var time = parseScheduleDate(day.date);

            (day.games || []).forEach(function (game) {
              var entry = {
                game: game,
                date: day.date,
                time: time,
                order: order
              };

              if (game.status === "completed" && (game.boxscoreUrl || game.boxscoreFile)) {
                completedGames.push(entry);
              } else if (game.status === "scheduled" && game.awayTeam && game.homeTeam) {
                scheduledGames.push(entry);
              }
              order += 1;
            });
          });
        });

        completedGames.sort(function (a, b) {
          return b.time - a.time || b.order - a.order;
        });
        scheduledGames.sort(function (a, b) {
          return a.time - b.time || a.order - b.order;
        });

        tickerCompletedGames = completedGames.map(function (entry) {
          return Object.assign({}, entry.game, {
            date: entry.date,
            _tickerTime: entry.time,
            _tickerOrder: entry.order
          });
        });
        tickerScheduledGames = scheduledGames.map(function (entry) {
          return Object.assign({}, entry.game, {
            date: entry.date,
            _tickerTime: entry.time,
            _tickerOrder: entry.order
          });
        });
        renderCurrentTickerGames();
      })
      .catch(function () {
        tickerCompletedGames = [];
        tickerScheduledGames = [];
        renderScoreTicker([]);
      });
  }

  function getPlayerHref(player) {
    if (window.LeagueSiteCore && window.LeagueSiteCore.getPlayerPageUrl) {
      return window.LeagueSiteCore.getPlayerPageUrl(player.url);
    }

    var match = String(player.url || "").match(/(player\d+)\.htm/i);
    return match ? "00-assets/html/unified-player.htm?id=" + match[1].toLowerCase() : String(player.url || "");
  }

  function getTeamHref(team) {
    return "00-assets/html/unified-roster.htm?file=" + encodeURIComponent(team.file || (team.id + ".htm"));
  }

  function buildShellSearchIndex() {
    var pages = [
      { type: "Page", name: "Standings", meta: "Classic standings", href: "standings.htm", aliases: "table records clb elb ecl" },
      { type: "Page", name: "Unified Standings", meta: "Modern league table", href: getCorePath("unifiedStandings", "00-assets/html/unified-standings.htm"), aliases: "table records promotion relegation" },
      { type: "Page", name: "Schedule", meta: "Games and box scores", href: "schedule.htm", aliases: "fixtures games scores boxes results" },
      { type: "Page", name: "Match Centre", meta: "Upcoming matchups and completed box scores", href: getCorePath("matchCentre", "00-assets/html/match-centre.htm"), aliases: "preview upcoming matchup favorite edge final scores results games player stats boxscore" },
      { type: "Page", name: "League Leaders", meta: "Classic stat leaders", href: "leaders.htm", aliases: "stats points rebounds assists blocks steals" },
      { type: "Page", name: "Unified Leaders", meta: "Modern stat leaders", href: getCorePath("unifiedLeaders", "00-assets/html/unified-leaders.htm"), aliases: "stats player rankings points rebounds assists" },
      { type: "Page", name: "League Dashboard", meta: "League overview", href: getCorePath("leagueDashboard", "00-assets/html/league%20dashboard.htm"), aliases: "home overview dashboard hub" },
      { type: "Page", name: "Free Agents", meta: "Classic free agent list", href: "freeagents.htm", aliases: "fa waiver unsigned players" },
      { type: "Page", name: "Waiver Database", meta: "Filterable player market", href: "waiverwire.htm", aliases: "waiver free agents fa database" },
      { type: "Page", name: "Player Database", meta: "Season attributes, potential and stats", href: getCorePath("playerDatabase", "00-assets/html/player-database.htm"), aliases: "players ratings overall ovr potential pot regular advanced stats history seasons" },
      { type: "Page", name: "Trade Tool", meta: "Roster and salary tool", href: getCorePath("tradeTool", "00-assets/html/trade-tool.htm"), aliases: "trades assets salaries cap" },
      { type: "Page", name: "FA War Room", meta: "Free agency ratings", href: getCorePath("faWarRoom", "00-assets/html/fa-war-room.htm"), aliases: "free agency war room ratings" },
      { type: "Page", name: "Youth Intake", meta: "Youth intake database", href: getCorePath("youthIntake", "00-assets/html/youth-intake.htm"), aliases: "youth prospects intake juniors" },
      { type: "Page", name: "ESL Media", meta: "Latest articles", href: getCorePath("eslMedia", "00-eslmedia/homepage.html"), aliases: "articles news media recaps rankings" }
    ];

    return Promise.all([
      loadJson("players.json").catch(function () { return []; }),
      loadJson("teams.json").catch(function () { return []; })
    ]).then(function (results) {
      var players = (results[0] || []).map(function (player) {
        return {
          type: "Player",
          name: player.name,
          meta: [player.teamLabel, player.pos, player.age ? player.age + " yrs" : ""].filter(Boolean).join(" | "),
          href: getPlayerHref(player),
          aliases: [player.teamLabel, player.pos].filter(Boolean).join(" ")
        };
      });
      var teams = (results[1] || []).map(function (team) {
        return {
          type: "Team",
          name: team.name,
          meta: team.starPlayer && team.starPlayer.name ? "Star: " + team.starPlayer.name : "Roster",
          href: getTeamHref(team),
          aliases: [team.abbrev, team.starPlayer && team.starPlayer.name].filter(Boolean).join(" ")
        };
      });

      return pages.concat(players, teams).filter(function (item) {
        return item.name && item.href;
      });
    });
  }

  function scoreSearchResult(item, query) {
    var name = String(item.name || "").toLowerCase();
    var meta = String(item.meta || "").toLowerCase();
    var aliases = String(item.aliases || "").toLowerCase();
    var typeBias = item.type === "Page" ? -0.25 : 0;

    if (name === query) {
      return 0 + typeBias;
    }
    if (name.indexOf(query) === 0) {
      return 1 + typeBias;
    }
    if (name.indexOf(query) !== -1) {
      return 2 + typeBias;
    }
    if (meta.indexOf(query) !== -1 || aliases.indexOf(query) !== -1) {
      return 3 + typeBias;
    }
    return 99;
  }

  function renderShellSearchResults(root, input, items) {
    var query = input.value.trim().toLowerCase();
    var resultsNode = root.querySelector(".site-shell-search-results");
    var matches;

    if (!resultsNode) {
      return;
    }

    if (!query) {
      root.classList.remove("is-open");
      resultsNode.innerHTML = "";
      return;
    }

    matches = items.map(function (item) {
      return { item: item, score: scoreSearchResult(item, query) };
    }).filter(function (entry) {
      return entry.score < 99;
    }).sort(function (a, b) {
      return a.score - b.score || String(a.item.name).localeCompare(String(b.item.name));
    }).slice(0, HEADER_SEARCH_LIMIT);

    if (!matches.length) {
      resultsNode.innerHTML = '<div class="site-shell-search-empty">No pages, players or teams found.</div>';
      root.classList.add("is-open");
      return;
    }

    resultsNode.innerHTML = matches.map(function (entry) {
      return [
        '<a class="site-shell-search-result" href="' + escapeHtml(entry.item.href) + '" target="data" role="option">',
        '<span class="site-shell-search-name">' + escapeHtml(entry.item.name) + "</span>",
        '<span class="site-shell-search-meta">' + escapeHtml(entry.item.type + " | " + entry.item.meta) + "</span>",
        "</a>"
      ].join("");
    }).join("");
    root.classList.add("is-open");
  }

  function initShellSearch() {
    var root = document.getElementById("siteShellSearch");
    var input = root ? root.querySelector(".site-shell-search-input") : null;
    var items = [];

    if (!root || !input || root.dataset.bound === "true") {
      return;
    }

    root.dataset.bound = "true";

    buildShellSearchIndex().then(function (searchItems) {
      items = searchItems;
    });

    input.addEventListener("input", function () {
      renderShellSearchResults(root, input, items);
    });

    input.addEventListener("focus", function () {
      renderShellSearchResults(root, input, items);
    });

    root.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest(".site-shell-search-result")) {
        root.classList.remove("is-open");
        input.blur();
      }
    });

    document.addEventListener("click", function (event) {
      if (!root.contains(event.target)) {
        root.classList.remove("is-open");
      }
    });

    document.addEventListener("keydown", function (event) {
      var key = String(event.key || "").toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        input.focus();
        input.select();
      }
      if (event.key === "Escape") {
        root.classList.remove("is-open");
        input.blur();
      }
    });
  }

  function init() {
    ensureStyles();
    ensureShell();
    ensureMenuControls();
    bindSidebarAutoClose();
    initScoreTicker();
    updateLatestSimStatus();
    initShellSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


