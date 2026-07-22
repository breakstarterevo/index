"""
build.py
Master build script - run this one file to update everything.

Usage:
  python 00-build/scripts/build.py           # full build
  python 00-build/scripts/build.py --dry-run # preview only, no files written
  python 00-build/scripts/build.py --verbose # include verbose child-script output where supported
"""

import subprocess, sys, os, time

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
DRY_RUN = "--dry-run" in sys.argv
VERBOSE = "--verbose" in sys.argv

SCRIPTS = [
    (os.path.join(BUILD_DIR, "build_players_json.py"), "Building database JSON files"),
    (os.path.join(BUILD_DIR, "build_player_photos_json.py"), "Building player photo mapping"),
    (os.path.join(BUILD_DIR, "build_player_database_json.py"), "Building season-aware player database feeds"),
    (os.path.join(BUILD_DIR, "build_discord_json.py"), "Building compact Discord lookup JSON files"),
    (os.path.join(BUILD_DIR, "build_youth_intake_json.py"), "Building youth intake JSON from spreadsheet"),
    (os.path.join(BUILD_DIR, "build_monthly_jsons.py"), "Building monthly media JSON files"),
    (os.path.join(BUILD_DIR, "build_media_package_prompts.py"), "Building monthly editorial prompt package"),
    (os.path.join(BUILD_DIR, "ensure_settings_page.py"), "Ensuring league settings page exists"),
    (os.path.join(BUILD_DIR, "inject_css_js.py"),      "Injecting CSS/JS links into all HTML files"),
    (os.path.join(BUILD_DIR, "validate_media_site.py"), "Validating ESL Media publish surfaces"),
    (os.path.join(BUILD_DIR, "build_camp_tracker_json.py"), "Building career camp tracker JSON"),
]

def progress_bar(index, total, width=24):
    filled = int(width * index / total) if total else width
    return "[" + "#" * filled + "-" * (width - filled) + f"] {index}/{total}"


def run(path, label, index, total):
    if not os.path.exists(path):
        print(f"{progress_bar(index, total)} SKIP {os.path.basename(path)} not found", flush=True)
        return
    print(f"\n{progress_bar(index, total)} {label}", flush=True)
    started = time.perf_counter()
    args = [sys.executable, path]
    if DRY_RUN:
        args.append("--dry-run")
    if VERBOSE and os.path.basename(path) == "inject_css_js.py":
        args.append("--verbose")
    result = subprocess.run(args, cwd=BUILD_DIR)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        print(f"  [ERROR] {os.path.basename(path)} exited with code {result.returncode}", flush=True)
        sys.exit(result.returncode)
    print(f"  done in {elapsed:.2f}s", flush=True)

print("=" * 50, flush=True)
print("BSL Build" + (" [DRY RUN]" if DRY_RUN else ""), flush=True)
print("=" * 50, flush=True)

build_started = time.perf_counter()

for index, (path, label) in enumerate(SCRIPTS, start=1):
    run(path, label, index, len(SCRIPTS))

print(f"\n{progress_bar(len(SCRIPTS), len(SCRIPTS))} Build complete in {time.perf_counter() - build_started:.2f}s", flush=True)
