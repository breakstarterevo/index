import json
import os
import re

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
MONTHLY_DIR = os.path.join(DATABASE_DIR, "monthly")
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
PROMPTS_DIR = os.path.join(PROJECT_ROOT, "00-eslmedia", "content", "prompts")
OUTPUT_PATH = os.path.join(PROMPTS_DIR, "monthly_editorial_package.json")
ARTICLES_DIR = os.path.join(PROJECT_ROOT, "00-eslmedia", "content", "articles")

LATEST_SIM_RESULTS_PATH = os.path.join(MONTHLY_DIR, "latest_sim_results.json")
MONTHLY_TEAM_FORM_PATH = os.path.join(MONTHLY_DIR, "monthly_team_form.json")
OVERALL_TEAM_FORM_PATH = os.path.join(MONTHLY_DIR, "overall_team_form.json")
TIER_RACE_SNAPSHOT_PATH = os.path.join(MONTHLY_DIR, "tier_race_snapshot.json")
MONTHLY_STORYLINES_PATH = os.path.join(MONTHLY_DIR, "monthly_storylines.json")
TEAMS_PATH = os.path.join(DATABASE_DIR, "teams.json")
PLAYERS_PATH = os.path.join(DATABASE_DIR, "players.json")
PLAYER_STATS_PATH = os.path.join(DATABASE_DIR, "player_stats.json")
LEADERS_PATH = os.path.join(DATABASE_DIR, "leaders.json")
AWARDS_PATH = os.path.join(DATABASE_DIR, "awards.json")

TIER_ORDER = ["Tier 1", "Tier 2", "Tier 3"]
LEAGUE_TO_TIER = {
    "CLB": "Tier 1",
    "ELB": "Tier 2",
    "ECL": "Tier 3",
}
POWER_RANKING_SERIES = {
    "Tier 1": "clb_power_rankings",
    "Tier 2": "elb_power_rankings",
    "Tier 3": "ecl_power_rankings",
}
GAME_RESULTS_CONTEXT = "../../00-build/database/game_results.json"
ARTICLE_STYLE_REFERENCES = {
    "power_rankings": [
        {
            "url": "https://www.nba.com/news/category/power-rankings",
            "useFor": "Power Rankings",
            "notes": (
                "Use NBA.com Power Rankings as the clean movement model: current rank, recent form, "
                "why the team moved or stayed, and one forward-looking pressure point."
            ),
        },
        {
            "url": "https://www.theringer.com/2026/03/17/nba/nba-power-rankings-2026-playoffs-contenders-bugonia",
            "useFor": "Power Rankings",
            "notes": (
                "Use The Ringer-style ranking voice for sharper tier logic, belief/doubt framing, "
                "and personality without turning the piece into jokes."
            ),
        },
        {
            "url": "https://www.espn.com/nba/story/_/id/48687450/nba-playoffs-2026-conference-semifinals-rankings-knicks-76ers-spurs-wolves-thunder-lakers-pistons-cavs",
            "useFor": "Power Rankings",
            "notes": (
                "Use a playoff ranking-style structure: make each ranked team earn its spot with current form, "
                "matchup/context stakes, reasons for belief, reasons for doubt, and what could change next."
            ),
        },
    ],
    "mvp_race": [
        {
            "url": "https://www.nba.com/news/kia-mvp-ladder-feb-27-2026",
            "useFor": "MVP Race",
            "notes": (
                "Use an MVP Ladder-style structure: stage the stakes before the ballot, include a stat-to-know "
                "or deciding-factor paragraph, then give each candidate a ranked case with stats, context, "
                "movement, caveats, and a short next group."
            ),
        },
        {
            "url": "https://www.nba.com/news/kia-rookie-ladder-feb-4-2026",
            "useFor": "MVP Race",
            "notes": (
                "Use Rookie Ladder-style movement logic: explain why a race changed this month, who surged, "
                "who slipped, and which evidence matters most."
            ),
        },
        {
            "url": "https://sports.yahoo.com/nba/article/the-assassin-vs-the-alien-my-2026-nba-mvp-vote-141617400.html",
            "useFor": "MVP Race",
            "notes": (
                "Use ballot-essay depth when the race is close: define what value means, compare competing "
                "cases directly, and make the final order feel argued instead of sorted."
            ),
        },
    ],
    "race_watch": [
        {
            "url": "https://www.premierleague.com/en/news/4609609/premier-league-relegation-battle-how-it-stands-and-remaining-fixtures",
            "useFor": "Promotion / Relegation Watch",
            "notes": (
                "Use the Premier League race explainer model: state the rules and line first, then sort teams "
                "by safe, sweating, in trouble, chasing, and no-longer-in-control."
            ),
        },
        {
            "url": "https://www.espn.com/nba/story/_/id/48083437/nba-2025-26-postseason-tracker-clinched-playoff-play-spots",
            "useFor": "Promotion / Relegation Watch",
            "notes": (
                "Use tracker-style clarity for who currently owns each slot, who is closest, and what outcome "
                "would change the race next."
            ),
        },
        {
            "url": "https://www.espn.com/nba/story/_/id/48387069/what-watch-biggest-question-last-week-2025-2026-nba-regular-season-playoffs-postseason-standings",
            "useFor": "Promotion / Relegation Watch",
            "notes": (
                "Use final-week question framing for stakes: what each team needs, what they can control, "
                "and which weakness could decide the race."
            ),
        },
    ],
    "stock_report": [
        {
            "url": "https://www.theringer.com/2026/04/13/nba/nba-final-day-winners-losers-playoff-picture-bracket-matchups",
            "useFor": "Stock Up / Stock Down",
            "notes": (
                "Use winners/losers structure: verdict first, evidence second, consequence third. "
                "Each stock call should explain what changed and why it matters."
            ),
        },
        {
            "url": "https://www.theringer.com/2026/02/05/nba/nba-trade-deadline-2026-giannis-antetokounmpo-rumors",
            "useFor": "Stock Up / Stock Down",
            "notes": (
                "Use trade-deadline winners/losers energy for sharper judgments and memorable section leads, "
                "while keeping each take tied to concrete results."
            ),
        },
    ],
    "month_in_review": [
        {
            "url": "https://www.espn.com/nba/story/_/id/48506452/2026-nba-playoffs-western-conference-round-one-takeaways",
            "useFor": "Month in Review",
            "notes": (
                "Use takeaways structure: do not recap every result; identify the three to five things the "
                "month changed and explain what they mean next."
            ),
        },
        {
            "url": "https://www.theringer.com/2026/04/13/nba/nba-final-day-winners-losers-playoff-picture-bracket-matchups",
            "useFor": "Month in Review",
            "notes": (
                "Use winners/losers voice to add editorial bite when the month clearly helped or hurt a team, "
                "player, or race."
            ),
        },
        {
            "url": "https://www.nba.com/news/category/power-rankings",
            "useFor": "Month in Review",
            "notes": (
                "Use ranking-recency logic to connect week-to-week movement, form, and changing expectations."
            ),
        },
    ],
}


def style_references(article_type):
    return ARTICLE_STYLE_REFERENCES.get(article_type, [])


def load_json(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def is_preseason_game(game):
    return str(game.get("sectionSlug") or game.get("section") or "").strip().casefold() == "preseason"


def is_preseason_package(latest_sim_results):
    results = latest_sim_results.get("results", [])
    return bool(results) and all(is_preseason_game(game) for game in results)


def context_sources(paths, include_preseason):
    if include_preseason:
        return paths
    return [path for path in paths if path != GAME_RESULTS_CONTEXT]


def find_latest_power_ranking_article(tier_name):
    series = POWER_RANKING_SERIES.get(tier_name, "")
    if not series or not os.path.isdir(ARTICLES_DIR):
        return ""

    pattern = re.compile(rf"^{re.escape(series)}_(\d+)_(\d+)\.html$", re.IGNORECASE)
    matches = []
    for filename in os.listdir(ARTICLES_DIR):
        match = pattern.match(filename)
        if not match:
            continue
        matches.append((int(match.group(1)), int(match.group(2)), filename))

    if not matches:
        return ""

    _, _, filename = max(matches, key=lambda item: (item[0], item[1]))
    return f"../articles/{filename}"


def build_team_star_lookup(teams):
    return {
        team.get("name", ""): team.get("starPlayer")
        for team in teams
        if team.get("name") and team.get("starPlayer")
    }


def compact_team_stars(team_star_lookup):
    return [
        {
            "team": team,
            "starPlayer": star_player,
        }
        for team, star_player in sorted(team_star_lookup.items())
    ]


def build_player_lookup(players):
    lookup = {}
    for player in players:
        name = player.get("name", "")
        if not name:
            continue
        lookup[name] = {
            "name": name,
            "team": player.get("team", ""),
            "teamName": player.get("teamName", ""),
            "pos": player.get("pos", ""),
            "overall": player.get("overall", ""),
            "potential": player.get("potential", ""),
            "url": player.get("url", ""),
        }
    return lookup


def season_average_row(player_stat):
    rows = player_stat.get("stats", {}).get("season_averages", {}).get("rows", [])
    return next((row for row in rows if str(row.get("season")) != "Career" and row.get("g")), None)


def efficiency_row(player_stat):
    rows = player_stat.get("stats", {}).get("efficiency", {}).get("rows", [])
    return next((row for row in rows if str(row.get("season")) != "Career"), None)


def collect_leader_names(leaders_data):
    names = set()
    priority_categories = {"Points", "Rebounds", "Assists", "Blocks", "Steals", "Efficiency"}
    for section in leaders_data.get("sections", []):
        for category in section.get("categories", []):
            if category.get("title") not in priority_categories:
                continue
            for leader in category.get("leaders", [])[:5]:
                if leader.get("player"):
                    names.add(leader["player"])
    return names


def collect_award_names(awards_data):
    names = set()
    for section in awards_data.get("sections", []):
        for category in section.get("categories", []):
            for award in category.get("awards", []):
                if award.get("player"):
                    names.add(award["player"])
    return names


def tier_games_played_floor(overall_team_form):
    floors = {}
    for tier_name, teams in overall_team_form.get("tiers", {}).items():
        max_games = max((int(team.get("games", 0) or 0) for team in teams), default=0)
        floors[tier_name] = max(1, int(max_games * 0.6 + 0.999)) if max_games else 1
    return floors


def build_mvp_candidates(player_stats_data, players, leaders_data, awards_data, overall_team_form):
    player_lookup = build_player_lookup(players)
    leader_names = collect_leader_names(leaders_data)
    award_names = collect_award_names(awards_data)
    games_floor_by_tier = tier_games_played_floor(overall_team_form)
    candidates_by_tier = {tier: [] for tier in TIER_ORDER}

    for player_stat in player_stats_data.get("players", []):
        averages = season_average_row(player_stat)
        if not averages or not averages.get("g"):
            continue

        tier_name = LEAGUE_TO_TIER.get(str(averages.get("lge", "")).upper())
        if not tier_name:
            continue
        games = int(averages.get("g", 0) or 0)
        if games < games_floor_by_tier.get(tier_name, 1):
            continue

        efficiency = efficiency_row(player_stat) or {}
        name = player_stat.get("name", "")
        profile = player_lookup.get(name, {})
        pts = float(averages.get("pts", 0) or 0)
        reb = float(averages.get("orb", 0) or 0) + float(averages.get("drb", 0) or 0)
        ast = float(averages.get("ast", 0) or 0)
        stl = float(averages.get("stl", 0) or 0)
        blk = float(averages.get("blk", 0) or 0)
        per = float(efficiency.get("per", 0) or 0)
        ewa = float(efficiency.get("ewa", 0) or 0)
        score = (
            pts
            + reb * 0.7
            + ast * 0.7
            + stl * 1.5
            + blk * 1.5
            + per * 0.25
            + ewa * 2
            + (8 if name in award_names else 0)
            + (4 if name in leader_names else 0)
        )

        if score <= 0:
            continue

        candidates_by_tier[tier_name].append(
            {
                "name": name,
                "team": profile.get("team") or player_stat.get("team", ""),
                "teamName": profile.get("teamName") or player_stat.get("teamLabel", ""),
                "pos": profile.get("pos") or player_stat.get("pos", ""),
                "url": profile.get("url") or player_stat.get("url", ""),
                "overall": profile.get("overall", ""),
                "season": {
                    "games": games,
                    "minutes": averages.get("min"),
                    "points": pts,
                    "rebounds": round(reb, 1),
                    "assists": ast,
                    "steals": stl,
                    "blocks": blk,
                    "fgPct": averages.get("fg_pct"),
                    "ftPct": averages.get("ft_pct"),
                    "threePct": averages.get("3p_pct"),
                },
                "efficiency": {
                    "per": efficiency.get("per", ""),
                    "ewa": efficiency.get("ewa", ""),
                    "plusMinus": efficiency.get("plus_minus", ""),
                    "tsPct": efficiency.get("ts_pct", ""),
                    "usage": efficiency.get("usg", ""),
                },
                "awardWinner": name in award_names,
                "leaderboardPresence": name in leader_names,
                "candidateScore": round(score, 2),
            }
        )

    return {
        tier_name: sorted(candidates, key=lambda player: player["candidateScore"], reverse=True)[:8]
        for tier_name, candidates in candidates_by_tier.items()
    }


def build_power_rankings(overall_team_form, monthly_team_form, period_label, team_star_lookup, include_preseason):
    prompts = []
    overall_tiers = overall_team_form.get("tiers", {})
    monthly_tiers = monthly_team_form.get("tiers", {})

    for tier_name in TIER_ORDER:
        overall_teams = list(overall_tiers.get(tier_name, []))
        monthly_lookup = {
            team["team"]: team
            for team in monthly_tiers.get(tier_name, [])
        }
        prompts.append(
            {
                "id": f'{tier_name.lower().replace(" ", "-")}-power-rankings',
                "type": "power_rankings",
                "tier": tier_name,
                "title": f"{tier_name} Power Rankings",
                "period": period_label,
                "previousArticle": find_latest_power_ranking_article(tier_name),
                "prompt": (
                    f"Write a {tier_name} power rankings article for {period_label}. Rank the teams yourself "
                    "using the context below. Use overall season-to-date performance as the base ranking logic, "
                    "and use the latest sim performance to explain changes, jumps, or drops from the previous board. "
                    "Explicitly note each team's movement from the last published power rankings article, including "
                    "how many spots they moved up or down or if they stayed level. Make the movement visible in each "
                    "team capsule, not just the intro. You are allowed to pull extra "
                    "context from any of the linked JSON sources if it strengthens the board. When it fits the "
                    "article, mention the listed star players as roster context; starPlayer is the highest OVR "
                    "player on that team's current roster. Use the style references to add substance: open with "
                    "a clear ranking thesis, then make each team earn its spot with current form, evidence, "
                    "belief, doubt, and what could change next. Give a little player reference where necessary, "
                    "especially when a star, scorer, defender, or depth piece explains why the team's results "
                    "are sustainable, misleading, or changing."
                ),
                "writerNotes": [
                    "Treat power rankings as a trust board, not a standings table: who would you trust most if the league kept playing like this right now?",
                    "Open the article with the ranking lens: full-season profile first, latest sim/month form second, and tier stakes third.",
                    "Use the team pool as context, not as a locked final order.",
                    "Base the ranking on overall form, not just one sim.",
                    "Use the latest sim to justify movement, momentum, and skepticism.",
                    "Reference rank movement from the previous published board for every team, with an explicit up/down/no-change note and the number of places moved.",
                    "Each team capsule should make the reason for the rank, the strongest doubt, and the next pressure point clear in natural prose rather than a repeated field template.",
                    "Use the permanent article shell and ranking-card format from the article README when turning this prompt into HTML.",
                    "Do not publish power rankings as one-line list items; each team needs a compact meta line and a real argument, but vary capsule length, rhythm, and analytical lens.",
                    "Do not use the same Reason / Concern / Next trigger mini-field grid for every team. If mini-fields are useful, limit that exact structure to three consecutive entries before changing the presentation.",
                    "Include a board notes block after the rankings with labels such as Control Team, Biggest Riser, Trust Problem, Danger Team, and Panic Team.",
                    "Use tier-specific stakes: Tier 1 credibility/survival, Tier 2 promotion/relegation pressure, and Tier 3 one-promotion urgency.",
                    "Work in star-player mentions for the biggest teams, risers, fallers, or arguments where roster quality matters.",
                    "Add player context only when it sharpens the team argument: who drives the offense, who covers a weakness, who is missing, or whose form changes the outlook.",
                    "Call out at least one riser, one faller, and one team you are still unsure about.",
                    "Follow the ESPN-style ranking model: current form, stakes, reasons for belief, reasons for doubt, and the next change trigger.",
                    "Each team capsule should include at least one concrete stat/result and one interpretive judgment.",
                ],
                "styleReferences": style_references("power_rankings"),
                "availableContext": context_sources([
                    "../../00-build/database/monthly/overall_team_form.json",
                    "../../00-build/database/monthly/monthly_team_form.json",
                    "../../00-build/database/monthly/latest_sim_results.json",
                    "../../00-build/database/monthly/tier_race_snapshot.json",
                    "../../00-build/database/monthly/monthly_storylines.json",
                    "../../00-build/database/standings.json",
                    GAME_RESULTS_CONTEXT,
                    "../../00-build/database/teams.json",
                    "../../00-build/database/players.json",
                    "../../00-build/database/player_stats.json",
                ], include_preseason),
                "teamPool": [
                    {
                        "team": team["team"],
                        "overall": {
                            "record": team["record"],
                            "streak": team["streak"],
                            "last3": team["last3"],
                            "avgMargin": team["avgMargin"],
                            "pointDiff": team["pointDiff"],
                            "bestWin": team["bestWin"],
                            "worstLoss": team["worstLoss"],
                            "closeGameCount": team["closeGameCount"],
                        },
                        "latestSim": {
                            "record": monthly_lookup.get(team["team"], {}).get("record", "0-0"),
                            "streak": monthly_lookup.get(team["team"], {}).get("streak", "-"),
                            "last3": monthly_lookup.get(team["team"], {}).get("last3", "-"),
                            "avgMargin": monthly_lookup.get(team["team"], {}).get("avgMargin", 0.0),
                            "pointDiff": monthly_lookup.get(team["team"], {}).get("pointDiff", 0),
                            "bestWin": monthly_lookup.get(team["team"], {}).get("bestWin"),
                            "worstLoss": monthly_lookup.get(team["team"], {}).get("worstLoss"),
                            "closeGameCount": monthly_lookup.get(team["team"], {}).get("closeGameCount", 0),
                        },
                        "rosterUrl": team["rosterUrl"],
                        "starPlayer": team_star_lookup.get(team["team"]),
                    }
                    for team in overall_teams
                ],
            }
        )

    return prompts


def build_race_watch(tier_race_snapshot, period_label, include_preseason):
    return {
        "id": "promotion-relegation-watch",
        "type": "race_watch",
        "title": "Promotion / Relegation Watch",
        "period": period_label,
        "prompt": (
            f"Write a promotion/relegation watch article for {period_label}. Cover Tier 1 relegation, "
            "Tier 2 promotion and relegation, and Tier 3 promotion. Use standings.json as the source of truth "
            "for the actual promotion/relegation line, team rank, record, games back, and whether a team is "
            "materially close enough to be in the race. Use the monthly race snapshot and monthly form only as "
            "momentum context after the real standings line is established. Use the style references to make "
            "the race easy to follow: state the rules, define the line, identify who controls their fate, and explain what changes next. "
            "Treat seeding as secondary to games-behind pressure: do not frame teams as truly in danger or truly "
            "live for promotion/relegation if they are only technically adjacent in seed but materially far from the line."
        ),
        "writerNotes": [
            "Tier 1 has 2 relegation spots.",
            "Tier 2 has 2 promotion spots and 1 relegation spot.",
            "Tier 3 has 1 promotion spot.",
            "Source-of-truth rule: standings.json decides the actual line, records, rank order, games back, and true race status.",
            "Do not use monthly_team_form.json or tier_race_snapshot.json to define who is on the promotion/relegation line.",
            "Monthly form can make a team a stock-up or pressure team, but it does not make them live for promotion if standings games-back says they are far away.",
            "If monthly form and standings conflict, explicitly trust standings and mention the monthly form only as context.",
            "Explain the pressure line clearly before making bigger editorial claims.",
            "Use games-behind logic, not seed alone, to decide whether a team is truly live, merely sweating, or only technical fringe.",
            "If a team is close in seed but materially far from the line, label it as fringe or outside the real pressure group rather than forcing it into the danger tier.",
            "Group teams by race status where useful: safe, sweating, chasing, in trouble, or no longer in control.",
            "Each race section should include the current line team, nearest chasers, momentum, and one concrete next pressure point.",
        ],
        "styleReferences": style_references("race_watch"),
        "availableContext": context_sources([
            "../../00-build/database/monthly/tier_race_snapshot.json",
            "../../00-build/database/monthly/monthly_team_form.json",
            "../../00-build/database/monthly/overall_team_form.json",
            "../../00-build/database/monthly/latest_sim_results.json",
            "../../00-build/database/standings.json",
            GAME_RESULTS_CONTEXT,
        ], include_preseason),
        "standingsSourceOfTruth": "../../00-build/database/standings.json",
        "monthlyFormRaceContext": tier_race_snapshot.get("races", []),
        "races": tier_race_snapshot.get("races", []),
    }


def build_stock_report(monthly_team_form, period_label, include_preseason):
    teams = [team for tier in monthly_team_form.get("tiers", {}).values() for team in tier]
    ordered_up = sorted(
        teams,
        key=lambda team: (team["wins"], team["pointDiff"], team["avgMargin"]),
        reverse=True,
    )
    ordered_down = sorted(
        teams,
        key=lambda team: (team["wins"], team["pointDiff"], team["avgMargin"]),
    )

    stock_up = ordered_up[:3]
    stock_down = ordered_down[:3]

    return {
        "id": "stock-up-stock-down",
        "type": "stock_report",
        "title": "Stock Up / Stock Down",
        "period": period_label,
        "prompt": (
            f"Write a Stock Up / Stock Down piece for {period_label}. Pick exactly three teams up and "
            "three teams down from the latest sim and explain the change in plain language. You can pull "
            "supporting detail from any linked JSON source if a team's monthly record alone is too thin. "
            "Use the style references for verdict-first sections: what changed, why it matters, and what "
            "happens if it continues."
        ),
        "writerNotes": [
            "Do not just sort by record; explain why the shape of the month matters.",
            "A close 1-0 month can be less convincing than a dominant 1-0 month.",
            "Use concise, punchy sections rather than one long essay.",
            "Each stock call needs a trigger, evidence, and consequence.",
            "Use player context when a star explains the rise or fall, but keep the verdict on the team.",
        ],
        "styleReferences": style_references("stock_report"),
        "availableContext": context_sources([
            "../../00-build/database/monthly/monthly_team_form.json",
            "../../00-build/database/monthly/overall_team_form.json",
            "../../00-build/database/monthly/monthly_storylines.json",
            "../../00-build/database/monthly/latest_sim_results.json",
            "../../00-build/database/standings.json",
            GAME_RESULTS_CONTEXT,
        ], include_preseason),
        "stockUpPool": stock_up,
        "stockDownPool": stock_down,
    }


def build_month_in_review(monthly_storylines, latest_sim_results, period_label, team_star_lookup, include_preseason):
    storyline_lookup = {item["id"]: item for item in monthly_storylines.get("storylines", [])}
    featured_ids = monthly_storylines.get("featured", [])
    featured = [storyline_lookup[item_id] for item_id in featured_ids if item_id in storyline_lookup]

    return {
        "id": "month-in-review",
        "type": "month_in_review",
        "title": "Month in Review",
        "period": period_label,
        "prompt": (
            f"Write a Month in Review feature for {period_label}. Use the featured storylines below to build "
            "a coherent recap of the sim: best performances, biggest swings, weirdest result, and what matters next. "
            "You can pull from any linked JSON source if the strongest story sits outside the featured shortlist. "
            "Use star-player context when it helps explain a result, a hot team, or why a matchup mattered. "
            "If you discuss promotion, relegation, race lines, or who is truly live in a race, use standings.json "
            "as the source of truth and use monthly form only as context. "
            "Use the style references to write takeaways, not a logbook: focus on what the month changed."
        ),
        "writerNotes": [
            "Lead with the strongest monthly theme, not just the biggest scoreline.",
            "Work across tiers if the month demands it.",
            "Mention star players naturally, not as a checklist.",
            "End with a forward-looking note about next month.",
            "Organize around three to five takeaways or winners/losers rather than every game in order.",
            "Every section should connect a result or stat to a larger implication.",
            "For race implications, standings.json decides the actual promotion/relegation line and games-back pressure.",
            "A hot month can make a team stock-up or worth watching, but do not call them a promotion/relegation race team if the full standings say they are materially far away.",
        ],
        "styleReferences": style_references("month_in_review"),
        "availableContext": context_sources([
            "../../00-build/database/monthly/monthly_storylines.json",
            "../../00-build/database/monthly/monthly_team_form.json",
            "../../00-build/database/monthly/overall_team_form.json",
            "../../00-build/database/monthly/tier_race_snapshot.json",
            "../../00-build/database/monthly/latest_sim_results.json",
            "../../00-build/database/standings.json",
            GAME_RESULTS_CONTEXT,
            "../../00-build/database/teams.json",
            "../../00-build/database/players.json",
            "../../00-build/database/freeagents.json",
        ], include_preseason),
        "featuredStorylines": featured,
        "teamStarPlayers": compact_team_stars(team_star_lookup),
        "latestSimGameCount": len(latest_sim_results.get("results", [])),
    }


def build_mvp_race(player_stats_data, players, leaders_data, awards_data, overall_team_form, period_label):
    candidates = build_mvp_candidates(player_stats_data, players, leaders_data, awards_data, overall_team_form)
    games_floor_by_tier = tier_games_played_floor(overall_team_form)

    return {
        "id": "mvp-race",
        "type": "mvp_race",
        "title": "MVP Race",
        "period": period_label,
        "prompt": (
            f"Write an MVP race article for {period_label}. Build separate ranked MVP ballots for Tier 1, "
            "Tier 2, and Tier 3. Include at least five candidates in each tier. Use the tier candidate pools "
            "as a starting point, but do not treat the generated order as final if the stats, awards, and "
            "leaderboard context point to a better argument. Use player stats as the base, awards as evidence "
            "of recent peaks, and leaders as supporting context for category dominance. Balance raw production, "
            "efficiency, team context, availability, and recent award momentum. Use the style references to "
            "build a more layered race: lead with the state of the ballot, include a stat-to-know or deciding "
            "factor, then give every candidate a case, caveat, and path to move up."
        ),
        "writerNotes": [
            "Rank at least five MVP candidates for each tier: Tier 1, Tier 2, and Tier 3.",
            "Use player_stats.json for the main statistical case.",
            "Use awards.json to identify recent Player of the Week/Month signals.",
            "Use leaders.json to call out category dominance, but do not make the piece a leaderboard recap.",
            "Only consider candidates who have played at least 60% of their tier's team games.",
            "Mention the biggest riser, the strongest statistical case, and one player whose numbers need team context.",
            "Follow the NBA MVP Ladder model: establish the stakes before the list, then use statistics and context to make each candidate's rank feel argued.",
            "Each candidate capsule should include production, team context, one reason to believe, one reason to hesitate, and what could change the ballot next.",
        ],
        "styleReferences": style_references("mvp_race"),
        "availableContext": [
            "../../00-build/database/player_stats.json",
            "../../00-build/database/players.json",
            "../../00-build/database/awards.json",
            "../../00-build/database/leaders.json",
            "../../00-build/database/teams.json",
            "../../00-build/database/standings.json",
            "../../00-build/database/monthly/overall_team_form.json",
            "../../00-build/database/monthly/monthly_team_form.json",
        ],
        "candidatePoolsByTier": candidates,
        "minimumGamesPlayedByTier": games_floor_by_tier,
        "awardsSource": awards_data.get("source", ""),
        "leadersSource": leaders_data.get("source", ""),
    }


def main():
    os.makedirs(PROMPTS_DIR, exist_ok=True)

    latest_sim_results = load_json(LATEST_SIM_RESULTS_PATH)
    monthly_team_form = load_json(MONTHLY_TEAM_FORM_PATH)
    overall_team_form = load_json(OVERALL_TEAM_FORM_PATH)
    tier_race_snapshot = load_json(TIER_RACE_SNAPSHOT_PATH)
    monthly_storylines = load_json(MONTHLY_STORYLINES_PATH)
    teams = load_json(TEAMS_PATH)
    players = load_json(PLAYERS_PATH)
    player_stats = load_json(PLAYER_STATS_PATH)
    leaders = load_json(LEADERS_PATH)
    awards = load_json(AWARDS_PATH) if os.path.exists(AWARDS_PATH) else {"source": "", "sections": []}

    period = latest_sim_results.get("period") or {}
    period_label = period.get("label", "Latest Sim")
    team_star_lookup = build_team_star_lookup(teams)
    include_preseason = is_preseason_package(latest_sim_results)

    output = {
        "source": [
            "../../00-build/database/monthly/latest_sim_results.json",
            "../../00-build/database/monthly/monthly_team_form.json",
            "../../00-build/database/monthly/overall_team_form.json",
            "../../00-build/database/monthly/tier_race_snapshot.json",
            "../../00-build/database/monthly/monthly_storylines.json",
            "../../00-build/database/teams.json",
        ],
        "period": period,
        "package": {
            "powerRankings": build_power_rankings(overall_team_form, monthly_team_form, period_label, team_star_lookup, include_preseason),
            "promotionRelegationWatch": build_race_watch(tier_race_snapshot, period_label, include_preseason),
            "stockUpStockDown": build_stock_report(monthly_team_form, period_label, include_preseason),
            "monthInReview": build_month_in_review(monthly_storylines, latest_sim_results, period_label, team_star_lookup, include_preseason),
            "mvpRace": build_mvp_race(player_stats, players, leaders, awards, overall_team_form, period_label),
        },
    }

    atomic_dump_json(OUTPUT_PATH, output, indent=4)

    print(f"Final count: 1 monthly editorial package saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
