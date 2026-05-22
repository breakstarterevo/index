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

  function ensureMediaNav(currentLabel) {
    return currentLabel;
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
