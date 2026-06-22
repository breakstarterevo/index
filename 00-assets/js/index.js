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

  function getCorePath(key, fallback) {
    if (window.LeagueSiteCore && window.LeagueSiteCore.paths && window.LeagueSiteCore.paths[key]) {
      return window.LeagueSiteCore.paths[key];
    }

    return fallback;
  }

  function applyRawMenuFallback(menuDocument) {
    var style;

    if (!menuDocument || menuDocument.getElementById("league-raw-menu-fallback")) {
      return;
    }

    style = menuDocument.createElement("style");
    style.id = "league-raw-menu-fallback";
    style.textContent = [
      "html, body { background: #111b36 !important; color: #fff !important; font-family: Inter, Tahoma, Arial, sans-serif !important; margin: 0 !important; overflow-x: hidden !important; }",
      "body[bgcolor] { background: #111b36 !important; }",
      "table { border-collapse: collapse !important; width: 100% !important; }",
      "td { padding: 0 !important; }",
      "a.menulink { color: #fff !important; display: block !important; font: 700 9.5pt/1.1 Inter, Tahoma, Arial, sans-serif !important; padding: 6px 8px !important; text-decoration: none !important; }",
      "a.menulink:hover { background: rgba(255,255,255,.09) !important; color: #fff !important; }",
      ".league-menu-shell { display: flex; flex-direction: column; gap: 0; }",
      ".league-menu-feature-row { align-items: center; border-bottom: 1px solid rgba(148, 163, 184, 0.45); display: flex; justify-content: center; min-height: 50px; padding: 5px 7px; }",
      ".league-menu-logo { display: block; filter: brightness(0) invert(1); max-height: 38px; max-width: 84px; object-fit: contain; width: 100%; }",
      ".league-menu-eslm-logo { display: block; filter: brightness(0) invert(1); max-height: 22px; max-width: 94px; object-fit: contain; object-position: left center; width: 100%; }",
      ".league-menu-group { border-bottom: 1px solid rgba(148, 163, 184, 0.24); overflow: hidden; }",
      ".league-menu-toggle { align-items: center; background: #111b36; border: 0; color: #94a3b8; cursor: pointer; display: flex; font: 800 8.7pt/1.1 Inter, Tahoma, Arial, sans-serif; justify-content: space-between; letter-spacing: 0.09em; padding: 7px 7px 3px 9px; text-align: left; text-transform: uppercase; width: 100%; }",
      ".league-menu-toggle:hover { background: rgba(255,255,255,.08); }",
      ".league-menu-toggle::after { content: '-'; font-weight: 800; }",
      ".league-menu-group.is-collapsed .league-menu-toggle::after { content: '+'; }",
      ".league-menu-links { display: flex; flex-direction: column; gap: 0; padding-top: 0; }",
      ".league-menu-group.is-collapsed .league-menu-links { display: none; }",
      ".league-menu-link { color: #fff !important; display: block; font: 700 9.5pt/1.08 Inter, Tahoma, Arial, sans-serif; padding: 5px 7px 5px 9px; text-decoration: none !important; }",
      ".league-menu-link:hover { background: rgba(255,255,255,.08); color: #fff !important; }",
      ".league-menu-link--accent { color: #d4af5a !important; }",
      ".league-menu-link--accent:hover { color: #e3c777 !important; }",
      ".league-menu-eslm { color: #fff !important; font: 900 italic 9.5pt/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: 0.04em; }"
    ].join("");

    (menuDocument.head || menuDocument.documentElement).appendChild(style);
    if (menuDocument.body) {
      menuDocument.body.setAttribute("bgcolor", "#111b36");
    }
  }

  function makeFallbackMenuLink(menuDocument, link) {
    var anchor = menuDocument.createElement("a");
    var logo;
    var fallback;

    anchor.className = "league-menu-link" + (link.className ? " " + link.className : "");
    anchor.href = link.href;
    anchor.target = link.target || "data";

    if (link.logo === "eslm") {
      logo = menuDocument.createElement("img");
      fallback = menuDocument.createElement("span");
      logo.className = "league-menu-eslm-logo";
      logo.src = getCorePath("eslMediaLogo", "00-eslmedia/content/article images/ESLM.png");
      logo.alt = "ESL Media";
      fallback.textContent = link.label;
      logo.addEventListener("error", function () {
        logo.remove();
        if (!anchor.contains(fallback)) {
          anchor.appendChild(fallback);
        }
      });
      anchor.appendChild(logo);
      return anchor;
    }

    anchor.textContent = link.label;
    return anchor;
  }

  function makeFallbackMenuGroup(menuDocument, title, links, collapsed) {
    var group = menuDocument.createElement("section");
    var toggle = menuDocument.createElement("button");
    var linkWrap = menuDocument.createElement("div");

    group.className = "league-menu-group" + (collapsed ? " is-collapsed" : "");
    toggle.className = "league-menu-toggle";
    toggle.type = "button";
    toggle.textContent = title;
    toggle.setAttribute("aria-expanded", String(!collapsed));
    linkWrap.className = "league-menu-links";

    links.forEach(function (link) {
      linkWrap.appendChild(makeFallbackMenuLink(menuDocument, link));
    });

    toggle.addEventListener("click", function () {
      var isCollapsed = group.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!isCollapsed));
    });

    group.appendChild(toggle);
    group.appendChild(linkWrap);
    return group;
  }

  function buildGroupedMenuFallback(menuDocument) {
    var shell;
    var featureRow;
    var logo;
    var groups;

    if (!menuDocument || menuDocument.querySelector(".league-menu-shell")) {
      return;
    }

    groups = [
      {
        title: "Media",
        links: [
          { label: "ESL Media", href: getCorePath("eslMedia", "00-eslmedia/homepage.html"), target: "_top", logo: "eslm" },
          { label: "ESL Reference", href: getCorePath("eslReference", "00-assets/html/reference.htm"), target: "_top", className: "league-menu-link--accent" }
        ]
      },
      {
        title: "League",
        links: [
          { label: "Standings", href: "standings.htm" },
          { label: "Schedule", href: "schedule.htm" },
          { label: "League Leaders", href: "leaders.htm" },
          { label: "Team Leaders", href: "teamleaders.htm" },
          { label: "Supercup Index", href: getCorePath("supercupIndex", "00-SuperCup/index.htm"), target: "_top", className: "league-menu-link--accent" },
          { label: "Supercup KO", href: getCorePath("supercupKnockout", "00-assets/html/supercup-knockout.htm"), className: "league-menu-link--accent" },
          { label: "Transactions", href: "transactions.htm" }
        ]
      },
      {
        title: "Teams",
        links: [
          { label: "Injuries", href: "injuries.htm" },
          { label: "Cap Report", href: "capreport.htm" },
          { label: "Free Agents", href: "freeagents.htm" },
          { label: "Potential FAs", href: "potentialfreeagents.htm" }
        ]
      },
      {
        title: "Tools",
        links: [
          { label: "Depth Charts", href: getCorePath("depthCharts", "00-assets/html/depthcharts.htm") },
          { label: "Camps", href: getCorePath("camps", "00-assets/html/camps.htm") },
          { label: "FA War Room", href: getCorePath("faWarRoom", "00-assets/html/fa-war-room.htm") },
          { label: "Player Compare", href: getCorePath("playerCompare", "00-assets/html/player-compare.htm") },
          { label: "Trade Tool", href: getCorePath("tradeTool", "00-assets/html/trade-tool.htm") },
          { label: "Training Camp", href: getCorePath("trainingCamp", "00-assets/html/training-camp.htm") }
        ]
      },
      {
        title: "Season",
        links: [
          { label: "Youth Intake", href: getCorePath("youthIntake", "00-assets/html/youth-intake.htm") },
          { label: "Awards", href: "awards.htm" },
          { label: "Season Awards", href: "seasonawards.htm" },
          { label: "Past Champs", href: "champs.htm" }
        ]
      },
      {
        title: "Admin",
        links: [
          { label: "Settings", href: getCorePath("settings", "00-assets/html/settings.htm") },
          { label: "Human Coaches", href: "humancoaches.htm" }
        ]
      },
      {
        title: "Legacy",
        collapsed: true,
        links: [
          { label: "Draft Preview", href: "draft.htm" },
          { label: "Available Staff", href: "staff.htm" },
          { label: "Waiver Wire", href: "waiverwire.htm" },
          { label: "Playoff Standings", href: "playoffstandings.htm" },
          { label: "Playoffs", href: "playoffs.htm" },
          { label: "Playoff Leaders", href: "playoffleaders.htm" }
        ]
      }
    ];

    shell = menuDocument.createElement("nav");
    featureRow = menuDocument.createElement("div");
    logo = menuDocument.createElement("img");

    shell.className = "league-menu-shell";
    shell.setAttribute("aria-label", "League navigation");
    featureRow.className = "league-menu-feature-row";
    logo.className = "league-menu-logo";
    logo.src = getCorePath("leagueLogo", "00-assets/images/ESLcropped-removebg-preview.png");
    logo.alt = "ESL";
    featureRow.appendChild(logo);
    shell.appendChild(featureRow);

    groups.forEach(function (group) {
      shell.appendChild(makeFallbackMenuGroup(menuDocument, group.title, group.links, !!group.collapsed));
    });

    menuDocument.body.innerHTML = "";
    menuDocument.body.className = "menu-body";
    menuDocument.body.appendChild(shell);
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
        applyRawMenuFallback(menuDocument);
        buildGroupedMenuFallback(menuDocument);
        return;
      }

      menuDocument.documentElement.dataset.autoCloseBound = "true";
      applyRawMenuFallback(menuDocument);
      buildGroupedMenuFallback(menuDocument);
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


