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
FINANCE_OUTPUT_PATH = HISTORY_ROOT / "finance_history.json"
HEAD_TO_HEAD_OUTPUT_PATH = HISTORY_ROOT / "head_to_head.json"
STORIES_OUTPUT_PATH = HISTORY_ROOT / "history_stories.json"
RIVALRIES_SOURCE_PATH = ROOT / "00-build" / "sources" / "history" / "rivalries.json"
PROFILE_DIR = HISTORY_ROOT / "player_profiles"
CHAMPS_PATH = ROOT / "champs.htm"

TIER_ORDER = {"CLB": 1, "ELB": 2, "ECL": 3}
PRIMARY_LEADERS = ("points", "rebounds", "assists", "steals", "blocks")

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


def file_name(value: object) -> str:
    return str(value or "").replace("\\", "/").split("/")[-1]


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
            efficiency = row_by_label(stats.get("efficiency", {}).get("rows", []), "season", "Career")
            playoffs = row_by_label(stats.get("playoff_averages", {}).get("rows", []), "season", "Career")
            playoff_shooting = row_by_label(stats.get("playoff_shooting", {}).get("rows", []), "season", "Career")
            records.append(
                {
                    "key": identity.get("key", ""),
                    "name": identity.get("name", ""),
                    "team": appearance.get("team", ""),
                    "season": appearance.get("season", ""),
                    "career": selected_values(
                        career,
                        ("g", "min", "fgm", "fga", "ftm", "fta", "3pm", "3pa", "pts", "reb", "ast", "stl", "blk", "to", "plus_minus"),
                    ),
                    "efficiency": selected_values(efficiency, ("ts_pct", "per", "ewa", "plus_minus")),
                    "playoffs": {
                        **selected_values(playoffs, ("g", "min", "pts", "orb", "drb", "ast", "to", "stl", "blk", "fg_pct", "ft_pct", "3p_pct")),
                        "reb": numeric(playoffs.get("orb")) + numeric(playoffs.get("drb")),
                        **selected_values(playoff_shooting, ("fgm", "fga", "ftm", "fta", "3pm", "3pa")),
                    },
                    "highs": selected_values(
                        highs,
                        ("pts", "reb", "ast", "stl", "blk", "to", "fgm", "fga", "ftm", "fta", "3pm", "3pa"),
                    ),
                }
            )
            break
    return records


def profile_bucket(key: str) -> str:
    match = re.search(r"[a-z0-9]", str(key or "").casefold())
    return match.group() if match else "_"


def build_player_profiles(index: dict, player_index: dict, earnings_by_key: dict[str, dict]) -> tuple[int, dict[str, int]]:
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
            "earnings": earnings_by_key.get(key, {"total": 0, "history": []}),
        }
        profile_count += 1

    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    bucket_counts = {}
    for bucket, profiles in sorted(buckets.items()):
        bucket_counts[bucket] = len(profiles)
        atomic_dump_json(
            PROFILE_DIR / f"{bucket}.json",
            {"version": 2, "players": profiles},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    atomic_dump_json(
        PROFILE_DIR / "index.json",
        {"version": 2, "profileCount": profile_count, "buckets": bucket_counts},
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


def franchise_records(index: dict, championships: list[dict]) -> list[dict]:
    records: dict[str, dict] = {}
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        label = season.get("label", season_id)
        standings = read_json(HISTORY_ROOT / season_id / "database" / "standings.json", {"sections": []})
        for section in standings.get("sections", []):
            for row in section.get("teams", []):
                key = file_name(row.get("rosterFile")) or clean(row.get("team")).casefold()
                item = records.setdefault(
                    key,
                    {
                        "key": key,
                        "file": file_name(row.get("rosterFile")),
                        "team": clean(row.get("team")),
                        "wins": 0,
                        "losses": 0,
                        "seasons": 0,
                        "titles": 0,
                        "bestSeason": {},
                        "worstSeason": {},
                        "highestScoring": {},
                        "biggestVictory": {},
                    },
                )
                wins, losses = numeric(row.get("wins")), numeric(row.get("losses"))
                pct, points = numeric(row.get("pct")), numeric(row.get("pf"))
                snapshot = {"season": season_id, "label": label, "wins": wins, "losses": losses, "pct": pct}
                item["wins"] += wins
                item["losses"] += losses
                item["seasons"] += 1
                if not item["bestSeason"] or pct > item["bestSeason"].get("pct", -1):
                    item["bestSeason"] = snapshot
                if not item["worstSeason"] or pct < item["worstSeason"].get("pct", 2):
                    item["worstSeason"] = snapshot
                if not item["highestScoring"] or points > item["highestScoring"].get("points", -1):
                    item["highestScoring"] = {"season": season_id, "label": label, "points": points}

        games = read_json(HISTORY_ROOT / season_id / "database" / "game_results.json", {"results": []})
        for game in games.get("results", []):
            if clean(game.get("section")).casefold() != "regular season":
                continue
            winner_key = f"{file_name(game.get('winner'))}.htm" if file_name(game.get("winner")) and not file_name(game.get("winner")).endswith(".htm") else file_name(game.get("winner"))
            item = records.get(winner_key)
            if not item:
                continue
            margin = numeric(game.get("margin"))
            if not item["biggestVictory"] or margin > item["biggestVictory"].get("margin", -1):
                item["biggestVictory"] = {
                    "season": season_id,
                    "label": label,
                    "date": clean(game.get("date")),
                    "opponent": clean(game.get("loserName")),
                    "score": f"{numeric(game.get('homeScore'))}-{numeric(game.get('awayScore'))}",
                    "margin": margin,
                }

    for championship in championships:
        key = championship.get("championFile") or ""
        if key in records:
            records[key]["titles"] += 1
    for item in records.values():
        games = item["wins"] + item["losses"]
        item["pct"] = round(item["wins"] / games, 3) if games else 0
    return sorted(records.values(), key=lambda item: (-item["wins"], item["team"].casefold()))


def build_finance_history(index: dict, player_index: dict) -> dict:
    season_maps = player_index.get("seasonMaps", {})
    identities = {item.get("key", ""): item for item in player_index.get("identities", [])}
    cap_history = []
    earnings: dict[str, dict] = {}
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        label = season.get("label", season_id)
        cap = read_json(HISTORY_ROOT / season_id / "database" / "capreport.json", {"sections": []})
        players = read_json(HISTORY_ROOT / season_id / "database" / "players.json", [])
        highest_paid: dict[str, dict] = {}
        for player in players:
            player_file = file_name(player.get("url") or f"{player.get('playerId', '')}.htm")
            key = season_maps.get(season_id, {}).get(player_file, "")
            salary = numeric(player.get("currentSalary"))
            team_file = file_name(player.get("team"))
            if team_file and not team_file.endswith(".htm"):
                team_file += ".htm"
            if salary > highest_paid.get(team_file, {}).get("salary", -1):
                highest_paid[team_file] = {"key": key, "name": clean(player.get("name")), "salary": salary}
            if key and salary > 0:
                item = earnings.setdefault(key, {"key": key, "name": identities.get(key, {}).get("name", clean(player.get("name"))), "total": 0, "history": []})
                item["total"] += salary
                item["history"].append({"season": season_id, "label": label, "team": clean(player.get("teamLabel")), "salary": salary})

        for section in cap.get("sections", []):
            for entry in section.get("entries", []):
                team_file = file_name(entry.get("rosterFile"))
                cap_history.append(
                    {
                        "season": season_id,
                        "label": label,
                        "tier": clean(section.get("title")),
                        "team": clean(entry.get("team")),
                        "file": team_file,
                        "salary": numeric(entry.get("salary")),
                        "capRoom": numeric(entry.get("capRoom")),
                        "budgetRoom": None if entry.get("budgetRoom") is None else numeric(entry.get("budgetRoom")),
                        "midException": numeric(entry.get("midException")),
                        "lowException": numeric(entry.get("lowException")),
                        "highestPaid": highest_paid.get(team_file, {}),
                    }
                )
    earnings_rows = sorted(earnings.values(), key=lambda item: (-item["total"], item["name"].casefold()))
    return {
        "version": 1,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "throughLabel": index.get("seasons", [{}])[-1].get("label", "") if index.get("seasons") else "",
        "capHistory": cap_history,
        "earnings": earnings_rows,
    }


def team_name_key(value: object) -> str:
    return clean(value).casefold()


def empty_matchup_record() -> dict:
    return {
        "games": 0,
        "wins": 0,
        "losses": 0,
        "pointsFor": 0,
        "pointsAgainst": 0,
        "largestWin": {},
        "results": [],
    }


def add_matchup_game(
    matchups: dict[str, dict[str, dict]],
    game: dict,
    competition: str,
    season_id: str,
    season_label: str,
) -> None:
    home_name = clean(game.get("homeTeamName"))
    away_name = clean(game.get("awayTeamName"))
    home_score = numeric(game.get("homeScore"))
    away_score = numeric(game.get("awayScore"))
    if not home_name or not away_name or home_score == away_score:
        return
    for team_name, opponent_name, points_for, points_against in (
        (home_name, away_name, home_score, away_score),
        (away_name, home_name, away_score, home_score),
    ):
        team_key = team_name_key(team_name)
        opponent_key = team_name_key(opponent_name)
        matchup = matchups.setdefault(team_key, {}).setdefault(
            opponent_key,
            {
                "team": team_name,
                "opponent": opponent_name,
                "league": empty_matchup_record(),
                "supercup": empty_matchup_record(),
            },
        )
        record = matchup[competition]
        won = points_for > points_against
        record["games"] += 1
        record["wins"] += int(won)
        record["losses"] += int(not won)
        record["pointsFor"] += points_for
        record["pointsAgainst"] += points_against
        margin = points_for - points_against
        record["results"].append(
            {
                "season": season_id,
                "label": season_label,
                "date": clean(game.get("date")),
                "competition": "Super Cup" if competition == "supercup" else "League",
                "venue": "Home" if team_name == home_name else "Away",
                "team": team_name,
                "opponent": opponent_name,
                "pointsFor": points_for,
                "pointsAgainst": points_against,
                "won": won,
            }
        )
        if won and (not record["largestWin"] or margin > record["largestWin"].get("margin", -1)):
            record["largestWin"] = {
                "margin": margin,
                "score": f"{points_for}-{points_against}",
                "season": season_id,
                "label": season_label,
                "date": clean(game.get("date")),
            }


def finalized_matchup_record(record: dict) -> dict:
    games = record.get("games", 0)
    return {
        **record,
        "pct": round(record.get("wins", 0) / games, 3) if games else 0,
        "avgPointsFor": round(record.get("pointsFor", 0) / games, 1) if games else 0,
        "avgPointsAgainst": round(record.get("pointsAgainst", 0) / games, 1) if games else 0,
        "avgDiff": round((record.get("pointsFor", 0) - record.get("pointsAgainst", 0)) / games, 1) if games else 0,
    }


def matchup_season_splits(results: list[dict]) -> list[dict]:
    seasons: dict[str, dict] = {}
    for game in results:
        season_id = clean(game.get("season"))
        item = seasons.setdefault(
            season_id,
            {
                "season": season_id,
                "label": clean(game.get("label")) or season_id,
                "games": 0,
                "wins": 0,
                "losses": 0,
                "pointsFor": 0,
                "pointsAgainst": 0,
                "leagueGames": 0,
                "supercupGames": 0,
            },
        )
        item["games"] += 1
        item["wins"] += int(bool(game.get("won")))
        item["losses"] += int(not game.get("won"))
        item["pointsFor"] += numeric(game.get("pointsFor"))
        item["pointsAgainst"] += numeric(game.get("pointsAgainst"))
        if game.get("competition") == "Super Cup":
            item["supercupGames"] += 1
        else:
            item["leagueGames"] += 1
    for item in seasons.values():
        item["avgDiff"] = round((item["pointsFor"] - item["pointsAgainst"]) / item["games"], 1) if item["games"] else 0
    return sorted(seasons.values(), key=lambda item: season_number(item["season"]))


def matchup_venue_splits(results: list[dict]) -> dict:
    splits = {
        "home": {"games": 0, "wins": 0, "losses": 0},
        "away": {"games": 0, "wins": 0, "losses": 0},
    }
    for game in results:
        key = "home" if clean(game.get("venue")).casefold() == "home" else "away"
        splits[key]["games"] += 1
        splits[key]["wins"] += int(bool(game.get("won")))
        splits[key]["losses"] += int(not game.get("won"))
    return splits


def matchup_notable_games(results: list[dict], largest_win: dict) -> dict:
    if not results:
        return {"closest": {}, "highestScoring": {}, "largestWin": largest_win or {}}
    closest = min(results, key=lambda game: (abs(numeric(game.get("pointsFor")) - numeric(game.get("pointsAgainst"))), clean(game.get("date"))))
    highest = max(results, key=lambda game: numeric(game.get("pointsFor")) + numeric(game.get("pointsAgainst")))
    return {"closest": closest, "highestScoring": highest, "largestWin": largest_win or {}}


def public_matchup_record(record: dict) -> dict:
    return {key: value for key, value in record.items() if key != "results"}


def build_head_to_head(index: dict) -> dict:
    matchups: dict[str, dict[str, dict]] = {}
    team_files: dict[str, dict] = {}
    for season in index.get("seasons", []):
        season_id = season.get("season", "")
        label = season.get("label", season_id)
        database = HISTORY_ROOT / season_id / "database"
        standings = read_json(database / "standings.json", {"sections": []})
        for section in standings.get("sections", []):
            for team in section.get("teams", []):
                key = team_name_key(team.get("team"))
                if key:
                    team_files[key] = {"team": clean(team.get("team")), "file": file_name(team.get("rosterFile"))}

        league_games = read_json(database / "game_results.json", {"results": []})
        for game in league_games.get("results", []):
            if clean(game.get("section")).casefold() == "regular season":
                add_matchup_game(matchups, game, "league", season_id, label)

        supercup_games = read_json(database / "supercup" / "game_results.json", {"results": []})
        for game in supercup_games.get("results", []):
            if clean(game.get("section")).casefold() in {"regular season", "playoffs"}:
                add_matchup_game(matchups, game, "supercup", season_id, label)

    teams = {}
    unique_matchups: dict[tuple[str, str], dict] = {}
    for team_key, opponent_map in matchups.items():
        if team_key not in team_files:
            continue
        team_meta = team_files.get(team_key, {"team": next(iter(opponent_map.values()), {}).get("team", team_key), "file": ""})
        opponents = []
        for opponent_key, matchup in opponent_map.items():
            if opponent_key not in team_files:
                continue
            league = finalized_matchup_record(matchup["league"])
            supercup = finalized_matchup_record(matchup["supercup"])
            combined_results = league.get("results", []) + supercup.get("results", [])
            combined = finalized_matchup_record(
                {
                    "games": league["games"] + supercup["games"],
                    "wins": league["wins"] + supercup["wins"],
                    "losses": league["losses"] + supercup["losses"],
                    "pointsFor": league["pointsFor"] + supercup["pointsFor"],
                    "pointsAgainst": league["pointsAgainst"] + supercup["pointsAgainst"],
                    "largestWin": max(
                        (item for item in (league.get("largestWin"), supercup.get("largestWin")) if item),
                        key=lambda item: item.get("margin", 0),
                        default={},
                    ),
                    "results": combined_results,
                }
            )
            if combined["largestWin"]:
                combined["largestWin"]["competition"] = (
                    "Super Cup" if combined["largestWin"] == supercup.get("largestWin") else "League"
                )
            opponent_meta = team_files.get(opponent_key, {"team": matchup.get("opponent", opponent_key), "file": ""})
            pair = tuple(sorted((team_meta.get("file", ""), opponent_meta.get("file", ""))))
            if all(pair) and pair not in unique_matchups:
                unique_matchups[pair] = {
                    "id": "--".join(file_name(value).removesuffix(".htm") for value in pair),
                    "teams": [team_meta, opponent_meta],
                    "league": public_matchup_record(league),
                    "supercup": public_matchup_record(supercup),
                    "combined": public_matchup_record(combined),
                    "venueSplits": matchup_venue_splits(combined_results),
                    "seasons": matchup_season_splits(combined_results),
                    "notableGames": matchup_notable_games(combined_results, combined.get("largestWin", {})),
                    "games": sorted(
                        combined_results,
                        key=lambda game: (
                            season_number(game.get("season")),
                            clean(game.get("competition")),
                            clean(game.get("date")),
                        ),
                    ),
                }
            opponents.append(
                {
                    "opponent": opponent_meta.get("team", matchup.get("opponent", "")),
                    "file": opponent_meta.get("file", ""),
                    "league": public_matchup_record(league),
                    "supercup": public_matchup_record(supercup),
                    "combined": public_matchup_record(combined),
                    "seasons": matchup_season_splits(combined_results),
                    "notableGames": matchup_notable_games(combined_results, combined.get("largestWin", {})),
                }
            )
        teams[team_key] = {
            **team_meta,
            "opponents": sorted(opponents, key=lambda item: (-item["combined"]["games"], item["opponent"].casefold())),
        }
    latest = index.get("seasons", [])[-1] if index.get("seasons") else {}
    unique_rows = list(unique_matchups.values())
    return {
        "version": 3,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "throughLabel": latest.get("label", latest.get("season", "")),
        "teams": teams,
        "matchups": sorted(unique_rows, key=lambda item: (-item["combined"].get("games", 0), item["id"])),
    }


def tier_from_title(value: object) -> str:
    text = clean(value).upper()
    return next((tier for tier in TIER_ORDER if text.startswith(tier)), "")


def movement_marker(tier: str, position: int, team_count: int) -> str:
    if tier == "CLB" and position == 1:
        return "C"
    if tier == "ELB" and position <= 2:
        return "P"
    if tier == "ECL" and position == 1:
        return "P"
    if tier == "CLB" and position > max(0, team_count - 2):
        return "R"
    if tier == "ELB" and position == team_count:
        return "R"
    return ""


def archived_team_seasons(index: dict) -> tuple[dict[str, list[dict]], dict[str, dict]]:
    histories: dict[str, list[dict]] = defaultdict(list)
    team_meta: dict[str, dict] = {}
    for season in index.get("seasons", []):
        season_id = clean(season.get("season"))
        standings = read_json(HISTORY_ROOT / season_id / "database" / "standings.json", {"sections": []})
        for section in standings.get("sections", []):
            tier = tier_from_title(section.get("title"))
            teams = section.get("teams", [])
            for position, row in enumerate(teams, 1):
                roster_file = file_name(row.get("rosterFile"))
                if not roster_file:
                    continue
                snapshot = {
                    "season": season_id,
                    "label": clean(season.get("label")) or season_id,
                    "team": clean(row.get("team")),
                    "file": roster_file,
                    "tier": tier,
                    "position": position,
                    "teamCount": len(teams),
                    "wins": numeric(row.get("wins")),
                    "losses": numeric(row.get("losses")),
                    "pct": numeric(row.get("pct")),
                    "diff": numeric(row.get("diff")),
                    "movement": movement_marker(tier, position, len(teams)),
                }
                histories[roster_file].append(snapshot)
                team_meta[roster_file] = {"team": snapshot["team"], "file": roster_file}
    for rows in histories.values():
        rows.sort(key=lambda item: season_number(item["season"]))
    return histories, team_meta


def season_key_from_championship(record: dict, index: dict) -> str:
    year = clean(record.get("season"))
    for season in index.get("seasons", []):
        if clean(season.get("label")).startswith(year):
            return clean(season.get("season"))
    return ""


def supercup_champion(database: Path, team_meta_by_name: dict[str, dict]) -> dict:
    feed = read_json(database / "supercup" / "game_results.json", {"results": []})
    playoff_games = [
        game for game in feed.get("results", [])
        if clean(game.get("section")).casefold() == "playoffs"
    ]
    if not playoff_games:
        return {}
    final = playoff_games[-1]
    name = clean(final.get("winnerName"))
    meta = team_meta_by_name.get(name.casefold(), {})
    return {
        "team": name,
        "file": meta.get("file", ""),
        "opponent": clean(final.get("loserName")),
        "date": clean(final.get("date")),
        "score": f"{numeric(final.get('homeScore'))}-{numeric(final.get('awayScore'))}",
    }


def timeline_records(index: dict, championships: list[dict], player_index: dict) -> list[dict]:
    season_maps = player_index.get("seasonMaps", {})
    championship_map: dict[str, list[dict]] = defaultdict(list)
    for record in championships:
        season_id = season_key_from_championship(record, index)
        if season_id:
            championship_map[season_id].append(record)
    timeline = []
    for season in index.get("seasons", []):
        season_id = clean(season.get("season"))
        label = clean(season.get("label")) or season_id
        database = HISTORY_ROOT / season_id / "database"
        standings = read_json(database / "standings.json", {"sections": []})
        team_rows = []
        for section in standings.get("sections", []):
            tier = tier_from_title(section.get("title"))
            teams = section.get("teams", [])
            for position, row in enumerate(teams, 1):
                team_rows.append(
                    {
                        "team": clean(row.get("team")),
                        "file": file_name(row.get("rosterFile")),
                        "tier": tier,
                        "position": position,
                        "wins": numeric(row.get("wins")),
                        "losses": numeric(row.get("losses")),
                        "pct": numeric(row.get("pct")),
                        "diff": numeric(row.get("diff")),
                        "movement": movement_marker(tier, position, len(teams)),
                    }
                )
        team_by_name = {row["team"].casefold(): row for row in team_rows}
        awards_feed = read_json(database / "season_awards.json", {"sections": []})
        awards = []
        for section in awards_feed.get("sections", []):
            tier = tier_from_title(section.get("title"))
            for award in section.get("awards", []):
                short = MAJOR_AWARDS.get(clean(award.get("award")).casefold())
                if not short:
                    continue
                awards.append(
                    {
                        "tier": tier,
                        "award": short,
                        "label": clean(award.get("award")),
                        "person": clean(award.get("person")),
                        "playerFile": file_name(award.get("personFile")),
                        "playerKey": season_maps.get(season_id, {}).get(file_name(award.get("personFile")), ""),
                        "team": clean(award.get("team")),
                        "teamFile": file_name(award.get("teamFile")),
                    }
                )
        leaders_feed = read_json(database / "leaders.json", {"sections": []})
        leaders = []
        for section in leaders_feed.get("sections", []):
            tier = tier_from_title(section.get("title"))
            for category in section.get("categories", []):
                category_key = clean(category.get("title")).casefold()
                if category_key not in PRIMARY_LEADERS or not category.get("leaders"):
                    continue
                leader = category["leaders"][0]
                player_file = file_name(leader.get("playerFile"))
                leaders.append(
                    {
                        "tier": tier,
                        "category": clean(category.get("title")),
                        "player": clean(leader.get("player")),
                        "playerFile": player_file,
                        "playerKey": season_maps.get(season_id, {}).get(player_file, ""),
                        "team": clean(leader.get("teamName")),
                        "teamFile": file_name(leader.get("teamFile")),
                        "value": leader.get("valueText", leader.get("value", "")),
                    }
                )
        best = min(team_rows, key=lambda row: (TIER_ORDER.get(row["tier"], 9), row["position"]), default={})
        timeline.append(
            {
                "season": season_id,
                "label": label,
                "championships": sorted(championship_map.get(season_id, []), key=lambda row: TIER_ORDER.get(row.get("tier"), 9)),
                "supercup": supercup_champion(database, team_by_name),
                "bestRegularSeason": best,
                "promoted": [row for row in team_rows if row["movement"] == "P"],
                "relegated": [row for row in team_rows if row["movement"] == "R"],
                "awards": awards,
                "leaders": leaders,
            }
        )
    return timeline


def score_era_window(rows: list[dict], titles: list[dict]) -> dict:
    season_ids = {row["season"] for row in rows}
    window_titles = [title for title in titles if title.get("season") in season_ids]
    clb_titles = sum(title.get("tier") == "CLB" for title in window_titles)
    lower_titles = len(window_titles) - clb_titles
    promotions = sum(row.get("movement") == "P" for row in rows)
    relegations = sum(row.get("movement") == "R" for row in rows)
    upward_moves = 0
    for previous, current in zip(rows, rows[1:]):
        upward_moves += max(0, TIER_ORDER.get(previous.get("tier"), 9) - TIER_ORDER.get(current.get("tier"), 9))
    top_three = sum(row.get("tier") == "CLB" and row.get("position", 99) <= 3 for row in rows)
    strong_seasons = sum(numeric(row.get("pct")) >= 0.6 for row in rows)
    score = clb_titles * 10 + lower_titles * 5 + promotions * 8 + upward_moves * 5 + top_three * 3 + strong_seasons * 2 - relegations * 4
    wins = sum(numeric(row.get("wins")) for row in rows)
    losses = sum(numeric(row.get("losses")) for row in rows)
    total_games = wins + losses
    classification = "Dynasty" if len(window_titles) >= 2 or (clb_titles and top_three >= 3) else "Promotion Journey" if promotions or upward_moves else "Sustained Contender"
    return {
        "score": score,
        "classification": classification,
        "titles": window_titles,
        "titleCount": len(window_titles),
        "promotions": promotions,
        "relegations": relegations,
        "upwardMoves": upward_moves,
        "topThreeFinishes": top_three,
        "wins": wins,
        "losses": losses,
        "pct": round(wins / total_games, 3) if total_games else 0,
    }


def build_eras(index: dict, championships: list[dict]) -> list[dict]:
    histories, _ = archived_team_seasons(index)
    titles_by_team: dict[str, list[dict]] = defaultdict(list)
    for title in championships:
        season_id = season_key_from_championship(title, index)
        roster_file = file_name(title.get("championFile"))
        if season_id and roster_file:
            titles_by_team[roster_file].append({**title, "season": season_id})
    eras = []
    for roster_file, history in histories.items():
        candidates = []
        max_length = min(5, len(history))
        for length in range(2, max_length + 1):
            for start in range(0, len(history) - length + 1):
                window = history[start:start + length]
                if any(season_number(b["season"]) - season_number(a["season"]) != 1 for a, b in zip(window, window[1:])):
                    continue
                result = score_era_window(window, titles_by_team.get(roster_file, []))
                if result["score"] < 10 or not (result["titleCount"] or result["promotions"] or result["upwardMoves"]):
                    continue
                candidates.append((result, window))
        if not candidates:
            continue
        result, window = max(candidates, key=lambda item: (item[0]["score"], item[0]["pct"], len(item[1])))
        milestones = []
        for row in window:
            if row["movement"] == "P":
                milestones.append(f"Promoted from {row['tier']} in {row['label']}")
            if row["movement"] == "R":
                milestones.append(f"Relegated from {row['tier']} in {row['label']}")
        labels_by_season = {row["season"]: row["label"] for row in window}
        milestones.extend(
            f"Won {title['tier']} in {labels_by_season.get(title.get('season', ''), title.get('season', ''))}"
            for title in result["titles"]
        )
        eras.append(
            {
                "id": f"{roster_file.removesuffix('.htm')}--{window[0]['season']}--{window[-1]['season']}",
                "team": window[-1]["team"],
                "file": roster_file,
                "startSeason": window[0]["season"],
                "endSeason": window[-1]["season"],
                "startLabel": window[0]["label"],
                "endLabel": window[-1]["label"],
                "seasons": window,
                "tierPath": [row["tier"] for row in window],
                "milestones": milestones,
                **result,
            }
        )
    return sorted(eras, key=lambda item: (-item["score"], -item["pct"], item["team"].casefold()))[:12]


def load_rivalry_registry(team_meta: dict[str, dict], path: Path = RIVALRIES_SOURCE_PATH) -> dict[tuple[str, str], dict]:
    payload = read_json(path, {"version": 1, "rivalries": []})
    if not isinstance(payload, dict) or not isinstance(payload.get("rivalries", []), list):
        raise ValueError(f"{path.relative_to(ROOT)} must contain a rivalry list")
    registry = {}
    known = set(team_meta)
    for position, entry in enumerate(payload.get("rivalries", []), 1):
        if not isinstance(entry, dict):
            raise ValueError(f"Rivalry entry {position} must be an object")
        teams = entry.get("teams")
        name = clean(entry.get("name"))
        if not isinstance(teams, list) or len(teams) != 2 or teams[0] == teams[1]:
            raise ValueError(f"Rivalry entry {position} must contain exactly two different team roster IDs")
        pair = tuple(sorted(file_name(team) for team in teams))
        unknown = [team for team in pair if team not in known]
        if unknown:
            raise ValueError(f"Rivalry entry {position} references unknown team(s): {', '.join(unknown)}")
        if not name:
            raise ValueError(f"Rivalry entry {position} is missing a name")
        if pair in registry:
            raise ValueError(f"Rivalry entry {position} duplicates the pair {' / '.join(pair)}")
        registry[pair] = {
            "name": name,
            "location": clean(entry.get("location")),
            "featured": bool(entry.get("featured")),
        }
    return registry


def rivalry_score(matchup: dict, manual: dict | None = None) -> float:
    combined = matchup.get("combined", {})
    games = numeric(combined.get("games"))
    if not games:
        return 12 if manual else 0
    wins = numeric(combined.get("wins"))
    losses = numeric(combined.get("losses"))
    frequency = min(games, 30)
    balance = 12 * max(0, 1 - abs(wins - losses) / games)
    margin = 10 * max(0, 1 - abs(numeric(combined.get("avgDiff"))) / 15)
    supercup = min(numeric(matchup.get("supercup", {}).get("games")) * 2, 10)
    manual_bonus = 8 if manual else 0
    location_bonus = 4 if manual and manual.get("location") else 0
    return round(frequency + balance + margin + supercup + manual_bonus + location_bonus, 2)


def build_rivalries(head_to_head: dict, team_meta: dict[str, dict], registry_path: Path = RIVALRIES_SOURCE_PATH) -> list[dict]:
    registry = load_rivalry_registry(team_meta, registry_path)
    seen = set()
    rivalries = []
    for matchup in head_to_head.get("matchups", []):
        files = tuple(sorted(file_name(team.get("file")) for team in matchup.get("teams", [])))
        if len(files) != 2 or not all(files) or files in seen:
            continue
        seen.add(files)
        manual = registry.get(files)
        games = numeric(matchup.get("combined", {}).get("games"))
        if games < 6 and not manual:
            continue
        teams = [
            team_meta.get(file_name(team.get("file")), {"team": clean(team.get("team")), "file": file_name(team.get("file"))})
            for team in matchup.get("teams", [])
        ]
        rivalries.append(
            {
                **matchup,
                "id": "--".join(roster_file.removesuffix(".htm") for roster_file in files),
                "teams": teams,
                "name": manual.get("name") if manual else f"{teams[0]['team']} vs {teams[1]['team']}",
                "location": manual.get("location", "") if manual else "",
                "featured": bool(manual and manual.get("featured")),
                "manual": bool(manual),
                "score": rivalry_score(matchup, manual),
            }
        )
    return sorted(rivalries, key=lambda item: (-int(item["featured"]), -item["score"], item["name"].casefold()))


def build_history_stories(index: dict, player_index: dict, records: dict, head_to_head: dict, registry_path: Path = RIVALRIES_SOURCE_PATH) -> dict:
    _, team_meta = archived_team_seasons(index)
    championships = records.get("championships", [])
    latest = index.get("seasons", [{}])[-1] if index.get("seasons") else {}
    return {
        "version": 1,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "throughSeason": latest.get("season", ""),
        "throughLabel": latest.get("label", latest.get("season", "")),
        "timeline": timeline_records(index, championships, player_index),
        "eras": build_eras(index, championships),
        "rivalries": build_rivalries(head_to_head, team_meta, registry_path),
        "methodology": {
            "era": "Best contiguous 2-5 season club window; titles, promotion and upward movement, top-tier finishes and winning seasons add value; relegation subtracts value.",
            "rivalry": "At least six meetings unless manually listed; rank balances frequency, series parity, scoring margin, Super Cup meetings and manual/location bonuses.",
        },
    }


def build_records() -> dict:
    index = read_json(HISTORY_ROOT / "index.json", {"seasons": []})
    player_index = read_json(HISTORY_ROOT / "player_index.json", {"identities": [], "seasonMaps": {}})
    championships = championship_records()
    seasons = index.get("seasons", [])
    latest = seasons[-1] if seasons else {}
    return {
        "version": 2,
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "throughSeason": latest.get("season", ""),
        "throughLabel": latest.get("label", latest.get("season", "")),
        "players": player_records(index, player_index),
        "awards": award_records(index, player_index),
        "championships": championships,
        "championshipTotals": championship_totals(championships),
        "franchises": franchise_records(index, championships),
    }


def main() -> int:
    payload = build_records()
    atomic_dump_json(OUTPUT_PATH, payload, ensure_ascii=False, separators=(",", ":"))
    index = read_json(HISTORY_ROOT / "index.json", {"seasons": []})
    player_index = read_json(HISTORY_ROOT / "player_index.json", {"identities": []})
    finance = build_finance_history(index, player_index)
    atomic_dump_json(FINANCE_OUTPUT_PATH, finance, ensure_ascii=False, separators=(",", ":"))
    head_to_head = build_head_to_head(index)
    atomic_dump_json(HEAD_TO_HEAD_OUTPUT_PATH, head_to_head, ensure_ascii=False, separators=(",", ":"))
    stories = build_history_stories(index, player_index, payload, head_to_head)
    atomic_dump_json(STORIES_OUTPUT_PATH, stories, ensure_ascii=False, separators=(",", ":"))
    earnings_by_key = {item.get("key", ""): item for item in finance.get("earnings", [])}
    profile_count, bucket_counts = build_player_profiles(index, player_index, earnings_by_key)
    print(
        f"History records: {len(payload['players'])} players, "
        f"{len(payload['championships'])} championships -> {OUTPUT_PATH.relative_to(ROOT)}"
    )
    print(f"History player profiles: {profile_count} players across {len(bucket_counts)} buckets")
    print(
        f"History finance: {len(finance['capHistory'])} team seasons, "
        f"{len(finance['earnings'])} player earnings records -> {FINANCE_OUTPUT_PATH.relative_to(ROOT)}"
    )
    print(
        f"History head-to-head: {len(head_to_head['teams'])} teams -> "
        f"{HEAD_TO_HEAD_OUTPUT_PATH.relative_to(ROOT)}"
    )
    print(
        f"History stories: {len(stories['timeline'])} seasons, {len(stories['eras'])} eras, "
        f"{len(stories['rivalries'])} rivalries -> {STORIES_OUTPUT_PATH.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
