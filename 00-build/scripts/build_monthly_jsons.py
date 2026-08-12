import json
import os
from collections import defaultdict
from datetime import datetime

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
MONTHLY_DIR = os.path.join(DATABASE_DIR, "monthly")

STANDINGS_PATH = os.path.join(DATABASE_DIR, "standings.json")
GAME_RESULTS_PATH = os.path.join(DATABASE_DIR, "game_results.json")

OVERALL_TEAM_FORM_PATH = os.path.join(MONTHLY_DIR, "overall_team_form.json")
LATEST_SIM_RESULTS_PATH = os.path.join(MONTHLY_DIR, "latest_sim_results.json")
MONTHLY_TEAM_FORM_PATH = os.path.join(MONTHLY_DIR, "monthly_team_form.json")
TIER_RACE_SNAPSHOT_PATH = os.path.join(MONTHLY_DIR, "tier_race_snapshot.json")
MONTHLY_STORYLINES_PATH = os.path.join(MONTHLY_DIR, "monthly_storylines.json")

TIER_CONFIG = [
    {"section_title": "CLB Standings", "tier": "Tier 1", "short": "T1"},
    {"section_title": "ELB Standings", "tier": "Tier 2", "short": "T2"},
    {"section_title": "ECL Standings", "tier": "Tier 3", "short": "T3"},
]


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def infer_game_date_format(values):
    """Infer one ambiguous day/month order for a whole export.

    Year-first ISO-style values are intentionally ignored here because they
    are unambiguous and are parsed directly by ``parse_game_date``. Keeping a
    single inferred order for day-first/month-first exports prevents an
    ambiguous value such as 03/04/1985 from being interpreted per row.
    """
    for value in values:
        raw = str(value or "").strip()
        if not raw or (len(raw) >= 4 and raw[:4].isdigit()):
            continue
        parts = raw.replace("-", "/").replace(".", "/").split("/")
        if len(parts) != 3:
            continue
        try:
            first, second = int(parts[0]), int(parts[1])
        except ValueError:
            continue
        if first > 12 and second <= 12:
            return "%d/%m/%Y"
        if second > 12 and first <= 12:
            return "%m/%d/%Y"

    # Fast Break exports use day/month/year. Ambiguous datasets keep that default.
    return "%d/%m/%Y"


def parse_game_date(value, date_format):
    raw = str(value or "").strip()
    if not raw:
        return None

    # ISO dates and timestamps are unambiguous, including a trailing Z.
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except ValueError:
        pass

    day_first = date_format.find("%d") < date_format.find("%m")
    first, second = ("%d", "%m") if day_first else ("%m", "%d")
    candidates = [
        f"{first}/{second}/%Y",
        f"{first}-{second}-%Y",
        f"{first}.{second}.%Y",
        "%Y/%m/%d",
        "%Y.%m.%d",
        "%d %b %Y",
        "%d %B %Y",
        "%b %d %Y",
        "%B %d %Y",
    ]
    for candidate in candidates:
        try:
            return datetime.strptime(raw, candidate)
        except ValueError:
            continue
    return None


def is_preseason_game(game):
    return str(game.get("sectionSlug") or game.get("section") or "").strip().casefold() == "preseason"


def filter_preseason_when_regular_exists(games):
    if not any(not is_preseason_game(game) for game in games):
        return list(games)
    return [game for game in games if not is_preseason_game(game)]


def make_team_lookup(standings_data):
    lookup = {}
    for config in TIER_CONFIG:
        section = next(
            (item for item in standings_data.get("sections", []) if item.get("title") == config["section_title"]),
            None,
        )
        if not section:
            continue

        for standing_rank, team in enumerate(section.get("teams", []), start=1):
            team_name = team.get("team", "")
            if not team_name:
                continue
            lookup[team_name] = {
                "team": team_name,
                "tier": config["tier"],
                "tierShort": config["short"],
                "standingRank": standing_rank,
                "rosterUrl": team.get("rosterUrl", ""),
                "rosterFile": team.get("rosterFile", ""),
                "standingsLast10": team.get("last10", "0-0"),
            }
    return lookup


def build_latest_sim_results(game_results_data):
    results = game_results_data.get("results", [])
    date_format = infer_game_date_format(game.get("date", "") for game in results)
    dated_results = []
    for game in results:
        parsed_date = parse_game_date(game.get("date", ""), date_format)
        if parsed_date is None:
            continue
        dated_results.append((parsed_date, game))

    if not dated_results:
        return {
            "source": ["game_results.json"],
            "period": None,
            "results": [],
        }

    latest_date = max(item[0] for item in dated_results)
    latest_year = latest_date.year
    latest_month = latest_date.month
    filtered_results = [
        game
        for parsed_date, game in dated_results
        if parsed_date.year == latest_year and parsed_date.month == latest_month
    ]
    filtered_results = filter_preseason_when_regular_exists(filtered_results)

    return {
        "source": ["game_results.json"],
        "period": {
            "year": latest_year,
            "month": latest_month,
            "label": latest_date.strftime("%B %Y"),
        },
        "results": filtered_results,
    }


def build_team_form(standings_data, game_results_data, source_labels):
    team_lookup = make_team_lookup(standings_data)
    team_form = {}

    for team_name, info in team_lookup.items():
        team_form[team_name] = {
            "team": team_name,
            "tier": info["tier"],
            "tierShort": info["tierShort"],
            "standingRank": info["standingRank"],
            "rosterUrl": info["rosterUrl"],
            "rosterFile": info["rosterFile"],
            "standingsLast10": info["standingsLast10"],
            "wins": 0,
            "losses": 0,
            "games": 0,
            "pointsFor": 0,
            "pointsAgainst": 0,
            "pointDiff": 0,
            "avgMargin": 0.0,
            "streak": "-",
            "recentResults": [],
            "bestWin": None,
            "worstLoss": None,
            "closeGames": [],
            "blowoutWins": [],
            "blowoutLosses": [],
        }

    for game in game_results_data.get("results", []):
        home_team = game.get("homeTeamName", "")
        away_team = game.get("awayTeamName", "")
        winner = game.get("winnerName", "")
        margin = int(game.get("margin", 0) or 0)

        game_pairs = (
            (home_team, int(game.get("homeScore", 0) or 0), int(game.get("awayScore", 0) or 0), away_team),
            (away_team, int(game.get("awayScore", 0) or 0), int(game.get("homeScore", 0) or 0), home_team),
        )

        for team_name, points_for, points_against, opponent in game_pairs:
            if team_name not in team_form:
                continue

            entry = team_form[team_name]
            result = "W" if winner == team_name else "L"
            summary = {
                "date": game.get("date", ""),
                "opponent": opponent,
                "result": result,
                "margin": margin,
                "score": game.get("matchupText", ""),
                "boxscoreUrl": game.get("boxscoreUrl", ""),
                "section": game.get("section", ""),
            }

            entry["games"] += 1
            entry["wins"] += 1 if result == "W" else 0
            entry["losses"] += 1 if result == "L" else 0
            entry["pointsFor"] += points_for
            entry["pointsAgainst"] += points_against
            entry["recentResults"].append(summary)

            if result == "W":
                if entry["bestWin"] is None or margin > entry["bestWin"]["margin"]:
                    entry["bestWin"] = summary
                if margin >= 15:
                    entry["blowoutWins"].append(summary)
            else:
                if entry["worstLoss"] is None or margin > entry["worstLoss"]["margin"]:
                    entry["worstLoss"] = summary
                if margin >= 15:
                    entry["blowoutLosses"].append(summary)

            if margin <= 5:
                entry["closeGames"].append(summary)

    tiers = defaultdict(list)
    for entry in team_form.values():
        entry["pointDiff"] = entry["pointsFor"] - entry["pointsAgainst"]
        games = entry["games"] or 1
        entry["avgMargin"] = round(entry["pointDiff"] / games, 2)
        entry["record"] = f'{entry["wins"]}-{entry["losses"]}'
        entry["closeGameCount"] = len(entry["closeGames"])

        recent = entry["recentResults"][-3:]
        entry["last3"] = "".join(item["result"] for item in recent) or "-"

        streak_count = 0
        streak_result = ""
        for item in reversed(entry["recentResults"]):
            if not streak_result:
                streak_result = item["result"]
                streak_count = 1
            elif item["result"] == streak_result:
                streak_count += 1
            else:
                break
        entry["streak"] = f"{streak_result}{streak_count}" if streak_result else "-"

        tiers[entry["tier"]].append(entry)

    output = {
        "source": source_labels,
        "tiers": {},
    }

    for config in TIER_CONFIG:
        tier_name = config["tier"]
        teams = tiers.get(tier_name, [])
        teams.sort(key=lambda item: (item["wins"], item["pointDiff"], -item["standingRank"]), reverse=True)
        output["tiers"][tier_name] = teams

    return output


def build_tier_race_snapshot(monthly_team_form_data):
    tiers = monthly_team_form_data.get("tiers", {})
    races = []
    race_specs = [
        {"tier": "Tier 1", "type": "relegation", "slots": 2, "direction": "bottom"},
        {"tier": "Tier 2", "type": "promotion", "slots": 2, "direction": "top"},
        {"tier": "Tier 2", "type": "relegation", "slots": 1, "direction": "bottom"},
        {"tier": "Tier 3", "type": "promotion", "slots": 1, "direction": "top"},
    ]

    for spec in race_specs:
        teams = list(tiers.get(spec["tier"], []))
        if not teams:
            continue

        sorted_teams = sorted(
            teams,
            key=lambda item: (item["wins"], item["pointDiff"], -item["standingRank"]),
            reverse=True,
        )

        if spec["direction"] == "top":
            line_index = max(spec["slots"] - 1, 0)
            line_team = sorted_teams[line_index]
            focus = sorted_teams[: min(len(sorted_teams), spec["slots"] + 2)]
        else:
            reversed_teams = list(reversed(sorted_teams))
            line_index = max(spec["slots"] - 1, 0)
            line_team = reversed_teams[line_index]
            focus = reversed_teams[: min(len(reversed_teams), spec["slots"] + 2)]

        entries = []
        for team in focus:
            if spec["direction"] == "top":
                status = "on_or_above_line" if team["wins"] >= line_team["wins"] else "chasing"
                gap = line_team["wins"] - team["wins"]
            else:
                status = "on_or_below_line" if team["wins"] <= line_team["wins"] else "above_safety"
                gap = team["wins"] - line_team["wins"]

            entries.append(
                {
                    "team": team["team"],
                    "record": team["record"],
                    "standingRank": team["standingRank"],
                    "streak": team["streak"],
                    "last3": team["last3"],
                    "avgMargin": team["avgMargin"],
                    "pointDiff": team["pointDiff"],
                    "gapToLine": gap,
                    "status": status,
                    "rosterUrl": team["rosterUrl"],
                }
            )

        races.append(
            {
                "id": f'{spec["tier"].lower().replace(" ", "-")}-{spec["type"]}',
                "tier": spec["tier"],
                "type": spec["type"],
                "slots": spec["slots"],
                "lineTeam": line_team["team"],
                "lineRecord": line_team["record"],
                "entries": entries,
            }
        )

    return {
        "source": ["monthly/monthly_team_form.json"],
        "races": races,
    }


def build_monthly_storylines(monthly_team_form_data, game_results_data, tier_race_snapshot_data):
    tiers = monthly_team_form_data.get("tiers", {})
    all_teams = [team for teams in tiers.values() for team in teams]
    storylines = []
    results = game_results_data.get("results", [])

    if results:
        biggest_blowout = max(results, key=lambda item: int(item.get("margin", 0) or 0))
        closest_game = min(results, key=lambda item: int(item.get("margin", 0) or 0))

        storylines.append(
            {
                "id": "biggest-blowout",
                "type": "game",
                "title": "Biggest Blowout of the Month",
                "summary": f'{biggest_blowout["winnerName"]} beat {biggest_blowout["loserName"]} by {biggest_blowout["margin"]}, the biggest margin of the sim.',
                "tier": next((team["tier"] for team in all_teams if team["team"] == biggest_blowout["winnerName"]), ""),
                "importance": int(biggest_blowout["margin"]) + 70,
                "data": biggest_blowout,
            }
        )

        storylines.append(
            {
                "id": "closest-game",
                "type": "game",
                "title": "Closest Game of the Month",
                "summary": f'{closest_game["winnerName"]} edged {closest_game["loserName"]} by {closest_game["margin"]} in the tightest finish of the sim.',
                "tier": next((team["tier"] for team in all_teams if team["team"] == closest_game["winnerName"]), ""),
                "importance": max(60, 85 - int(closest_game["margin"])),
                "data": closest_game,
            }
        )

    if all_teams:
        hottest_team = max(all_teams, key=lambda item: (item["wins"], item["pointDiff"], item["avgMargin"]))
        coldest_team = min(all_teams, key=lambda item: (item["wins"], item["pointDiff"], item["avgMargin"]))

        storylines.append(
            {
                "id": "hottest-team",
                "type": "team_trend",
                "title": "Hottest Team of the Month",
                "summary": f'{hottest_team["team"]} posted the strongest month at {hottest_team["record"]} and closed on a {hottest_team["streak"]} run.',
                "tier": hottest_team["tier"],
                "importance": 88,
                "data": {
                    "team": hottest_team["team"],
                    "record": hottest_team["record"],
                    "streak": hottest_team["streak"],
                    "avgMargin": hottest_team["avgMargin"],
                    "bestWin": hottest_team["bestWin"],
                    "rosterUrl": hottest_team["rosterUrl"],
                },
            }
        )

        storylines.append(
            {
                "id": "coldest-team",
                "type": "team_trend",
                "title": "Coldest Team of the Month",
                "summary": f'{coldest_team["team"]} had the roughest month at {coldest_team["record"]} and now carries a {coldest_team["streak"]} slide.',
                "tier": coldest_team["tier"],
                "importance": 84,
                "data": {
                    "team": coldest_team["team"],
                    "record": coldest_team["record"],
                    "streak": coldest_team["streak"],
                    "avgMargin": coldest_team["avgMargin"],
                    "worstLoss": coldest_team["worstLoss"],
                    "rosterUrl": coldest_team["rosterUrl"],
                },
            }
        )

        upset_pool = []
        for result in results:
            winner = next((team for team in all_teams if team["team"] == result["winnerName"]), None)
            loser = next((team for team in all_teams if team["team"] == result["loserName"]), None)
            if not winner or not loser or winner["tier"] != loser["tier"]:
                continue
            rank_gap = winner["standingRank"] - loser["standingRank"]
            if rank_gap > 0:
                upset_pool.append((rank_gap, int(result.get("margin", 0) or 0), result))

        if upset_pool:
            _, _, upset_result = max(upset_pool, key=lambda item: (item[0], item[1]))
            storylines.append(
                {
                    "id": "upset-of-the-month",
                    "type": "game",
                    "title": "Upset of the Month",
                    "summary": f'{upset_result["winnerName"]} landed the sharpest upset of the sim by beating {upset_result["loserName"]}.',
                    "tier": next((team["tier"] for team in all_teams if team["team"] == upset_result["winnerName"]), ""),
                    "importance": 82,
                    "data": upset_result,
                }
            )

    for race in tier_race_snapshot_data.get("races", []):
        entries = race.get("entries", [])
        if len(entries) < 2:
            continue
        challenger = next((entry for entry in entries if entry.get("team") != race.get("lineTeam")), entries[1])
        storylines.append(
            {
                "id": f'{race["id"]}-watch',
                "type": "race",
                "title": f'{race["tier"]} {race["type"].title()} Watch',
                "summary": f'{race["lineTeam"]} sits on the current {race["type"]} line, with {challenger["team"]} close enough to keep the race live.',
                "tier": race["tier"],
                "importance": 78 if challenger.get("gapToLine", 0) <= 1 else 68,
                "data": race,
            }
        )

    storylines.sort(key=lambda item: item.get("importance", 0), reverse=True)
    by_tier = defaultdict(list)
    for storyline in storylines:
        if storyline.get("tier"):
            by_tier[storyline["tier"]].append(storyline["id"])

    return {
        "source": [
            "monthly/latest_sim_results.json",
            "monthly/monthly_team_form.json",
            "monthly/tier_race_snapshot.json",
        ],
        "featured": [item["id"] for item in storylines[:5]],
        "byTier": dict(by_tier),
        "storylines": storylines,
    }


def main():
    os.makedirs(MONTHLY_DIR, exist_ok=True)

    standings_data = load_json(STANDINGS_PATH)
    game_results_data = load_json(GAME_RESULTS_PATH)
    overall_games = filter_preseason_when_regular_exists(game_results_data.get("results", []))
    overall_game_results_data = {
        **game_results_data,
        "results": overall_games,
    }

    overall_team_form = build_team_form(
        standings_data,
        overall_game_results_data,
        ["standings.json", "game_results.json"],
    )
    atomic_dump_json(OVERALL_TEAM_FORM_PATH, overall_team_form, indent=4)

    latest_sim_results = build_latest_sim_results(game_results_data)
    atomic_dump_json(LATEST_SIM_RESULTS_PATH, latest_sim_results, indent=4)

    monthly_team_form = build_team_form(
        standings_data,
        latest_sim_results,
        ["standings.json", "monthly/latest_sim_results.json"],
    )
    atomic_dump_json(MONTHLY_TEAM_FORM_PATH, monthly_team_form, indent=4)

    tier_race_snapshot = build_tier_race_snapshot(monthly_team_form)
    atomic_dump_json(TIER_RACE_SNAPSHOT_PATH, tier_race_snapshot, indent=4)

    monthly_storylines = build_monthly_storylines(monthly_team_form, latest_sim_results, tier_race_snapshot)
    atomic_dump_json(MONTHLY_STORYLINES_PATH, monthly_storylines, indent=4)

    overall_team_count = sum(len(teams) for teams in overall_team_form.get("tiers", {}).values())
    monthly_team_count = sum(len(teams) for teams in monthly_team_form.get("tiers", {}).values())
    latest_result_count = len(latest_sim_results.get("results", []))
    print(f"Final count: {overall_team_count} overall team form entries saved to {OVERALL_TEAM_FORM_PATH}")
    print(f"Final count: {latest_result_count} latest sim results saved to {LATEST_SIM_RESULTS_PATH}")
    print(f"Final count: {monthly_team_count} team monthly form entries saved to {MONTHLY_TEAM_FORM_PATH}")
    print(f"Final count: {len(tier_race_snapshot.get('races', []))} tier race snapshots saved to {TIER_RACE_SNAPSHOT_PATH}")
    print(f"Final count: {len(monthly_storylines.get('storylines', []))} monthly storylines saved to {MONTHLY_STORYLINES_PATH}")


if __name__ == "__main__":
    main()
