"""
build_supercup.py
Master Super Cup build script.

Usage:
  python 00-build/scripts/build_supercup.py
  python 00-build/scripts/build_supercup.py --dry-run
"""

import os
import subprocess
import sys
import time


BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BUILD_DIR))
DRY_RUN = "--dry-run" in sys.argv

SCRIPTS = [
    (os.path.join(BUILD_DIR, "build_supercup_json.py"), "Building Super Cup database JSON files"),
    (os.path.join(BUILD_DIR, "build_supercup_knockout.py"), "Building Super Cup unified knockout page"),
    (os.path.join(BUILD_DIR, "build_supercup_ui.py"), "Injecting shared CSS/JS into Super Cup HTML"),
]

REQUIRED_FILES = [
    os.path.join(PROJECT_ROOT, "00-SuperCup", "index.htm"),
    os.path.join(PROJECT_ROOT, "00-assets", "html", "supercup-dashboard.htm"),
    os.path.join(PROJECT_ROOT, "00-assets", "html", "supercup-knockout.htm"),
    os.path.join(PROJECT_ROOT, "00-assets", "html", "unified-roster-supercup.htm"),
    os.path.join(PROJECT_ROOT, "00-assets", "html", "unified-player-supercup.htm"),
]


def progress_bar(index, total, width=24):
    filled = int(width * index / total) if total else width
    return "[" + "#" * filled + "-" * (width - filled) + f"] {index}/{total}"


def run_script(path, label, index, total):
    if not os.path.exists(path):
        print(f"{progress_bar(index, total)} SKIP {os.path.basename(path)} not found", flush=True)
        return

    print(f"\n{progress_bar(index, total)} {label}", flush=True)
    started = time.perf_counter()
    args = [sys.executable, path]
    if DRY_RUN:
        args.append("--dry-run")
    result = subprocess.run(args, cwd=BUILD_DIR)
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        print(f"  [ERROR] {os.path.basename(path)} exited with code {result.returncode}", flush=True)
        sys.exit(result.returncode)
    print(f"  done in {elapsed:.2f}s", flush=True)


def verify_required_files():
    print("\nVerifying Super Cup shell files", flush=True)
    missing = [path for path in REQUIRED_FILES if not os.path.exists(path)]
    if missing:
        print("  [ERROR] Missing required Super Cup files:", flush=True)
        for path in missing:
            print(f"    - {path}", flush=True)
        sys.exit(1)
    for path in REQUIRED_FILES:
        print(f"  ok  {os.path.relpath(path, PROJECT_ROOT)}", flush=True)


def main():
    print("=" * 50, flush=True)
    print("Super Cup Build" + (" [DRY RUN]" if DRY_RUN else ""), flush=True)
    print("=" * 50, flush=True)

    build_started = time.perf_counter()

    for index, (path, label) in enumerate(SCRIPTS, start=1):
        run_script(path, label, index, len(SCRIPTS))

    verify_required_files()
    print(f"\n{progress_bar(len(SCRIPTS), len(SCRIPTS))} Build complete in {time.perf_counter() - build_started:.2f}s", flush=True)


if __name__ == "__main__":
    main()
