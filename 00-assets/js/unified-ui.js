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
    "Paris Saint-Germain": "PSG", "Real Madrid": "RMA", "AC Sparta Praha": "ACS",
    "Arsenal": "ARS", "Tottenham Hotspur": "TOT", "Valencia": "VAL",
    "Free Agents": "FA", "Draft": "DRF"
  };

  var TEAM_COLORS = {
    "AC Milan": "#B50909", "AFC Richmond": "#021E73", "Ajax": "#D2122E",
    "Aston Villa": "#670E36", "Atletico Madrid": "#CB3524", "Barcelona": "#A60042",
    "Bayern Munich": "#DC052D", "Benfica": "#E41E26", "Brighton": "#0057B8",
    "Chelsea": "#034694", "Crystal Palace": "#1B458F", "FL Fart": "#D72B2B",
    "Inter Milan": "#0055A0", "Juventus": "#000000", "Manchester City": "#6CABDD",
    "Manchester United": "#D9020D", "Marseille": "#099FFF", "Monaco": "#CE1126",
    "Paris Saint-Germain": "#00093F", "Real Madrid": "#004996", "AC Sparta Praha": "#000000",
    "Arsenal": "#DB0007", "Tottenham Hotspur": "#132257", "Valencia": "#F57710"
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

  function teamColor(value, fallback) {
    return TEAM_COLORS[String(value || "").trim()] || fallback || "#111b36";
  }

  function contrastColor(value) {
    var hex = String(value || "").replace("#", "");
    var channels;
    var luminance;

    if (!/^[0-9a-f]{6}$/i.test(hex)) { return "#ffffff"; }
    channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map(function (part) {
      var channel = parseInt(part, 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? "#111827" : "#ffffff";
  }

  function setTeamColor(primary, secondary) {
    if (primary) {
      document.documentElement.style.setProperty("--ui-team", primary);
      document.documentElement.style.setProperty("--ui-team-contrast", contrastColor(primary));
    }
    if (secondary) { document.documentElement.style.setProperty("--ui-team-secondary", secondary); }
  }

  window.ESLUnifiedUI = Object.freeze({
    escapeHtml: escapeHtml,
    ratingClass: ratingClass,
    ratingBadge: ratingBadge,
    tierBadge: tierBadge,
    statusBadge: statusBadge,
    teamAbbreviation: teamAbbreviation,
    teamColor: teamColor,
    setTeamColor: setTeamColor
  });
}());
