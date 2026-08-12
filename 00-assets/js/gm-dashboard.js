(function () {
  "use strict";

  const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
  const AGE_BUCKETS = [
    { id: "u22", label: "U22", test: (age) => age < 22 },
    { id: "22-25", label: "22-25", test: (age) => age >= 22 && age <= 25 },
    { id: "26-29", label: "26-29", test: (age) => age >= 26 && age <= 29 },
    { id: "30+", label: "30+", test: (age) => age >= 30 }
  ];

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeName(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function rosterKey(value) {
    return clean(value).toLowerCase().replace(/^.*[\\/]/, "").replace(/\.htm$/, "");
  }

  function num(value) {
    const n = Number(String(value || "").replace(/[$,%(),]/g, "").replace(/^\((.*)\)$/, "-$1"));
    return Number.isFinite(n) ? n : null;
  }

  function fmtNumber(value, digits = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "--";
  }

  function fmtMoney(value, fallback) {
    if (fallback && fallback !== "-") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return "--";
    const sign = n < 0 ? "-" : "";
    return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  function sumCurrentSalary(players) {
    return players.reduce((sum, player) => sum + (Number(player.currentSalary) || 0), 0);
  }

  function localDate(year, month, day) {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function parseDate(value) {
    const text = clean(value);
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (iso) return localDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const legacy = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (legacy) {
      const first = Number(legacy[1]);
      const second = Number(legacy[2]);
      const year = Number(legacy[3]);
      if (first > 12) return localDate(year, second, first);
      return localDate(year, first, second);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
      ? null
      : localDate(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }

  function repoRootPrefix() {
    const path = window.location && window.location.pathname ? window.location.pathname : "";
    const markerIndex = path.indexOf("/00-assets/");
    return markerIndex >= 0 ? path.slice(0, markerIndex) : "";
  }

  function rootCandidate(path) {
    const cleanPath = String(path || "").replace(/^(\.\.\/)+/, "").replace(/^\.\/+/, "");
    return `${repoRootPrefix()}/${cleanPath}`.replace(/\/{2,}/g, "/");
  }

  function pathCandidates(path) {
    const candidates = [path, rootCandidate(path)];
    return candidates.filter(Boolean).filter((candidate, index) => candidates.indexOf(candidate) === index);
  }

  function cacheBust(url) {
    const joiner = String(url).includes("?") ? "&" : "?";
    return `${url}${joiner}v=${Date.now()}`;
  }

  async function fetchJson(path) {
    for (const candidate of pathCandidates(path)) {
      try {
        const res = await fetch(cacheBust(candidate), { cache: "no-store" });
        if (res.ok) return await res.json();
      } catch (error) {
        // Try the next portable candidate.
      }
    }
    return null;
  }

  async function hydrateMissingFeeds(state) {
    const isSupercup = /unified-roster-supercup/i.test(window.location && window.location.pathname || "");
    const basePath = isSupercup ? "../../00-build/database/supercup" : "../../00-build/database";
    const needsCap = !(state.capReport || []).length;
    const needsForm = !Object.keys(state.monthlyTeamForm || {}).length;
    if (!needsCap && !needsForm) return false;

    const [capData, formData] = await Promise.all([
      needsCap ? fetchJson(`${basePath}/capreport.json`) : null,
      needsForm ? fetchJson(`${basePath}/monthly/monthly_team_form.json`) : null
    ]);
    let changed = false;
    if (capData && Array.isArray(capData.sections)) {
      state.capReport = capData.sections;
      changed = true;
    }
    if (formData && formData.tiers) {
      state.monthlyTeamForm = formData.tiers;
      changed = true;
    }
    return changed;
  }

  function isCompletedGame(game) {
    return Number.isFinite(Number(game && game.homeScore)) && Number.isFinite(Number(game && game.awayScore));
  }

  function findTeamPlayers(state) {
    const current = state.current || {};
    const targetRoster = rosterKey(current.rosterFile || current.teamId);
    const targetName = normalizeName(current.teamName);
    return (state.players || []).filter((player) => {
      const playerRoster = rosterKey(player.team);
      const playerTeam = normalizeName(player.teamLabel);
      return (targetRoster && playerRoster === targetRoster) || (targetName && playerTeam === targetName);
    });
  }

  function findCapEntry(state) {
    const current = state.current || {};
    const targetRoster = rosterKey(current.rosterFile || current.teamId);
    const targetName = normalizeName(current.teamName);
    const entries = (state.capReport || []).flatMap((section) => section.entries || []);
    return entries.find((entry) => rosterKey(entry.rosterFile || entry.rosterUrl) === targetRoster) ||
      entries.find((entry) => normalizeName(entry.team) === targetName) ||
      null;
  }

  function findMonthlyForm(state) {
    const current = state.current || {};
    const targetRoster = rosterKey(current.rosterFile || current.teamId);
    const targetName = normalizeName(current.teamName);
    const entries = Object.values(state.monthlyTeamForm || {}).flatMap((tier) => Array.isArray(tier) ? tier : []);
    return entries.find((entry) => rosterKey(entry.rosterFile || entry.rosterUrl) === targetRoster) ||
      entries.find((entry) => normalizeName(entry.team) === targetName) ||
      null;
  }

  function findTeamStats(state) {
    const current = state.current || {};
    const targetRoster = rosterKey(current.rosterFile || current.teamId);
    const targetName = normalizeName(current.teamName);
    return (state.teamStats || []).find((entry) => rosterKey(entry.file || entry.url || entry.teamId) === targetRoster) ||
      (state.teamStats || []).find((entry) => normalizeName(entry.team) === targetName) ||
      null;
  }

  function findInjuries(state) {
    const current = state.current || {};
    const targetRoster = rosterKey(current.rosterFile || current.teamId);
    const targetName = normalizeName(current.teamName);
    return (state.injuries || []).filter((item) =>
      rosterKey(item.rosterUrl || item.rosterFile) === targetRoster ||
      normalizeName(item.team || item.teamName) === targetName
    );
  }

  function collectTeamGames(state, helpers) {
    const current = state.current || {};
    const teamId = current.teamId;
    const teamName = normalizeName(current.teamName);
    const dateParser = helpers && typeof helpers.parseDate === "function" ? helpers.parseDate : parseDate;
    const days = (state.scheduleSections || []).flatMap((section) => section.days || []);
    return days.flatMap((day) =>
      (day.games || [])
        .filter((game) =>
          game.homeTeam === teamId ||
          game.awayTeam === teamId ||
          normalizeName(game.homeTeamName) === teamName ||
          normalizeName(game.awayTeamName) === teamName
        )
        .map((game) => ({ ...game, date: day.date, dateObj: dateParser(day.date) }))
    ).filter((game) => game.dateObj);
  }

  function playerHref(player, helpers) {
    return helpers && typeof helpers.toPlayerHref === "function" ? helpers.toPlayerHref(player && player.url) : "";
  }

  function gameHref(game, helpers) {
    if (helpers && typeof helpers.scheduleBoxHref === "function") return helpers.scheduleBoxHref(game);
    const boxHref = String(game && game.boxscoreUrl || "").replace(/^\.\/+/, "");
    return boxHref ? `../../${boxHref}` : "";
  }

  function positionGroups(players, injuries) {
    const injuredNames = new Set(injuries.map((item) => normalizeName(item.name)));
    const groups = POSITIONS.map((position) => {
      const list = players.filter((player) => clean(player.pos).toUpperCase() === position);
      const injured = list.filter((player) => injuredNames.has(normalizeName(player.name))).length;
      const count = list.length;
      const avgOvr = count ? list.reduce((sum, player) => sum + (num(player.overall) || 0), 0) / count : null;
      const avgPot = count ? list.reduce((sum, player) => sum + (num(player.potential) || 0), 0) / count : null;
      return { position, list, count, injured, active: Math.max(0, count - injured), avgOvr, avgPot };
    });
    const teamAvgOvr = players.length ? players.reduce((sum, player) => sum + (num(player.overall) || 0), 0) / players.length : null;
    return { groups, teamAvgOvr };
  }

  function renderProgressBar(label, value, max, detail) {
    const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return `<div class="gm-bar-row"><div class="gm-bar-label">${escapeHtml(label)}</div><div class="gm-bar-track"><span style="width:${pct}%"></span></div><div class="gm-bar-value">${escapeHtml(detail || value)}</div></div>`;
  }

  function renderRosterBalance(players, injuries) {
    const { groups } = positionGroups(players, injuries);
    const maxCount = Math.max(1, ...groups.map((group) => group.count));
    const rows = groups.map((group) =>
      renderProgressBar(group.position, group.count, maxCount, `${group.count} | ${fmtNumber(group.avgOvr)} / ${fmtNumber(group.avgPot)}`)
    ).join("");
    return dashboardCard("Roster Balance", rows || emptyState("No roster players found"));
  }

  function renderCapSnapshot(entry, players) {
    if (!entry) {
      const salary = sumCurrentSalary(players || []);
      if (!salary) return dashboardCard("Cap Snapshot", emptyState("Cap feed not matched"));
      return dashboardCard("Cap Snapshot", [
        `<div class="gm-stat-grid"><div><span>Roster Salary</span><strong>${escapeHtml(fmtMoney(salary))}</strong></div></div>`
      ].join(""));
    }
    const capRoom = Number(entry.capRoom);
    const statusClass = Number.isFinite(capRoom) && capRoom < 0 ? "critical" : Number.isFinite(capRoom) && capRoom < 5000000 ? "watch" : "stable";
    const status = Number.isFinite(capRoom) && capRoom < 0 ? "Over Cap" : Number.isFinite(capRoom) && capRoom < 5000000 ? "Tight" : "Room";
    return dashboardCard("Cap Snapshot", [
      `<div class="gm-stat-grid"><div><span>Salary</span><strong>${escapeHtml(fmtMoney(entry.salary, entry.salaryText))}</strong></div><div><span>Cap Room</span><strong>${escapeHtml(fmtMoney(entry.capRoom, entry.capRoomText))}</strong></div></div>`,
      `<div class="gm-chip-row"><span class="gm-chip ${statusClass}">${escapeHtml(status)}</span></div>`
    ].join(""));
  }

  function renderExpiringContracts(players, helpers) {
    const candidates = players.map((player) => {
      const contracts = Array.isArray(player.contracts) ? player.contracts : [];
      const years = contracts.map((c) => ({ year: Number(c.year), salary: Number(c.salary || 0), salaryText: c.salaryText })).filter((c) => Number.isFinite(c.year));
      const positiveYears = years.filter((c) => c.salary > 0).map((c) => c.year);
      const currentYear = years.length ? Math.min(...years.map((c) => c.year)) : null;
      const lastPositiveYear = positiveYears.length ? Math.max(...positiveYears) : null;
      const isZero = Number(player.currentSalary || 0) <= 0;
      const isExpiring = currentYear !== null && lastPositiveYear !== null && lastPositiveYear <= currentYear + 1;
      return { player, lastPositiveYear, isZero, isExpiring };
    }).filter((item) => item.isZero || item.isExpiring);
    const rows = candidates
      .sort((a, b) => Number(b.player.overall || 0) - Number(a.player.overall || 0))
      .slice(0, 5)
      .map((item) => {
        const href = playerHref(item.player, helpers);
        const name = href ? `<a href="${href}">${escapeHtml(item.player.name)}</a>` : escapeHtml(item.player.name);
        const year = item.isZero ? "$0" : `Ends ${item.lastPositiveYear}`;
        return `<li><span>${name}</span><strong>${escapeHtml(year)}</strong></li>`;
      }).join("");
    return dashboardCard("Expiring Contracts", rows ? `<div class="gm-count">${candidates.length}</div><ul class="gm-mini-list">${rows}</ul>` : emptyState("No expiring contracts flagged"));
  }

  function renderAgeCurve(players) {
    const counts = AGE_BUCKETS.map((bucket) => ({ ...bucket, count: players.filter((player) => bucket.test(Number(player.age))).length }));
    const maxCount = Math.max(1, ...counts.map((bucket) => bucket.count));
    return dashboardCard("Age Curve", counts.map((bucket) => renderProgressBar(bucket.label, bucket.count, maxCount, String(bucket.count))).join(""));
  }

  function renderNeeds(players, injuries) {
    const { groups, teamAvgOvr } = positionGroups(players, injuries);
    const chips = groups.map((group) => {
      let level = "stable";
      let label = `${group.position} stable`;
      if (group.active < 2) {
        level = "critical";
        label = `${group.position} critical`;
      } else if (group.count > 0 && group.injured / group.count >= 0.5) {
        level = "watch";
        label = `${group.position} injury pressure`;
      } else if (teamAvgOvr !== null && group.avgOvr !== null && group.avgOvr <= teamAvgOvr - 10) {
        level = "watch";
        label = `${group.position} watch`;
      }
      return `<span class="gm-chip ${level}">${escapeHtml(label)}</span>`;
    }).join("");
    return dashboardCard("Needs / Holes", `<div class="gm-chip-row">${chips}</div>`);
  }

  function renderRecentForm(form, state) {
    if (!form) {
      const current = state.current || {};
      if (!current.record && !current.streak && current.diff === undefined) {
        return dashboardCard("Recent Form", emptyState("Form feed not matched"));
      }
      return dashboardCard("Recent Form", [
        `<div class="gm-stat-grid"><div><span>Season</span><strong>${escapeHtml(current.record || "--")}</strong></div><div><span>Diff</span><strong>${escapeHtml(current.diff !== undefined && current.diff !== null ? `${Number(current.diff) > 0 ? "+" : ""}${current.diff}` : "--")}</strong></div><div><span>Streak</span><strong>${escapeHtml(current.streak || "--")}</strong></div></div>`
      ].join(""));
    }
    const best = form.bestWin ? `Best: ${form.bestWin.result} ${form.bestWin.margin} vs ${form.bestWin.opponent}` : "Best: --";
    const worst = form.worstLoss ? `Worst: ${form.worstLoss.result} ${form.worstLoss.margin} vs ${form.worstLoss.opponent}` : "Worst: --";
    return dashboardCard("Recent Form", [
      `<div class="gm-stat-grid"><div><span>Latest</span><strong>${escapeHtml(`${form.wins || 0}-${form.losses || 0}`)}</strong></div><div><span>Margin</span><strong>${escapeHtml(fmtNumber(form.avgMargin, 1))}</strong></div><div><span>Streak</span><strong>${escapeHtml(form.streak || "--")}</strong></div></div>`,
      `<ul class="gm-mini-list"><li><span>${escapeHtml(best)}</span></li><li><span>${escapeHtml(worst)}</span></li></ul>`
    ].join(""));
  }

  function renderInjuries(injuries, players, helpers) {
    const rows = injuries
      .sort((a, b) => Number(b.length || 0) - Number(a.length || 0))
      .slice(0, 5)
      .map((item) => {
        const player = players.find((p) => normalizeName(p.name) === normalizeName(item.name));
        const href = playerHref(player, helpers);
        const name = href ? `<a href="${href}">${escapeHtml(item.name)}</a>` : escapeHtml(item.name || "Unknown Player");
        return `<li><span>${name}<em>${escapeHtml(item.injury || "Injury")}</em></span><strong>${escapeHtml(item.length || 0)}d</strong></li>`;
      }).join("");
    return dashboardCard("Injuries", rows ? `<ul class="gm-mini-list">${rows}</ul>` : emptyState("No active injuries"));
  }

  function renderUpcomingGames(state, helpers) {
    const games = collectTeamGames(state, helpers).filter((game) => !isCompletedGame(game)).sort((a, b) => a.dateObj - b.dateObj).slice(0, 3);
    const teamId = state.current && state.current.teamId;
    const rows = games.map((game) => {
      const isHome = game.homeTeam === teamId || normalizeName(game.homeTeamName) === normalizeName(state.current && state.current.teamName);
      const opponent = isHome ? game.awayTeamName : game.homeTeamName;
      const href = gameHref(game, helpers);
      const gameText = `${game.date} ${isHome ? "vs" : "@"} ${opponent || "TBD"}`;
      return `<li><span>${href ? `<a href="${href}">${escapeHtml(gameText)}</a>` : escapeHtml(gameText)}</span><strong>${isHome ? "Home" : "Away"}</strong></li>`;
    }).join("");
    return dashboardCard("Upcoming Games", rows ? `<ul class="gm-mini-list">${rows}</ul>` : emptyState("No upcoming games"));
  }

  function renderTeamProfile(teamStats, state) {
    const stats = teamStats && teamStats.stats ? Object.values(teamStats.stats) : [];
    if (!stats.length) {
      const seasonInfo = state.parsedSections && state.parsedSections["Season Info"];
      const rows = Array.isArray(seasonInfo) ? seasonInfo.slice(1).filter((row) => row.length >= 8).slice(0, 4) : [];
      if (!rows.length) return dashboardCard("Team Strengths / Weaknesses", emptyState("Team stats feed not matched"));
      const chips = rows.map((row) => {
        const label = clean(row[0] && row[0].text).replace(/:$/, "");
        const rank = clean(row[2] && row[2].text);
        return `<span class="gm-chip">${escapeHtml(label)} #${escapeHtml(rank || "--")}</span>`;
      }).join("");
      return dashboardCard("Team Strengths / Weaknesses", `<div class="gm-chip-row">${chips}</div>`);
    }
    const ranked = stats.flatMap((stat) => {
      const items = [];
      if (stat.team && Number.isFinite(Number(stat.team.totalRank))) {
        items.push({ label: stat.label, side: "Team", rank: Number(stat.team.totalRank), value: stat.team.value });
      }
      if (stat.opponent && Number.isFinite(Number(stat.opponent.totalRank))) {
        items.push({ label: stat.label, side: "Opp", rank: Number(stat.opponent.totalRank), value: stat.opponent.value });
      }
      return items;
    });
    const renderItem = (item) =>
      `<li><span>${escapeHtml(item.side)} ${escapeHtml(item.label)}<em>${escapeHtml(fmtNumber(item.value, 3).replace(/\.?0+$/, ""))}</em></span><strong>#${escapeHtml(item.rank)}</strong></li>`;
    const strengths = ranked.slice().sort((a, b) => a.rank - b.rank).slice(0, 3).map(renderItem).join("");
    const weaknesses = ranked.slice().sort((a, b) => b.rank - a.rank).slice(0, 3).map(renderItem).join("");
    return dashboardCard("Team Strengths / Weaknesses", [
      `<div class="gm-subhead">Strengths</div><ul class="gm-mini-list">${strengths}</ul>`,
      `<div class="gm-subhead">Weaknesses</div><ul class="gm-mini-list">${weaknesses}</ul>`
    ].join(""));
  }

  function dashboardCard(title, body) {
    return `<section class="gm-card"><h3>${escapeHtml(title)}</h3>${body}</section>`;
  }

  function emptyState(text) {
    return `<div class="gm-empty">${escapeHtml(text)}</div>`;
  }

  function render(options) {
    const state = options && options.state ? options.state : {};
    const helpers = options && options.helpers ? options.helpers : {};
    const root = document.getElementById(options && options.rootId || "gmDashboardBody");
    if (!root) return;
    const players = findTeamPlayers(state);
    const injuries = findInjuries(state);
    root.innerHTML = [
      renderRecentForm(findMonthlyForm(state), state),
      renderCapSnapshot(findCapEntry(state), players),
      renderExpiringContracts(players, helpers),
      renderAgeCurve(players),
      renderNeeds(players, injuries),
      renderRosterBalance(players, injuries),
      renderTeamProfile(findTeamStats(state), state),
      renderInjuries(injuries, players, helpers),
      renderUpcomingGames(state, helpers)
    ].join("");

    if (!options.__hydrated) {
      hydrateMissingFeeds(state).then((changed) => {
        if (changed) render({ ...options, __hydrated: true });
      });
    }
  }

  window.UnifiedRosterGMDashboard = { render };
})();
