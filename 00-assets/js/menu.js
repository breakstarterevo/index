(function () {
  "use strict";

  var core = window.LeagueSiteCore;
  var LeagueSettings = window.LeagueSettings || {};
  var MENU_STYLE_ID = "league-menu-enhancement-styles";
  var RESPONSIVE_MENU_STYLE_ID = "responsive-menu-toggle-styles";
  var MENU_BREAKPOINT = 760;

  if (!core) {
    return;
  }

  function isParentCompactWidth(parentWindow) {
    var screenWidth = parentWindow.screen && parentWindow.screen.width ? parentWindow.screen.width : parentWindow.innerWidth;
    return Math.min(parentWindow.innerWidth, screenWidth) <= MENU_BREAKPOINT;
  }

  function syncResponsiveMenuState(button) {
    var parentWindow;
    var isNarrow;

    try {
      parentWindow = window.parent;
      isNarrow = isParentCompactWidth(parentWindow);
    } catch (error) {
      return;
    }

    if (!isNarrow) {
      core.setParentMenuOpen(true);
      button.hidden = true;
      parentWindow.__leagueMenuUserToggled = false;
      return;
    }

    if (!parentWindow.__leagueMenuUserToggled) {
      core.setParentMenuOpen(false);
    }

    button.hidden = false;
    button.setAttribute("aria-expanded", String(core.isParentMenuOpen()));
  }

  function ensureResponsiveMenuToggleStyles() {
    if (document.getElementById(RESPONSIVE_MENU_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = RESPONSIVE_MENU_STYLE_ID;
    style.textContent = [
      ".league-menu-hamburger { position: fixed; top: 8px; left: 8px; z-index: 3000; width: 36px; height: 34px; border: 1px solid rgba(255,255,255,0.24); border-radius: 8px; background: #111b36; color: #ffffff; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.22); cursor: pointer; font: 800 18px/1 Inter, Tahoma, Arial, sans-serif; }",
      ".league-menu-hamburger:hover { background: #17274b; }",
      ".league-menu-hamburger[hidden] { display: none; }"
    ].join("");
    document.head.appendChild(style);
  }

  function initResponsiveFrameMenu() {
    var parentDocument = core.getParentShellDocument();
    var button;

    if (
      !parentDocument ||
      core.isMenuPage() ||
      document.querySelector(".league-menu-hamburger") ||
      parentDocument.querySelector(".site-menu-toggle")
    ) {
      return;
    }

    ensureResponsiveMenuToggleStyles();
    button = document.createElement("button");
    button.className = "league-menu-hamburger";
    button.type = "button";
    button.setAttribute("aria-label", "Toggle league menu");
    button.textContent = "\u2630";
    document.body.appendChild(button);

    button.addEventListener("click", function () {
      var parentWindow = window.parent;
      var nextOpen = !core.isParentMenuOpen();

      parentWindow.__leagueMenuUserToggled = true;
      core.setParentMenuOpen(nextOpen);
      button.setAttribute("aria-expanded", String(nextOpen));
    });

    window.__syncLeagueMenuButton = function () {
      syncResponsiveMenuState(button);
    };
    syncResponsiveMenuState(button);
    window.setInterval(function () {
      syncResponsiveMenuState(button);
    }, 500);

    try {
      window.parent.addEventListener("resize", function () {
        syncResponsiveMenuState(button);
      });
    } catch (error) {
      window.addEventListener("resize", function () {
        syncResponsiveMenuState(button);
      });
    }
  }

  function ensureCapReportMenuLink() {
    if (!core.isMenuPage()) {
      return;
    }

    var menuTable = document.querySelector("body > table");
    if (!menuTable || menuTable.querySelector('a[href="capreport.htm"]')) {
      return;
    }

    var anchor = menuTable.querySelector('a[href="injuries.htm"]');
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    var link = document.createElement("a");

    row.setAttribute("valign", "top");
    link.className = "menulink";
    link.target = "data";
    link.href = "capreport.htm";
    link.textContent = "Cap Report";
    cell.appendChild(link);
    row.appendChild(cell);

    if (anchor && anchor.parentNode && anchor.parentNode.parentNode && anchor.parentNode.parentNode.parentNode === menuTable) {
      anchor.parentNode.parentNode.insertAdjacentElement("afterend", row);
      return;
    }

    menuTable.appendChild(row);
  }

  function ensureDepthChartsMenuLink() {
    if (!core.isMenuPage()) {
      return;
    }

    var menuTable = document.querySelector("body > table");
    if (!menuTable || menuTable.querySelector('a[href="00-assets/html/depthcharts.htm"], a[href="/00-assets/html/depthcharts.htm"]')) {
      return;
    }

    var anchor = menuTable.querySelector('a[href="capreport.htm"]') || menuTable.querySelector('a[href="injuries.htm"]');
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    var link = document.createElement("a");

    row.setAttribute("valign", "top");
    link.className = "menulink";
    link.target = "data";
    link.href = core.paths.depthCharts;
    link.textContent = "Depth Charts";
    cell.appendChild(link);
    row.appendChild(cell);

    if (anchor && anchor.parentNode && anchor.parentNode.parentNode && anchor.parentNode.parentNode.parentNode === menuTable) {
      anchor.parentNode.parentNode.insertAdjacentElement("afterend", row);
      return;
    }

    menuTable.appendChild(row);
  }

  function ensureTradeToolMenuLink() {
    if (!core.isMenuPage()) {
      return;
    }

    var menuTable = document.querySelector("body > table");
    if (!menuTable || menuTable.querySelector('a[href$="trade-tool.htm"]')) {
      return;
    }

    var anchor = menuTable.querySelector('a[href$="depthcharts.htm"]') ||
      menuTable.querySelector('a[href="capreport.htm"]') ||
      menuTable.querySelector('a[href="injuries.htm"]');
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    var link = document.createElement("a");

    row.setAttribute("valign", "top");
    link.className = "menulink";
    link.target = "data";
    link.href = core.paths.tradeTool;
    link.textContent = "Trade Tool";
    cell.appendChild(link);
    row.appendChild(cell);

    if (anchor && anchor.parentNode && anchor.parentNode.parentNode && anchor.parentNode.parentNode.parentNode === menuTable) {
      anchor.parentNode.parentNode.insertAdjacentElement("afterend", row);
      return;
    }

    menuTable.appendChild(row);
  }

  function ensureLeagueMenuStyles() {
    if (document.getElementById(MENU_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = MENU_STYLE_ID;
    style.textContent = [
      "body.menu-body { background: #111b36 !important; color: #ffffff; font-family: 'Inter', Tahoma, Arial, sans-serif; font-size: 10.8pt; line-height: 1.16; margin: 0; padding: 0; overflow-x: hidden; }",
      ".league-menu-shell { display: flex; flex-direction: column; gap: 0; }",
      ".league-menu-link, .league-menu-toggle { font-family: 'Inter', Tahoma, Arial, sans-serif; text-decoration: none; }",
      ".league-menu-link { color: #ffffff; display: block; font-size: 9.8pt; font-weight: 600; line-height: 1.08; padding: 6px 7px 6px 9px; }",
      ".league-menu-link:hover { background: rgba(255, 255, 255, 0.08); color: #ffffff; text-decoration: none; }",
      ".league-menu-link--accent { color: #d4af5a; }",
      ".league-menu-link--accent:hover { color: #e3c777; }",
      ".league-menu-feature { align-items: center; background: #111b36; color: #ffffff !important; display: flex; justify-content: center; min-height: 42px; padding: 5px 2px; }",
      ".league-menu-feature:hover { background: rgba(255, 255, 255, 0.08); }",
      ".league-menu-feature-row { align-items: center; border-bottom: 1px solid rgba(148, 163, 184, 0.45); display: flex; justify-content: center; min-height: 50px; padding: 5px 7px; }",
      ".league-menu-logo { display: block; max-width: 84px; width: 100%; max-height: 38px; object-fit: contain; filter: brightness(0) invert(1); }",
      ".league-menu-logo--supercup { filter: none; }",
      ".league-menu-eslm-logo { display: block; max-width: 94px; width: 100%; max-height: 22px; object-fit: contain; object-position: left center; filter: brightness(0) invert(1); }",
      ".league-menu-eslm-logo--supercup { filter: brightness(0) saturate(100%) invert(76%) sepia(39%) saturate(744%) hue-rotate(356deg) brightness(95%) contrast(94%); }",
      ".league-menu-back-link { align-items: center; border: 1px solid rgba(212, 175, 90, 0.45); border-radius: 999px; color: #d4af5a; display: inline-flex; flex: 0 0 auto; font-size: 6.8pt; font-weight: 800; letter-spacing: 0.08em; line-height: 1; margin-left: 6px; padding: 5px 8px; text-decoration: none; text-transform: uppercase; white-space: nowrap; }",
      ".league-menu-back-link:hover { background: rgba(212, 175, 90, 0.12); color: #e3c777; text-decoration: none; }",
      ".league-menu-fallback { color: #ffffff; font: 800 11pt/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: 0.05em; text-transform: uppercase; }",
      ".league-menu-group { border-bottom: 1px solid rgba(148, 163, 184, 0.24); overflow: hidden; }",
      ".league-menu-toggle { align-items: center; background: #111b36; border: 0; color: #94a3b8; cursor: pointer; display: flex; font-size: 8.7pt; font-weight: 800; justify-content: space-between; letter-spacing: 0.09em; padding: 7px 7px 3px 9px; text-align: left; text-transform: uppercase; width: 100%; }",
      ".league-menu-toggle:hover { background: rgba(255, 255, 255, 0.08); }",
      ".league-menu-shell--supercup .league-menu-toggle { color: #d4af5a; }",
      ".league-menu-toggle::after { content: '-'; font-weight: 800; }",
      ".league-menu-group.is-collapsed .league-menu-toggle::after { content: '+'; }",
      ".league-menu-links { display: flex; flex-direction: column; gap: 0; padding-top: 0; }",
      ".league-menu-group.is-collapsed .league-menu-links { display: none; }",
      "@media (max-height: 680px) { .league-menu-link { font-size: 9.2pt; padding: 5px 6px 5px 8px; } .league-menu-toggle { font-size: 8.1pt; padding: 6px 6px 2px 8px; } .league-menu-feature-row { min-height: 42px; padding-left: 6px; padding-right: 6px; } .league-menu-feature { min-height: 34px; } .league-menu-logo { max-height: 32px; } }",
      "html.league-pref-density-compact .league-menu-link { padding-top: 4px; padding-bottom: 4px; }",
      "html.league-pref-density-compact .league-menu-toggle { padding-top: 5px; padding-bottom: 2px; }",
      "html.league-pref-density-spacious .league-menu-link { padding-top: 8px; padding-bottom: 8px; }",
      "html.league-pref-density-spacious .league-menu-toggle { padding-top: 9px; padding-bottom: 4px; }",
      "@media (max-height: 680px) { html.league-pref-density-compact .league-menu-link { padding-top: 3px; padding-bottom: 3px; } html.league-pref-density-compact .league-menu-toggle { padding-top: 4px; padding-bottom: 1px; } }"
    ].join("");
    document.head.appendChild(style);
  }

  function makeMenuLink(label, href, className) {
    var link = document.createElement("a");
    link.className = className || "league-menu-link";
    link.target = "data";
    link.href = href;
    link.textContent = label;
    link.addEventListener("click", function (event) {
      if (link.target !== "data") {
        return;
      }
      try {
        if (window.parent && window.parent.frames && window.parent.frames.data) {
          event.preventDefault();
          window.parent.frames.data.location.href = link.getAttribute("href");
        }
      } catch (error) {
        // Let default navigation proceed when frame access is blocked.
      }
    });
    return link;
  }

  function makeLeagueLogoLink() {
    var isSuperCup = core.isSuperCupPage();
    var link = makeMenuLink("", isSuperCup ? core.paths.supercupDashboard : core.paths.leagueDashboard, "league-menu-link league-menu-feature");
    var logo = document.createElement("img");
    var fallback = document.createElement("span");

    logo.className = isSuperCup ? "league-menu-logo league-menu-logo--supercup" : "league-menu-logo";
    logo.src = isSuperCup ? core.paths.supercupLogo : core.paths.leagueLogo;
    logo.alt = isSuperCup ? "ESL Super Cup" : "European Super League";

    fallback.className = "league-menu-fallback";
    fallback.textContent = isSuperCup ? "SC" : "ESL";

    logo.addEventListener("error", function () {
      logo.remove();
      if (!link.contains(fallback)) {
        link.appendChild(fallback);
      }
    });

    link.appendChild(logo);
    return link;
  }

  function makeBackToIndexLink(label, className) {
    var link = makeMenuLink(label || "Back to Index", core.paths.mainIndex, className || "league-menu-link");
    link.target = "_top";
    return link;
  }

  function makeEslMediaLogoLink() {
    var isSuperCup = core.isSuperCupPage();
    var link = makeMenuLink("", core.paths.eslMedia);
    var logo = document.createElement("img");
    var fallback = document.createElement("span");

    link.target = "_top";
    logo.className = isSuperCup ? "league-menu-eslm-logo league-menu-eslm-logo--supercup" : "league-menu-eslm-logo";
    logo.src = core.paths.eslMediaLogo;
    logo.alt = "ESL Media";

    fallback.textContent = "ESL Media";

    logo.addEventListener("error", function () {
      logo.remove();
      if (!link.contains(fallback)) {
        link.appendChild(fallback);
      }
    });

    link.appendChild(logo);
    return link;
  }

  function makeMenuGroup(title, links, options) {
    var section = document.createElement("section");
    var toggle = document.createElement("button");
    var linkWrap = document.createElement("div");
    var opts = options || {};
    var isCollapsed = !!opts.collapsed;

    section.className = "league-menu-group";
    if (isCollapsed) {
      section.classList.add("is-collapsed");
    }
    toggle.className = "league-menu-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.textContent = title;
    linkWrap.className = "league-menu-links";

    links.forEach(function (link) {
      var menuLink = link.logo === "eslm" ? makeEslMediaLogoLink() : makeMenuLink(link.label, link.href);

      if (link.target) {
        menuLink.target = link.target;
      }

      if (link.className) {
        String(link.className)
          .split(/\s+/)
          .filter(Boolean)
          .forEach(function (name) {
            menuLink.classList.add(name);
          });
      }

      linkWrap.appendChild(menuLink);
    });

    toggle.addEventListener("click", function () {
      var collapsed = section.classList.toggle("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
    });

    section.appendChild(toggle);
    section.appendChild(linkWrap);
    return section;
  }

  function enhanceLeagueMenu() {
    if (!core.isMenuPage() || document.querySelector(".league-menu-shell")) {
      return;
    }

    ensureLeagueMenuStyles();
    document.body.className = (document.body.className ? document.body.className + " " : "") + "menu-body";
    document.body.setAttribute("bgcolor", "#111b36");

    var groups = [
      {
        title: "League",
        links: [
          { label: "Standings", href: "standings.htm" },
          { label: "Schedule", href: "schedule.htm" },
          { label: "League Leaders", href: "leaders.htm" },
          { label: "Team Leaders", href: "teamleaders.htm" },
          { label: "Supercup Index", href: core.paths.supercupIndex, className: "league-menu-link--accent", target: "_top" },
          { label: "Supercup KO", href: core.paths.supercupKnockout, className: "league-menu-link--accent" },
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
          { label: "Depth Charts", href: core.paths.depthCharts },
          { label: "Camps", href: core.paths.camps },
          { label: "FA War Room", href: core.paths.faWarRoom },
          { label: "Player Database", href: core.paths.playerDatabase },
          { label: "Player Compare", href: core.paths.playerCompare },
          { label: "Trade Tool", href: core.paths.tradeTool },
          { label: "Training Camp", href: core.paths.trainingCamp }
        ]
      },
      {
        title: "Season",
        links: [
          { label: "Youth Intake", href: core.paths.youthIntake },
          { label: "Future Player Pool", href: core.paths.futurePlayerPool },
          { label: "Awards", href: "awards.htm" },
          { label: "Season Awards", href: "seasonawards.htm" },
          { label: "Past Champs", href: "champs.htm" }
        ]
      },
      {
        title: "Admin",
        links: [
          { label: "Settings", href: core.paths.settings },
          { label: "Human Coaches", href: "humancoaches.htm" }
        ]
      },
      {
        title: "Legacy",
        links: [
          { label: "Draft Preview", href: "draft.htm" },
          { label: "Available Staff", href: "staff.htm" },
          { label: "Waiver Wire", href: "waiverwire.htm" },
          { label: "Playoff Standings", href: "playoffstandings.htm" },
          { label: "Playoffs", href: "playoffs.htm" },
          { label: "Playoff Leaders", href: "playoffleaders.htm" }
        ],
        collapsed: true
      }
    ];

    if (core.isSuperCupPage()) {
      groups = groups.map(function (group) {
        if (group.title === "League") {
          var nextLinks = [];
          (group.links || []).forEach(function (link) {
            if (link.label === "Supercup Index" || link.label === "Supercup KO") {
              return;
            }
            nextLinks.push(link);
            if (link.label === "Team Leaders") {
              nextLinks.push({ label: "Knockout", href: core.paths.supercupKnockout, className: "league-menu-link--accent" });
            }
          });
          return {
            title: group.title,
            links: nextLinks,
            collapsed: !!group.collapsed
          };
        }
        if (group.title === "Legacy") {
          return {
            title: group.title,
            links: (group.links || []).map(function (link) {
              if (link.label === "Playoffs") {
                return { label: "Playoffs", href: core.paths.supercupKnockout };
              }
              return link;
            }),
            collapsed: !!group.collapsed
          };
        }
        if (group.title === "Season") {
          return {
            title: group.title,
            links: (group.links || []).filter(function (link) {
              return link.label !== "Youth Intake" &&
                link.label !== "Future Player Pool" &&
                link.label !== "Playoff Standings" &&
                link.label !== "Past Champs";
            }),
            collapsed: !!group.collapsed
          };
        }
        if (group.title !== "Admin") {
          return group;
        }
        return {
          title: group.title,
          links: (group.links || []).filter(function (link) {
            return link.label !== "Settings";
          }),
          collapsed: !!group.collapsed
        };
      }).filter(function (group) {
        return Array.isArray(group.links) && group.links.length > 0;
      });
    }

    var shell = document.createElement("nav");
    var featureRow = document.createElement("div");

    shell.className = "league-menu-shell";
    if (core.isSuperCupPage()) {
      shell.className += " league-menu-shell--supercup";
    }
    shell.setAttribute("aria-label", "League navigation");
    featureRow.className = "league-menu-feature-row";
    featureRow.appendChild(makeLeagueLogoLink());
    shell.appendChild(featureRow);
    shell.appendChild(makeMenuGroup("Media", [
      { label: "ESL Media", href: core.paths.eslMedia, target: "_top", logo: "eslm" },
      { label: "ESL Reference", href: core.paths.eslReference, target: "_top", className: "league-menu-link--accent" }
    ]));
    groups.forEach(function (group) {
      shell.appendChild(makeMenuGroup(group.title, group.links, { collapsed: !!group.collapsed }));
    });
    if (core.isSuperCupPage()) {
      shell.appendChild(makeBackToIndexLink("Back to Index"));
    }

    document.body.innerHTML = "";
    document.body.appendChild(shell);
  }

  function initMenuEnhancements() {
    core.enableMenuFrameScroll();
    initResponsiveFrameMenu();
    ensureCapReportMenuLink();
    ensureDepthChartsMenuLink();
    ensureTradeToolMenuLink();
    enhanceLeagueMenu();
    if (LeagueSettings.applySavedPreferences) {
      LeagueSettings.applySavedPreferences();
    }
  }

  window.LeagueMenuEnhancements = {
    init: initMenuEnhancements,
    enhanceLeagueMenu: enhanceLeagueMenu
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenuEnhancements);
  } else {
    initMenuEnhancements();
  }
})();
