# Content System

Use this file for ESL Media pages, article creation, homepage feeds, and editorial prompt generation.

## Main content areas

- `00-eslmedia/content/articles/`
  - Standalone article HTML files
- `00-eslmedia/content/prompts/`
  - Generated editorial prompt packages
- `00-eslmedia/content/cms/articles/`
  - Decap/static-CMS article JSON entries
- `00-eslmedia/content/media-articles.js`
  - Article manifest consumed by media surfaces
- `00-eslmedia/homepage.html`
  - Media homepage with dynamic hooks validated by the build

## Article rules

The primary source of truth is:

- `00-eslmedia/content/articles/README.md`

That file defines:

- required article location and standalone HTML structure
- required shared stylesheet import
- required body class
- required article shell/container
- required shared scripts before `</body>`
- metadata/canonical expectations

When editing or generating articles, prefer following that README instead of copying arbitrary older files.

## Build integration

- `00-build/scripts/build_media_package_prompts.py`
  - Writes `00-eslmedia/content/prompts/monthly_editorial_package.json`
  - Pulls from monthly JSON plus league data such as teams, players, player stats, leaders, and awards

- `00-build/scripts/build_monthly_jsons.py`
  - Produces:
    - `monthly/latest_sim_results.json`
    - `monthly/monthly_team_form.json`
    - `monthly/overall_team_form.json`
    - `monthly/tier_race_snapshot.json`
    - `monthly/monthly_storylines.json`

- `00-build/scripts/validate_media_site.py`
  - Confirms manifest integrity
  - Confirms homepage hooks exist
  - Confirms article files and links resolve

- `00-build/scripts/build_esl_media_static_cms.py`
  - Exports entries with `status: "published"` plus due scheduled entries
  - Writes `00-eslmedia/content/articles/<slug>.html`
  - Injects generated manifest objects between the CMS markers in `media-articles.js`

## Static CMS flow

- Editor/admin shell: `00-eslmedia/admin/index.html`
- Import helper: `00-eslmedia/admin/import.html`
- Flow guide: `00-eslmedia/content/cms/README.md`
- Public submissions from `00-eslmedia/content/submit.html` can be normalized into CMS JSON before review.

## When tracing a media bug

- Broken article shell/layout: inspect the article file and the article README
- Missing article from feed: inspect `media-articles.js` and validation rules
- CMS article not publishing: inspect the entry status/date, `build_esl_media_static_cms.py`, and CMS marker block in `media-articles.js`
- Bad monthly editorial input: inspect `build_monthly_jsons.py` and generated monthly JSON
- Bad generated prompt package: inspect `build_media_package_prompts.py`
