# Build Flow

Use this file when the task involves refreshing data, tracing generated output, or deciding where a change belongs in the pipeline.

## Main build entrypoints

- `00-build/scripts/build.py`
  - Runs the main league-site build
  - Supports `--dry-run`
  - Calls, in order:
    1. `build_players_json.py`
    2. `build_youth_intake_json.py`
    3. `build_monthly_jsons.py`
    4. `build_media_package_prompts.py`
    5. `ensure_settings_page.py`
    6. `inject_css_js.py`
    7. `validate_media_site.py`

- `00-build/scripts/build_esl_media_static_cms.py`
  - Not part of the default main build
  - Exports publishable JSON entries from `00-eslmedia/content/cms/articles/`
  - Writes article HTML into `00-eslmedia/content/articles/`
  - Injects generated manifest entries into `00-eslmedia/content/media-articles.js`

- `00-build/scripts/build_supercup.py`
  - Runs the Super Cup build
  - Supports `--dry-run`
  - Calls, in order:
    1. `build_supercup_json.py`
    2. `build_supercup_knockout.py`
    3. `build_supercup_ui.py`
  - Verifies required Super Cup shell files exist

- `00-build/scripts/archive_season_jsons.py`
  - Not part of the default main build
  - Archives generated JSON feeds from `00-build/database/` into `00-build/history/season-*`
  - Updates `00-build/history/index.json` and `00-build/history/player_index.json`
  - Can parse `seasonawards.htm` into `season_awards.json`

## Practical build rules

- If a task affects league data extraction, start with `build_players_json.py`.
- If a task affects monthly editorial/context JSON, start with `build_monthly_jsons.py` or `build_media_package_prompts.py`.
- If a task affects youth intake, start with `build_youth_intake_json.py` and the workbook at `00-assets/spreadsheet/Youth Intake.xlsx`.
- If a task affects shared league-page UI availability, start with `inject_css_js.py`.
- If a task affects ESL Media publishing integrity, check `validate_media_site.py`.
- If a task affects CMS-authored articles, check `build_esl_media_static_cms.py` and `00-eslmedia/content/cms/README.md`.
- If a task affects historical seasons or cross-season player identity, check `archive_season_jsons.py`.

## High-value source files

- `00-assets/FEATURES_README_DRAFT.md`
  - Human-readable quick start for local build/server flow
- `00-build/scripts/build.py`
  - Canonical sequence for the main build
- `00-build/scripts/build_supercup.py`
  - Canonical sequence for the Super Cup build

## Output expectations

- `00-build/database/` holds generated JSON consumed by newer site features.
- `00-build/database/monthly/` holds monthly editorial/supporting JSON.
- `00-build/history/` holds archived season snapshots plus history indexes.
- HTML pages may be rewritten or augmented by injection steps, so verify whether a file is source, template, or emitted output before editing it directly.

## Safe debugging order

1. Identify whether the bug is in source data, transformation logic, or frontend rendering.
2. Read the build script that produces the affected output.
3. Check the generated file in `00-build/database/` only after understanding the producer.
4. Use dry-run capable entrypoints when verifying pipeline changes.
