"""Build a compact all-time record feed from archived ESL seasons."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

from atomic_write import atomic_dump_json


ROOT = Path(__file__).resolve().parents[2]
HISTORY_ROOT = ROOT / "00-build" / "history"
OUTPUT_PATH = HISTORY_ROOT / "league_records.json"
PROFILE_DIR = HISTORY_ROOT / "player_profiles"
CHAMPS_PATH = ROOT / "champs.htm"

MAJOR_AWARDS = {
    "most valuable player": "MVP",
    "defender of the year": "DPOY",
    "rookie of the year": "ROTY",
    "6th man of the year": "6MOY",
    "most improved player": "MIP",
}


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clean(value: object) -> str:
    text = unescape(str(value or "")).replace("\xa0", " ").replace("\x00", "")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()


def season_number(value: object) -> int:
    match = re.search(r"\d+", str(value or ""))
    return int(match.group()) if match else 0


def numeric(value: object):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0
    return int(number) if number.is_integer() else number


def row_by_label(rows: list[dict], key: str, label: str) -> dict:
    return next(
        (row for row in rows if str(row.get(key, "")).strip().casefold() == label.casefold()),
        {},
    )


def selected_values(row: dict, keys: tuple[str, ...]) -> dict:
    return {key: numeric(row.get(key)) for key in keys}


def player_records(index: dict, player_index: dict) -> list[dict]:
    stats_by_season: dict[str, dict[str, dict]] = {}
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        feed = read_json(HISTORY_ROOT / season_id / "database" / "player_stats.json", {"players": []})
        stats_by_season[season_id] = {
            str(record.get("url", "")).replace("\\", "/").split("/")[-1]: record
            for record in feed.get("players", [])
        }

    records = []
    for identity in player_index.get("identities", []):
        appearances = sorted(
            identity.get("appearances", []),
            key=lambda item: season_number(item.get("season")),
            reverse=True,
        )
        for appearance in appearances:
            stat = stats_by_season.get(appearance.get("season", ""), {}).get(
                appearance.get("playerFile", "")
            )
            if not stat:
                continue
            stats = stat.get("stats", {})
            career = row_by_label(stats.get("season_totals", {}).get("rows", []), "season", "Career")
            highs = row_by_label(stats.get("career_highs", {}).get("rows", []), "type", "Career")
            records.append(
                {
                    "key": identity.get("key", ""),
                    "name": identity.get("name", ""),
                    "team": appearance.get("team", ""),
                    "season": appearance.get("season", ""),
                    "career": selected_values(career, ("g", "pts", "reb", "ast", "stl", "blk")),
                    "highs": selected_values(highs, ("pts", "reb", "ast", "stl", "blk", "3pm")),
                }
            )
            break
    return records


def profile_bucket(key: str) -> str:
    match = re.search(r"[a-z0-9]", str(key or "").casefold())
    return match.group() if match else "_"


def build_player_profiles(index: dict, player_index: dict) -> tuple[int, dict[str, int]]:
    stats_by_season: dict[str, dict[str, dict]] = {}
    players_by_season: dict[str, dict[str, dict]] = {}
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        stats_feed = read_json(HISTORY_ROOT / season_id / "database" / "player_stats.json", {"players": []})
        players_feed = read_json(HISTORY_ROOT / season_id / "database" / "players.json", [])
        stats_by_season[season_id] = {
            str(record.get("url", "")).replace("\\", "/").split("/")[-1]: record
            for record in stats_feed.get("players", [])
        }
        players_by_season[season_id] = {
            str(record.get("url", "")).replace("\\", "/").split("/")[-1]: record
            for record in players_feed
        }

    buckets: dict[str, dict[str, dict]] = defaultdict(dict)
    profile_count = 0
    for identity in player_index.get("identities", []):
        key = str(identity.get("key", ""))
        appearances = sorted(
            identity.get("appearances", []),
            key=lambda item: season_number(item.get("season")),
            reverse=True,
        )
        latest_stat = {}
        latest_player = {}
        for appearance in appearances:
            season_id = appearance.get("season", "")
            player_file = appearance.get("playerFile", "")
            latest_stat = stats_by_season.get(season_id, {}).get(player_file, {})
            latest_player = players_by_season.get(season_id, {}).get(player_file, {})
            if latest_stat:
                break
        peak_appearance = max(
            appearances,
            key=lambda item: numeric(item.get("overall")),
            default={},
        )
        peak_player = players_by_season.get(peak_appearance.get("season", ""), {}).get(
            peak_appearance.get("playerFile", ""),
            {},
        )
        if not key or not latest_stat:
            continue
        buckets[profile_bucket(key)][key] = {
            "key": key,
            "name": identity.get("name", ""),
            "latestStats": latest_stat,
            "peakPlayer": peak_player,
            "awards": latest_player.get("awards", []),
        }
        profile_count += 1

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    bucket_counts = {}
    for bucket, profiles in sorted(buckets.items()):
        bucket_counts[bucket] = len(profiles)
        atomic_dump_json(
            PROFILE_DIR / f"{bucket}.json",
            {"version": 1, "players": profiles},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    atomic_dump_json(
        PROFILE_DIR / "index.json",
        {"version": 1, "profileCount": profile_count, "buckets": bucket_counts},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return profile_count, bucket_counts


def award_records(index: dict, player_index: dict) -> list[dict]:
    identities = {item.get("key", ""): item for item in player_index.get("identities", [])}
    season_maps = player_index.get("seasonMaps", {})
    counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {"MVP": 0, "DPOY": 0, "ROTY": 0, "6MOY": 0, "MIP": 0, "total": 0}
    )
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        feed = read_json(HISTORY_ROOT / season_id / "database" / "season_awards.json", {"sections": []})
        for section in feed.get("sections", []):
            for award in section.get("awards", []):
                label = MAJOR_AWARDS.get(str(award.get("award", "")).strip().casefold())
                key = season_maps.get(season_id, {}).get(award.get("personFile", ""), "")
                if not label or not key:
                    continue
                counts[key][label] += 1
                counts[key]["total"] += 1

    records = []
    for key, values in counts.items():
        identity = identities.get(key, {})
        records.append({"key": key, "name": identity.get("name", ""), **values})
    return sorted(records, key=lambda item: (-item["total"], item["name"].casefold()))


def link_value(cell: str) -> tuple[str, str]:
    match = re.search(r'<a[^>]+href=["\']?([^"\'\s>]+)[^>]*>(.*?)</a>', cell, re.I | re.S)
    if not match:
        return clean(cell), ""
    return clean(match.group(2)), match.group(1).replace("\\", "/").split("/")[-1]


def championship_tier(title: str) -> str:
    lowered = title.casefold()
    if "champions league" in lowered:
        return "CLB"
    if "europa league" in lowered:
        return "ELB"
    if "conference league" in lowered:
        return "ECL"
    return clean(title)


def championship_records() -> list[dict]:
    if not CHAMPS_PATH.exists():
        return []
    html = CHAMPS_PATH.read_text(encoding="latin-1")
    records = []
    tier = ""
    for table in re.findall(r"<table[^>]*>(.*?)</table>", html, re.I | re.S):
        heading = re.search(r"<td[^>]*class=newheader[^>]*>(.*?)</td>", table, re.I | re.S)
        if heading:
            tier = championship_tier(clean(heading.group(1)))
            continue
        if not tier or not re.search(r"<td[^>]*class=header", table, re.I):
            continue
        for row in re.findall(r"<tr[^>]*class=row[12][^>]*>(.*?)</tr>", table, re.I | re.S):
            cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row, re.I | re.S)
            if len(cells) < 4:
                continue
            champion, champion_file = link_value(cells[1])
            opponent, opponent_file = link_value(cells[3])
            season = clean(cells[0])
            if season and champion:
                records.append(
                    {
                        "season": season,
                        "tier": tier,
                        "champion": champion,
                        "championFile": champion_file,
                        "opponent": opponent,
                        "opponentFile": opponent_file,
                    }
                )
    return sorted(records, key=lambda item: (-season_number(item["season"]), item["tier"]))


def championship_totals(championships: list[dict]) -> list[dict]:
    totals: dict[str, dict] = {}
    for record in championships:
        key = record.get("championFile") or record.get("champion", "").casefold()
        item = totals.setdefault(
            key,
            {"team": record.get("champion", ""), "file": record.get("championFile", ""), "titles": 0, "wins": []},
        )
        item["titles"] += 1
        item["wins"].append(f"{record.get('season', '')} {record.get('tier', '')}".strip())
    return sorted(totals.values(), key=lambda item: (-item["titles"], item["team"].casefold()))


def build_records() -> dict:
    index = read_json(HISTORY_ROOT / "index.json", {"seasons": []})
    player_index = read_json(HISTORY_ROOT / "player_index.json", {"identities": [], "seasonMaps": {}})
    championships = championship_records()
    seasons = index.get("seasons", [])
    latest = seasons[-1] if seasons else {}
    return {
        "version": 1,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "throughSeason": latest.get("season", ""),
        "throughLabel": latest.get("label", latest.get("season", "")),
        "players": player_records(index, player_index),
        "awards": award_records(index, player_index),
        "championships": championships,
        "championshipTotals": championship_totals(championships),
    }


def main() -> int:
    payload = build_records()
    atomic_dump_json(OUTPUT_PATH, payload, ensure_ascii=False, separators=(",", ":"))
    index = read_json(HISTORY_ROOT / "index.json", {"seasons": []})
    player_index = read_json(HISTORY_ROOT / "player_index.json", {"identities": []})
    profile_count, bucket_counts = build_player_profiles(index, player_index)
    print(
        f"History records: {len(payload['players'])} players, "
        f"{len(payload['championships'])} championships -> {OUTPUT_PATH.relative_to(ROOT)}"
    )
    print(f"History player profiles: {profile_count} players across {len(bucket_counts)} buckets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
