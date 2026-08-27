from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path


ATTRIBUTE_HISTORY_KEYS = [
    "Ins",
    "Jps",
    "Fts",
    "3ps",
    "Hnd",
    "Pas",
    "Orb",
    "Drb",
    "Psd",
    "Prd",
    "Stl",
    "Blk",
    "Qkn",
    "Str",
    "Jmp",
    "Sta",
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Archive generated database JSON feeds into a season history folder."
    )
    parser.add_argument(
        "--season",
        help="Season number or label, for example 1 or season-1.",
    )
    parser.add_argument(
        "--rebuild-index-only",
        action="store_true",
        help="Rebuild cross-season history indexes without changing an archived season.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite an existing season archive.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Archive the existing generated JSON without running build_players_json.py first.",
    )
    parser.add_argument(
        "--label",
        help='Display label for menus, for example "1981-82". Defaults to the season slug.',
    )
    args = parser.parse_args()
    if not args.rebuild_index_only and not args.season:
        parser.error("--season is required unless --rebuild-index-only is used.")
    return args


def season_slug(value: str) -> str:
    cleaned = str(value).strip().lower().replace("_", "-").replace(" ", "-")
    if not cleaned:
        raise ValueError("Season label cannot be empty.")
    return cleaned if cleaned.startswith("season-") else f"season-{cleaned}"


def season_sort_key(slug: str) -> tuple[int, object]:
    match = re.search(r"(\d+)", slug)
    if match:
        return (0, int(match.group(1)))
    return (1, slug)


def default_season_label(slug: str) -> str:
    match = re.fullmatch(r"season-(\d+)", slug)
    if not match:
        return slug
    start_year = 1980 + int(match.group(1))
    return f"{start_year}-{start_year + 1}"


def clean(value: object) -> str:
    text = unescape(str(value or "")).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def strip_tags(value: str) -> str:
    return clean(re.sub(r"<[^>]+>", " ", value or ""))


def slugify(value: object) -> str:
    text = clean(value).lower()
    text = text.replace("+/-", "plus-minus").replace("%", "pct")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def normalize_url(url: str) -> str:
    return clean(url).replace("\\", "/")


def parse_numeric_value(value: str) -> object:
    text = strip_tags(value)
    if text in {"", "-"}:
        return text
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


def parse_link(cell_html: str) -> tuple[str, str, str]:
    link = re.search(
        r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
        cell_html or "",
        re.IGNORECASE | re.DOTALL,
    )
    if not link:
        return strip_tags(cell_html), "", ""
    url = normalize_url(link.group(2))
    return strip_tags(link.group(3)), url, url.split("/")[-1]


def parse_season_awards_rows(table_html: str) -> list[dict[str, object]]:
    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    awards: list[dict[str, object]] = []
    for row_class, row_html in row_matches:
        cells = re.findall(
            r"<td[^>]*class=main[^>]*>(.*?)</td>",
            row_html,
            re.IGNORECASE | re.DOTALL,
        )
        if len(cells) < 9:
            continue

        award = strip_tags(cells[0])
        person, person_url, person_file = parse_link(cells[2])
        team, team_url, team_file = parse_link(cells[3])
        if not award and not person and not team:
            continue

        awards.append(
            {
                "award": award,
                "pos": strip_tags(cells[1]),
                "person": person,
                "personUrl": person_url,
                "personFile": person_file,
                "team": team,
                "teamUrl": team_url,
                "teamFile": team_file,
                "ppg": parse_numeric_value(cells[4]),
                "rpg": parse_numeric_value(cells[5]),
                "apg": parse_numeric_value(cells[6]),
                "spg": parse_numeric_value(cells[7]),
                "bpg": parse_numeric_value(cells[8]),
                "rowClass": row_class.lower(),
            }
        )
    return awards


def parse_season_awards(html: str, source_name: str) -> dict[str, object]:
    sections: list[dict[str, object]] = []
    table_matches = re.findall(
        r"<table[^>]*>\s*<tr><td class=tableheader[^>]*>&nbsp;(.*?)</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    for title_html, table_html in table_matches:
        title = strip_tags(title_html)
        if not title:
            continue
        awards = parse_season_awards_rows(table_html)
        sections.append(
            {
                "title": title,
                "slug": slugify(title),
                "awards": awards,
            }
        )

    return {
        "source": source_name,
        "missing": False,
        "sectionCount": len(sections),
        "awardCount": sum(len(section["awards"]) for section in sections),
        "sections": sections,
    }


def write_season_awards(root: Path, output: Path) -> dict[str, object]:
    awards_path = root / "seasonawards.htm"
    output.parent.mkdir(parents=True, exist_ok=True)

    if not awards_path.exists():
        data: dict[str, object] = {
            "source": "seasonawards.htm",
            "missing": True,
            "sectionCount": 0,
            "awardCount": 0,
            "sections": [],
        }
    else:
        html = awards_path.read_text(encoding="latin-1", errors="replace")
        data = parse_season_awards(html, awards_path.name)

    output.write_text(json.dumps(data, indent=4) + "\n", encoding="utf-8")
    return data


def run_player_json_build(root: Path) -> None:
    script = root / "00-build" / "scripts" / "build_players_json.py"
    subprocess.run([sys.executable, str(script)], cwd=root, check=True)


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


def read_json(path: Path, fallback: object) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def load_manifest(season_dir: Path) -> dict[str, object]:
    manifest = read_json(season_dir / "manifest.json", {})
    return manifest if isinstance(manifest, dict) else {}


def feed_status(database_dir: Path) -> dict[str, bool]:
    key_feeds = [
        "players.json",
        "player_stats.json",
        "standings.json",
        "leaders.json",
        "teams.json",
        "team_stats.json",
        "awards.json",
        "season_awards.json",
        "youth_intake.json",
        "youth_intake_players.json",
        "supercup/standings.json",
        "supercup/leaders.json",
    ]
    return {feed: (database_dir / feed).exists() for feed in key_feeds}


def update_history_index(history_root: Path) -> list[dict[str, object]]:
    seasons: list[dict[str, object]] = []
    for season_dir in sorted(
        [path for path in history_root.glob("season-*") if path.is_dir()],
        key=lambda path: season_sort_key(path.name),
    ):
        manifest = load_manifest(season_dir)
        label = manifest.get("label") or ""
        display_label = (
            default_season_label(season_dir.name)
            if label == season_dir.name
            else label or default_season_label(season_dir.name)
        )
        seasons.append(
            {
                "season": season_dir.name,
                "label": display_label,
                "archivedAtUtc": manifest.get("archived_at_utc", ""),
                "jsonCount": manifest.get("json_count", 0),
                "manifest": f"{season_dir.name}/manifest.json",
                "database": f"{season_dir.name}/database",
                "feeds": feed_status(season_dir / "database"),
            }
        )

    index = {
        "source": "00-build/history",
        "updatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "seasonCount": len(seasons),
        "seasons": seasons,
    }
    history_root.mkdir(parents=True, exist_ok=True)
    (history_root / "index.json").write_text(
        json.dumps(index, indent=2) + "\n",
        encoding="utf-8",
    )
    return seasons


def player_file_from_url(player: dict[str, object]) -> str:
    url = clean(player.get("url", "")).replace("\\", "/")
    return url.split("/")[-1] if url else ""


def player_signature(player: dict[str, object]) -> tuple[str, str, str, str, str, str, str, str]:
    return (
        clean(player.get("name", "")).casefold(),
        clean(player.get("ht", "")),
        clean(player.get("wt", "")),
        clean(player.get("age", "")),
        clean(player.get("pos", "")),
        clean(player.get("teamLabel", player.get("team", ""))),
        clean(player.get("overall", "")),
        clean(player.get("potential", "")),
    )


def history_base_key(player: dict[str, object], season: str) -> str:
    parts = [
        slugify(player.get("name", "")) or "unknown-player",
        slugify(player.get("ht", "")) or "unknown-height",
        slugify(season),
        slugify(player.get("age", "")) or "unknown-age",
    ]
    return "__".join(parts)


def age_as_int(player: dict[str, object]) -> int | None:
    try:
        return int(clean(player.get("age", "")))
    except ValueError:
        return None


def season_number(slug: str) -> int | None:
    match = re.search(r"(\d+)", slug)
    return int(match.group(1)) if match else None


def identity_matches(identity: dict[str, object], player: dict[str, object], season: str) -> bool:
    if clean(identity.get("name", "")).casefold() != clean(player.get("name", "")).casefold():
        return False
    if clean(identity.get("height", "")) != clean(player.get("ht", "")):
        return False

    first_age = identity.get("firstAge")
    first_season_number = identity.get("firstSeasonNumber")
    current_age = age_as_int(player)
    current_season_number = season_number(season)
    if (
        isinstance(first_age, int)
        and isinstance(first_season_number, int)
        and isinstance(current_age, int)
        and isinstance(current_season_number, int)
    ):
        expected_age = first_age + (current_season_number - first_season_number)
        return abs(current_age - expected_age) <= 1

    return True


def collapse_exact_duplicates(players: list[dict[str, object]]) -> list[dict[str, object]]:
    seen: set[tuple[str, str, str, str, str, str, str, str]] = set()
    unique: list[dict[str, object]] = []
    for player in players:
        signature = player_signature(player)
        if signature in seen:
            continue
        seen.add(signature)
        unique.append(player)
    return unique


def build_player_identity_index(history_root: Path) -> dict[str, object]:
    identities: list[dict[str, object]] = []
    used_keys: set[str] = set()
    by_key: dict[str, dict[str, object]] = {}
    player_key_maps: dict[str, dict[str, str]] = {}

    season_dirs = sorted(
        [path for path in history_root.glob("season-*") if path.is_dir()],
        key=lambda path: season_sort_key(path.name),
    )
    for season_dir in season_dirs:
        players_path = season_dir / "database" / "players.json"
        players = read_json(players_path, [])
        if not isinstance(players, list):
            continue

        season = season_dir.name
        manifest = read_json(season_dir / "manifest.json", {})
        season_label = (
            clean(manifest.get("label", ""))
            if isinstance(manifest, dict)
            else ""
        )
        season_key_map: dict[str, str] = {}
        for player in collapse_exact_duplicates([p for p in players if isinstance(p, dict)]):
            name = clean(player.get("name", ""))
            if not name:
                continue

            identity = next(
                (item for item in identities if identity_matches(item, player, season)),
                None,
            )
            if identity is None:
                base_key = history_base_key(player, season)
                key = base_key
                suffix = 2
                while key in used_keys:
                    key = f"{base_key}-{suffix}"
                    suffix += 1
                used_keys.add(key)
                identity = {
                    "key": key,
                    "name": name,
                    "height": clean(player.get("ht", "")),
                    "weight": clean(player.get("wt", "")),
                    "firstSeason": season,
                    "firstSeasonNumber": season_number(season),
                    "firstAge": age_as_int(player),
                    "latestSeason": season,
                    "appearances": [],
                }
                identities.append(identity)
                by_key[key] = identity

            identity["latestSeason"] = season
            file_name = player_file_from_url(player)
            appearance = {
                "season": season,
                "seasonLabel": season_label or default_season_label(season),
                "playerFile": file_name,
                "name": name,
                "team": clean(player.get("teamLabel", player.get("team", ""))),
                "pos": clean(player.get("pos", "")),
                "age": clean(player.get("age", "")),
                "overall": clean(player.get("overall", "")),
                "potential": clean(player.get("potential", "")),
            }
            appearance.update(
                {key: clean(player.get(key, "")) for key in ATTRIBUTE_HISTORY_KEYS}
            )
            identity.setdefault("appearances", []).append(appearance)
            if file_name:
                season_key_map[file_name] = str(identity["key"])

        player_key_maps[season] = season_key_map
        map_path = season_dir / "database" / "player_history_keys.json"
        map_payload = {
            "source": "players.json",
            "season": season,
            "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
            "keys": season_key_map,
        }
        map_path.write_text(json.dumps(map_payload, indent=2) + "\n", encoding="utf-8")

    payload = {
        "source": "00-build/history/*/database/players.json",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "identityCount": len(identities),
        "attributeHistoryKeys": ATTRIBUTE_HISTORY_KEYS,
        "identities": sorted(identities, key=lambda item: str(item.get("name", "")).casefold()),
        "seasonMaps": player_key_maps,
    }
    (history_root / "player_index.json").write_text(
        json.dumps(payload, indent=2) + "\n",
        encoding="utf-8",
    )
    return payload


def enrich_player_identity_index(history_root: Path) -> dict[str, object]:
    index_path = history_root / "player_index.json"
    payload = read_json(index_path, {})
    if not isinstance(payload, dict) or not isinstance(payload.get("identities"), list):
        return build_player_identity_index(history_root)

    players_by_season: dict[str, dict[str, list[dict[str, object]]]] = {}
    labels_by_season: dict[str, str] = {}

    def archived_players(season: str) -> dict[str, list[dict[str, object]]]:
        if season in players_by_season:
            return players_by_season[season]
        season_dir = history_root / season
        players = read_json(season_dir / "database" / "players.json", [])
        by_file: dict[str, list[dict[str, object]]] = {}
        if isinstance(players, list):
            for player in players:
                if not isinstance(player, dict):
                    continue
                file_name = player_file_from_url(player)
                if file_name:
                    by_file.setdefault(file_name, []).append(player)
        manifest = read_json(season_dir / "manifest.json", {})
        labels_by_season[season] = (
            clean(manifest.get("label", ""))
            if isinstance(manifest, dict)
            else ""
        ) or default_season_label(season)
        players_by_season[season] = by_file
        return by_file

    enriched_count = 0
    for identity in payload["identities"]:
        if not isinstance(identity, dict):
            continue
        appearances = identity.get("appearances", [])
        if not isinstance(appearances, list):
            continue
        for appearance in appearances:
            if not isinstance(appearance, dict):
                continue
            season = clean(appearance.get("season", ""))
            file_name = clean(appearance.get("playerFile", ""))
            if not season or not file_name:
                continue
            candidates = archived_players(season).get(file_name, [])
            if not candidates:
                continue
            appearance_name = clean(appearance.get("name", "")).casefold()
            player = next(
                (
                    candidate
                    for candidate in candidates
                    if clean(candidate.get("name", "")).casefold() == appearance_name
                ),
                candidates[0],
            )
            appearance["seasonLabel"] = labels_by_season[season]
            appearance.update(
                {key: clean(player.get(key, "")) for key in ATTRIBUTE_HISTORY_KEYS}
            )
            enriched_count += 1

    payload["generatedAtUtc"] = datetime.now(timezone.utc).isoformat()
    payload["attributeHistoryKeys"] = ATTRIBUTE_HISTORY_KEYS
    index_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    payload["enrichedAppearanceCount"] = enriched_count
    return payload


def main() -> int:
    args = parse_args()
    root = repo_root()
    history_root = root / "00-build" / "history"
    if args.rebuild_index_only:
        player_index = enrich_player_identity_index(history_root)
        print(
            "Enriched player identity index with "
            f"{player_index.get('enrichedAppearanceCount', 0)} archived appearance(s)"
        )
        return 0

    source = root / "00-build" / "database"
    season_dir = history_root / season_slug(args.season)
    database_archive = season_dir / "database"
    season_awards_out = source / "season_awards.json"

    if not source.exists():
        raise FileNotFoundError(f"Database folder not found: {source}")
    if season_dir.exists() and not args.force:
        raise FileExistsError(
            f"Archive already exists: {season_dir}. Re-run with --force to overwrite it."
        )

    if not args.skip_build:
        run_player_json_build(root)

    season_awards = write_season_awards(root, season_awards_out)

    if season_dir.exists():
        shutil.rmtree(season_dir)

    copied = copy_json_tree(source, database_archive)
    manifest = {
        "season": season_dir.name,
        "label": args.label or default_season_label(season_dir.name),
        "source": "00-build/database",
        "archived_at_utc": datetime.now(timezone.utc).isoformat(),
        "json_count": len(copied),
        "feeds": feed_status(database_archive),
        "season_awards": {
            "missing": season_awards.get("missing", True),
            "sectionCount": season_awards.get("sectionCount", 0),
            "awardCount": season_awards.get("awardCount", 0),
        },
        "files": copied,
    }
    season_dir.mkdir(parents=True, exist_ok=True)
    (season_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    seasons = update_history_index(history_root)
    player_index = build_player_identity_index(history_root)
    records_script = root / "00-build" / "scripts" / "build_history_records.py"
    subprocess.run([sys.executable, str(records_script)], cwd=root, check=True)

    print(f"Archived {len(copied)} JSON files to {season_dir}")
    print(f"Updated history index with {len(seasons)} season(s)")
    print(f"Updated player identity index with {player_index['identityCount']} player(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
