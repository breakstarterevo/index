(function () {
  "use strict";

  var core = window.LeagueSiteCore;
  var SETTINGS_STYLE_ID = "league-settings-styles";
  var PREFERENCE_STYLE_ID = "league-preference-styles";

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
      "html.league-pref-text-small body { font-size: 92%; }",
      "html.league-pref-text-large body { font-size: 112%; }",
      "html.league-pref-density-compact td.main, html.league-pref-density-compact td.header { padding-top: 3px !important; padding-bottom: 3px !important; }",
      "html.league-pref-density-spacious td.main, html.league-pref-density-spacious td.header { padding-top: 8px !important; padding-bottom: 8px !important; }",
      ".league-favorite-row > td { background-color: #fff3bf !important; }",
      ".league-favorite-row a { font-weight: 800 !important; }",
      "body.page-settings { background: #f4f2ec !important; color: #172033; font-family: Georgia, 'Times New Roman', serif; margin: 0; }"
    ].join("");
    document.head.appendChild(style);
  }

  function applySavedPreferences() {
    var settings = core.getSettings();
    var root = document.documentElement;

    ensurePreferenceStyles();
    root.classList.remove(
      "league-pref-text-small",
      "league-pref-text-normal",
      "league-pref-text-large",
      "league-pref-density-compact",
      "league-pref-density-normal",
      "league-pref-density-spacious"
    );

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

      nextSettings.theme = "classic";
      nextSettings.spoilerMode = "show";
      core.saveSettings(nextSettings);
      applySavedPreferences();
      status.textContent = "Saved. Reload the main page to apply default page, menu startup, and player link destination changes.";
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
