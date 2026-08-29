(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var launchToken = params.get("token") || "";
  var token = launchToken || sessionStorage.getItem("youthIntakeToken") || "";
  if (launchToken) {
    sessionStorage.setItem("youthIntakeToken", launchToken);
    params.delete("token");
    history.replaceState(null, "", window.location.pathname + (params.toString() ? "?" + params : ""));
  }

  var TEAM_LOGOS = {
    "AC Milan":"acmilan.jpg","AFC Richmond":"richmond.jpg","Ajax":"ajax.jpg",
    "Aston Villa":"astonvilla.jpg","Atletico Madrid":"atletico.jpg","Barcelona":"barcelona.jpg",
    "Bayern Munich":"bayern.jpg","Benfica":"benfica.jpg","Brighton":"brighton.jpg",
    "Chelsea":"chelsea.jpg","Crystal Palace":"crystalpalace.jpg","FL Fart":"flfart.jpg",
    "Inter Milan":"intermilan.jpg","Juventus":"juventus.jpg","Manchester City":"manchestercity.jpg",
    "Manchester United":"manutd.jpg","Marseille":"marseille.jpg","Monaco":"monaco.jpg",
    "Paris Saint-Germain":"psg.jpg","Real Madrid":"realmadrid.jpg","AC Sparta Praha":"acspartapraha.png",
    "Arsenal":"arsenal.png","Tottenham Hotspur":"tottenham.jpg","Valencia":"valencia.jpg"
  };
  var DIVISION_LABELS = {CLB:"Champions League",ELB:"Europa League",ECL:"Conference League"};
  var state = {
    bootstrap:null,
    result:null,
    revealSteps:[],
    revealIndex:0,
    autoplayTimer:null,
    filters:{division:"",team:""},
    reviewSort:{key:"allocation",direction:"asc"},
    busy:false,
    setupLocked:false
  };

  function el(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  function initials(value) {
    return String(value || "ESL").split(/\s+/).filter(Boolean).map(function (part) { return part[0]; }).join("").slice(0,3).toUpperCase();
  }
  function syncDisabled() {
    document.querySelectorAll("button").forEach(function (button) {
      if (!button.closest(".yi-reveal-controls")) button.disabled = state.busy;
    });
    el("seasonInput").disabled = state.busy || state.setupLocked;
    el("saveConfigButton").disabled = state.busy || state.setupLocked;
    el("refreshPoolButton").disabled = state.busy || state.setupLocked;
    el("officialDrawButton").disabled = state.busy || state.setupLocked;
    document.querySelectorAll("#configRows input,#configRows select").forEach(function (control) {
      control.disabled = state.busy || state.setupLocked;
    });
    document.querySelectorAll("#awardPanel input,#awardPanel select,#awardPanel button").forEach(function (control) {
      control.disabled = state.busy || state.setupLocked;
    });
  }
  function setBusy(busy, text) {
    state.busy = !!busy;
    syncDisabled();
    el("appStatus").textContent = text || (busy ? "Working" : "Local & secure");
  }
  function toast(message, isError) {
    var node = el("toast");
    node.textContent = message;
    node.classList.toggle("is-error", !!isError);
    node.hidden = false;
    clearTimeout(node._timer);
    node._timer = setTimeout(function () { node.hidden = true; }, isError ? 8000 : 4200);
  }
  async function api(path, body) {
    var options = {
      method: body === undefined ? "GET" : "POST",
      headers: {"X-Youth-Intake-Token":token}
    };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    var response = await fetch(path, options);
    var payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "The local app request failed.");
    return payload.data;
  }
  async function download(path) {
    var response = await fetch(path, {headers:{"X-Youth-Intake-Token":token}});
    if (!response.ok) {
      var payload = await response.json().catch(function () { return {}; });
      throw new Error(payload.error || "The FBB3 export failed.");
    }
    var disposition = response.headers.get("Content-Disposition") || "";
    var match = disposition.match(/filename="([^"]+)"/i);
    var filename = match ? match[1] : "FBB3-Youth-Intake.zip";
    var objectUrl = URL.createObjectURL(await response.blob());
    var link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1000);
    return filename;
  }
  function tierBadge(tier) {
    var clean = String(tier || "").toLowerCase();
    return '<span class="yi-tier yi-tier--' + escapeHtml(clean) + '">' + escapeHtml(String(tier || "—").toUpperCase()) + "</span>";
  }
  function focusBadge(outcome) {
    var random = String(outcome).toLowerCase() !== "focused";
    return '<span class="yi-focus' + (random ? " yi-focus--random" : "") + '">' + escapeHtml(outcome || "—") + "</span>";
  }
  function formatHeight(value) {
    var inches = Number(value);
    return Number.isFinite(inches) && inches > 0 ? Math.floor(inches / 12) + "-" + (inches % 12) : "—";
  }
  function logoHtml(team) {
    var file = TEAM_LOGOS[team];
    return file
      ? '<img src="../../00-assets/photos/' + encodeURIComponent(file) + '" alt="' + escapeHtml(team) + ' logo">'
      : escapeHtml(initials(team));
  }

  function readConfigRows() {
    return Array.from(document.querySelectorAll("tr[data-team]")).map(function (row) {
      return {
        team:row.dataset.team,
        gm:row.querySelector("[data-field=gm]").value.trim(),
        positionFocus:row.querySelector("[data-field=focus]").value
      };
    });
  }
  function renderConfig() {
    var teams = state.bootstrap.teams || [];
    var rows = [];
    var currentDivision = "";
    teams.forEach(function (team) {
      if (team.division !== currentDivision) {
        currentDivision = team.division;
        rows.push('<tr class="yi-division-row"><td colspan="5">' + escapeHtml(DIVISION_LABELS[currentDivision] || currentDivision) + "</td></tr>");
      }
      rows.push(
        '<tr data-team="' + escapeHtml(team.team) + '">' +
          "<td>" + escapeHtml(team.division) + "</td>" +
          "<td><strong>" + escapeHtml(team.team) + "</strong></td>" +
          "<td>" + escapeHtml(team.record) + "</td>" +
          '<td><input data-field="gm" type="text" value="' + escapeHtml(team.gm) + '" aria-label="' + escapeHtml(team.team) + ' GM"></td>' +
          '<td><select data-field="focus" aria-label="' + escapeHtml(team.team) + ' Academy Focus">' +
            state.bootstrap.positions.map(function (position) {
              return '<option value="' + position + '"' + (position === team.positionFocus ? " selected" : "") + ">" + position + "</option>";
            }).join("") +
          "</select></td>" +
        "</tr>"
      );
    });
    el("configRows").innerHTML = rows.join("");
    var validation = state.bootstrap.validation || {ok:false,issues:["Validation unavailable."]};
    el("validationStrip").classList.toggle("is-error", !validation.ok);
    el("validationStrip").textContent = validation.ok
      ? "All 24 teams have a valid GM and Academy Focus. Official generation is available."
      : validation.issues.join(" ");
  }
  function publishedAwardMode() {
    var published = state.bootstrap && state.bootstrap.currentPublished;
    return !!published && published.status === "published" &&
      String(published.season || "") === String(el("seasonInput").value.trim());
  }
  function syncAwardTypes() {
    var teamName = el("awardTeam").value;
    var team = (state.bootstrap.teams || []).find(function (entry) { return entry.team === teamName; });
    var previous = el("awardType").value;
    var types = (state.bootstrap.awardTypes || []).filter(function (type) {
      return team && (type.divisions || []).indexOf(team.division) !== -1;
    });
    el("awardType").innerHTML = types.map(function (type) {
      var odds = Object.keys(type.tierWeights || {}).map(function (tier) {
        return tier + " " + type.tierWeights[tier];
      }).join("/");
      return '<option value="' + escapeHtml(type.id) + '">' + escapeHtml(type.label) + " · " + escapeHtml(odds) + "</option>";
    }).join("");
    if (types.some(function (type) { return type.id === previous; })) el("awardType").value = previous;
  }
  function renderAwardPanel() {
    var teams = (state.bootstrap.teams || []).slice().sort(function (a,b) { return a.team.localeCompare(b.team); });
    var previousTeam = el("awardTeam").value;
    el("awardTeam").innerHTML = teams.map(function (team) {
      return '<option value="' + escapeHtml(team.team) + '">' + escapeHtml(team.team) + " · " + escapeHtml(team.division) + "</option>";
    }).join("");
    if (teams.some(function (team) { return team.team === previousTeam; })) el("awardTeam").value = previousTeam;
    syncAwardTypes();

    var published = publishedAwardMode();
    var publication = state.bootstrap.currentPublished || {};
    var awards = published ? (publication.manualAwards || []) : (state.bootstrap.stagedAwards || []);
    var revision = published ? Number(publication.awardsRevision || 0) : Number(state.bootstrap.awardRevision || 0);
    el("awardRevision").textContent = "Revision " + revision;
    el("awardModeCopy").textContent = published
      ? "Roll an audited extra prospect into the current published intake. Published corrections use recorded reversals."
      : "Roll and stage extra prospects for " + el("seasonInput").value + ". They will supplement all 72 normal slots.";
    el("createAwardButton").textContent = published ? "Roll & add published prospect" : "Roll & stage prospect";
    var capacity = state.bootstrap.awardCapacity || {};
    if (published && publication.counts) {
      capacity = {CLB:81-Number(publication.counts.CLB || 0),ELB:79-Number(publication.counts.ELB || 0),ECL:101-Number(publication.counts.ECL || 0)};
    }
    el("awardCapacity").textContent = "Remaining FBB3 capacity · CLB " + Math.max(0,capacity.CLB || 0) +
      " · ELB " + Math.max(0,capacity.ELB || 0) + " · ECL " + Math.max(0,capacity.ECL || 0);
    el("awardRows").innerHTML = awards.length ? awards.slice().reverse().map(function (award) {
      var player = award.player || {};
      var active = award.status === "staged" || award.status === "published";
      var action = active
        ? '<button class="yi-button yi-button--danger yi-button--small" type="button" data-award-action="' + (published ? "reverse" : "remove") + '" data-award-id="' + escapeHtml(award.awardId) + '">' + (published ? "Reverse" : "Remove") + "</button>"
        : "—";
      return "<tr>" +
        '<td><span class="yi-award-status is-' + escapeHtml(award.status) + '">' + escapeHtml(award.status) + "</span></td>" +
        "<td><strong>" + escapeHtml(award.team) + "</strong></td>" +
        "<td>" + escapeHtml(award.awardLabel || award.awardType) + "</td>" +
        "<td><strong>" + escapeHtml(award.playerName || player.name) + "</strong></td>" +
        "<td>" + tierBadge(award.selectedTier || player.tier) + "</td>" +
        "<td>" + escapeHtml(player.Position) + "</td>" +
        "<td>" + focusBadge(award.focusOutcome) + "</td>" +
        '<td class="yi-award-note">' + escapeHtml(award.note) + "</td><td>" + action + "</td></tr>";
    }).join("") : '<tr><td colspan="9">No individual awards recorded for this season.</td></tr>';
    syncDisabled();
  }
  function renderBootstrap() {
    var pool = state.bootstrap.pool || {};
    var requestedSeason = el("seasonInput").value.trim();
    el("poolTotal").textContent = Number(pool.total || 0).toLocaleString();
    el("poolDetail").textContent = ["A","B","C","D"].map(function (tier) {
      return tier + " " + ((pool.byTier || {})[tier] || 0);
    }).join(" · ");
    el("seasonInput").value = requestedSeason || state.bootstrap.defaultSeason || "season-4";
    renderConfig();
    var draft = state.bootstrap.activeDraft;
    if (draft) {
      state.result = draft;
      el("officialState").textContent = "Draft";
      el("officialDetail").textContent = draft.season + " · " + draft.draftHash.slice(0,12);
      lockSetup(true);
      renderResult();
    } else if (state.bootstrap.currentPublished) {
      state.result = state.bootstrap.currentPublished;
      el("officialState").textContent = "Published";
      el("officialDetail").textContent = state.bootstrap.currentPublished.season || "Current intake";
      renderResult(false);
    }
    renderAwardPanel();
  }
  function lockSetup(locked) {
    state.setupLocked = !!locked;
    syncDisabled();
  }
  async function saveConfig(showMessage) {
    var config = await api("/api/youth-intake/config", {teams:readConfigRows()});
    if (showMessage) toast("Team configuration saved.");
    return config;
  }
  async function reloadBootstrap() {
    var season = el("seasonInput").value.trim();
    state.bootstrap = await api("/api/youth-intake/bootstrap" + (season ? "?season=" + encodeURIComponent(season) : ""));
    renderBootstrap();
  }

  function allPlayers(result) {
    return (result.teams || []).flatMap(function (team) {
      return (team.intakePlayers || []).map(function (player) {
        return {team:team,player:player};
      });
    });
  }
  function rightsTeamFor(result, intakeTeam, prospectKey) {
    var owner = String(intakeTeam || "");
    (result.rightsTransfers || []).forEach(function (transfer) {
      if (String(transfer.prospectKey || "") === String(prospectKey || "")) {
        owner = String(transfer.toTeam || owner);
      }
    });
    return owner;
  }
  function selectedRightsEntry() {
    if (!state.result) return null;
    var key = el("rightsPlayer").value;
    return allPlayers(state.result).find(function (entry) {
      return String(entry.player.prospectKey || "") === key;
    }) || null;
  }
  function syncRightsForm() {
    var entry = selectedRightsEntry();
    if (!entry) {
      el("rightsCurrentOwner").textContent = "—";
      el("rightsDestination").innerHTML = "";
      return;
    }
    var currentOwner = rightsTeamFor(state.result,entry.team.team,entry.player.prospectKey);
    el("rightsCurrentOwner").textContent = currentOwner;
    var previousDestination = el("rightsDestination").value;
    var teams = (state.result.teams || []).map(function (team) { return team.team; }).sort(function (a,b) {
      return a.localeCompare(b);
    }).filter(function (team) { return team !== currentOwner; });
    el("rightsDestination").innerHTML = teams.map(function (team) {
      return '<option value="' + escapeHtml(team) + '">' + escapeHtml(team) + "</option>";
    }).join("");
    if (teams.indexOf(previousDestination) !== -1) el("rightsDestination").value = previousDestination;
  }
  function renderRights(result) {
    var published = result.status === "published";
    el("rightsPanel").hidden = !published;
    if (!published) return;

    var revision = Number(result.rightsRevision || 0);
    el("rightsRevision").textContent = "Revision " + revision;
    var previousPlayer = el("rightsPlayer").value;
    var players = allPlayers(result).slice().sort(function (a,b) {
      return String(a.player.name || "").localeCompare(String(b.player.name || ""),undefined,{sensitivity:"base"});
    });
    el("rightsPlayer").innerHTML = players.map(function (entry) {
      return '<option value="' + escapeHtml(entry.player.prospectKey) + '">' +
        escapeHtml(entry.player.name) + " — intake: " + escapeHtml(entry.team.team) + "</option>";
    }).join("");
    if (players.some(function (entry) { return String(entry.player.prospectKey || "") === previousPlayer; })) {
      el("rightsPlayer").value = previousPlayer;
    }
    syncRightsForm();

    var transfers = (result.rightsTransfers || []).slice().reverse();
    el("rightsHistory").innerHTML = transfers.length ? transfers.map(function (transfer) {
      var recorded = String(transfer.tradedAt || "").replace("T"," ").replace("Z"," UTC");
      return "<tr>" +
        "<td>" + escapeHtml(transfer.revision) + "</td>" +
        "<td><strong>" + escapeHtml(transfer.playerName) + "</strong></td>" +
        "<td>" + escapeHtml(transfer.fromTeam) + "</td>" +
        "<td><strong>" + escapeHtml(transfer.toTeam) + "</strong></td>" +
        "<td>" + escapeHtml(recorded) + "</td>" +
        "<td>" + escapeHtml(transfer.note) + "</td>" +
      "</tr>";
    }).join("") : '<tr><td colspan="6">No post-intake rights transfers recorded.</td></tr>';
  }
  function renderFilters(result) {
    var divisions = Array.from(new Set((result.teams || []).map(function (team) { return team.division; })));
    el("divisionFilter").innerHTML = '<option value="">All divisions</option>' + divisions.map(function (division) {
      return '<option value="' + escapeHtml(division) + '">' + escapeHtml(DIVISION_LABELS[division] || division) + "</option>";
    }).join("");
    el("teamFilter").innerHTML = '<option value="">All teams</option>' + (result.teams || []).slice().sort(function (a,b) {
      return a.team.localeCompare(b.team);
    }).map(function (team) {
      return '<option value="' + escapeHtml(team.team) + '">' + escapeHtml(team.team) + "</option>";
    }).join("");
    el("divisionFilter").value = state.filters.division;
    el("teamFilter").value = state.filters.team;
  }
  function compactSlot(team, player) {
    var division = String(team.division || "").toUpperCase();
    if (player.manualAward || player.slotType === "manual-award") return "EXTRA";
    if (player.slotType !== "wildcard") {
      return division + " " + String(player.selectedTier || player.tier || "").toUpperCase();
    }
    var wildcardNumber = String(player.slotKey || "").match(/(\d+)$/);
    return division + " WC" + (division === "ECL" && wildcardNumber ? wildcardNumber[1] : "");
  }
  function reviewSortValue(entry, key) {
    var team = entry.team;
    var player = entry.player;
    var values = {
      allocation:Number(player.allocationIndex || 0),
      team:String(team.team || ""),
      rights:rightsTeamFor(state.result,team.team,player.prospectKey),
      division:String(team.division || ""),
      record:Number(team.pct || 0),
      slot:compactSlot(team,player),
      tier:String(player.selectedTier || player.tier || ""),
      focus:String(player.focusOutcome || ""),
      player:String(player.name || ""),
      position:String(player.Position || ""),
      age:Number(player.Age || 0),
      potential:Number(player.POT || 0)
    };
    return values[key];
  }
  function compareReviewEntries(a, b) {
    var key = state.reviewSort.key;
    var direction = state.reviewSort.direction === "desc" ? -1 : 1;
    var left = reviewSortValue(a,key);
    var right = reviewSortValue(b,key);
    var result = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:"base"});
    if (result === 0) {
      result = String(a.team.team).localeCompare(String(b.team.team),undefined,{sensitivity:"base"});
    }
    if (result === 0) result = Number(a.player.allocationIndex || 0) - Number(b.player.allocationIndex || 0);
    return result * direction;
  }
  function updateReviewSortHeaders() {
    document.querySelectorAll(".yi-review-table th[data-active-sort]").forEach(function (header) {
      header.removeAttribute("data-active-sort");
      header.removeAttribute("aria-sort");
    });
    document.querySelectorAll(".yi-sort-button").forEach(function (button) {
      var active = button.dataset.sort === state.reviewSort.key;
      button.classList.toggle("is-active",active);
      if (active) {
        var header = button.closest("th");
        header.dataset.activeSort = state.reviewSort.direction;
        header.setAttribute("aria-sort",state.reviewSort.direction === "asc" ? "ascending" : "descending");
      }
    });
  }
  function renderReviewRows() {
    var result = state.result;
    if (!result) return;
    var entries = allPlayers(result).filter(function (entry) {
      return (!state.filters.division || entry.team.division === state.filters.division)
        && (!state.filters.team || entry.team.team === state.filters.team);
    }).sort(compareReviewEntries);
    el("reviewRows").innerHTML = entries.map(function (entry) {
      var team = entry.team;
      var player = entry.player;
      var rightsTeam = rightsTeamFor(result,team.team,player.prospectKey);
      return "<tr>" +
        "<td><strong>" + escapeHtml(team.team) + "</strong></td>" +
        "<td>" + (rightsTeam === team.team ? escapeHtml(rightsTeam) : "<strong>" + escapeHtml(rightsTeam) + "</strong>") + "</td>" +
        "<td>" + escapeHtml(team.division) + "</td>" +
        "<td>" + escapeHtml(team.record) + "</td>" +
        '<td><span class="yi-slot" title="' + escapeHtml(player.slotLabel) + '">' + escapeHtml(compactSlot(team,player)) + "</span></td>" +
        "<td>" + tierBadge(player.selectedTier || player.tier) + "</td>" +
        "<td>" + focusBadge(player.focusOutcome) + "</td>" +
        "<td><strong>" + escapeHtml(player.name) + "</strong></td>" +
        "<td>" + escapeHtml(player.Position) + "</td>" +
        "<td>" + escapeHtml(player.Age) + "</td>" +
        "<td>" + escapeHtml(player.POT) + "</td>" +
        '<td><details class="yi-audit"><summary>Rolls</summary><div>' +
          "Allocation #" + escapeHtml(player.allocationIndex) +
          (player.manualAward ? "<br>Individual award " + escapeHtml(player.awardId) : "") +
          "<br>Focus roll " + escapeHtml(player.focusRoll) + " / 10000" +
          "<br>Eligible pool " + escapeHtml(player.eligibleCount) +
          "<br>Prospect key " + escapeHtml(player.prospectKey) +
        "</div></details></td>" +
      "</tr>";
    }).join("");
    el("reviewCount").textContent = entries.length + " prospects shown";
    updateReviewSortHeaders();
  }
  function renderResult(scrollToReview) {
    var result = state.result;
    if (!result) return;
    el("reviewPanel").hidden = false;
    el("reviewTitle").textContent = result.status === "test"
      ? "Test draw review"
      : result.status === "published" ? "Published intake review" : "Official draw review";
    el("reviewMeta").textContent =
      result.season + " · Seed " + result.seed + " · Hash " + result.draftHash.slice(0,16) +
      " · " + result.counts.prospects + " unique prospects";
    el("publishButton").hidden = result.status !== "draft";
    el("voidButton").hidden = result.status !== "draft";
    el("exportCsvButton").hidden = result.status !== "draft" && result.status !== "published";
    renderFilters(result);
    renderReviewRows();
    renderRights(result);
    if (scrollToReview !== false) el("reviewPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function buildRevealSteps(result) {
    var byTeam = new Map((result.teams || []).map(function (team) { return [team.team,team]; }));
    return (result.revealOrder || []).map(function (teamName) {
      return byTeam.get(teamName);
    }).filter(Boolean).sort(function (left,right) {
      return left.team.localeCompare(right.team,undefined,{sensitivity:"base"});
    }).map(function (team) {
      return {type:"team",team:team};
    });
  }
  function compactRatingPair(player, label, currentKey, potentialKey) {
    var current = player[currentKey] == null ? "—" : player[currentKey];
    var potential = player[potentialKey] == null ? current : player[potentialKey];
    return '<span class="yi-class-rating"><b>' + label + '</b> ' +
      escapeHtml(current) + '<i>→</i>' + escapeHtml(potential) + "</span>";
  }
  var REVEAL_SKILLS = [
    {label:"INS",current:"InsideScoring",potential:"PotInside"},
    {label:"JPS",current:"JumpShot",potential:"PotJumpShot"},
    {label:"FT",current:"FtShot",potential:"PotFtShot"},
    {label:"3PT",current:"3pShot",potential:"Pot3pShot"},
    {label:"HND",current:"Handling",potential:"PotHandling"},
    {label:"PAS",current:"Passing",potential:"PotPassing"},
    {label:"PST D",current:"PostDefense",potential:"PotPostDefense"},
    {label:"PER D",current:"PerimeterDefense",potential:"PotPerimeterDefense"},
    {label:"STL",current:"Stealing",potential:"PotStealing"},
    {label:"BLK",current:"Blocking",potential:"PotBlocking"},
    {label:"OREB",current:"OReb",potential:"PotOReb"},
    {label:"DREB",current:"DReb",potential:"PotDReb"}
  ];
  function bestRevealSkills(player, limit) {
    return REVEAL_SKILLS.filter(function (skill) {
      return Number.isFinite(Number(player[skill.current])) ||
        Number.isFinite(Number(player[skill.potential]));
    }).sort(function (left, right) {
      var leftPotential = Number(player[left.potential]);
      var rightPotential = Number(player[right.potential]);
      var leftCurrent = Number(player[left.current]);
      var rightCurrent = Number(player[right.current]);
      if (!Number.isFinite(leftPotential)) leftPotential = leftCurrent;
      if (!Number.isFinite(rightPotential)) rightPotential = rightCurrent;
      if (!Number.isFinite(leftCurrent)) leftCurrent = -1;
      if (!Number.isFinite(rightCurrent)) rightCurrent = -1;
      return rightPotential - leftPotential ||
        rightCurrent - leftCurrent ||
        left.label.localeCompare(right.label);
    }).slice(0,limit);
  }
  function revealProspect(player, team) {
    var tier = String(player.selectedTier || player.tier || "").toLowerCase();
    var wildcard = player.slotType === "wildcard";
    var bestSkills = bestRevealSkills(player,5);
    return '<section class="yi-class-prospect">' +
      '<div class="yi-class-prospect-head">' +
        '<div><span class="yi-class-slot">' + escapeHtml(player.slotLabel) + '</span>' +
        '<h3>' + escapeHtml(player.name) + '</h3></div>' +
        '<span class="yi-reveal-tier yi-reveal-tier--compact is-' + escapeHtml(tier) + '">' + escapeHtml(tier.toUpperCase()) + "</span>" +
      "</div>" +
      '<p class="yi-class-meta">' + escapeHtml(player.Position) + " / Age " + escapeHtml(player.Age) +
        " / " + escapeHtml(formatHeight(player.Height)) + " / POT " + escapeHtml(player.POT) + "</p>" +
      '<div class="yi-class-ratings">' +
        bestSkills.map(function (skill) {
          return compactRatingPair(player,skill.label,skill.current,skill.potential);
        }).join("") +
      "</div>" +
      '<p class="yi-class-roll">' +
        (player.manualAward ? "Extra award: Tier " + escapeHtml(player.selectedTier) :
          (wildcard ? "Wildcard: Tier " + escapeHtml(player.selectedTier) : "Guaranteed Tier " + escapeHtml(player.selectedTier))) +
        " / Focus " + escapeHtml(team.positionFocus) + ": " + escapeHtml(player.focusOutcome) +
        (player.focusApplied ? "" : " (focus excluded)") +
      "</p></section>";
  }
  function revealTeam(step, result) {
    var team = step.team;
    return '<article class="yi-reveal-card">' +
      (result.status === "test" ? '<span class="yi-reveal-watermark">Test draw</span>' : "") +
      '<header class="yi-class-header">' +
        '<div class="yi-reveal-logo yi-reveal-logo--class">' + logoHtml(team.team) + "</div>" +
        '<div><p class="yi-reveal-eyebrow">' + escapeHtml(team.divisionLabel) + " / " + escapeHtml(team.record) + "</p>" +
        '<h2 class="yi-class-team-name">' + escapeHtml(team.team) + "</h2>" +
        '<p class="yi-reveal-meta">GM ' + escapeHtml(team.gm) + " / Academy Focus " + escapeHtml(team.positionFocus) +
        " / Complete class</p></div>" +
      "</header>" +
      '<div class="yi-team-class-grid yi-team-class-grid--' + escapeHtml((team.intakePlayers || []).length) + '">' +
        (team.intakePlayers || []).map(function (player) { return revealProspect(player,team); }).join("") +
      "</div></article>";
  }
  function renderRevealStep() {
    var step = state.revealSteps[state.revealIndex];
    if (!step) { closeReveal(); return; }
    el("revealStage").innerHTML = revealTeam(step,state.result);
    el("revealProgress").textContent = "Team " + (state.revealIndex + 1) + " / " + state.revealSteps.length;
  }
  function openReveal() {
    if (!state.result) return;
    state.revealSteps = buildRevealSteps(state.result);
    state.revealIndex = 0;
    stopAutoplay();
    el("revealOverlay").hidden = false;
    document.body.style.overflow = "hidden";
    renderRevealStep();
  }
  function closeReveal() {
    stopAutoplay();
    el("revealOverlay").hidden = true;
    document.body.style.overflow = "";
    renderResult();
  }
  function nextReveal() {
    if (state.revealIndex >= state.revealSteps.length - 1) { closeReveal(); return; }
    state.revealIndex += 1;
    renderRevealStep();
  }
  function previousReveal() {
    state.revealIndex = Math.max(0,state.revealIndex - 1);
    renderRevealStep();
  }
  function stopAutoplay() {
    clearInterval(state.autoplayTimer);
    state.autoplayTimer = null;
    var button = document.querySelector("[data-reveal-action=autoplay]");
    if (button) button.textContent = "Autoplay";
  }
  function toggleAutoplay() {
    if (state.autoplayTimer) { stopAutoplay(); return; }
    document.querySelector("[data-reveal-action=autoplay]").textContent = "Pause";
    state.autoplayTimer = setInterval(nextReveal,8000);
  }

  async function runTest() {
    setBusy(true,"Running test");
    try {
      await saveConfig(false);
      state.result = await api("/api/youth-intake/simulate/test",{season:el("seasonInput").value});
      state.filters = {division:"",team:""};
      renderResult();
      openReveal();
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function runOfficial() {
    if (!confirm("Generate the official intake now? The seed will be locked and the draft can only be published or voided with a reason.")) return;
    setBusy(true,"Generating official");
    try {
      await saveConfig(false);
      state.result = await api("/api/youth-intake/draft",{season:el("seasonInput").value});
      state.filters = {division:"",team:""};
      lockSetup(true);
      el("officialState").textContent = "Draft";
      el("officialDetail").textContent = state.result.season + " · " + state.result.draftHash.slice(0,12);
      renderResult();
      openReveal();
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function publishOfficial() {
    if (!state.result || state.result.status !== "draft") return;
    if (!confirm("Lock and publish this exact official intake? The selected prospects will become permanently unavailable.")) return;
    setBusy(true,"Publishing");
    try {
      var published = await api("/api/youth-intake/publish",{draftHash:state.result.draftHash});
      toast("Published " + published.publication.season + " to the public Youth Intake page.");
      state.result = published.publication;
      renderResult();
      lockSetup(false);
      await reloadBootstrap();
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function voidOfficial() {
    var reason = prompt("Why is this official draft being voided? This reason is saved permanently.");
    if (!reason || !reason.trim()) return;
    setBusy(true,"Voiding draft");
    try {
      await api("/api/youth-intake/void",{reason:reason.trim()});
      toast("Official draft voided. Its prospects are available again.");
      state.result = null;
      el("reviewPanel").hidden = true;
      lockSetup(false);
      await reloadBootstrap();
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function refreshPool() {
    setBusy(true,"Refreshing pool");
    try {
      var result = await api("/api/youth-intake/pool/refresh",{});
      toast(result.output || "Prospect pool refreshed.");
      await reloadBootstrap();
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function createAward() {
    var note = el("awardNote").value.trim();
    if (!note) { toast("Add a commissioner note or reference.",true); return; }
    var published = publishedAwardMode();
    var team = el("awardTeam").value;
    var type = el("awardType").value;
    if (!team || !type) { toast("Choose a team and prospect type.",true); return; }
    if (published && !confirm("Roll and immediately add this extra prospect to the published intake?")) return;
    setBusy(true,published ? "Adding published award" : "Staging award");
    try {
      var payload = {
        season:el("seasonInput").value.trim(), team:team, awardType:type, note:note,
        expectedRevision:published
          ? Number((state.bootstrap.currentPublished || {}).awardsRevision || 0)
          : Number(state.bootstrap.awardRevision || 0)
      };
      var result = await api(published
        ? "/api/youth-intake/awards/published/create"
        : "/api/youth-intake/awards/staged/create",payload);
      el("awardNote").value = "";
      if (published) {
        state.result = result.publication;
        state.bootstrap.currentPublished = result.publication;
        renderResult(false);
        renderAwardPanel();
      } else {
        state.bootstrap = result.bootstrap;
        renderBootstrap();
      }
      toast("Awarded " + result.award.playerName + " to " + result.award.team + ".");
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function removeStagedAward(awardId) {
    if (!confirm("Remove this staged award and return its prospect to the eligible pool?")) return;
    setBusy(true,"Removing staged award");
    try {
      var result = await api("/api/youth-intake/awards/staged/remove",{
        season:el("seasonInput").value.trim(), awardId:awardId,
        expectedRevision:Number(state.bootstrap.awardRevision || 0)
      });
      state.bootstrap = result.bootstrap;
      renderBootstrap();
      toast("Staged award removed.");
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function reversePublishedAward(awardId) {
    var reason = prompt("Why is this published individual award being reversed? The reversal is permanent and audited.");
    if (!reason || !reason.trim()) return;
    setBusy(true,"Reversing published award");
    try {
      var result = await api("/api/youth-intake/awards/published/reverse",{
        awardId:awardId, reason:reason.trim(),
        expectedRevision:Number((state.bootstrap.currentPublished || {}).awardsRevision || 0)
      });
      state.result = result.publication;
      state.bootstrap.currentPublished = result.publication;
      renderResult(false);
      renderAwardPanel();
      toast("Published award reversed and prospect returned to the eligible pool.");
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }
  async function exportFbb3Csvs() {
    if (!state.result || (state.result.status !== "draft" && state.result.status !== "published")) return;
    setBusy(true,"Preparing FBB3 CSVs");
    try {
      var hash = encodeURIComponent(state.result.draftHash || "");
      var filename = await download("/api/youth-intake/export/fbb3?draftHash=" + hash);
      toast("Downloaded " + filename + " with T1, T2 and T3 CSVs.");
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }

  async function recordRightsTransfer() {
    if (!state.result || state.result.status !== "published") return;
    var entry = selectedRightsEntry();
    var destination = el("rightsDestination").value;
    var note = el("rightsNote").value.trim();
    if (!entry || !destination) { toast("Choose a prospect and destination team.",true); return; }
    if (!note) { toast("Add a trade note or reference.",true); return; }
    var currentOwner = rightsTeamFor(state.result,entry.team.team,entry.player.prospectKey);
    if (!confirm("Transfer " + entry.player.name + " rights from " + currentOwner + " to " + destination + "?")) return;
    setBusy(true,"Recording rights trade");
    try {
      var result = await api("/api/youth-intake/rights/transfer",{
        prospectKey:entry.player.prospectKey,
        toTeam:destination,
        note:note,
        expectedRevision:Number(state.result.rightsRevision || 0)
      });
      state.result = result.publication;
      if (state.bootstrap) state.bootstrap.currentPublished = result.publication;
      el("rightsNote").value = "";
      renderResult(false);
      toast("Recorded " + result.transfer.playerName + " rights to " + result.transfer.toTeam + ".");
    } catch (error) { toast(error.message,true); }
    finally { setBusy(false); }
  }

  function bind() {
    el("saveConfigButton").addEventListener("click",function () {
      setBusy(true,"Saving");
      saveConfig(true).then(reloadBootstrap).catch(function (error) { toast(error.message,true); }).finally(function () { setBusy(false); });
    });
    el("refreshPoolButton").addEventListener("click",refreshPool);
    el("testDrawButton").addEventListener("click",runTest);
    el("officialDrawButton").addEventListener("click",runOfficial);
    el("revealButton").addEventListener("click",openReveal);
    el("exportCsvButton").addEventListener("click",exportFbb3Csvs);
    el("publishButton").addEventListener("click",publishOfficial);
    el("voidButton").addEventListener("click",voidOfficial);
    el("rightsPlayer").addEventListener("change",syncRightsForm);
    el("recordRightsButton").addEventListener("click",recordRightsTransfer);
    el("awardTeam").addEventListener("change",syncAwardTypes);
    el("createAwardButton").addEventListener("click",createAward);
    el("awardRows").addEventListener("click",function (event) {
      var button = event.target.closest("[data-award-action]");
      if (!button) return;
      if (button.dataset.awardAction === "remove") removeStagedAward(button.dataset.awardId);
      if (button.dataset.awardAction === "reverse") reversePublishedAward(button.dataset.awardId);
    });
    el("seasonInput").addEventListener("change",function () {
      setBusy(true,"Loading season awards");
      reloadBootstrap().catch(function (error) { toast(error.message,true); }).finally(function () { setBusy(false); });
    });
    el("divisionFilter").addEventListener("change",function () {
      state.filters.division = this.value;
      state.filters.team = "";
      el("teamFilter").value = "";
      renderReviewRows();
    });
    el("teamFilter").addEventListener("change",function () {
      state.filters.team = this.value;
      renderReviewRows();
    });
    document.querySelector(".yi-review-table thead").addEventListener("click",function (event) {
      var button = event.target.closest(".yi-sort-button");
      if (!button) return;
      var key = button.dataset.sort;
      if (state.reviewSort.key === key) {
        state.reviewSort.direction = state.reviewSort.direction === "asc" ? "desc" : "asc";
      } else {
        state.reviewSort = {key:key,direction:"asc"};
      }
      renderReviewRows();
    });
    document.querySelectorAll("[data-reveal-action]").forEach(function (button) {
      button.addEventListener("click",function () {
        var action = this.dataset.revealAction;
        if (action === "previous") previousReveal();
        if (action === "next") nextReveal();
        if (action === "autoplay") toggleAutoplay();
        if (action === "skip") closeReveal();
        if (action === "fullscreen") el("revealOverlay").requestFullscreen && el("revealOverlay").requestFullscreen();
      });
    });
    document.addEventListener("keydown",function (event) {
      if (el("revealOverlay").hidden) return;
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); nextReveal(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); previousReveal(); }
      if (event.key === "Escape" && !document.fullscreenElement) closeReveal();
    });
  }
  async function init() {
    bind();
    if (!token) {
      el("appStatus").textContent = "Launch required";
      toast("Open this page with run_youth_intake_app.bat so it receives a secure local token.",true);
      return;
    }
    setBusy(true,"Loading inputs");
    try {
      await reloadBootstrap();
      el("appStatus").textContent = "Local & secure";
    } catch (error) {
      el("appStatus").textContent = "Input error";
      toast(error.message,true);
    } finally {
      setBusy(false);
    }
  }
  init();
}());
