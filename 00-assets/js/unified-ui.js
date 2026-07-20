(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function ratingClass(value) {
    var rating = Number(value) || 0;
    if (rating >= 151) { return "purple"; }
    if (rating >= 115) { return "blue"; }
    if (rating >= 100) { return "green"; }
    if (rating >= 80) { return "yellow"; }
    return "orange";
  }

  function ratingBadge(value, label) {
    var text = label === undefined || label === null || label === "" ? value : label;
    return '<span class="ui-rating ui-rating--' + ratingClass(value) + '">' + escapeHtml(text) + "</span>";
  }

  function tierBadge(value) {
    var tier = String(value || "").trim();
    var key = tier.charAt(0).toLowerCase();
    return '<span class="ui-tier' + (key ? " ui-tier--" + escapeHtml(key) : "") + '">' + escapeHtml(tier || "-") + "</span>";
  }

  function statusBadge(value, tone) {
    var safeTone = ["good", "warn", "bad"].indexOf(tone) >= 0 ? " ui-status--" + tone : "";
    return '<span class="ui-status' + safeTone + '">' + escapeHtml(value) + "</span>";
  }

  var TEAM_ABBREVIATIONS = {
    "AC Milan": "ACM", "AFC Richmond": "AFC", "Ajax": "AJX",
    "Aston Villa": "AVL", "Atletico Madrid": "ATM", "Barcelona": "BAR",
    "Bayern Munich": "BAY", "Benfica": "BEN", "Brighton": "BRI",
    "Chelsea": "CHE", "Crystal Palace": "CRY", "FL Fart": "FLF",
    "Inter Milan": "INT", "Juventus": "JUV", "Manchester City": "MCI",
    "Manchester United": "MUN", "Marseille": "MAR", "Monaco": "MON",
    "Paris Saint-Germain": "PSG", "Real Madrid": "RMA", "Sheffield United": "SHU",
    "Sporting CP": "SCP", "Tottenham Hotspur": "TOT", "Valencia": "VAL",
    "Free Agents": "FA", "Draft": "DRF"
  };

  function teamAbbreviation(value) {
    var name = String(value || "").trim();
    if (!name) { return "---"; }
    if (TEAM_ABBREVIATIONS[name]) { return TEAM_ABBREVIATIONS[name]; }
    if (name === "FA") { return "FA"; }
    return name.split(/\s+/).filter(Boolean).map(function (part) {
      return part.charAt(0);
    }).join("").slice(0, 3).toUpperCase() || "---";
  }

  function setTeamColor(primary, secondary) {
    if (primary) { document.documentElement.style.setProperty("--ui-team", primary); }
    if (secondary) { document.documentElement.style.setProperty("--ui-team-secondary", secondary); }
  }

  window.ESLUnifiedUI = Object.freeze({
    escapeHtml: escapeHtml,
    ratingClass: ratingClass,
    ratingBadge: ratingBadge,
    tierBadge: tierBadge,
    statusBadge: statusBadge,
    teamAbbreviation: teamAbbreviation,
    setTeamColor: setTeamColor
  });
}());
