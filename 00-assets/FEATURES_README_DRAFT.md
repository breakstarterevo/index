# Site Features Guide Draft

This is the working guide for the custom league-site features and build pipeline. It is meant to describe how the repo behaves now, not how the first version worked.

## Quick Start

1. Put the latest sim export files in the project root like normal.
2. Make sure `LeagueOutput.mdb` is present if you want ratings enrichment.
3. Run `00-build/run_build.bat`.
4. Run `00-build/scripts/server.bat`.
5. Open `http://localhost:8000/index.htm`.

Using the local server is still the safest option because many features read JSON files and browsers can block that from `file://`.

## What The Main Build Does

Run:

```bat
00-build/run_build.bat
```

That script resolves Python, then runs:

```text
00-build/scripts/build.py
```

`build.py` currently runs these steps in order:

1. `build_players_json.py`
2. `build_player_photos_json.py`
3. `build_player_database_json.py`
4. `build_discord_json.py`
5. `build_youth_intake_json.py`
6. `build_monthly_jsons.py`
7. `build_media_package_prompts.py`
8. `ensure_settings_page.py`
9. `inject_css_js.py`
10. `validate_media_site.py`

So the build now does more than just JSON generation and CSS injection. It also:

- builds youth-intake data
- builds the compact player-headshot mapping from cached Basketball GM sources
- builds monthly editorial context JSON
- builds the monthly media prompt package
- ensures the browser-only settings page exists
- validates ESL Media publish surfaces

## Main Generated Output

The main generated data lives in:

```text
00-build/database/
```

Important files there include:

```text
players.json
player_photos.json
player_stats.json
player_gamelogs.json
teams.json
team_stats.json
standings.json
schedule.json
game_results.json
capreport.json
injuries.json
freeagents.json
leaders.json
awards.json
```

Player-photo source snapshots are deliberately not refreshed during an ordinary
build. To update them from the upstream Basketball GM files, run:

```text
python 00-build/scripts/build_player_photos_json.py --refresh
```

Manual identity corrections live in:

```text
00-assets/data/player-photo-overrides.json
```

Monthly editorial/supporting output lives in:

```text
00-build/database/monthly/
```

Important monthly files:

```text
latest_sim_results.json
monthly_team_form.json
overall_team_form.json
tier_race_snapshot.json
monthly_storylines.json
```

The generated monthly editorial package lives in:

```text
00-eslmedia/content/prompts/monthly_editorial_package.json
```

## Running The Local Server

Run:

```bat
00-build/scripts/server.bat
```

That starts a simple HTTP server from the repo root on port `8000`.

Then open:

```text
http://localhost:8000/index.htm
```

Because the server starts from the repo root, paths like these resolve correctly:

- `players/`
- `rosters/`
- `00-assets/`
- `00-build/database/`
- `00-eslmedia/`
- `00-SuperCup/`

## Main Source Files

### Build entrypoints

```text
00-build/scripts/build.py
00-build/scripts/build_supercup.py
00-build/scripts/build_players_json.py
```

### Shared asset injection

```text
00-build/scripts/inject_css_js.py
```

When run against the main repo, the injector adds:

- `00-assets/css/styles.css`
- `00-assets/js/sort.js`
- `00-assets/js/core.js`
- `00-assets/js/settings.js`
- `00-assets/js/menu.js`
- `00-assets/js/legacy-page-enhancements.js`
- `00-assets/js/search.js`
- `00-assets/js/roster-enhancements.js`
- `00-assets/js/index.js` on the main `index.htm`

`features.js` still exists, but it is now a deprecated compatibility wrapper rather than the main feature file.

### Shared frontend files

```text
00-assets/css/styles.css
00-assets/js/core.js
00-assets/js/settings.js
00-assets/js/menu.js
00-assets/js/search.js
00-assets/js/roster-enhancements.js
00-assets/js/index.js
00-assets/js/depthcharts.js
```

### Shared HTML shells

```text
00-assets/html/depthcharts.htm
00-assets/html/league dashboard.htm
00-assets/html/settings.htm
00-assets/html/unified-roster.htm
00-assets/html/unified-player.htm
00-assets/html/youth-intake.htm
```

## Current Feature Model

### League pages are enhanced output

Root pages like `standings.htm`, `schedule.htm`, and `leaders.htm`, plus the `players/` and `rosters/` folders, should be treated as league-export surfaces that the build enhances.

If you want a change to survive the next sim export, prefer editing:

- shared assets in `00-assets/`
- build scripts in `00-build/scripts/`
- HTML shells in `00-assets/html/`

Avoid relying on direct hand edits to generated pages unless it is a one-off patch.

### JSON-backed site features

The newer site features read from generated JSON in `00-build/database/` rather than scraping the HTML at page load.

That means when something looks stale, the likely issue is one of:

1. the build did not run
2. the source export files changed shape
3. the wrong producer script needs updating
4. the browser is still serving cached JS

### Ratings enrichment

OVR and POT data can be enriched from:

```text
LeagueOutput.mdb
```

If ratings are missing, check that the MDB file exists before running the build.

### Browser-only settings page

The build now ensures this page exists:

```text
00-assets/html/settings.htm
```

That file is recreated if missing by:

```text
00-build/scripts/ensure_settings_page.py
```

### Index shell behavior

The main `index.htm` now behaves like a shell that loads:

- the menu in one frame
- the selected league page in another frame

`00-assets/js/index.js` handles the mobile-friendly shell behavior, default page routing, and menu open/close behavior.

### Depth chart builder

Open:

```text
00-assets/html/depthcharts.htm
```

The depth chart builder still lives outside the generated pages and is backed by `00-assets/js/depthcharts.js`.

### Unified custom pages

Several custom pages now exist as maintained HTML shells rather than generated league pages, including:

- unified roster pages
- unified player pages
- league dashboard pages
- youth-intake pages

When one of those pages is wrong, start by checking `00-assets/html/` before inspecting root exported pages.

### ESL Media integration

The main build now feeds the media side too.

Important media-related files:

```text
00-build/scripts/build_monthly_jsons.py
00-build/scripts/build_media_package_prompts.py
00-build/scripts/validate_media_site.py
00-eslmedia/content/media-articles.js
00-eslmedia/content/prompts/monthly_editorial_package.json
00-eslmedia/content/articles/README.md
```

The media validation step checks that:

- the article manifest exists
- manifest entries point at real article files
- sort keys are valid
- teams arrays exist
- homepage hooks and links resolve

## After Uploading A New Sim

Do this each time the league export changes:

1. Replace or update the generated league files in the repo root plus `players/` and `rosters/`.
2. Make sure `LeagueOutput.mdb` is present if you want OVR/POT.
3. Run `00-build/run_build.bat`.
4. Run or restart `00-build/scripts/server.bat`.
5. Refresh the browser.

If something still looks old, do a hard refresh because browser caching can hide new JS or JSON.

## Things You Usually Should Not Edit Manually

These are typically generated or refreshed from league output:

```text
players/
rosters/
standings.htm
leaders.htm
schedule.htm
transactions.htm
menu.htm
```

Usually prefer editing:

```text
00-assets/css/styles.css
00-assets/js/
00-assets/html/
00-build/scripts/
00-eslmedia/content/
```

## Troubleshooting

### If a league feature is missing

1. Run `00-build/run_build.bat`.
2. Check that the page has the injected shared assets, especially `styles.css`, `sort.js`, and the split feature modules.
3. Use the local server instead of opening files directly.
4. Hard refresh the browser.

### If data is missing or outdated

1. Check `00-build/database/`.
2. Re-run the build.
3. Confirm the relevant source files exist:
   - `players/`
   - `rosters/`
   - `standings.htm`
   - `capreport.htm`
   - `injuries.htm`
   - `schedule.htm`
   - `leaders.htm`
   - `awards.htm`
4. If ratings are the issue, confirm `LeagueOutput.mdb` exists.

### If an ESL Media surface is wrong

1. Re-run the build so validation runs again.
2. Check `00-eslmedia/content/media-articles.js`.
3. Check `00-eslmedia/content/prompts/monthly_editorial_package.json`.
4. Check `00-eslmedia/content/articles/README.md` if the issue is article structure or shared scripts.

### If a feature survives locally but disappears after a new sim

The change was probably made in generated output instead of:

- a build script
- a shared asset file
- a maintained custom HTML shell

## Simple Mental Model

The sim export gives you raw league HTML and related source files.

The build scripts turn those sources into generated JSON, maintained helper pages, injected shared assets, and media-side support files.

The site frontend reads those generated files and shared modules to upgrade the exported league site without needing to hand-edit every generated page after each sim.
