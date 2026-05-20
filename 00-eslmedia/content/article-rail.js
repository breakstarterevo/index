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

  const ensureMediaNavStyles = () => {
    if (document.getElementById("media-compact-nav-styles")) return;
    const style = document.createElement("style");
    style.id = "media-compact-nav-styles";
    style.textContent = `
      .media-breadcrumbs,.media-compact-nav{width:min(1180px,calc(100% - 2.5rem));margin-left:auto;margin-right:auto}
      .media-breadcrumbs{align-items:center;color:var(--mid,#524633);display:flex;flex-wrap:wrap;gap:.35rem;font-size:.68rem;font-weight:800;letter-spacing:.16em;padding:.65rem 0 0;text-transform:uppercase}
      .media-breadcrumbs a{color:var(--gold,#111b36);text-decoration:none}
      .media-breadcrumbs a:hover{text-decoration:underline}
      .media-breadcrumbs-current{color:var(--ink,#0f0f0f);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .media-compact-nav{display:none;gap:.4rem;overflow-x:auto;padding-top:.55rem;scrollbar-width:thin}
      .media-compact-nav a{border:1px solid var(--light,#e3d7bf);background:var(--cream,#fff);color:var(--ink,#0f0f0f);flex:0 0 auto;font-size:.68rem;font-weight:850;letter-spacing:.12em;padding:.42rem .52rem;text-decoration:none;text-transform:uppercase;white-space:nowrap}
      .media-compact-nav a:hover{border-color:var(--gold,#111b36);color:var(--gold,#111b36)}
      @media(max-width:700px){.site-topbar-nav{display:none!important}.media-breadcrumbs,.media-compact-nav{width:min(100%,calc(100% - 1.25rem))}.media-breadcrumbs{font-size:.58rem;gap:.28rem;letter-spacing:.1em;padding-top:.5rem}.media-compact-nav{display:flex}}
    `;
    document.head.appendChild(style);
  };

  const ensureMediaNav = (currentArticle) => {
    if (document.querySelector(".media-breadcrumbs")) return;
    ensureMediaNavStyles();
    const topbar = document.querySelector(".site-topbar");
    if (!topbar) return;
    const title = currentArticle?.title || document.querySelector(".headline")?.textContent || "Article";
    const crumbs = document.createElement("nav");
    crumbs.className = "media-breadcrumbs";
    crumbs.setAttribute("aria-label", "Breadcrumb");
    crumbs.innerHTML = `<a href="../../../index.htm">League</a><span>/</span><a href="../../homepage.html">Media</a><span>/</span><a href="../all-articles.html">Articles</a><span>/</span><span class="media-breadcrumbs-current">${safeText(title)}</span>`;
    const compact = document.createElement("nav");
    compact.className = "media-compact-nav";
    compact.setAttribute("aria-label", "ESL Media quick links");
    compact.innerHTML = `
      <a href="../../homepage.html">Home</a>
      <a href="../all-articles.html">All</a>
      <a href="../analysis.html">Analysis</a>
      <a href="../scouting.html">Scouting</a>
      <a href="../interviews.html">Interviews</a>
      <a href="../../../index.htm">League</a>
    `;
    topbar.insertAdjacentElement("afterend", compact);
    topbar.insertAdjacentElement("afterend", crumbs);
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

    const paper = document.querySelector(".paper");
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
