"""
inject_css_js.py
Walk every .htm/.html file in a target tree and inject shared league CSS/JS.

Usage:
    python inject_css_js.py
    python inject_css_js.py --dry-run
    python inject_css_js.py --verbose
    python inject_css_js.py --target-root 00-SuperCup
"""

import os
import re
import sys

from atomic_write import atomic_write_text


SCRIPT_ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(SCRIPT_ROOT)
PROJECT_ROOT = os.path.dirname(BUILD_DIR)

CSS_FILENAME = "00-assets/css/styles.css"
THEME_PRELOAD_FILENAME = "00-assets/js/theme-preload.js"
JS_FILENAME = "00-assets/js/sort.js"
FEATURE_JS_FILENAMES = [
    "00-assets/js/core.js",
    "00-assets/js/settings.js",
    "00-assets/js/menu.js",
    "00-assets/js/legacy-page-enhancements.js",
    "00-assets/js/search.js",
    "00-assets/js/roster-enhancements.js",
]
ROSTER_ENHANCEMENTS_VERSION = "classic-schedule-preview-2"
INDEX_JS_FILENAME = "00-assets/js/index.js"
INDEX_JS_VERSION = "ticker-date-order-2"
FAVICON_FILE = "00-build/database/favicon.png"
MOBILE_INDEX_VIEWPORT_TAG = '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0, user-scalable=yes">'
SKIP_DIRS = {"00-build", "00-assets", "00-eslmedia", "00-SuperCup"}
SKIP_FILENAMES = set()


def parse_args(argv):
    dry_run = "--dry-run" in argv
    verbose = "--verbose" in argv
    target_root = PROJECT_ROOT

    if "--target-root" in argv:
        index = argv.index("--target-root")
        if index + 1 >= len(argv):
            raise SystemExit("Error: --target-root requires a path.")
        raw_target = argv[index + 1]
        target_root = raw_target if os.path.isabs(raw_target) else os.path.join(PROJECT_ROOT, raw_target)

    return {
        "dry_run": dry_run,
        "verbose": verbose,
        "target_root": os.path.normpath(os.path.abspath(target_root)),
    }


def make_rel(from_dir, project_relative_path):
    absolute_target = os.path.join(PROJECT_ROOT, project_relative_path)
    rel = os.path.relpath(absolute_target, from_dir).replace("\\", "/")
    return rel[2:] if rel.startswith("./") else rel


def inject_file(filepath, dry_run, target_root):
    dirpath = os.path.dirname(filepath)
    css_rel = make_rel(dirpath, CSS_FILENAME)
    theme_preload_rel = make_rel(dirpath, THEME_PRELOAD_FILENAME)
    js_rel = make_rel(dirpath, JS_FILENAME)
    index_js_rel = make_rel(dirpath, INDEX_JS_FILENAME)
    favicon_rel = make_rel(dirpath, FAVICON_FILE)
    feature_js_rels = [make_rel(dirpath, filename) for filename in FEATURE_JS_FILENAMES]
    is_target_root_index = os.path.abspath(filepath) == os.path.join(target_root, "index.htm")

    css_tag = f'<link rel="stylesheet" href="{css_rel}">'
    theme_preload_tag = f'<script src="{theme_preload_rel}"></script>'
    js_tag = f'<script src="{js_rel}" defer></script>'
    feature_js_tags = [
        f'<script src="{feature_rel}?v={ROSTER_ENHANCEMENTS_VERSION}" defer></script>'
        if filename == "00-assets/js/roster-enhancements.js"
        else f'<script src="{feature_rel}" defer></script>'
        for filename, feature_rel in zip(FEATURE_JS_FILENAMES, feature_js_rels)
    ]
    index_js_tag = f'<script src="{index_js_rel}?v={INDEX_JS_VERSION}" defer></script>'
    favicon_tag = f'<link rel="icon" type="image/png" href="{favicon_rel}">'

    with open(filepath, "r", encoding="latin-1") as f:
        html = f.read()

    roster_index = FEATURE_JS_FILENAMES.index("00-assets/js/roster-enhancements.js")
    roster_rel = feature_js_rels[roster_index]
    versioned_roster_tag = feature_js_tags[roster_index]
    roster_tag_pattern = re.compile(rf'<script src="{re.escape(roster_rel)}(?:\?v=[^"]+)?" defer></script>')
    current_roster_tag = roster_tag_pattern.search(html)
    replaced_roster_tag = False
    if current_roster_tag and current_roster_tag.group(0) != versioned_roster_tag:
        html = html[:current_roster_tag.start()] + versioned_roster_tag + html[current_roster_tag.end():]
        replaced_roster_tag = True

    already_css = CSS_FILENAME in html or css_rel in html
    already_theme_preload = THEME_PRELOAD_FILENAME in html or theme_preload_rel in html
    already_js = JS_FILENAME in html or js_rel in html
    already_feature_js = all(
        filename in html or rel in html
        for filename, rel in zip(FEATURE_JS_FILENAMES, feature_js_rels)
    )
    already_index_js = INDEX_JS_FILENAME in html or index_js_rel in html
    already_favicon = FAVICON_FILE in html or favicon_rel in html
    lower_html = html.lower()
    already_viewport = 'name="viewport"' in lower_html or "name='viewport'" in lower_html
    viewport_tag = MOBILE_INDEX_VIEWPORT_TAG if is_target_root_index else MOBILE_INDEX_VIEWPORT_TAG
    should_replace_viewport = is_target_root_index and viewport_tag not in html and already_viewport

    index_tag_pattern = re.compile(rf'<script src="{re.escape(index_js_rel)}(?:\?v=[^"]+)?" defer></script>')
    current_index_tag = index_tag_pattern.search(html)
    versioned_index_tag = index_js_tag
    replaced_index_tag = False
    if is_target_root_index and current_index_tag and current_index_tag.group(0) != versioned_index_tag:
        html = html[:current_index_tag.start()] + versioned_index_tag + html[current_index_tag.end():]
        replaced_index_tag = True

    needs_index_js = is_target_root_index
    if already_css and already_theme_preload and already_js and already_feature_js and already_favicon and already_viewport and not should_replace_viewport and not replaced_roster_tag and not replaced_index_tag and (not needs_index_js or already_index_js):
        return "skipped"

    inject = ""
    if not already_viewport:
        inject += f"  {viewport_tag}\n"
    if not already_favicon:
        inject += f"  {favicon_tag}\n"
    if not already_theme_preload:
        if css_tag in html:
            html = html.replace(css_tag, f"{theme_preload_tag}\n  {css_tag}", 1)
        else:
            inject += f"  {theme_preload_tag}\n"
    if not already_css:
        inject += f"  {css_tag}\n"
    if not already_js:
        inject += f"  {js_tag}\n"
    if not already_feature_js:
        inject += "".join(f"  {tag}\n" for tag in feature_js_tags)
    if needs_index_js and not already_index_js:
        inject += f"  {index_js_tag}\n"

    if "</head>" not in html:
        if "<body" in html:
            html = html.replace("<body", "<head>\n</head>\n<body", 1)
        else:
            html = "<head>\n</head>\n" + html

    if should_replace_viewport:
        html = html.replace(
            '<meta name="viewport" content="width=1100, initial-scale=0.35, minimum-scale=0.1, maximum-scale=10.0, user-scalable=yes">',
            viewport_tag,
            1,
        )
        html = html.replace(
            "<meta name='viewport' content='width=1100, initial-scale=0.35, minimum-scale=0.1, maximum-scale=10.0, user-scalable=yes'>",
            viewport_tag,
            1,
        )

    if "</head>" in html:
        html = html.replace("</head>", f"{inject}</head>", 1)
    elif "</body>" in html:
        html = html.replace("</body>", f"{inject}</body>", 1)
    else:
        html += "\n" + inject

    if dry_run:
        print(f"DRY RUN: would update {filepath}")
    else:
        atomic_write_text(filepath, html, encoding="latin-1")
        print(f"UPDATED: {filepath}")

    return "updated"


def should_skip_dir(target_root, dirpath):
    if os.path.abspath(target_root) != PROJECT_ROOT:
        return False
    return os.path.basename(dirpath) in SKIP_DIRS


def main():
    options = parse_args(sys.argv[1:])
    dry_run = options["dry_run"]
    verbose = options["verbose"]
    target_root = options["target_root"]

    if not os.path.isdir(target_root):
        raise SystemExit(f"Error: target root not found: {target_root}")

    files_updated = 0
    files_skipped = 0

    for dirpath, dirnames, filenames in os.walk(target_root):
        if os.path.abspath(target_root) == PROJECT_ROOT:
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for filename in filenames:
            if not filename.lower().endswith((".html", ".htm")):
                continue
            if filename.lower() in SKIP_FILENAMES:
                files_skipped += 1
                if verbose:
                    print(f"SKIPPED (excluded file): {os.path.join(dirpath, filename)}")
                continue

            filepath = os.path.join(dirpath, filename)
            result = inject_file(filepath, dry_run, target_root)
            if result == "updated":
                files_updated += 1
            else:
                if verbose:
                    print(f"SKIPPED (all present): {filepath}")
                files_skipped += 1

    prefix = "[DRY RUN] " if dry_run else ""
    print(f"\n{prefix}Done - {files_updated} updated, {files_skipped} skipped.")


if __name__ == "__main__":
    main()
