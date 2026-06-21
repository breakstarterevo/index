(function () {
  var root = document.documentElement;
  var rawSettings;
  var settings;
  var theme;

  try {
    rawSettings = window.localStorage && window.localStorage.getItem("leagueSiteSettings");
    settings = rawSettings ? JSON.parse(rawSettings) : {};
    theme = String(settings.theme || "").toLowerCase();
  } catch (error) {
    theme = "";
  }

  if (theme === "dark") {
    root.className = (root.className + " league-theme-dark").replace(/\s+/g, " ").trim();
    root.style.backgroundColor = "#0d1118";
    root.style.colorScheme = "dark";
  } else {
    root.className = (root.className + " league-theme-light").replace(/\s+/g, " ").trim();
  }
}());
