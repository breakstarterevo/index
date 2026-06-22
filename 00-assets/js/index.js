(function () {
  "use strict";

  var STYLE_ID = "league-index-shell-styles";
  var BREAKPOINT = 760;
  var SETTINGS_KEY = "leagueSiteSettings";
  var HEADER_SEARCH_LIMIT = 8;

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

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "html, body { height: 100%; margin: 0; }",
      "body { background: #f4f2ec; overflow: hidden; overflow-x: hidden; padding: 0; }",
      ":root { --site-sidebar-width: 150px; --site-topbar-height: 58px; --site-navy: #111b36; --site-blue: #5ca8ff; --site-line: rgba(148, 163, 184, 0.36); }",
      ".site-shell { display: grid; grid-template-columns: var(--site-sidebar-width) minmax(0, 1fr); grid-template-rows: var(--site-topbar-height) minmax(0, 1fr); height: 100vh; left: 0; position: fixed; right: 0; top: 0; transition: grid-template-columns 0.24s ease; width: 100%; }",
      "body.league-menu-closed .site-shell { grid-template-columns: 0 minmax(0, 1fr); }",
      ".site-topbar { background: #f7f9fc; border-bottom: 0; display: grid; grid-column: 1 / -1; grid-row: 1; grid-template-columns: var(--site-sidebar-width) minmax(0, 1fr) minmax(250px, 340px); min-width: 0; overflow: visible; position: relative; z-index: 25; }",
      ".site-topbar-brand { align-items: center; background: var(--site-navy); border-right: 0; display: flex; height: 100%; justify-content: center; padding: 0 8px; position: relative; }",
      ".site-topbar-logo-link { align-items: center; display: flex; justify-content: center; min-width: 0; position: absolute; left: 50%; text-decoration: none; top: 50%; transform: translate(-50%, -50%); }",
      ".site-topbar-logo { display: block; filter: brightness(0) invert(1); height: 38px; object-fit: contain; width: 38px; }",
      ".site-ticker { align-items: stretch; box-shadow: inset 0 -1px 0 rgba(17, 27, 54, 0.18); display: flex; min-width: 0; overflow: hidden; position: relative; }",
      ".site-ticker-track { align-items: stretch; display: flex; min-width: max-content; }",
      ".site-ticker-track.is-scrolling { animation: siteTickerScroll var(--ticker-duration, 60s) linear infinite; }",
      ".site-ticker:hover .site-ticker-track.is-scrolling { animation-play-state: paused; }",
      "@keyframes siteTickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }",
      ".site-ticker-label { align-items: center; border-right: 1px solid #d8e1ee; color: #1d4f91; display: flex; flex: 0 0 auto; font: 900 10px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: .12em; padding: 0 12px; text-transform: uppercase; }",
      ".site-score-card { align-items: center; background: #f7f9fc; border-right: 1px solid #d8e1ee; color: #111827; display: grid; flex: 0 0 auto; gap: 5px; grid-template-columns: 39px 10px 39px; height: 100%; justify-content: center; min-width: 100px; padding: 3px 8px 2px; text-decoration: none; }",
      ".site-score-card:hover { background: #edf5ff; }",
      ".site-score-team { align-items: center; display: grid; gap: 1px; grid-template-rows: 20px 11px 18px; justify-items: center; min-width: 0; }",
      ".site-score-logo { border-radius: 50%; display: block; height: 19px; object-fit: cover; width: 19px; }",
      ".site-score-abbr { color: #5b6472; font: 900 10px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: .04em; text-align: center; text-transform: uppercase; }",
      ".site-score-pts { color: #111827; font: 950 18px/1 Inter, Tahoma, Arial, sans-serif; text-align: center; }",
      ".site-score-team.is-winner .site-score-pts { color: #1d5ea8; }",
      ".site-score-sep { color: #7b8492; font: 900 15px/1 Inter, Tahoma, Arial, sans-serif; text-align: center; }",
      ".site-ticker-empty { align-items: center; color: #5b6472; display: flex; font: 800 12px/1 Inter, Tahoma, Arial, sans-serif; padding: 0 14px; }",
      ".site-shell-search { align-items: center; background: #f7f9fc; box-shadow: inset 0 -1px 0 rgba(17, 27, 54, 0.18); display: flex; min-width: 0; padding: 0 12px; position: relative; }",
      ".site-shell-search-input { background: #ffffff; border: 1px solid #c9d3e1; border-radius: 7px; box-sizing: border-box; color: #0f172a; font: 700 12px/1.2 Inter, Tahoma, Arial, sans-serif; height: 34px; outline: none; padding: 0 10px; width: 100%; }",
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
      "html.league-theme-dark .site-score-abbr, html.league-theme-dark .site-score-sep, html.league-theme-dark .site-ticker-empty { color: #a9b6c8; }",
      "html.league-theme-dark .site-score-pts { color: #edf4ff; }",
      "html.league-theme-dark .site-score-team.is-winner .site-score-pts, html.league-theme-dark .site-ticker-label { color: #8ec5ff; }",
      "html.league-theme-dark .site-shell-search { background: #0d1118; box-shadow: inset 0 -1px 0 rgba(148, 163, 184, .24); }",
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
      "  .site-shell-search { display: flex; grid-column: 2; grid-row: 1; padding: 0 10px; }",
      "  body.league-menu-compact .site-shell-search { display: flex; }",
      "  .site-shell-search-results { left: 10px; right: 10px; top: calc(100% + 4px); width: auto; }",
      "  .site-topbar-brand { padding: 0 6px; }",
      "  .site-menu-toggle { left: 6px; }",
      "  .site-topbar-logo { height: 36px; width: 36px; }",
      "  .site-score-card { grid-template-columns: 36px 9px 36px; min-width: 92px; padding-left: 7px; padding-right: 7px; }",
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
    var tickerTrack = document.createElement("div");
    var search = document.createElement("section");
    var searchInput = document.createElement("input");
    var searchResults = document.createElement("div");
    var sidebar = document.createElement("aside");
    var content = document.createElement("main");

    shell.className = "site-shell";
    topbar.className = "site-topbar";
    brand.className = "site-topbar-brand";
    logoLink.className = "site-topbar-logo-link";
    logoLink.href = getCorePath("leagueDashboard", "00-assets/html/league%20dashboard.htm");
    logoLink.target = "data";
    logoLink.setAttribute("aria-label", "League dashboard");
    logo.className = "site-topbar-logo";
    logo.src = getCorePath("leagueLogo", "00-assets/images/ESLcropped-removebg-preview.png");
    logo.alt = "ESL";
    ticker.className = "site-ticker";
    ticker.setAttribute("aria-label", "Latest scores");
    tickerTrack.className = "site-ticker-track";
    tickerTrack.id = "siteTickerTrack";
    tickerTrack.innerHTML = '<span class="site-ticker-empty">Scores loading</span>';
    search.className = "site-shell-search";
    search.id = "siteShellSearch";
    searchInput.className = "site-shell-search-input";
    searchInput.type = "search";
    searchInput.autocomplete = "off";
    searchInput.placeholder = "Search players or teams";
    searchInput.setAttribute("aria-label", "Search players or teams");
    searchResults.className = "site-shell-search-results";
    searchResults.setAttribute("role", "listbox");
    sidebar.className = "site-sidebar";
    sidebar.setAttribute("aria-label", "League navigation");
    content.className = "site-content";

    logoLink.appendChild(logo);
    brand.appendChild(logoLink);
    ticker.appendChild(tickerTrack);
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

  function parseScheduleDate(value) {
    var match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (!match) {
      return 0;
    }

    return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2])).getTime();
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
    var href = String(game.boxscoreUrl || ("./boxes/" + game.boxscoreFile)).replace(/^\.\//, "");

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
      '<span class="site-score-sep">-</span>',
      teamHtml(home, game.homeScore, !awayWins),
      "</a>"
    ].join("");
  }

  function renderScoreTicker(games) {
    var track = document.getElementById("siteTickerTrack");
    var cards;

    if (!track) {
      return;
    }

    if (!games.length) {
      track.innerHTML = '<span class="site-ticker-empty">Scores unavailable</span>';
      return;
    }

    cards = games.map(makeScoreCard).join("");
    track.className = "site-ticker-track";
    track.style.removeProperty("--ticker-duration");
    track.innerHTML = '<span class="site-ticker-label">Final</span>' + cards;

    window.requestAnimationFrame(function () {
      if (track.scrollWidth > track.parentNode.clientWidth) {
        track.innerHTML = '<span class="site-ticker-label">Final</span>' + cards + cards;
        track.classList.add("is-scrolling");
        track.style.setProperty("--ticker-duration", Math.max(28, games.length * 5) + "s");
      }
    });
  }

  function initScoreTicker() {
    loadJson("schedule.json")
      .then(function (schedule) {
        var completedGames = [];
        var order = 0;

        (schedule.sections || []).forEach(function (section) {
          (section.days || []).forEach(function (day) {
            var time = parseScheduleDate(day.date);

            (day.games || []).forEach(function (game) {
              if (game.status !== "completed" || !(game.boxscoreUrl || game.boxscoreFile)) {
                return;
              }

              completedGames.push({
                game: game,
                time: time,
                order: order
              });
              order += 1;
            });
          });
        });

        completedGames.sort(function (a, b) {
          return a.time - b.time || a.order - b.order;
        });

        renderScoreTicker(completedGames.slice(-20).map(function (entry) {
          return entry.game;
        }));
      })
      .catch(function () {
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
    return Promise.all([
      loadJson("players.json").catch(function () { return []; }),
      loadJson("teams.json").catch(function () { return []; })
    ]).then(function (results) {
      var players = (results[0] || []).map(function (player) {
        return {
          type: "Player",
          name: player.name,
          meta: [player.teamLabel, player.pos, player.age ? player.age + " yrs" : ""].filter(Boolean).join(" | "),
          href: getPlayerHref(player)
        };
      });
      var teams = (results[1] || []).map(function (team) {
        return {
          type: "Team",
          name: team.name,
          meta: team.starPlayer && team.starPlayer.name ? "Star: " + team.starPlayer.name : "Roster",
          href: getTeamHref(team)
        };
      });

      return players.concat(teams).filter(function (item) {
        return item.name && item.href;
      });
    });
  }

  function scoreSearchResult(item, query) {
    var name = String(item.name || "").toLowerCase();
    var meta = String(item.meta || "").toLowerCase();

    if (name === query) {
      return 0;
    }
    if (name.indexOf(query) === 0) {
      return 1;
    }
    if (name.indexOf(query) !== -1) {
      return 2;
    }
    if (meta.indexOf(query) !== -1) {
      return 3;
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
      resultsNode.innerHTML = '<div class="site-shell-search-empty">No players or teams found.</div>';
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
    initShellSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


