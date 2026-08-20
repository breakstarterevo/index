"""Keep exported league surfaces aligned with the current club identities.

This runs before the JSON builders because Fast Break exports may restore the
legacy team names in HTML. Replacements are byte-for-byte ASCII substitutions,
so the original encoding of legacy HTML files is preserved.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DRY_RUN = "--dry-run" in sys.argv

REPLACEMENTS = (
    (b"sheffield.jpg", b"acspartapraha.png"),
    (b"sportingcp.jpg", b"arsenal.png"),
    (b"Sheffield United", b"AC Sparta Praha"),
    (b"SHEFFIELD UNITED", b"AC SPARTA PRAHA"),
    (b"sheffield united", b"ac sparta praha"),
    (b"Sporting CP", b"Arsenal"),
    (b"SPORTING CP", b"ARSENAL"),
    (b"sporting cp", b"arsenal"),
)

TOKEN_REPLACEMENTS = (
    (rb"(?<![A-Za-z])Sheffield(?![A-Za-z])", b"AC Sparta Praha"),
    (rb"(?<![A-Za-z])SHEFFIELD(?![A-Za-z])", b"AC SPARTA PRAHA"),
    (rb"(?<![A-Za-z])sheffield(?![A-Za-z])", b"ac sparta praha"),
)

TEXT_EXTENSIONS = {".htm", ".html", ".json", ".js", ".css", ".md", ".txt"}
EXPORT_DIRECTORIES = (
    "players",
    "rosters",
    "coaches",
    "boxes",
    "00-SuperCup",
    os.path.join("00-build", "database"),
    os.path.join("00-build", "history"),
)


def candidate_paths():
    yield from PROJECT_ROOT.glob("*.htm")
    yield from PROJECT_ROOT.glob("*.html")
    for relative_root in EXPORT_DIRECTORIES:
        root = PROJECT_ROOT / relative_root
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS:
                yield path


def rebrand(path: Path) -> bool:
    original = path.read_bytes()
    updated = original
    for old, new in REPLACEMENTS:
        updated = updated.replace(old, new)
    for pattern, new in TOKEN_REPLACEMENTS:
        updated = re.sub(pattern, new, updated)
    if updated == original:
        return False
    if not DRY_RUN:
        path.write_bytes(updated)
    return True


def main():
    changed = [path for path in candidate_paths() if rebrand(path)]
    action = "Would update" if DRY_RUN else "Updated"
    print(f"{action} {len(changed)} exported team-brand surface(s).")


if __name__ == "__main__":
    main()
