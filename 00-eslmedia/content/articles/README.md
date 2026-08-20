# ESL Media Article Template Guide

This guide is for humans or AIs creating future files inside `00-eslmedia/content/articles/`.

The goal is simple:
- every article should keep the same ESL Media article shell
- every article should auto-pick up the shared right rail
- every article should look like the existing newspaper-style pages without custom rebuilding

## Required file setup

Every article file should:
- live in `00-eslmedia/content/articles/`
- be a standalone `.html` file
- include `@import url("../media-shared.css");` inside its `<style>` block
- use `<body class="media-article">`
- include one main article container using the permanent package shell: `<div class="package-paper"> ... </div>`
- keep the standard topbar nav unchanged so the shared Teams dropdown can inject correctly
- include shared scripts before `</body>`:

```html
<script src="../media-articles.js"></script>
<script src="../media-ads.js"></script>
<script src="../article-rail.js"></script>
</body>
```

The `article-rail.js` script automatically:
- nudges the article layout left on desktop
- adds a right rail
- shows a recommended-articles list
- shows two random ads from `00-eslmedia/content/Ads/`

## Permanent package shell

For monthly packages, offseason packages, rankings, race watches, stock reports,
and month reviews, start from:

`00-eslmedia/content/articles/_package_article_template.html`

Use the shell classes from `media-shared.css`:
- `package-paper`
- `package-masthead`
- `package-headline`
- `package-dek`
- `package-byline-bar`
- `package-body`
- `package-section-header`
- `footer-rule`
- `footer-text`

Do not paste a full custom inline stylesheet into each article unless the story
needs a genuinely unique component. Keep the page chrome consistent and let the
newness come from reporting, ordering, board logic, and writer voice.

For power rankings, use the shared ranking components:
- `ranking-board`
- `ranking-board-head`
- `ranking-list`
- `ranking-card`
- `ranking-topline`
- `ranking-number`
- `ranking-team`
- `ranking-move`
- `ranking-meta`
- `ranking-copy`
- `ranking-detail-grid`
- `ranking-detail`
- `ranking-detail-label`
- `ranking-detail-text`
- `board-notes`

Every power-ranking team should get a real capsule, not a one-line list item:
- rank, team, movement
- compact meta line with overall record, latest-sim form, differential/streak, and star/context hook
- main argument paragraph
- three mini-fields: `Reason`, `Concern`, and `Next trigger`

## Standard metadata block

Every article should include this metadata in `<head>` so social previews are consistent:

```html
<meta name="description" content="One sentence summary of the article.">
<meta property="og:title" content="ARTICLE TITLE - ESL Media">
<meta property="og:description" content="One sentence summary of the article.">
<meta property="og:type" content="article">
<meta property="og:image" content="../article%20images/ESLM.png">
<link rel="canonical" href="https://example.com/00-eslmedia/content/articles/ARTICLE_FILE.html">
```

Rules:
- Keep `description` and `og:description` aligned.
- Use the final article filename in the canonical URL.
- Keep the canonical URL absolute.

## Required page structure

Use this structure in order:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ARTICLE TITLE - ESL Media</title>
  <meta name="description" content="One sentence summary of the article.">
  <meta property="og:title" content="ARTICLE TITLE - ESL Media">
  <meta property="og:description" content="One sentence summary of the article.">
  <meta property="og:type" content="article">
  <meta property="og:image" content="../article%20images/ESLM.png">
  <link rel="canonical" href="https://example.com/00-eslmedia/content/articles/ARTICLE_FILE.html">
  <style>
    @import url("../media-shared.css");

    :root {
      --gold: #111b36;
      --ink: #0F0F0F;
      --off-white: #F5F0E8;
      --red: #111b36;
      --mid: #3A3A3A;
      --light: #E8E2D5;
    }

    /* Add only article-specific styles here */
  </style>
</head>
<body class="media-article">
  <header class="site-topbar">
    <div class="site-topbar-inner">
      <div class="site-topbar-brand">
        <div class="site-edition-pill">Front Page</div>
        <div>European Super League Sports Desk</div>
      </div>
      <ul class="site-topbar-nav">
        <li><a href="../../homepage.html" class="active">Home</a></li>
        <li><a href="../all-articles.html">All Articles</a></li>
        <li><a href="../articles/ecl_awards_predictions.html">Latest</a></li>
        <li><a href="../analysis.html">Analysis</a></li>
        <li><a href="../scouting.html">Scouting</a></li>
        <li><a href="../interviews.html">Interviews</a></li>
        <li><a href="../../../index.htm">League Site</a></li>
      </ul>
    </div>
  </header>

  <div class="site-ticker">
    <div class="site-ticker-inner">
      <span class="site-ticker-label">Top Story</span>
      <div class="site-ticker-track">
        <div class="site-ticker-item">Ticker item one</div>
        <div class="site-ticker-item">Ticker item two</div>
        <div class="site-ticker-item">Ticker item one</div>
        <div class="site-ticker-item">Ticker item two</div>
      </div>
    </div>
  </div>

  <div class="paper">
    <div class="masthead">
      <div class="league-name">European Super League - Feature</div>
      <div class="section-label">Category - Desk - Season</div>
    </div>

    <h1 class="headline">Article headline here</h1>
    <p class="dek">One-sentence deck here.</p>

    <div class="byline-bar">
      <span class="byline">Author Name</span>
      <span class="dateline">Season and descriptor</span>
    </div>

    <div class="body-text">
      <p class="drop-cap">First paragraph starts here.</p>
      <p>Second paragraph.</p>
    </div>

    <hr class="footer-rule">
    <div class="footer-text">European Super League - Season - Desk</div>
  </div>

  <script src="../media-articles.js"></script>
  <script src="../media-ads.js"></script>
  <script src="../article-rail.js"></script>
</body>
</html>
```

## Writing rules

Use these conventions:
- headline in title case
- headline should sound like a sports headline, not an internal summary label
- prefer one strong central claim over a list of three mini-claims
- power rankings headlines should always include the month or period in the title, for example `February Tier 1 Power Rankings: Bayern Still Own The Room`
- for power rankings, the month/period should appear in both the `<title>` and the visible `<h1>`
- let the dek carry some explanatory detail so the headline can stay sharper
- dek is 1 sentence, 20 to 35 words
- byline line is short and uppercase-friendly
- first paragraph should use `class="drop-cap"`
- body copy should be broken into readable short paragraphs
- use `section-header` blocks for major subsections
- use existing helper classes like `pull-quote`, `stat-box`, `player-callout`, `section-header`, `footer-rule`, and `footer-text` when useful
- published article copy must read like a real sports article, not an AI note or production memo
- do not mention JSON files, templates, prompts, databases, repo structure, source extraction, or any behind-the-scenes workflow in the visible article
- writer persona guidance is internal only and should shape the prose without being named inside the article body

## Reporting and anti-template writing rules

An article should feel observed, argued, and edited rather than assembled from a
data pack. Accurate facts are the starting point, not the finished voice.

For every article:

- decide what the writer genuinely finds surprising, suspicious, funny, worrying,
  or difficult to explain before drafting
- include at least one inconvenient detail that complicates the cleanest version
  of the main argument
- include at least one reasonable counterargument or uncertainty; answer it when
  the evidence allows, and leave it unresolved when the evidence does not
- use only the statistics that change the reader's understanding of the subject
- interpret a number instead of restating every available field around it
- make direct judgments when the evidence supports them; do not give every praise
  sentence a matching caution merely to sound balanced
- vary paragraph length, sentence length, transitions, and section rhythm
- let some paragraphs perform different jobs: observation, argument, scene,
  objection, comparison, punchline, or consequence
- prefer precise basketball consequences over portable sports language that could
  be pasted into an article about any team or player
- preserve odd roster shapes, questionable decisions, awkward fits, and unresolved
  questions instead of forcing every section into a clean thesis

Do not build a whole article from repeated formulas such as:

- `claim -> statistic -> balanced caveat -> tidy verdict`
- `Fit / Risk / Bidders` for every player
- `Reason / Concern / Next trigger` written with identical sentence construction
- one paragraph of equal length for every ranked entry
- a topic sentence that announces the purpose of every paragraph

Shared board fields may remain for visual consistency, but the prose inside them
must not repeat the same syntax. Do not use the same capsule formula for more than
three consecutive entries. Change the analytical lens when the subject changes:
contract pressure, roster geometry, age curve, role scarcity, tactical fit,
developmental risk, or a specific club decision.

Avoid stock rhetorical signposts as default transitions, including:

- `the case is simple`
- `that matters`
- `the point is`
- `the mistake is`
- `make no mistake`
- `it is not X; it is Y`
- `options, not obligations`
- `money is leverage only when...`
- `read that again`
- `stop pretending`

A writer may use one of these only when it is genuinely natural to that writer's
voice and has not already appeared elsewhere in the article. Catchphrases cannot
substitute for an argument.

### Draft and revision method

Write in two passes:

1. **Reporting draft**
   - establish the claim, best evidence, awkward evidence, and unanswered question
   - write freely without trying to make every paragraph publication-ready
   - identify the one or two details a human columnist would keep talking about

2. **Voice edit**
   - cut generic transitions and sentences that could survive unchanged in another article
   - break repeated paragraph and capsule patterns
   - replace broad praise or criticism with a specific basketball consequence
   - read the opening, one middle section, and the ending aloud for repeated rhythm
   - remove one unnecessary statistic from any paragraph carrying three or more numbers
   - check that the ending advances the argument instead of summarizing every section

Do not aim for perfect polish in the first draft. Immediate, uniformly polished
prose often becomes symmetrical, cautious, and generic. The second pass is where
the assigned writer's preferences, irritations, humour, and judgment should become
unmistakable.

## Power rankings rules

Power rankings should read as a trust board, not a standings table. They should
answer: who would the writer trust most if the league kept playing like this
right now?

For every power rankings article:
- open with the ranking lens before the board, for example full-season profile first, latest month second, and tier stakes third
- make the order meaningfully different from standings when form, margin, injury context, schedule context, or tier pressure justify it
- include visible movement for every team, such as `STAYED NO. 1`, `UP 2 FROM NO. 5`, or `DOWN 1 FROM NO. 3`
- include a compact meta line with record, latest-month form, point differential or streak, and the main player/context hook
- make the reason, concern, and next pressure point clear inside natural prose rather than forcing the same mini-field template onto every team
- vary capsule length, rhythm, and analytical lens; do not repeat a `Reason / Concern / Next trigger` grid across the entire board
- use tier-specific stakes: Tier 1 credibility/survival, Tier 2 promotion/relegation pressure, Tier 3 one-promotion urgency
- include a short board notes block after the rankings with labels like `Control Team`, `Biggest Riser`, `Trust Problem`, and `Panic Team`
- end by looking forward to what would change the next board

Avoid:
- sorting only by record
- repeating the same sentence structure in every capsule
- using generic phrases like "player anchor," "the board respects the floor," or "the case is built on..."
- presenting a hot month as proof without explaining whether it changes trust
- burying movement only in the intro

## Promotion/relegation race rules

Any article that discusses promotion, relegation, race lines, or whether a team is
truly live in a race must use the full standings as the source of truth. This
applies to race-watch articles, month reviews, stock reports, power rankings,
and any other package article that mentions race implications.

For every article with race implications:
- use `00-build/database/standings.json` to define the actual line, rank order, record, games back, and whether a team is truly live in the race
- use monthly form, latest-sim record, and `tier_race_snapshot.json` only as momentum/context after the standings line is established
- do not describe a team as being on, above, below, or close to the promotion/relegation line based only on latest-sim form
- if a team has a hot month but remains materially far back in the standings, frame it as stock-up/context rather than as a promotion-line team
- state the rules clearly: Tier 1 has two relegation spots, Tier 2 has two promotion spots and one relegation spot, and Tier 3 has one promotion spot
- use games-behind pressure over seed adjacency when deciding who is safe, sweating, chasing, or fringe

Avoid:
- treating `monthly_team_form.json` or `tier_race_snapshot.json` as the standings table
- calling a team "live for promotion" because it led the latest sim while still many games behind the actual line
- burying the actual line behind monthly movement language

## Visual identity rules

ESL Media articles should keep the older print sports-page feel. They should read
more like a newspaper column or power-board page than a modern app dashboard.

Preserve these traits:
- big serif headline with real editorial weight
- compact dek that states the article's point of view
- byline/dateline row with thin rules
- first paragraph using `class="drop-cap"`
- narrow, readable article measure inside the `.paper` wrapper
- strong board/table contrast, especially black or near-black section headers
- pale board bodies with thin separators for rankings or lists
- clear type hierarchy for headline, dek, byline, intro, section title, rank, team/player name, and metadata
- restrained palette: mostly black, white, pale gray/off-white, and blue-led accents

Avoid these when making article pages:
- generic rounded dashboard cards for main article content
- heavy gradients, bright colors, or decorative app-style chrome
- soft card stacks that make rankings feel like UI panels instead of editorial boards
- oversized spacing that weakens the newspaper density
- hiding the article voice behind neutral web-template layout

Dashboard and league tools can look modern, but articles should keep the
print/editorial identity unless the user explicitly asks for a different style.

## Headline guidance

Use these rules when naming articles:
- avoid flat `X holds, Y climbs, Z slips` constructions unless the piece is intentionally recap-heavy
- lead with the strongest story or consequence, not the article category
- use sharper verbs like `owns`, `breaks`, `opens`, `tightens`, `steals`, `survives`, `collapses`, or `changes`
- a good title should usually feel like one clean editorial idea, not a changelog
- if the headline feels too summary-like, tighten it and move the extra explanation into the dek

## Approval rule

Before generating any new article, always ask the user for approval in chat first.

Do not draft immediately, even if the angle sounds clear.

Confirm these before writing:
- article format: one article or multiple articles
- tier/category: CLB, ELB, ECL, Analysis, Scouting, etc.
- rough length
- writer persona/voice
- whether it should be added to homepage, analysis, scouting, interviews, or archive pages
- how it should appear on the homepage power board

Only start writing once the user answers.

Example confirmation:
- `Do you want this as one article or three separate pieces, and which writer voice should I use?`

## Writer personas

Use a named writer persona for every future article request.

Default options:
- `Damon Cross`
  Voice: loud, confrontational, TV-debate energy, inspired by a Stephen A.-style columnist.
  Best for: awards takes, contender pressure pieces, panic meter columns, bold predictions.
- `Nina Vale`
  Voice: data-first, measured, analytical, evidence-heavy.
  Best for: power rankings, standings breakdowns, league leader analysis, trend stories.
- `Graham Trent`
  Voice: dry, observant, polished, lightly wry long-form reporter.
  Best for: profiles, features, scene-setting pieces, club identity essays.
- `Malik Sparks`
  Voice: high-energy comedy columnist with rapid-fire reactions, exaggerated disbelief, sharp self-awareness, and a big little-man chip on his shoulder. The rhythm should feel fast, animated, and punchline-heavy while still landing real basketball points.
  Best for: roast columns, chaotic game reactions, fan frustration pieces, locker-room absurdity, funny panic-meter articles, and stories where the league needs to be laughed at before it gets analyzed.

Always note the chosen persona in the article plan before drafting.

## Voice Separation Rules

Use these rules to keep reports from sounding interchangeable:

- `Damon Cross` should sound like argument first, evidence second. Use short, forceful paragraphs, direct judgments, selective rhetorical questions, and pressure framing. He can be funny, but the main engine is conviction. Do not manufacture his voice by repeating catchphrases such as "stop pretending," "that matters," or "the case is simple."
- `Nina Vale` should sound like evidence first, judgment second. Use measured claims, explicit criteria, ranking logic, statistical qualifiers, and clean transitions. Avoid yelling, mockery, or theatrical phrasing; her authority comes from being precise.
- `Graham Trent` should sound like a newspaper feature writer. Use polished sentences, dry understatement, scene-setting, and quiet irony. He should explain why a result feels meaningful without turning every paragraph into a take.
- `Malik Sparks` should sound like controlled chaos with a basketball brain. Use punchlines, quick turns, exaggerated disbelief, and self-aware asides, but always land on a real tactical or statistical point before moving on.
- Do not reuse the same opening rhythm across personas. Damon can open with a verdict, Nina with criteria, Graham with context, and Malik with a comic image or reaction.
- Do not flatten every article into the same structure. A power ranking can use ordered logic, a race watch can use pressure lines, an awards/MVP piece can use ballot arguments, and a month review can use themes.
- If an article includes multiple tiers, keep the writer voice consistent while varying the tier sections by argument: one tier may be obvious, one may be messy, and one may need a caveat.

## Author voice QA checklist

Run this quick check before publishing any article:

1. **Open and close test**
   - Does the opening sound like the assigned writer immediately?
   - Does the closing land in the same voice, not a generic recap voice?

2. **Structure test**
   - `Damon Cross`: verdict first, pressure framing, short forceful paragraphs.
   - `Nina Vale`: criteria first, evidence chains, ranking logic before verdict.
   - `Graham Trent`: context first, polished long-form cadence, dry understatement.
   - `Malik Sparks`: punchline-to-point rhythm, comedic turns that still land basketball analysis.

3. **Language test**
   - Remove phrases that belong to another writer's voice (for example, theatrical lines inside Nina, or pure neutral analyst phrasing inside Damon).
   - Confirm repeated transition phrases are not copied from another persona template.

4. **Section consistency test**
   - If the piece has multiple sections or tiers, does each section still sound like the same writer?
   - No section should read like a different desk voice.

5. **A/B identity test**
   - Read any 2 random paragraphs without the byline.
   - If you cannot correctly guess the writer persona, revise for stronger voice markers.

6. **Template test**
   - Do three consecutive sections or capsules use the same sentence construction?
   - Does each paragraph follow claim, statistic, caveat, and verdict in that order?
   - If so, change the lens, length, or structure of at least one section.

7. **Specificity test**
   - Could any sentence be pasted unchanged into an article about another league?
   - Replace portable phrases with a player, contract, roster, tactical, or race consequence.
   - Confirm the article contains at least one awkward or surprising detail that resists a tidy summary.

8. **Counterargument test**
   - Does the article acknowledge the strongest reasonable objection to its main claim?
   - Does the writer answer it honestly rather than inserting a token balanced sentence?

9. **Rhythm test**
   - Read the opening, a middle section, and the ending aloud.
   - Break repeated transition words, identical paragraph lengths, and consecutive sentences with the same cadence.
   - Confirm the ending adds a consequence, prediction, or unresolved pressure point rather than merely recapping.

## Team-biased reporter personas

Use these when the article should read like a biased fan-columnist for a specific team. Each reporter has the same base personality, but the name changes by team.

Shared voice: biased fan-columnist with long-memory grudges, half-serious historical comparisons, confident overreactions, fake-objective analysis, and constant references to how this team has spiritually changed them. Funny, nostalgic, self-important, weirdly persuasive, and always convinced their team's pain or greatness matters more than everyone else's.

Best for: team-biased columns, homer previews, rivalry pieces, legacy debates, emotional playoff reactions, front-office second guessing, fanbase therapy articles, and arguments where the conclusion was clearly decided before the evidence was gathered.

Team assignments:
- `AC Milan` - `Marco Redline`
- `AFC Richmond` - `Ted Pressbox`
- `Ajax` - `Johan Backpage`
- `Aston Villa` - `Vinnie Midlands`
- `Atletico Madrid` - `Diego Grudge`
- `Barcelona` - `Pablo Parquet`
- `Bayern Munich` - `Klaus Banner`
- `Benfica` - `Rui Ledger`
- `Brighton` - `Benny Seaside`
- `Chelsea` - `Grant Bridge`
- `Crystal Palace` - `Eddie Selhurst`
- `FL Fart` - `Barry Windham`
- `Inter Milan` - `Luca Nerazzurri`
- `Juventus` - `Tony Turin`
- `Manchester City` - `Cal Bluebook`
- `Manchester United` - `Marty Trafford`
- `Marseille` - `Remy Southstand`
- `Monaco` - `Luc Riviera`
- `Paris Saint-Germain` - `Nico Parc`
- `Real Madrid` - `Sergio Crown`
- `AC Sparta Praha` - `Billy Bramall`
- `Arsenal` - `Nuno Greenroom`
- `Tottenham Hotspur` - `Harry Northbank`
- `Valencia` - `Mateo Mestalla`

## Style rules

Keep the tone consistent with the current site:
- serious sports-desk/editorial voice
- newspaper-like pacing
- strong serif headline, clean sans-serif metadata
- no bright colors
- blue-led accents only
- no custom page chrome unless absolutely necessary

## If making a brand-new article

The normal publishing flow is manual HTML. Do not create a CMS JSON entry for new work.

Follow this checklist:
1. Copy an existing article file as the base.
2. Replace title, headline, dek, byline, dateline, masthead labels, ticker items, and body copy.
3. Keep the shared header classes unchanged.
4. Keep the `.paper` wrapper unchanged.
5. Keep the `<script src="../article-rail.js"></script>` line in place.
6. Add only the minimum extra CSS needed for that specific article.
7. Add or update the matching object in `00-eslmedia/content/media-articles.js`.
8. Add the story to the homepage power board in `00-eslmedia/homepage.html`.
9. Run the media validator before publishing.

## If updating recommendations

The live article metadata is powered by:
- `00-eslmedia/content/media-articles.js`

The right-rail recommendation list is rendered from that shared manifest through:
- `00-eslmedia/content/article-rail.js`

Ad creatives are configured in:
- `00-eslmedia/content/media-ads.js`

When a new article is added, add its metadata object there:
- `file`
- `title`
- `category`
- `desk`
- `sortKey`
- `tag`
- `author`
- `meta`
- `blurb`
- `teams`
- `playerTags` (optional on the object, but **required whenever the article names players**; see **Player tags** below)

The `teams` array is required.

It must include every ESL team explicitly mentioned anywhere in the article copy, headline, dek, pull quotes, or visible stat/summary blocks.

Example:

```js
teams: ["Chelsea", "Benfica", "Marseille"]
```

The team directory and team-specific article pages are powered from that field. If you skip a mentioned team, that club's coverage page will be incomplete.

## Player tags (`playerTags`)

The league **Unified Player** page loads this manifest and matches **ESL Media** pieces to players using an optional **`playerTags`** array on each article object (in addition to `teams`, `blurb`, etc.).

### When to add `playerTags`

Add **`playerTags`** whenever the article names specific **players** (not just clubs). Each entry must use the **exact `name` string** from `00-build/database/players.json`, because matching normalizes names the same way as the roster (letters and digits only, case-insensitive).

### Rule: tag every mentioned player

Before publishing, scan the **entire HTML**: headline, dek, ticker, body paragraphs, pull quotes, ballot rows, ballot notes, stat callouts, and captions. For **every distinct player** who appears in any of those places:

1. Look up their canonical **`name`** in `players.json`.
2. Add that string to **`playerTags`** once.

Do not skip honourable mentions, “next two names” paragraphs, or anyone named only in a ballot note. If they are not in **`playerTags`**, their unified player profile will not pick up this article when tag matching is in effect for that entry.

### Ballots, ladders, and ranked lists

For MVP races, award ballots, power-rank rows, or any ordered list of players:

- Include **every player named in the ranked list**, not only the winner or the lead.

Example: **December 1981 MVP Race** lists fifteen ballot players across three tiers (five per tier). The manifest **`playerTags`** for that article must list **all fifteen** roster names.

### Optional `mediaTags` on a player

You may add **`mediaTags`** on a player object in `players.json`. Those strings are shown as chips on the unified player page and participate in the same slug matching as article **`playerTags`**. Use them for recurring labels (for example a desk-wide “MVP ballot” tag) that should match multiple articles without repeating a player’s full name in every manifest row.

### If you omit `playerTags`

When **`playerTags` is missing or empty**, the unified player page falls back to searching for the player’s **full real name** inside manifest text (`title`, `blurb`, and related fields). That is forgiving but easy to miss nicknames or partial references.

Prefer explicit **`playerTags`** whenever profiles should reliably surface the piece.

For interview articles, always set:
- `category: "Interview"`
- `desk: "Interview"`

The Interviews tab is powered automatically by that `desk` value through:
- `00-eslmedia/content/interviews.html`

If you skip this step, the page will still render, but the new article will not appear in recommendations.

## Homepage power board rule

Every newly published article must also be placed on the homepage power board in:
- `00-eslmedia/homepage.html`

That is a required publishing step, not an optional promo step.

When adding a new article:
1. update the homepage power board entry text and link
2. make sure the board reflects the newest live stories first
3. remove older placeholder or superseded entries if space is limited

Do not publish a new article without updating the homepage power board to include it.

## Team directory rule

The site now has:
- a Teams dropdown in the top navigation
- a directory page at `00-eslmedia/content/teams.html`
- team coverage pages at `00-eslmedia/content/team.html?team=TEAM-SLUG`

Those pages are driven by:
- `00-build/database/standings.json` for team tier placement
- `00-eslmedia/content/media-articles.js`
- `window.ESL_TEAM_LOGOS` for logo filenames only
- each article's `teams` array

When adding future articles:
1. tag every mentioned team in the `teams` array
2. keep the topbar markup standard so the dropdown injects correctly
3. check that the article appears on the relevant team pages after updating the manifest

Do not hardcode which tier a team belongs to in the media site. The Teams dropdown, Teams directory, and individual team pages should read the current standings JSON so promotion/relegation changes automatically move teams into the correct column after a build.
