(function () {
  "use strict";

  var core = window.LeagueSiteCore;

  if (!core) {
    return;
  }

  function markStandingsPage() {
    if (core.shouldAttachStandingsSearch()) {
      document.body.classList.add("page-standings");
    }
  }

  function markTransactionsPage() {
    var path = (window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    var title = document.title ? document.title.trim().toLowerCase() : "";

    if (/\/transactions\.htm$/.test(path) || /\\transactions\.htm$/.test(path) || title === "transactions") {
      document.body.classList.add("page-transactions");
    }
  }

  function getRosterPhotoPath(filename) {
    if (!filename) {
      return "";
    }

    return core.isNestedPage() ? "../00-assets/photos/" + filename : "00-assets/photos/" + filename;
  }

  function getRosterPhotoFilename(teamName) {
    var photoMap = {
      "Manchester United": "manutd.jpg",
      "Crystal Palace": "crystalpalace.jpg",
      "Bayern Munich": "bayern.jpg",
      "Real Madrid": "realmadrid.jpg",
      "AC Milan": "acmilan.jpg",
      "Brighton": "brighton.jpg",
      "Atletico Madrid": "atletico.jpg",
      "AFC Richmond": "richmond.jpg",
      "Benfica": "benfica.jpg",
      "Juventus": "juventus.jpg",
      "Marseille": "marseille.jpg",
      "Sheffield United": "sheffield.jpg",
      "Chelsea": "chelsea.jpg",
      "Ajax": "ajax.jpg",
      "Aston Villa": "astonvilla.jpg",
      "Monaco": "monaco.jpg",
      "Paris Saint-Germain": "psg.jpg",
      "Tottenham Hotspur": "tottenham.jpg",
      "Sporting CP": "sportingcp.jpg",
      "Barcelona": "barcelona.jpg",
      "Valencia": "valencia.jpg",
      "Inter Milan": "intermilan.jpg",
      "Manchester City": "manchestercity.jpg",
      "FL Fart": "flfart.jpg"
    };

    return photoMap[teamName] || "";
  }

  function applyRosterHeaderPhoto() {
    if (!core.isRosterPage()) {
      return;
    }

    var teamName = document.title ? document.title.trim() : "";
    var photoFilename = getRosterPhotoFilename(teamName);

    if (!photoFilename) {
      return;
    }

    var headerImage = document.querySelector("body > table img");

    if (!headerImage) {
      return;
    }

    headerImage.setAttribute("src", getRosterPhotoPath(photoFilename));
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (core.isRosterPage()) {
      core.ensureViewport(core.ROSTER_VIEWPORT);
      document.body.classList.add("page-roster");
    } else if (core.shouldUseLegacyViewport()) {
      core.ensureViewport(core.DEFAULT_VIEWPORT);
    }

    markStandingsPage();
    markTransactionsPage();
    applyRosterHeaderPhoto();
  });
})();
