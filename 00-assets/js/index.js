(function () {
  "use strict";

  var STYLE_ID = "league-index-shell-styles";
  var BREAKPOINT = 760;
  var SETTINGS_KEY = "leagueSiteSettings";

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
    var rootPath = path.replace(/\/00-SuperCup\/index\.htm$/i, "");
    var cleanPath = String(relativePath || "").replace(/^\/+/, "");

    return (rootPath ? rootPath + "/" : "/") + cleanPath;
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
      ".site-shell { display: grid; grid-template-columns: 150px minmax(0, 1fr); height: 100vh; left: 0; position: fixed; right: 0; top: 0; transition: grid-template-columns 0.24s ease; width: 100%; }",
      "body.league-menu-closed .site-shell { grid-template-columns: 0 minmax(0, 1fr); }",
      ".site-sidebar { background: #111b36; border-right: 1px solid rgba(15, 23, 42, 0.22); height: 100vh; max-width: 150px; min-width: 0; overflow: auto; position: sticky; top: 0; transform: translateX(0); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: 150px; z-index: 10; }",
      "body.league-menu-closed .site-sidebar { border-right-color: transparent; overflow: hidden; transform: translateX(-100%); width: 0; }",
      ".site-frame { border: 0; display: block; height: 100%; width: 100%; }",
      ".site-content { min-width: 0; overflow: hidden; }",
      ".site-menu-toggle { align-items: center; background: #111b36; border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 8px; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22); color: #ffffff; cursor: pointer; display: flex; font: 800 18px/1 Inter, Tahoma, Arial, sans-serif; height: 34px; justify-content: center; left: 8px; position: fixed; top: 8px; width: 36px; z-index: 30; }",
      ".site-menu-toggle:hover { background: #17274b; }",
      ".site-sidebar-backdrop { display: none; }",
      "body.league-menu-compact .site-shell { grid-template-columns: minmax(0, 1fr); }",
      "body.league-menu-compact .site-sidebar-backdrop { background: rgba(15, 23, 42, 0.36); bottom: 0; display: block; left: min(72vw, 240px); opacity: 0; pointer-events: none; position: fixed; right: 0; top: 0; transition: opacity 0.2s ease; z-index: 15; }",
      "body.league-menu-compact.league-menu-open .site-sidebar-backdrop { opacity: 1; pointer-events: auto; }",
      "body.league-menu-compact .site-sidebar { bottom: 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); max-width: 240px; position: fixed; top: 0; transform: translateX(-100%); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: min(72vw, 240px); z-index: 20; }",
      "body.league-menu-compact.league-menu-closed .site-sidebar { width: min(72vw, 240px); }",
      "body.league-menu-compact.league-menu-open .site-sidebar { transform: translateX(0); }",
      "@media (max-width: 760px) {",
      "  html, body { height: 100%; min-height: 100%; overflow: hidden; overflow-x: hidden; }",
      "  body { overflow: hidden; overflow-x: hidden; }",
      "  .site-shell { grid-template-columns: minmax(0, 1fr); height: 100dvh; left: 0; min-width: 0; position: fixed; right: 0; top: 0; width: 100%; }",
      "  .site-content { min-width: 0; overflow: hidden; }",
      "  .site-content .site-frame { min-width: 0; width: 100%; }",
      "  .site-sidebar-backdrop { background: rgba(15, 23, 42, 0.36); bottom: 0; display: block; left: min(72vw, 240px); opacity: 0; pointer-events: none; position: fixed; right: 0; top: 0; transition: opacity 0.2s ease; z-index: 15; }",
      "  body.league-menu-open .site-sidebar-backdrop { opacity: 1; pointer-events: auto; }",
      "  .site-sidebar { bottom: 0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); max-width: 240px; position: fixed; top: 0; transform: translateX(-100%); transition: transform 0.24s ease, width 0.24s ease, border-color 0.24s ease; width: min(72vw, 240px); z-index: 20; }",
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
    var sidebar = document.createElement("aside");
    var content = document.createElement("main");

    shell.className = "site-shell";
    sidebar.className = "site-sidebar";
    sidebar.setAttribute("aria-label", "League navigation");
    content.className = "site-content";

    sidebar.appendChild(makeFrame("site-frame", "Options", "menu.htm", "League navigation"));
    content.appendChild(makeFrame("site-frame", "data", getDefaultPage(), "League content"));
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
        return;
      }

      menuDocument.documentElement.dataset.autoCloseBound = "true";
      ensureRealMenuEnhancements(menuFrame, menuDocument);
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
    var button = document.querySelector(".site-menu-toggle");
    var backdrop = document.querySelector(".site-sidebar-backdrop");

    if (!button) {
      button = document.createElement("button");
      button.className = "site-menu-toggle";
      button.type = "button";
      button.setAttribute("aria-label", "Toggle league menu");
      button.setAttribute("aria-expanded", "false");
      button.textContent = "\u2630";
      body.insertBefore(button, body.firstChild);
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

  function init() {
    ensureStyles();
    ensureShell();
    ensureMenuControls();
    bindSidebarAutoClose();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


