# Data Sources

Use this file when the task is "where does this field come from?" or "which file should I trust?"

## Main generated data area

- `00-build/database/`
  - Primary generated JSON for the main league site
- `00-build/database/supercup/`
  - Parallel generated JSON for Super Cup
- `00-build/database/monthly/`
  - Derived editorial/context JSON
- `00-build/history/`
  - Archived per-season copies of generated JSON plus cross-season indexes

## Main producer

`00-build/scripts/build_players_json.py` is the main extraction pipeline for league data.

From its path setup and output definitions, it produces:

- `players.json`
- `player_stats.json`
- `player_gamelogs.json`
- `team_stats.json`
- `teams.json`
- `standings.json`
- `capreport.json`
- `injuries.json`
- `schedule.json`
- `freeagents.json`
- `leaders.json`
- `game_results.json`
- `awards.json`
- `season_awards.json`

`00-build/scripts/build_youth_intake_json.py` produces:

- `youth_intake.json`
- `youth_intake_players.json`

from `00-assets/spreadsheet/Youth Intake.xlsx`.

`00-build/scripts/archive_season_jsons.py` copies generated feeds into `00-build/history/season-*/database/` and updates:

- `00-build/history/index.json`
- `00-build/history/player_index.json`
- per-season `player_history_keys.json`

## Key source-of-truth mapping

From `build_players_json.py`:

- roster/player-page extraction comes from:
  - `rosters/`
  - `players/`
- root pages used as structured inputs include:
  - `standings.htm`
  - `capreport.htm`
  - `injuries.htm`
  - `schedule.htm`
  - `freeagents.htm`
  - `leaders.htm`
  - `awards.htm`
  - `draft.htm`
  - `seasonawards.htm`
- ratings enrichment may come from:
  - `LeagueOutput.mdb`

## Interpretation rules

- If a field is visible on a player or roster page, inspect `build_players_json.py` before editing JSON by hand.
- If OVR/POT or related ratings look missing, check whether `LeagueOutput.mdb` exists and whether the build imported it.
- If a standings or cap figure looks wrong, check the corresponding root `.htm` input before blaming the frontend.
- If a monthly narrative or prompt package looks wrong, trace it through `00-build/database/monthly/` rather than directly from article output.
- If a history page looks wrong, check whether `archive_season_jsons.py` was run for that season and whether the affected feed exists under `00-build/history/season-*/database/`.
- If youth intake data looks wrong, inspect `00-assets/spreadsheet/Youth Intake.xlsx` before changing the emitted JSON.

## Trust order

Use this order when tracing issues:

1. Producer script
2. Source HTML/MDB input
3. Generated JSON
4. Frontend consumer
