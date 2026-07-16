"""Build compact season-aware feeds for the unified player database page."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from atomic_write import atomic_dump_json


ROOT = Path(__file__).resolve().parents[2]
DATABASE_DIR = ROOT / "00-build" / "database"
HISTORY_DIR = ROOT / "00-build" / "history"
OUTPUT_DIR = DATABASE_DIR / "player-database"

ATTRIBUTE_KEYS = [
    "Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb",
    "Psd", "Prd", "Stl", "Blk", "Qkn", "Str", "Jmp", "Sta",
]
POTENTIAL_KEYS = [
    "Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb",
    "Psd", "Prd", "Stl", "Blk",
]
REGULAR_KEYS = [
    "g", "gs", "min", "pts", "orb", "drb", "ast", "to", "a_t",
    "stl", "blk", "pf", "fg_pct", "ft_pct", "3p_pct",
]
ADVANCED_KEYS = [
    "ts_pct", "pps", "usg", "orr", "drr", "rr", "per", "va", "ewa",
    "plus_minus", "oeff", "deff",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build compact player database feeds.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing files.")
    return parser.parse_args()


def load_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def norm(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", clean(value).casefold())


def as_number(value: Any) -> float | int | None:
    if value in (None, "", "-"):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def season_number(value: Any) -> int | None:
    match = re.search(r"(\d+)", clean(value))
    return int(match.group(1)) if match else None


def player_file(record: dict[str, Any]) -> str:
    url = clean(record.get("url", "")).replace("\\", "/")
    if url:
        return url.rsplit("/", 1)[-1]
    player_id = clean(record.get("playerId", ""))
    return f"{player_id}.htm" if player_id else ""


def included_player(player: dict[str, Any]) -> bool:
    if clean(player.get("teamLabel", player.get("team", ""))).casefold() == "draft":
        return False
    return max(as_number(player.get("overall")) or 0, as_number(player.get("potential")) or 0) > 0


def table_rows(stats_record: dict[str, Any], table_name: str) -> list[dict[str, Any]]:
    rows = stats_record.get("stats", {}).get(table_name, {}).get("rows", [])
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


def row_for_period(stats_record: dict[str, Any], table_name: str, period: int | str | None) -> dict[str, Any]:
    if period is None:
        return {}
    for row in table_rows(stats_record, table_name):
        if str(row.get("season", "")).casefold() == str(period).casefold():
            return row
    return {}


def numeric_stat_year(stats_records: list[dict[str, Any]]) -> int | None:
    years: list[int] = []
    for record in stats_records:
        for row in table_rows(record, "season_averages"):
            value = as_number(row.get("season"))
            if isinstance(value, int):
                years.append(value)
    return max(years) if years else None


def picked(row: dict[str, Any], keys: list[str]) -> dict[str, Any]:
    return {key: row.get(key) for key in keys if row.get(key) not in (None, "")}


def regular_payload(row: dict[str, Any]) -> dict[str, Any]:
    result = picked(row, REGULAR_KEYS)
    orb = as_number(row.get("orb"))
    drb = as_number(row.get("drb"))
    if orb is not None or drb is not None:
        result["reb"] = round((orb or 0) + (drb or 0), 1)
    return result


def advanced_payload(row: dict[str, Any]) -> dict[str, Any]:
    return picked(row, ADVANCED_KEYS)


def build_stats_lookup(records: list[dict[str, Any]]) -> dict[str, Any]:
    by_id: dict[str, dict[str, Any]] = {}
    by_file: dict[str, dict[str, Any]] = {}
    by_signature: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    by_name: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        player_id = clean(record.get("playerId", ""))
        file_name = player_file(record)
        if player_id:
            by_id[player_id] = record
        if file_name:
            by_file[file_name.casefold()] = record
        signature = (
            norm(record.get("name")),
            norm(record.get("teamLabel", record.get("team"))),
            norm(record.get("pos")),
        )
        by_signature[signature].append(record)
        by_name[norm(record.get("name"))].append(record)
    return {"id": by_id, "file": by_file, "signature": by_signature, "name": by_name}


def find_stats(player: dict[str, Any], lookup: dict[str, Any]) -> dict[str, Any]:
    player_id = clean(player.get("playerId", ""))
    file_name = player_file(player).casefold()
    if player_id and player_id in lookup["id"]:
        return lookup["id"][player_id]
    if file_name and file_name in lookup["file"]:
        return lookup["file"][file_name]
    signature = (
        norm(player.get("name")),
        norm(player.get("teamLabel", player.get("team"))),
        norm(player.get("pos")),
    )
    matches = lookup["signature"].get(signature, [])
    if len(matches) == 1:
        return matches[0]
    matches = lookup["name"].get(norm(player.get("name")), [])
    return matches[0] if len(matches) == 1 else {}


def identity_for_current(
    player: dict[str, Any],
    identities: list[dict[str, Any]],
    latest_file_map: dict[str, str],
    current_season_number: int,
) -> str:
    file_name = player_file(player)
    if file_name and file_name in latest_file_map:
        return clean(latest_file_map[file_name])

    player_name = clean(player.get("name")).casefold()
    height = clean(player.get("ht"))
    current_age = as_number(player.get("age"))
    candidates: list[dict[str, Any]] = []
    for identity in identities:
        if clean(identity.get("name")).casefold() != player_name:
            continue
        if clean(identity.get("height")) != height:
            continue
        first_age = identity.get("firstAge")
        first_season = identity.get("firstSeasonNumber")
        if isinstance(current_age, int) and isinstance(first_age, int) and isinstance(first_season, int):
            expected_age = first_age + (current_season_number - first_season)
            if abs(current_age - expected_age) > 1:
                continue
        candidates.append(identity)
    return clean(candidates[0].get("key")) if len(candidates) == 1 else ""


def compact_player(
    player: dict[str, Any],
    stats_record: dict[str, Any],
    stat_year: int | None,
    history_key: str,
    historical: bool,
    include_career: bool,
    team_abbreviations: dict[str, str],
) -> dict[str, Any]:
    player_id = clean(player.get("playerId")) or Path(player_file(player)).stem
    team = clean(player.get("teamLabel", player.get("team", "FA"))) or "FA"
    team_abbr = "FA" if team.casefold() == "fa" else clean(team_abbreviations.get(team, ""))
    row = row_for_period(stats_record, "season_averages", stat_year)
    efficiency = row_for_period(stats_record, "efficiency", stat_year)
    contracts = []
    for contract in player.get("contracts", []):
        if not isinstance(contract, dict):
            continue
        salary = as_number(contract.get("salary"))
        year = clean(contract.get("year"))
        if year and salary and salary > 0:
            contracts.append({"year": year, "salary": salary})
    href = (
        f"./history/player.htm?key={history_key}"
        if historical and history_key
        else ("" if historical else f"./unified-player.htm?id={player_id}")
    )
    payload: dict[str, Any] = {
        "key": history_key or player_id,
        "id": player_id,
        "historyKey": history_key,
        "name": clean(player.get("name")),
        "team": team,
        "teamAbbr": team_abbr or team,
        "status": "free_agent" if team.casefold() == "fa" else "rostered",
        "pos": clean(player.get("pos")),
        "age": as_number(player.get("age")),
        "href": href,
        "overall": as_number(player.get("overall")),
        "potential": as_number(player.get("potential")),
        "currentSalary": as_number(player.get("currentSalary")),
        "contracts": contracts,
        "attributes": {key: as_number(player.get(key)) for key in ATTRIBUTE_KEYS},
        "potentialGrades": {
            key: clean((player.get("potentials") or {}).get(key, ""))
            for key in POTENTIAL_KEYS
        },
        "regular": regular_payload(row),
        "advanced": advanced_payload(efficiency),
    }
    if include_career:
        payload["careerRegular"] = regular_payload(row_for_period(stats_record, "season_averages", "Career"))
        payload["careerAdvanced"] = advanced_payload(row_for_period(stats_record, "efficiency", "Career"))
    return payload


def deduplicate(players: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    by_key: dict[str, dict[str, Any]] = {}
    duplicate_count = 0
    for player in players:
        key = clean(player.get("key"))
        if key not in by_key:
            by_key[key] = player
            continue
        duplicate_count += 1
        existing = by_key[key]
        existing_rank = (existing.get("status") == "rostered", existing.get("overall") or 0)
        candidate_rank = (player.get("status") == "rostered", player.get("overall") or 0)
        if candidate_rank > existing_rank:
            by_key[key] = player
    return sorted(by_key.values(), key=lambda item: (clean(item.get("name")).casefold(), clean(item.get("key")))), duplicate_count


def build_snapshot_feed(
    snapshot: str,
    label: str,
    players_path: Path,
    stats_path: Path,
    history_map: dict[str, str],
    historical: bool,
    include_career: bool = False,
    current_identity_context: tuple[list[dict[str, Any]], dict[str, str], int] | None = None,
) -> tuple[dict[str, Any], dict[str, int | None]]:
    raw_players = load_json(players_path, [])
    stats_payload = load_json(stats_path, {})
    stats_records = stats_payload.get("players", []) if isinstance(stats_payload, dict) else []
    if not isinstance(raw_players, list) or not isinstance(stats_records, list):
        raise ValueError(f"Invalid player database source for {snapshot}")
    stat_year = numeric_stat_year(stats_records)
    lookup = build_stats_lookup([record for record in stats_records if isinstance(record, dict)])
    abbreviation_votes: dict[str, Counter[str]] = defaultdict(Counter)
    for player in raw_players:
        if not isinstance(player, dict) or not included_player(player):
            continue
        team = clean(player.get("teamLabel", player.get("team", "")))
        if not team or team.casefold() in {"fa", "draft"}:
            continue
        stats_record = find_stats(player, lookup)
        row = row_for_period(stats_record, "season_averages", stat_year)
        abbreviation = clean(row.get("team", ""))
        if abbreviation:
            abbreviation_votes[team][abbreviation] += 1
    team_abbreviations = {
        team: sorted(votes.items(), key=lambda item: (-item[1], item[0]))[0][0]
        for team, votes in abbreviation_votes.items()
        if votes
    }
    compact: list[dict[str, Any]] = []
    missing_stats = 0
    identity_matches = 0
    for player in raw_players:
        if not isinstance(player, dict) or not included_player(player):
            continue
        file_name = player_file(player)
        if current_identity_context:
            identities, latest_file_map, current_number = current_identity_context
            history_key = identity_for_current(player, identities, latest_file_map, current_number)
        else:
            history_key = clean(history_map.get(file_name, ""))
        if history_key:
            identity_matches += 1
        stats_record = find_stats(player, lookup)
        if not stats_record or (
            not row_for_period(stats_record, "season_averages", stat_year)
            and not row_for_period(stats_record, "efficiency", stat_year)
        ):
            missing_stats += 1
        compact.append(compact_player(
            player,
            stats_record,
            stat_year,
            history_key,
            historical=historical,
            include_career=include_career,
            team_abbreviations=team_abbreviations,
        ))

    compact, duplicate_count = deduplicate(compact)
    identity_matches = sum(1 for player in compact if player.get("historyKey"))
    missing_stats = sum(
        1 for player in compact
        if not player.get("regular") and not player.get("advanced")
    )
    feed = {
        "snapshot": snapshot,
        "label": label,
        "statYear": stat_year,
        "playerCount": len(compact),
        "players": compact,
    }
    diagnostics = {
        "players": len(compact),
        "identityMatches": identity_matches,
        "missingStats": missing_stats,
        "duplicatesRemoved": duplicate_count,
        "statYear": stat_year,
    }
    return feed, diagnostics


def build_database() -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, dict[str, int | None]]]:
    history_index = load_json(HISTORY_DIR / "index.json", {"seasons": []})
    player_index = load_json(HISTORY_DIR / "player_index.json", {"identities": [], "seasonMaps": {}})
    seasons = history_index.get("seasons", []) if isinstance(history_index, dict) else []
    seasons = [season for season in seasons if isinstance(season, dict)]
    seasons.sort(key=lambda entry: season_number(entry.get("season")) or 0)
    identities = player_index.get("identities", []) if isinstance(player_index, dict) else []
    season_maps = player_index.get("seasonMaps", {}) if isinstance(player_index, dict) else {}

    feeds: dict[str, dict[str, Any]] = {}
    diagnostics: dict[str, dict[str, int | None]] = {}
    manifest_snapshots: list[dict[str, Any]] = []

    latest = seasons[-1] if seasons else None
    latest_slug = clean(latest.get("season")) if latest else ""
    latest_number = season_number(latest_slug) or 0
    latest_map = season_maps.get(latest_slug, {}) if isinstance(season_maps, dict) else {}
    current_feed, diagnostics["current"] = build_snapshot_feed(
        "current",
        "Current",
        DATABASE_DIR / "players.json",
        DATABASE_DIR / "player_stats.json",
        {},
        historical=False,
        include_career=True,
        current_identity_context=(identities, latest_map, latest_number + 1),
    )
    feeds["current"] = current_feed
    manifest_snapshots.append({
        "id": "current",
        "label": "Current",
        "path": "current.json",
        "statYear": current_feed.get("statYear"),
    })

    for season in reversed(seasons):
        slug = clean(season.get("season"))
        if not slug:
            continue
        database_path = HISTORY_DIR / clean(season.get("database", f"{slug}/database"))
        feed, season_diagnostics = build_snapshot_feed(
            slug,
            clean(season.get("label")) or slug,
            database_path / "players.json",
            database_path / "player_stats.json",
            season_maps.get(slug, {}) if isinstance(season_maps, dict) else {},
            historical=True,
        )
        feeds[slug] = feed
        diagnostics[slug] = season_diagnostics
        manifest_snapshots.append({
            "id": slug,
            "label": feed["label"],
            "path": f"{slug}.json",
            "statYear": feed.get("statYear"),
        })

    latest_completed = latest_slug
    latest_completed_year = feeds.get(latest_completed, {}).get("statYear")
    current_year = current_feed.get("statYear")
    current_has_stats = bool(current_year and (not latest_completed_year or current_year > latest_completed_year))
    manifest = {
        "source": "ESL player database compact feeds",
        "currentSnapshot": "current",
        "latestCompletedSnapshot": latest_completed,
        "latestCompletedLabel": feeds.get(latest_completed, {}).get("label", ""),
        "currentHasStats": current_has_stats,
        "snapshots": manifest_snapshots,
    }
    return manifest, feeds, diagnostics


def validate_database(manifest: dict[str, Any], feeds: dict[str, dict[str, Any]]) -> list[str]:
    """Validate feed identity/path integrity and return non-fatal data warnings."""
    warnings: list[str] = []
    declared = manifest.get("snapshots", [])
    declared_ids = [clean(entry.get("id")) for entry in declared]
    if set(declared_ids) != set(feeds):
        raise ValueError("Manifest snapshots do not match generated feeds")
    for entry in declared:
        snapshot = clean(entry.get("id"))
        if clean(entry.get("path")) != f"{snapshot}.json":
            raise ValueError(f"Invalid generated path declared for {snapshot}")
        feed = feeds[snapshot]
        keys = [clean(player.get("key")) for player in feed.get("players", [])]
        if not all(keys) or len(keys) != len(set(keys)):
            raise ValueError(f"Snapshot {snapshot} contains missing or duplicate player identities")
        if feed.get("playerCount") != len(keys):
            raise ValueError(f"Snapshot {snapshot} player count does not match its feed")
        missing = sum(
            1 for player in feed.get("players", [])
            if not player.get("regular") and not player.get("advanced")
        )
        if missing:
            warnings.append(f"{snapshot}: {missing} player(s) legitimately lack a matching statistics row")
    return warnings


def write_outputs(manifest: dict[str, Any], feeds: dict[str, dict[str, Any]], output_dir: Path, dry_run: bool) -> None:
    if dry_run:
        return
    output_dir.mkdir(parents=True, exist_ok=True)
    atomic_dump_json(output_dir / "index.json", manifest, indent=2)
    for snapshot, feed in feeds.items():
        atomic_dump_json(output_dir / f"{snapshot}.json", feed, separators=(",", ":"))


def main() -> int:
    args = parse_args()
    try:
        manifest, feeds, diagnostics = build_database()
        warnings = validate_database(manifest, feeds)
    except (OSError, ValueError) as error:
        print(f"Player database build failed: {error}", file=sys.stderr)
        return 1

    write_outputs(manifest, feeds, OUTPUT_DIR, args.dry_run)
    prefix = "Would write" if args.dry_run else "Wrote"
    print(f"{prefix} player database manifest and {len(feeds)} snapshot feed(s).")
    for snapshot in [entry["id"] for entry in manifest["snapshots"]]:
        details = diagnostics[snapshot]
        payload_bytes = len(json.dumps(feeds[snapshot], separators=(",", ":")).encode("utf-8"))
        print(
            f"  {snapshot}: {details['players']} players, {details['identityMatches']} identity matches, "
            f"{details['missingStats']} without stats, {details['duplicatesRemoved']} duplicate(s) removed, "
            f"{payload_bytes} bytes"
        )
    for warning in warnings:
        print(f"  Warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
