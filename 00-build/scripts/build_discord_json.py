"""
Build compact JSON feeds for Discord slash-command lookups.

These feeds are intentionally much smaller than the full site database JSON so
serverless Discord interactions can answer quickly without loading large stat
tables on every cold request.
"""

import json
import os
import sys

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
DISCORD_DIR = os.path.join(DATABASE_DIR, "discord")
SITE_BASE_URL = "https://eurosuperleague.github.io/index/"
DRY_RUN = "--dry-run" in sys.argv


def load_json(filename):
    path = os.path.join(DATABASE_DIR, filename)
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def public_url(path):
    return SITE_BASE_URL + path.lstrip("/")


def public_player_url(player_id):
    return public_url(f"00-assets/html/unified-player.htm?id={player_id}")


def public_team_url(team_id):
    return public_url(f"00-assets/html/unified-roster.htm?id={team_id}")


def roster_id_from_file(value):
    return str(value or "").replace(".htm", "").replace(".html", "")


def normalize(value):
    return " ".join(str(value or "").lower().split())


def find_season_average(player_stats_entry):
    rows = get_table_rows(player_stats_entry, "season_averages")
    if not isinstance(rows, list):
        return None
    return next((row for row in rows if row.get("season") != "Career"), rows[0] if rows else None)


def get_table_rows(player_stats_entry, key):
    return player_stats_entry.get("stats", {}).get(key, {}).get("rows", [])


def find_table_row(player_stats_entry, key):
    rows = get_table_rows(player_stats_entry, key)
    if not isinstance(rows, list):
        return None
    return next((row for row in rows if row.get("season") != "Career"), rows[0] if rows else None)


def pick(row, keys):
    if not row:
        return {}
    return {key: row.get(key) for key in keys if row.get(key) is not None}


def compact_player_stats(entry):
    season = find_table_row(entry, "season_averages")
    shooting = find_table_row(entry, "shooting_averages")
    efficiency = find_table_row(entry, "efficiency")
    highs = find_table_row(entry, "career_highs")

    return {
        "season": pick(season, [
            "season", "lge", "team", "g", "gs", "min", "pts", "orb", "drb",
            "ast", "to", "a_t", "stl", "blk", "pf", "fg_pct", "ft_pct", "3p_pct",
        ]),
        "shooting": pick(shooting, [
            "fgm", "fga", "fg_pct", "ftm", "fta", "ft_pct", "inm", "ina",
            "in_pct", "jsm", "jsa", "js_pct", "3pm", "3pa", "3p_pct",
        ]),
        "efficiency": pick(efficiency, [
            "eff", "plus_minus", "per", "ts_pct", "efg_pct", "orb_pct",
            "drb_pct", "trb_pct", "ast_pct", "to_pct", "stl_pct", "blk_pct",
            "usg_pct",
        ]),
        "careerHighs": pick(highs, ["pts", "reb", "ast", "stl", "blk", "fgm", "3pm"]),
    }


def compact_player_ratings(player):
    return {
        "offense": {
            "INS": player.get("Ins", ""),
            "JPS": player.get("Jps", ""),
            "3PS": player.get("3ps", ""),
            "HND": player.get("Hnd", ""),
            "PAS": player.get("Pas", ""),
        },
        "defense": {
            "ORB": player.get("Orb", ""),
            "DRB": player.get("Drb", ""),
            "PSD": player.get("Psd", ""),
            "PRD": player.get("Prd", ""),
            "STL": player.get("Stl", ""),
            "BLK": player.get("Blk", ""),
        },
        "physical": {
            "QKN": player.get("Qkn", ""),
            "JMP": player.get("Jmp", ""),
            "STR": player.get("Str", ""),
            "STA": player.get("Sta", ""),
        },
    }


def format_player_stat_line(row):
    if not row:
        return ""
    return (
        f"{row.get('pts', '-')} PTS, {row.get('drb', '-')} DRB, "
        f"{row.get('ast', '-')} AST, {row.get('stl', '-')} STL, "
        f"{row.get('blk', '-')} BLK in {row.get('min', '-')} MIN"
    )


def flatten_standings(standings):
    rows = []
    for section in standings.get("sections", []):
        for team in section.get("teams", []):
            rows.append({**team, "sectionTitle": section.get("title", "Standings")})
    return rows


def flatten_schedule(schedule):
    games = []
    for section in schedule.get("sections", []):
        for day in section.get("days", []):
            for game in day.get("games", []):
                games.append({**game, "date": day.get("date", ""), "sectionTitle": section.get("title", "")})
    return games


def find_recent_game(games, team_id, team_name):
    matches = [
        game for game in games
        if game.get("status") == "completed" and game_includes_team(game, team_id, team_name)
    ]
    return compact_game(matches[-1]) if matches else None


def find_next_game(games, team_id, team_name):
    for game in games:
        if game.get("status") != "completed" and game_includes_team(game, team_id, team_name):
            return compact_game(game)
    return None


def game_includes_team(game, team_id, team_name):
    return (
        game.get("homeTeam") == team_id
        or game.get("awayTeam") == team_id
        or normalize(game.get("homeTeamName")) == normalize(team_name)
        or normalize(game.get("awayTeamName")) == normalize(team_name)
    )


def compact_game(game):
    return {
        "date": game.get("date", ""),
        "text": game.get("matchupText") or format_game(game),
        "boxscoreFile": game.get("boxscoreFile", ""),
    }


def format_game(game):
    away = game.get("awayTeamName", "Away")
    home = game.get("homeTeamName", "Home")
    if game.get("awayScore") is not None and game.get("homeScore") is not None:
        return f"{away} {game.get('awayScore')}, @{home} {game.get('homeScore')}"
    return f"{game.get('date', '')} {away} @ {home}".strip()


def find_cap_entry(capreport, team_name, roster_file):
    for section in capreport.get("sections", []):
        for entry in section.get("entries", []):
            if normalize(entry.get("team")) == normalize(team_name) or entry.get("rosterFile") == roster_file:
                return entry
    return None


def find_injuries(injuries, team_id, team_name):
    rows = injuries.get("injuries", [])
    return [
        {
            "name": injury.get("name", "Player"),
            "pos": injury.get("pos", ""),
            "injury": injury.get("injury", "Injured"),
            "length": injury.get("length", ""),
        }
        for injury in rows
        if injury.get("team") == team_id or normalize(injury.get("teamName")) == normalize(team_name)
    ][:3]


def top_team_strengths(team_stats_entry):
    stats = team_stats_entry.get("stats", {}) if team_stats_entry else {}
    strengths = []
    for entry in stats.values():
        rank = entry.get("team", {}).get("totalRank")
        if isinstance(rank, int) and rank <= 5:
            strengths.append({
                "label": entry.get("label", ""),
                "value": entry.get("team", {}).get("value"),
                "rank": rank,
            })
    return sorted(strengths, key=lambda entry: entry["rank"])[:4]


def build_players():
    players = load_json("players.json")
    player_stats = load_json("player_stats.json").get("players", [])
    stats_by_id = {entry.get("playerId"): entry for entry in player_stats}
    compact_players = []

    for player in players:
        player_id = player.get("playerId", "")
        stats_entry = stats_by_id.get(player_id, {})
        compact_stats = compact_player_stats(stats_entry)
        season_row = find_season_average(stats_entry)
        compact_players.append({
            "id": player_id,
            "name": player.get("name", ""),
            "teamId": player.get("team", ""),
            "team": player.get("teamLabel", "Free Agent"),
            "pos": player.get("pos", ""),
            "age": player.get("age", ""),
            "height": player.get("ht", ""),
            "weight": player.get("wt", ""),
            "overall": player.get("overall", ""),
            "potential": player.get("potential", ""),
            "salary": player.get("currentSalaryText", ""),
            "statLine": format_player_stat_line(season_row),
            "stats": compact_stats,
            "ratings": compact_player_ratings(player),
            "url": public_player_url(player_id) if player_id else "",
        })

    return compact_players


def build_player_stats():
    player_stats = load_json("player_stats.json").get("players", [])
    compact_stats = []

    for entry in player_stats:
        player_id = entry.get("playerId", "")
        stats = compact_player_stats(entry)
        compact_stats.append({
            "id": player_id,
            "name": entry.get("name", ""),
            "teamId": entry.get("team", ""),
            "team": entry.get("teamLabel", ""),
            "pos": entry.get("pos", ""),
            "statLine": format_player_stat_line(stats.get("season")),
            **stats,
            "url": public_player_url(player_id) if player_id else "",
        })

    return compact_stats


def build_teams():
    teams = load_json("teams.json")
    standings = load_json("standings.json")
    team_stats = load_json("team_stats.json").get("teams", [])
    capreport = load_json("capreport.json")
    injuries = load_json("injuries.json")
    schedule = load_json("schedule.json")

    standings_rows = flatten_standings(standings)
    games = flatten_schedule(schedule)
    stats_by_id = {entry.get("teamId"): entry for entry in team_stats}
    compact_teams = []

    for team in teams:
        team_id = team.get("id", "")
        roster_file = team.get("file", "")
        standing = next((
            row for row in standings_rows
            if row.get("rosterFile") == roster_file or roster_id_from_file(row.get("rosterFile")) == team_id
        ), {})
        cap = find_cap_entry(capreport, team.get("name", ""), roster_file) or {}

        compact_teams.append({
            "id": team_id,
            "name": team.get("name", ""),
            "record": {
                "wins": standing.get("wins"),
                "losses": standing.get("losses"),
                "pct": standing.get("pct"),
            },
            "section": standing.get("sectionTitle", ""),
            "pf": standing.get("pf"),
            "pa": standing.get("pa"),
            "diff": standing.get("diff"),
            "streak": standing.get("streak", ""),
            "last10": standing.get("last10", ""),
            "starPlayer": team.get("starPlayer"),
            "cap": {
                "salary": cap.get("salaryText", ""),
                "room": cap.get("capRoomText", ""),
            },
            "strengths": top_team_strengths(stats_by_id.get(team_id, {})),
            "injuries": find_injuries(injuries, team_id, team.get("name", "")),
            "recentGame": find_recent_game(games, team_id, team.get("name", "")),
            "nextGame": find_next_game(games, team_id, team.get("name", "")),
            "url": public_team_url(team_id) if team_id else "",
        })

    return compact_teams


def build_league():
    standings = load_json("standings.json")
    leaders = load_json("leaders.json")

    return {
        "name": "European Super League",
        "url": public_url("index.htm"),
        "sections": [
            {
                "title": section.get("title", "Standings"),
                "teams": [
                    {
                        "name": team.get("team", ""),
                        "wins": team.get("wins"),
                        "losses": team.get("losses"),
                        "streak": team.get("streak", ""),
                    }
                    for team in section.get("teams", [])[:3]
                ],
            }
            for section in standings.get("sections", [])[:4]
        ],
        "leaders": [
            {
                "category": category.get("title", ""),
                "player": category.get("leaders", [{}])[0].get("player", ""),
                "team": category.get("leaders", [{}])[0].get("teamName", ""),
                "value": category.get("leaders", [{}])[0].get("valueText", category.get("leaders", [{}])[0].get("value", "")),
            }
            for section in leaders.get("sections", [])
            for category in section.get("categories", [])
            if category.get("leaders")
        ][:5],
    }


def write_json(filename, payload):
    path = os.path.join(DISCORD_DIR, filename)
    if DRY_RUN:
        print(f"[dry-run] Would write {path} ({len(json.dumps(payload, separators=(',', ':')))} bytes)")
        return
    os.makedirs(DISCORD_DIR, exist_ok=True)
    atomic_dump_json(path, payload, indent=2)
    print(f"Wrote {path}")


def main():
    write_json("players.json", build_players())
    write_json("player_stats.json", build_player_stats())
    write_json("teams.json", build_teams())
    write_json("league.json", build_league())


if __name__ == "__main__":
    main()
