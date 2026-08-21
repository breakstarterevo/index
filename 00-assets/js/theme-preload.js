(function () {
  var superCupBoxMatch = window.location.pathname.match(/\/00-SuperCup\/boxes\/(box\d+-\d+)\.htm$/i);
  var routeParams = new URLSearchParams(window.location.search);
  var root = document.documentElement;
  var rawSettings;
  var settings;
  var theme;

  if (superCupBoxMatch && routeParams.get("classic") !== "1") {
    window.location.replace(
      "../../00-assets/html/unified-box-score.htm?competition=supercup&game=" +
      encodeURIComponent(superCupBoxMatch[1].toLowerCase())
    );
    return;
  }

  try {
    rawSettings = window.localStorage && window.localStorage.getItem("leagueSiteSettings");
    settings = rawSettings ? JSON.parse(rawSettings) : {};
    theme = String(settings.theme || "").toLowerCase();
  } catch (error) {
    theme = "";
  }

  if (theme === "dark") {
    root.setAttribute("data-theme", "dark");
    root.className = (root.className + " league-theme-dark").replace(/\s+/g, " ").trim();
    root.style.backgroundColor = "#0d1118";
    root.style.colorScheme = "dark";
  } else {
    root.setAttribute("data-theme", "light");
    root.className = (root.className + " league-theme-light").replace(/\s+/g, " ").trim();
  }
}());
