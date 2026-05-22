from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Archive generated database JSON feeds into a season history folder."
    )
    parser.add_argument(
        "--season",
        required=True,
        help="Season number or label, for example 1 or season-1.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing season archive.",
    )
    return parser.parse_args()


def season_slug(value: str) -> str:
    cleaned = str(value).strip().lower().replace("_", "-").replace(" ", "-")
    if not cleaned:
        raise ValueError("Season label cannot be empty.")
    return cleaned if cleaned.startswith("season-") else f"season-{cleaned}"


def copy_json_tree(source: Path, destination: Path) -> list[dict[str, object]]:
    copied: list[dict[str, object]] = []
    for src in sorted(source.rglob("*.json")):
        rel = src.relative_to(source)
        dest = destination / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        copied.append(
            {
                "path": rel.as_posix(),
                "bytes": dest.stat().st_size,
            }
        )
    return copied


def main() -> int:
    args = parse_args()
    root = repo_root()
    source = root / "00-build" / "database"
    history_root = root / "00-build" / "history"
    season_dir = history_root / season_slug(args.season)
    database_archive = season_dir / "database"

    if not source.exists():
        raise FileNotFoundError(f"Database folder not found: {source}")
    if season_dir.exists() and not args.force:
        raise FileExistsError(
            f"Archive already exists: {season_dir}. Re-run with --force to overwrite it."
        )
    if season_dir.exists():
        shutil.rmtree(season_dir)

    copied = copy_json_tree(source, database_archive)
    manifest = {
        "season": season_dir.name,
        "source": "00-build/database",
        "archived_at_utc": datetime.now(timezone.utc).isoformat(),
        "json_count": len(copied),
        "files": copied,
    }
    season_dir.mkdir(parents=True, exist_ok=True)
    (season_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Archived {len(copied)} JSON files to {season_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
