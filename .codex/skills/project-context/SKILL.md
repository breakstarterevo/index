---
name: project-context
description: Use for work in this ESL league-site repository. Provides a minimal project map, source-of-truth paths, build flow, media-content rules, and data-source routing so context is loaded only when relevant.
---

# Project Context

Use this skill for tasks in this repository.

## First read

Read only the reference file that matches the task:

- Frontend pages, injected assets, page ownership, or where to edit: `references/architecture.md`
- Build scripts, generation flow, dry-run behavior, or validation steps: `references/build-flow.md`
- ESL Media articles, prompts, homepage surfaces, or publishing rules: `references/content-system.md`
- JSON/database outputs, stat origins, or source-of-truth tracing: `references/data-sources.md`

## Core rules

- Prefer source files over generated outputs when tracing behavior.
- Treat root `.htm` files, `players/`, and `rosters/` as league-export surfaces that build scripts enhance rather than hand-authored app pages.
- Treat `00-build/database/` as generated output unless the task is explicitly about emitted data.
- When a field or page behavior is unclear, check the relevant build script before inferring from output JSON or injected HTML.

## Primary anchors

- `00-build/scripts/build.py` is the main league-site build entrypoint.
- `00-build/scripts/build_supercup.py` is the Super Cup build entrypoint.
- `00-build/scripts/build_players_json.py` is the main league-data extraction pipeline.
- `00-build/scripts/inject_css_js.py` injects shared assets into generated HTML.
- `00-build/scripts/archive_season_jsons.py` snapshots generated feeds into `00-build/history/`.
- `00-eslmedia/content/articles/README.md` defines the article shell and required shared scripts.
- `00-assets/FEATURES_README_DRAFT.md` is the quickest human-readable summary of the main site feature flow.

## Fast routing

- If the task mentions build, sim updates, JSON refreshes, or generated outputs: read `references/build-flow.md`
- If the task mentions an article, editorial package, homepage media, or manifest validation: read `references/content-system.md`
- If the task mentions shared JS/CSS, index page behavior, or league-page UI: read `references/architecture.md`
- If the task names a site branch such as index, history, media, or Super Cup: read `references/architecture.md`
- If the task asks where a number, field, team record, salary, rating, or monthly narrative input comes from: read `references/data-sources.md`
- If the task mentions youth intake, history, archived seasons, or published media drafts: read the matching reference first, then the named producer script above.
