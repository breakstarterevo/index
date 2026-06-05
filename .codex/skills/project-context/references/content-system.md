# Content System

Use this file for ESL Media pages, article creation, homepage feeds, and editorial prompt generation.

## Main content areas

- `00-eslmedia/content/articles/`
  - Standalone article HTML files
- `00-eslmedia/content/prompts/`
  - Generated editorial prompt packages
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
- ESL Media's preferred old-style newspaper/editorial visual identity

When editing or generating articles, prefer following that README instead of copying arbitrary older files.
For article visuals, preserve the older print-sports-page feel: big serif headlines,
compact dek, byline rules, drop-cap openings, narrow readable article measure,
high-contrast board headers, restrained colors, and minimal app-like card styling.

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

## Manual article flow

- Create or edit standalone article HTML in `00-eslmedia/content/articles/`.
- Follow `00-eslmedia/content/articles/README.md` for the required article shell, shared scripts, metadata, and writer voice rules.
- Add or update the article object manually in `00-eslmedia/content/media-articles.js`.
- Add the article to the homepage power board in `00-eslmedia/homepage.html`.
- Use `00-eslmedia/content/submit.html` only as a preview/export helper; it exports article HTML, not CMS JSON.

## Archived CMS flow

- `00-build/scripts/build_esl_media_static_cms.py`, `00-eslmedia/admin/`, and `00-eslmedia/content/cms/` are retained for historical reference only.
- Do not use the CMS exporter for normal publishing unless the workflow is explicitly revived.

## When tracing a media bug

- Broken article shell/layout: inspect the article file and the article README
- Missing article from feed: inspect `media-articles.js` and validation rules
- Article missing from homepage: inspect `00-eslmedia/homepage.html` power board entries
- Bad monthly editorial input: inspect `build_monthly_jsons.py` and generated monthly JSON
- Bad generated prompt package: inspect `build_media_package_prompts.py`
