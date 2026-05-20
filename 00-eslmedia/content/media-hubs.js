(() => {
  const articles = Array.isArray(window.ESL_MEDIA_ARTICLES) ? window.ESL_MEDIA_ARTICLES : [];
  const page = document.body?.dataset?.listingPage;
  if (!page || !articles.length) {
    return;
  }

  const bySortDesc = (a, b) => (b.sortKey || "").localeCompare(a.sortKey || "");
  const monthFromSortKey = (sortKey = "") => String(sortKey).slice(0, 7);
  const safe = (value) => String(value == null ? "" : value).replace(/"/g, "&quot;");
  const pageLabels = {
    "all-articles": "All Articles",
    analysis: "Analysis",
    scouting: "Scouting",
    interviews: "Interviews"
  };

  function ensureMediaNavStyles() {
    if (document.getElementById("media-compact-nav-styles")) return;
    const style = document.createElement("style");
    style.id = "media-compact-nav-styles";
    style.textContent = `
      .media-breadcrumbs,.media-compact-nav{width:min(1280px,calc(100% - 2.5rem));margin-left:auto;margin-right:auto}
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
  }

  function ensureMediaNav(currentLabel) {
    if (document.querySelector(".media-breadcrumbs")) return;
    ensureMediaNavStyles();
    const topbar = document.querySelector(".site-topbar");
    if (!topbar) return;
    const crumbs = document.createElement("nav");
    crumbs.className = "media-breadcrumbs";
    crumbs.setAttribute("aria-label", "Breadcrumb");
    crumbs.innerHTML = `<a href="../../index.htm">League</a><span>/</span><a href="../homepage.html">Media</a><span>/</span><span class="media-breadcrumbs-current">${safe(currentLabel || "Media")}</span>`;
    const compact = document.createElement("nav");
    compact.className = "media-compact-nav";
    compact.setAttribute("aria-label", "ESL Media quick links");
    compact.innerHTML = `
      <a href="../homepage.html">Home</a>
      <a href="all-articles.html">All</a>
      <a href="analysis.html">Analysis</a>
      <a href="scouting.html">Scouting</a>
      <a href="interviews.html">Interviews</a>
      <a href="../../index.htm">League</a>
    `;
    topbar.insertAdjacentElement("afterend", compact);
    topbar.insertAdjacentElement("afterend", crumbs);
  }

  function renderCard(article) {
    const teams = Array.isArray(article.teams) ? article.teams : [];
    const month = monthFromSortKey(article.sortKey);
    return `
      <article
        class="article-card"
        data-sort-key="${safe(article.sortKey)}"
        data-desk="${safe(article.desk)}"
        data-category="${safe(article.category)}"
        data-author="${safe(article.author)}"
        data-tag="${safe(article.tag)}"
        data-month="${safe(month)}"
        data-teams="${safe(teams.join("|"))}">
        <div class="card-tag">${article.tag}</div>
        <h2 class="card-title"><a href="${article.file}">${article.title}</a></h2>
        <p class="card-dek">${article.blurb}</p>
        <div class="card-meta"><span>${article.author}</span><span>${article.meta}</span></div>
      </article>
    `;
  }

  function setSectionCount(selector, count) {
    const node = document.querySelector(selector);
    if (node) {
      node.textContent = `${count} ${count === 1 ? "story" : "stories"}`;
    }
  }

  if (page === "analysis") {
    ensureMediaNav(pageLabels[page]);
    const grid = document.querySelector("[data-hub-grid='analysis']");
    const analysisArticles = articles.filter((article) => article.desk === "Analysis").sort(bySortDesc);
    if (grid) {
      grid.innerHTML = analysisArticles.map(renderCard).join("");
    }
    return;
  }

  if (page === "scouting") {
    ensureMediaNav(pageLabels[page]);
    const grid = document.querySelector("[data-hub-grid='scouting']");
    const scoutingArticles = articles.filter((article) => article.desk === "Scouting").sort(bySortDesc);
    if (grid) {
      grid.innerHTML = scoutingArticles.map(renderCard).join("");
    }
    return;
  }

  if (page === "interviews") {
    ensureMediaNav(pageLabels[page]);
    const grid = document.querySelector("[data-hub-grid='interviews']");
    const interviewArticles = articles.filter((article) => article.desk === "Interview").sort(bySortDesc);
    if (grid) {
      grid.innerHTML = interviewArticles.map(renderCard).join("");
    }
    return;
  }

  if (page === "all-articles") {
    ensureMediaNav(pageLabels[page]);
    const analysisGrid = document.querySelector("[data-hub-grid='all-analysis']");
    const scoutingGrid = document.querySelector("[data-hub-grid='all-scouting']");
    const interviewGrid = document.querySelector("[data-hub-grid='all-interviews']");
    const analysisArticles = articles.filter((article) => article.desk === "Analysis").sort(bySortDesc);
    const scoutingArticles = articles.filter((article) => article.desk === "Scouting").sort(bySortDesc);
    const interviewArticles = articles.filter((article) => article.desk === "Interview").sort(bySortDesc);

    if (analysisGrid) {
      analysisGrid.innerHTML = analysisArticles.map(renderCard).join("");
    }
    if (scoutingGrid) {
      scoutingGrid.innerHTML = scoutingArticles.map(renderCard).join("");
    }
    if (interviewGrid) {
      interviewGrid.innerHTML = interviewArticles.map(renderCard).join("");
    }

    setSectionCount("[data-section-count='analysis']", analysisArticles.length);
    setSectionCount("[data-section-count='scouting']", scoutingArticles.length);
    setSectionCount("[data-section-count='interviews']", interviewArticles.length);
  }
})();
