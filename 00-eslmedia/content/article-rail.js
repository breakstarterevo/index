(() => {
  const manifest = Array.isArray(window.ESL_MEDIA_ARTICLES) ? window.ESL_MEDIA_ARTICLES : [];
  const articles = manifest.map((article) => ({
    file: article.file.split("/").pop(),
    title: article.title,
    category: article.category || article.desk || "",
    desk: article.desk || "",
    tag: article.tag || "",
    teams: Array.isArray(article.teams) ? article.teams : [],
    blurb: article.blurb,
    sortKey: article.sortKey || ""
  }));

  let adImages = Array.isArray(window.ESL_MEDIA_ADS) ? window.ESL_MEDIA_ADS : [];

  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const pickRandom = (items, count) => shuffle(items).slice(0, count);
  const safeText = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);

  const ensureMediaNav = (currentArticle) => {
    return currentArticle;
  };

  const overlapCount = (a = [], b = []) => {
    if (!a.length || !b.length) return 0;
    const lookup = new Set(a);
    return b.filter((item) => lookup.has(item)).length;
  };

  const buildRecommendations = (currentArticle) => {
    const ranked = articles
      .filter((article) => article.file !== currentArticle.file)
      .map((article) => {
        let score = 0;
        if (article.desk && article.desk === currentArticle.desk) score += 4;
        if (article.category && article.category === currentArticle.category) score += 2;
        if (article.tag && currentArticle.tag && article.tag === currentArticle.tag) score += 3;
        score += overlapCount(currentArticle.teams, article.teams) * 2;
        return { ...article, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.sortKey.localeCompare(a.sortKey);
      });

    const contextual = ranked.filter((article) => article.score > 0).slice(0, 3);
    if (contextual.length >= 3) return contextual;
    const fallback = ranked.filter((article) => !contextual.some((picked) => picked.file === article.file)).slice(0, 3 - contextual.length);
    return [...contextual, ...fallback];
  };

  const createAdCard = (src, index) => {
    const card = document.createElement("section");
    card.className = "article-rail-card article-ad-card";
    card.innerHTML = `
      <div class="article-rail-label">Advertisement</div>
      <img src="${src}" alt="ESL sponsor creative ${index + 1}" loading="lazy">
    `;
    return card;
  };

  const createRecommendationCard = (recommendations) => {
    const card = document.createElement("section");
    card.className = "article-rail-card article-rec-card";

    const items = recommendations.map((article) => `
      <li class="article-rec-item">
        <a href="${article.file}" class="article-rec-link">${article.title}</a>
        <div class="article-rec-meta">${article.category}</div>
        <p class="article-rec-blurb">${article.blurb}</p>
      </li>
    `).join("");

    card.innerHTML = `
      <div class="article-rail-head">
        <div class="article-rail-title">Recommended</div>
        <div class="article-rail-note">More from ESL Media</div>
      </div>
      <ul class="article-rec-list">${items}</ul>
    `;

    return card;
  };

  const loadAdsIfNeeded = async () => {
    if (adImages.length || typeof fetch !== "function") return;
    try {
      const response = await fetch("../media-ads.js");
      if (!response.ok) return;
      const scriptText = await response.text();
      // Evaluate trusted local config script to populate window.ESL_MEDIA_ADS.
      Function(scriptText)();
      adImages = Array.isArray(window.ESL_MEDIA_ADS) ? window.ESL_MEDIA_ADS : [];
    } catch (_) {
      adImages = [];
    }
  };

  const initRail = async () => {
    const body = document.body;
    if (!body || !body.classList.contains("media-article")) return;

    const paper = document.querySelector(".package-paper, .paper");
    if (!paper || paper.closest(".article-shell")) return;

    await loadAdsIfNeeded();

    const currentFile = window.location.pathname.split("/").pop();
    const currentArticle = articles.find((article) => article.file === currentFile) || articles[0];
    ensureMediaNav(currentArticle);
    const recommendations = buildRecommendations(currentArticle);
    const adSelection = pickRandom(adImages, Math.min(2, adImages.length));

    const shell = document.createElement("div");
    shell.className = "article-shell";

    const rail = document.createElement("aside");
    rail.className = "article-rail";
    rail.append(
      createRecommendationCard(recommendations),
      ...adSelection.map((src, index) => createAdCard(src, index))
    );

    paper.parentNode.insertBefore(shell, paper);
    shell.appendChild(paper);
    shell.appendChild(rail);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRail, { once: true });
  } else {
    initRail();
  }
})();
