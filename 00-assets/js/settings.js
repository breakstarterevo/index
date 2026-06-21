(function () {
  "use strict";

  var core = window.LeagueSiteCore;
  var SETTINGS_STYLE_ID = "league-settings-styles";
  var PREFERENCE_STYLE_ID = "league-preference-styles";
  var THEME_CLASSES = [
    "league-theme-light",
    "league-theme-dark"
  ];

  if (!core) {
    return;
  }

  function ensurePreferenceStyles() {
    if (document.getElementById(PREFERENCE_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = PREFERENCE_STYLE_ID;
    style.textContent = [
      "html.league-theme-dark { color-scheme: dark; --team-color-2: #2f5f9f; --ink: #e8eef7; --muted: #a9b6c8; --mid: #8fa6c3; --paper: #0d1118; --card: #151b25; --soft: #1a2331; --line: rgba(148, 163, 184, .24); --blue: #8ec5ff; --green: #82e6a7; --red: #f59da5; --good: #82e6a7; --warn: #f9dfa1; --bad: #f59da5; --fa-paper: #0d1118; --fa-card: #151b25; --fa-soft: #1a2331; --fa-ink: #e8eef7; --fa-muted: #a9b6c8; --fa-line: rgba(148, 163, 184, .24); --camp-paper: #0d1118; --camp-card: #151b25; --camp-soft: #1a2331; --camp-ink: #e8eef7; --camp-muted: #a9b6c8; --camp-line: rgba(148, 163, 184, .24); }",
      "html.league-theme-dark body { background: #0d1118 !important; color: #e8eef7 !important; }",
      "html.league-theme-dark a { color: #8ec5ff; }",
      "html.league-theme-dark input, html.league-theme-dark select, html.league-theme-dark textarea { background: #192231; border-color: rgba(148, 163, 184, .34); color: #f3f7ff; }",
      "html.league-theme-dark input::placeholder, html.league-theme-dark textarea::placeholder { color: #7f8ca1; opacity: 1; }",
      "html.league-theme-dark .panel, html.league-theme-dark .tc-panel, html.league-theme-dark .trade-panel, html.league-theme-dark .trade-team-card, html.league-theme-dark .depth-panel, html.league-theme-dark .gm-dashboard-panel, html.league-theme-dark .knockout-round, html.league-theme-dark .fa-panel, html.league-theme-dark .league-settings__card, html.league-theme-dark .leader-card, html.league-theme-dark .summary-card, html.league-theme-dark .stat-card, html.league-theme-dark .metric-card, html.league-theme-dark .reference-card, html.league-theme-dark .media-card, html.league-theme-dark .rating-card, html.league-theme-dark .knockout-card { background: #151b25; border-color: rgba(148, 163, 184, .22); box-shadow: none; color: #e8eef7; }",
      "html.league-theme-dark .panel-head, html.league-theme-dark .tc-panel-head, html.league-theme-dark .trade-panel__head, html.league-theme-dark .depth-panel__head, html.league-theme-dark .knockout-round-head { background: #1a2331; border-color: rgba(148, 163, 184, .18); color: #e8eef7; }",
      "html.league-theme-dark .kicker, html.league-theme-dark .fa-kicker, html.league-theme-dark .tc-kicker, html.league-theme-dark .search-label, html.league-theme-dark .slot-label, html.league-theme-dark .fa-label, html.league-theme-dark .trade-card-label, html.league-theme-dark .trade-field-label, html.league-theme-dark .depth-label, html.league-theme-dark .preset-label, html.league-theme-dark .reference-card-kicker, html.league-theme-dark .media-kicker, html.league-theme-dark .gm-bar-label, html.league-theme-dark .gm-bar-value, html.league-theme-dark .weekday { color: #9fc5ff; }",
      "html.league-theme-dark .panel-title, html.league-theme-dark .tc-panel-title, html.league-theme-dark .fa-panel-title, html.league-theme-dark .rating-card-title, html.league-theme-dark .stat-card-title, html.league-theme-dark .reference-card-title, html.league-theme-dark .media-title, html.league-theme-dark .gm-card h3, html.league-theme-dark .gm-subhead, html.league-theme-dark .month-title, html.league-theme-dark .team-name, html.league-theme-dark .compare-title, html.league-theme-dark .tc-title, html.league-theme-dark .fa-title, html.league-theme-dark .depth-title, html.league-theme-dark .camp-title { color: #f8fbff; }",
      "html.league-theme-dark .note, html.league-theme-dark .empty, html.league-theme-dark .status, html.league-theme-dark .status-text, html.league-theme-dark .team-sub, html.league-theme-dark .compare-subtitle, html.league-theme-dark .tc-subtitle, html.league-theme-dark .fa-subtitle, html.league-theme-dark .reference-card-copy, html.league-theme-dark .media-mention-meta, html.league-theme-dark .media-mention-blurb, html.league-theme-dark .trade-note, html.league-theme-dark .depth-subtitle, html.league-theme-dark .camp-subtitle { color: #a9b6c8; }",
      "html.league-theme-dark .btn, html.league-theme-dark .tab, html.league-theme-dark .tab-btn, html.league-theme-dark .btn-link, html.league-theme-dark .league-btn, html.league-theme-dark .quick-link, html.league-theme-dark .trade-btn, html.league-theme-dark .trade-mini-btn, html.league-theme-dark .depth-button, html.league-theme-dark .camp-button, html.league-theme-dark .tc-button, html.league-theme-dark .player-search-option { background: #1a2537; border-color: rgba(148, 163, 184, .32); color: #edf4ff; }",
      "html.league-theme-dark .tab.active, html.league-theme-dark .tab-btn.active, html.league-theme-dark .player-search-option.active, html.league-theme-dark .trade-btn--primary, html.league-theme-dark .depth-button--primary, html.league-theme-dark .camp-button--primary { background: var(--team-color, #1f4f91); border-color: var(--team-color, #1f4f91); color: #ffffff; }",
      "html.league-theme-dark .data-table, html.league-theme-dark .compare-table, html.league-theme-dark .contract-table, html.league-theme-dark .standings-table, html.league-theme-dark .leaders-table, html.league-theme-dark .intake-table, html.league-theme-dark .tc-table, html.league-theme-dark .table, html.league-theme-dark .depth-table { background: #141b26; color: #edf3fb; }",
      "html.league-theme-dark .data-table th, html.league-theme-dark .compare-table th, html.league-theme-dark .contract-table th, html.league-theme-dark .standings-table th, html.league-theme-dark .leaders-table th, html.league-theme-dark .intake-table th, html.league-theme-dark .tc-table th, html.league-theme-dark .table th, html.league-theme-dark .depth-table th { background: var(--team-color, #0f172a); border-color: rgba(148, 163, 184, .16); color: #ffffff; }",
      "html.league-theme-dark .data-table td, html.league-theme-dark .compare-table td, html.league-theme-dark .contract-table td, html.league-theme-dark .standings-table td, html.league-theme-dark .leaders-table td, html.league-theme-dark .intake-table td, html.league-theme-dark .tc-table td, html.league-theme-dark .table td, html.league-theme-dark .depth-table td { background: #141b26; border-color: rgba(148, 163, 184, .18); color: #edf3fb; }",
      "html.league-theme-dark .data-table tbody tr:nth-child(even) td, html.league-theme-dark .compare-table tbody tr:nth-child(even) td, html.league-theme-dark .contract-table tbody tr:nth-child(even) td, html.league-theme-dark .standings-table tbody tr:nth-child(even) td, html.league-theme-dark .leaders-table tbody tr:nth-child(even) td, html.league-theme-dark .intake-table tbody tr:nth-child(even) td, html.league-theme-dark .tc-table tbody tr:nth-child(even) td, html.league-theme-dark .table tbody tr:nth-child(even) td, html.league-theme-dark .depth-table tr:nth-child(even) td { background: #1a2331; }",
      "html.league-theme-dark .data-table tbody tr td.rating-purple, html.league-theme-dark #playerTable.data-table td.rating-purple { background: #7e22ce !important; color: #ffffff !important; font-weight: 900 !important; }",
      "html.league-theme-dark .data-table tbody tr td.rating-blue, html.league-theme-dark #playerTable.data-table td.rating-blue { background: #1d4ed8 !important; color: #ffffff !important; font-weight: 900 !important; }",
      "html.league-theme-dark .data-table tbody tr td.rating-green, html.league-theme-dark #playerTable.data-table td.rating-green { background: #15803d !important; color: #ffffff !important; font-weight: 900 !important; }",
      "html.league-theme-dark .data-table tbody tr td.rating-yellow, html.league-theme-dark #playerTable.data-table td.rating-yellow { background: #facc15 !important; color: #1f2937 !important; font-weight: 900 !important; }",
      "html.league-theme-dark .data-table tbody tr td.rating-orange, html.league-theme-dark #playerTable.data-table td.rating-orange { background: #f97316 !important; color: #ffffff !important; font-weight: 900 !important; }",
      "html.league-theme-dark .hero { background: linear-gradient(90deg, var(--team-color, #1d3666), #06080f); border-color: rgba(148, 163, 184, .24); color: #ffffff; }",
      "html.league-theme-dark .player-header { border-left-color: var(--team-color, #1d3666); }",
      "html.league-theme-dark .fa-header, html.league-theme-dark .fa-panel, html.league-theme-dark .fa-player-popover { border-top-color: var(--fa-accent, #1f4f91); }",
      "html.league-theme-dark .fa-button, html.league-theme-dark .fa-table th, html.league-theme-dark .fa-rating, html.league-theme-dark .fa-popover-stats, html.league-theme-dark .fa-drawer-head { background: var(--fa-accent, #1f4f91); border-color: var(--fa-accent, #1f4f91); color: #ffffff; }",
      "html.league-theme-dark .depth-header, html.league-theme-dark .camp-header { background: #151b25; border-color: rgba(148, 163, 184, .24); border-top-color: var(--depth-team-color, var(--camp-accent, #1f4f91)); box-shadow: none; }",
      "html.league-theme-dark .depth-panel__head, html.league-theme-dark .depth-table th { background: var(--depth-team-color, #0f172a); border-color: var(--depth-team-color, #0f172a); color: #ffffff; }",
      "html.league-theme-dark .camp-panel { border-top-color: var(--camp-accent, #1f4f91); }",
      "html.league-theme-dark .camp-panel-head { border-bottom-color: var(--camp-accent, #1f4f91); }",
      "html.league-theme-dark .camp-button--primary { background: var(--camp-accent, #1f4f91); border-color: var(--camp-accent, #1f4f91); color: #ffffff; }",
      "html.league-pref-text-small body { font-size: 92%; }",
      "html.league-pref-text-large body { font-size: 112%; }",
      "html.league-pref-density-compact td.main, html.league-pref-density-compact td.header { padding-top: 3px !important; padding-bottom: 3px !important; }",
      "html.league-pref-density-spacious td.main, html.league-pref-density-spacious td.header { padding-top: 8px !important; padding-bottom: 8px !important; }",
      ".league-favorite-row > td { background-color: #fff3bf !important; }",
      ".league-favorite-row a { font-weight: 800 !important; }",
      "body.page-settings { background: #f4f2ec !important; color: #172033; font-family: Georgia, 'Times New Roman', serif; margin: 0; }",
      "html.league-theme-dark body.page-settings { background: #111318 !important; color: #f3f6fb !important; }"
    ].join("");
    document.head.appendChild(style);
  }

  function normalizeTheme(theme) {
    return String(theme || "").toLowerCase() === "dark" ? "dark" : "light";
  }

  function normalizeHexColor(value) {
    var match = String(value || "").match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    var hex;

    if (!match) {
      return "";
    }

    hex = match[1];
    if (hex.length === 3) {
      hex = hex.split("").map(function (char) { return char + char; }).join("");
    }

    return "#" + hex.toUpperCase();
  }

  function getContrastText(hex) {
    var normalized = normalizeHexColor(hex).slice(1);
    var red;
    var green;
    var blue;
    var brightness;

    if (!normalized) {
      return "#ffffff";
    }

    red = parseInt(normalized.slice(0, 2), 16);
    green = parseInt(normalized.slice(2, 4), 16);
    blue = parseInt(normalized.slice(4, 6), 16);
    brightness = (red * 299 + green * 587 + blue * 114) / 1000;

    return brightness > 150 ? "#111827" : "#ffffff";
  }

  function extractClassicTeamColor() {
    var styleText = Array.prototype.slice.call(document.querySelectorAll("style")).map(function (style) {
      return style.textContent || "";
    }).join("\n");
    var patterns = [
      /td\.teamheader\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i,
      /td\.teamheader2\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i,
      /td\.plainheader\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i,
      /tr\.teamcolor\s*\{[^}]*background\s*:\s*(#[0-9a-f]{3,6})/i
    ];
    var index;
    var match;
    var color;

    for (index = 0; index < patterns.length; index += 1) {
      match = styleText.match(patterns[index]);
      color = match ? normalizeHexColor(match[1]) : "";
      if (color) {
        return color;
      }
    }

    return "";
  }

  function applyClassicTeamColor() {
    var color = extractClassicTeamColor();
    var root = document.documentElement;

    root.classList.remove("league-has-classic-team-color");
    root.style.removeProperty("--classic-team-color");
    root.style.removeProperty("--classic-team-text");
    root.style.removeProperty("--team-color");

    if (!color) {
      return;
    }

    root.style.setProperty("--classic-team-color", color);
    root.style.setProperty("--classic-team-text", getContrastText(color));
    root.style.setProperty("--team-color", color);
    root.classList.add("league-has-classic-team-color");
  }

  function applySavedPreferences() {
    var settings = core.getSettings();
    var root = document.documentElement;

    ensurePreferenceStyles();
    applyClassicTeamColor();
    root.style.removeProperty("background-color");
    root.style.removeProperty("color-scheme");
    root.classList.remove(
      THEME_CLASSES[0],
      THEME_CLASSES[1],
      "league-pref-text-small",
      "league-pref-text-normal",
      "league-pref-text-large",
      "league-pref-density-compact",
      "league-pref-density-normal",
      "league-pref-density-spacious"
    );

    root.classList.add("league-theme-" + normalizeTheme(settings.theme));
    root.classList.add("league-pref-text-" + (settings.textSize || "normal"));
    root.classList.add("league-pref-density-" + (settings.tableDensity || "normal"));
  }

  function highlightFavoriteTeam(teams) {
    var settings = core.getSettings();
    var favorite = core.normalizeName(settings.favoriteTeam);
    var favoriteTeam;
    var favoritePattern;

    if (!favorite || core.isMenuPage() || core.isSettingsPage()) {
      return;
    }

    favoriteTeam = (teams || []).find(function (team) {
      return core.normalizeName(team && team.name) === favorite;
    });

    if (!favoriteTeam) {
      return;
    }

    favoritePattern = new RegExp("(^|[^a-z0-9])" + favorite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)", "i");

    Array.prototype.slice.call(document.querySelectorAll("tr.row1, tr.row2")).forEach(function (row) {
      var directCells = Array.prototype.slice.call(row.children);
      var hasNestedTable = directCells.some(function (cell) {
        return cell.querySelector && cell.querySelector("table");
      });
      var links = Array.prototype.slice.call(row.querySelectorAll("a"));
      var linkMatch = links.some(function (link) {
        return core.normalizeName(link.textContent) === favorite;
      });
      var rowText = core.normalizeName(row.textContent);

      if (hasNestedTable || !directCells.some(function (cell) { return cell.classList && cell.classList.contains("main"); })) {
        return;
      }

      if (linkMatch || favoritePattern.test(rowText)) {
        row.classList.add("league-favorite-row");
      }
    });
  }

  function ensureSettingsStyles() {
    if (document.getElementById(SETTINGS_STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = SETTINGS_STYLE_ID;
    style.textContent = [
      ".league-settings { max-width: 920px; margin: 0 auto; padding: 34px 22px 46px; }",
      ".league-settings__eyebrow { color: #8b6f32; font: 800 11px/1.2 Inter, Tahoma, Arial, sans-serif; letter-spacing: 0.14em; margin: 0 0 8px; text-transform: uppercase; }",
      ".league-settings__title { color: #121826; font: 800 34px/1.02 Georgia, 'Times New Roman', serif; margin: 0; }",
      ".league-settings__lede { color: #4c5870; font: 500 15px/1.45 Inter, Tahoma, Arial, sans-serif; margin: 10px 0 22px; max-width: 650px; }",
      ".league-settings__grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }",
      ".league-settings__card { background: #fffdf7; border: 1px solid #d7c9a8; box-shadow: 0 8px 20px rgba(23, 32, 51, 0.08); padding: 16px; }",
      ".league-settings__card label { color: #172033; display: block; font: 800 12px/1.2 Inter, Tahoma, Arial, sans-serif; letter-spacing: 0.08em; margin-bottom: 8px; text-transform: uppercase; }",
      ".league-settings__card p { color: #5b6475; font: 500 13px/1.35 Inter, Tahoma, Arial, sans-serif; margin: 8px 0 0; }",
      ".league-settings select { background: #ffffff; border: 1px solid #a99b78; color: #172033; font: 600 14px/1.2 Inter, Tahoma, Arial, sans-serif; min-height: 38px; padding: 7px 9px; width: 100%; }",
      ".league-settings__actions { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }",
      ".league-settings__button { background: #111b36; border: 0; color: #fff; cursor: pointer; font: 800 12px/1 Inter, Tahoma, Arial, sans-serif; letter-spacing: 0.08em; padding: 12px 16px; text-transform: uppercase; }",
      ".league-settings__button--secondary { background: transparent; border: 1px solid #111b36; color: #111b36; }",
      ".league-settings__status { color: #2f6b3b; font: 700 13px/1.3 Inter, Tahoma, Arial, sans-serif; min-height: 18px; }",
      "html.league-theme-dark .league-settings__eyebrow { color: #93c5fd; }",
      "html.league-theme-dark .league-settings__title, html.league-theme-dark .league-settings__card label { color: #f9fafb; }",
      "html.league-theme-dark .league-settings__lede, html.league-theme-dark .league-settings__card p { color: #cbd5e1; }",
      "html.league-theme-dark .league-settings__card { background: #171d27; border-color: #374151; box-shadow: none; }",
      "html.league-theme-dark .league-settings select { background: #1f2937; border-color: #4b5563; color: #f9fafb; }",
      "html.league-theme-dark .league-settings__button { background: #1d3666; color: #ffffff; }",
      "html.league-theme-dark .league-settings__button--secondary { background: transparent; border-color: #f9fafb; color: #f9fafb; }",
      "html.league-theme-dark .league-settings__status { color: #86efac; }",
      "@media (max-width: 720px) { .league-settings { padding: 26px 14px 36px; } .league-settings__grid { grid-template-columns: 1fr; } .league-settings__title { font-size: 28px; } }"
    ].join("");
    document.head.appendChild(style);
  }

  function createOption(value, label, selectedValue) {
    var option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedValue;
    return option;
  }

  function addSettingsSelect(form, config) {
    var card = document.createElement("section");
    var label = document.createElement("label");
    var select = document.createElement("select");
    var help = document.createElement("p");

    card.className = "league-settings__card";
    label.setAttribute("for", config.id);
    label.textContent = config.label;
    select.id = config.id;
    select.name = config.name;
    config.options.forEach(function (option) {
      select.appendChild(createOption(option.value, option.label, config.value));
    });
    help.textContent = config.help;

    card.appendChild(label);
    card.appendChild(select);
    card.appendChild(help);
    form.appendChild(card);
  }

  function buildTeamOptions(teams) {
    var options = [{ value: "", label: "None" }];

    (teams || []).slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    }).forEach(function (team) {
      if (team && team.name) {
        options.push({ value: team.name, label: team.name });
      }
    });

    return options;
  }

  function buildTeamLandingOptions(teams) {
    var options = [{ value: "", label: "Choose team" }];

    (teams || []).slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    }).forEach(function (team) {
      if (team && team.name && team.file) {
        options.push({ value: team.file, label: team.name });
      }
    });

    return options;
  }

  function initSettingsPage(teams) {
    var root = document.getElementById("league-settings-root");
    var settings = core.getSettings();
    var form;
    var status;

    if (!core.isSettingsPage() || !root) {
      return;
    }

    ensureSettingsStyles();
    document.body.classList.add("page-settings");
    root.innerHTML = [
      '<div class="league-settings">',
      '  <p class="league-settings__eyebrow">League Site</p>',
      '  <h1 class="league-settings__title">Settings</h1>',
      '  <p class="league-settings__lede">Tune the site for how you actually browse it. These preferences save in this browser only.</p>',
      '  <form class="league-settings__grid" id="league-settings-form"></form>',
      '  <div class="league-settings__actions">',
      '    <button class="league-settings__button" id="league-settings-save" type="button">Save Settings</button>',
      '    <button class="league-settings__button league-settings__button--secondary" id="league-settings-reset" type="button">Reset</button>',
      '    <span class="league-settings__status" id="league-settings-status" aria-live="polite"></span>',
      "  </div>",
      "</div>"
    ].join("");

    form = document.getElementById("league-settings-form");
    status = document.getElementById("league-settings-status");

    addSettingsSelect(form, {
      id: "setting-theme",
      name: "theme",
      label: "Color Mode",
      value: normalizeTheme(settings.theme),
      help: "Switches the site between the normal light look and a high-contrast dark background.",
      options: [
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-default-page",
      name: "defaultPage",
      label: "Default Landing Page",
      value: settings.defaultPage || "standings.htm",
      help: "The page the main league frame opens to first.",
      options: [
        { value: "standings.htm", label: "Standings" },
        { value: "schedule.htm", label: "Schedule" },
        { value: "00-assets/html/league%20dashboard.htm", label: "League Dashboard" },
        { value: "__unified_team_page__", label: "Unified Team Page" },
        { value: "leaders.htm", label: "League Leaders" },
        { value: "teamleaders.htm", label: "Team Leaders" },
        { value: "transactions.htm", label: "Transactions" },
        { value: "freeagents.htm", label: "Free Agents" },
        { value: "00-assets/html/fa-war-room.htm", label: "FA War Room" },
        { value: "awards.htm", label: "Awards" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-default-team-page",
      name: "defaultTeamPage",
      label: "Unified Team Landing",
      value: settings.defaultTeamPage || "",
      help: "Used only when Default Landing Page is set to Unified Team Page.",
      options: buildTeamLandingOptions(teams)
    });
    addSettingsSelect(form, {
      id: "setting-favorite-team",
      name: "favoriteTeam",
      label: "Favorite Team",
      value: settings.favoriteTeam || "",
      help: "Highlights rows where your team appears.",
      options: buildTeamOptions(teams)
    });
    addSettingsSelect(form, {
      id: "setting-text-size",
      name: "textSize",
      label: "Text Size",
      value: settings.textSize || "normal",
      help: "Adjusts general readability across league pages.",
      options: [
        { value: "small", label: "Small" },
        { value: "normal", label: "Normal" },
        { value: "large", label: "Large" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-density",
      name: "tableDensity",
      label: "Table Density",
      value: settings.tableDensity || "normal",
      help: "Changes vertical spacing in generated tables and the sidebar menu.",
      options: [
        { value: "compact", label: "Compact" },
        { value: "normal", label: "Normal" },
        { value: "spacious", label: "Spacious" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-roster-ratings",
      name: "rosterRatingDisplay",
      label: "Rating Display",
      value: settings.rosterRatingDisplay || "colors",
      help: "Shows Cur/Fut as readable rating pills on roster, free agent, and draft preview tables.",
      options: [
        { value: "colors", label: "Color Boxes" },
        { value: "numbers", label: "Number Pills" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-roster-sticky-tables",
      name: "rosterStickyTables",
      label: "Frozen Roster Columns",
      value: settings.rosterStickyTables || "on",
      help: "Keeps key roster table columns frozen on mobile while scrolling sideways.",
      options: [
        { value: "on", label: "On" },
        { value: "off", label: "Off" }
      ]
    });
    addSettingsSelect(form, {
      id: "setting-player-page-destination",
      name: "playerPageDestination",
      label: "Player Page Links",
      value: settings.playerPageDestination === "classic" ? "classic" : "unified",
      help: "Choose whether roster-style player links and the floating player search open the classic player.htm pages or the unified player view.",
      options: [
        { value: "unified", label: "Unified player page" },
        { value: "classic", label: "Classic player pages" }
      ]
    });

    document.getElementById("league-settings-save").addEventListener("click", function () {
      var nextSettings = {};

      Array.prototype.slice.call(form.elements).forEach(function (field) {
        if (field.name) {
          nextSettings[field.name] = field.value;
        }
      });

      nextSettings.theme = normalizeTheme(nextSettings.theme);
      nextSettings.spoilerMode = "show";
      core.saveSettings(nextSettings);
      applySavedPreferences();
      status.textContent = "Saved. Dark mode applies now. Reload the main page to apply default page, menu startup, and player link destination changes.";
    });

    document.getElementById("league-settings-reset").addEventListener("click", function () {
      window.localStorage.removeItem(core.SETTINGS_KEY);
      window.location.reload();
    });
  }

  window.LeagueSettings = {
    applySavedPreferences: applySavedPreferences,
    highlightFavoriteTeam: highlightFavoriteTeam,
    initSettingsPage: initSettingsPage
  };

  document.addEventListener("DOMContentLoaded", function () {
    applySavedPreferences();
    core.loadJsonData("teams.json")
      .then(function (teams) {
        initSettingsPage(teams);
        highlightFavoriteTeam(teams);
      })
      .catch(function () {
        initSettingsPage([]);
      });
  });
})();
