import argparse
import datetime as dt
import html
import json
import os
import re

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
PROMPTS_DIR = os.path.join(PROJECT_ROOT, "00-eslmedia", "content", "prompts")
OUTPUT_PATH = os.path.join(PROMPTS_DIR, "offseason_editorial_package.json")

INDEX_PATH = os.path.join(PROJECT_ROOT, "index.htm")
PLAYERS_PATH = os.path.join(DATABASE_DIR, "players.json")
FREE_AGENTS_PATH = os.path.join(DATABASE_DIR, "freeagents.json")
CAPREPORT_PATH = os.path.join(DATABASE_DIR, "capreport.json")
STANDINGS_PATH = os.path.join(DATABASE_DIR, "standings.json")
TEAMS_PATH = os.path.join(DATABASE_DIR, "teams.json")
TRANSACTIONS_PATH = os.path.join(PROJECT_ROOT, "transactions.htm")

VALID_PHASES = {
    "SIM6": "Sim 6",
    "FA1": "FA1",
    "FA2": "FA2",
    "FA3": "FA3",
    "TC": "TC",
    "FA3/TC": "FA3/TC",
    "PRESEASON": "Preseason",
}

PHASE_ALIASES = {
    "SIM 6": "SIM6",
    "SIM6": "SIM6",
    "PRE OFFSEASON": "SIM6",
    "PRE-OFFSEASON": "SIM6",
    "OFFSEASON PREVIEW": "SIM6",
    "FA 1": "FA1",
    "FA1": "FA1",
    "FA 2": "FA2",
    "FA2": "FA2",
    "FA 3": "FA3",
    "FA3": "FA3",
    "TC": "TC",
    "FA3 TC": "FA3/TC",
    "FA3/TC": "FA3/TC",
    "FA 3 TC": "FA3/TC",
    "PRESEASON": "PRESEASON",
}

CONTEXT_PATHS = {
    "players": "../../00-build/database/players.json",
    "freeAgents": "../../00-build/database/freeagents.json",
    "capReport": "../../00-build/database/capreport.json",
    "standings": "../../00-build/database/standings.json",
    "teams": "../../00-build/database/teams.json",
    "transactions": "../../transactions.htm",
}

POS_GROUPS = {
    "guard": {"PG", "SG"},
    "wing": {"SF"},
    "big": {"PF", "C"},
}

OFFSEASON_PHASE_OPTIONS = [
    ("1", "Sim 6"),
    ("2", "FA1"),
    ("3", "FA2"),
    ("4", "FA3/TC"),
]


def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def read_text(path):
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read()


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value, default=0):
    try:
        return float(str(value).replace("$", "").replace(",", "").replace("(", "-").replace(")", ""))
    except (TypeError, ValueError):
        return default


def int_number(value, default=0):
    return int(number(value, default))


def money(value):
    amount = number(value)
    sign = "-" if amount < 0 else ""
    return f"{sign}${abs(amount):,.0f}"


def normalize_phase(value):
    raw = clean(value).upper().replace("_", " ").replace("-", " ")
    raw = re.sub(r"\s*/\s*", "/", raw)
    raw = re.sub(r"\s+", " ", raw)
    key = PHASE_ALIASES.get(raw) or PHASE_ALIASES.get(raw.replace(" ", ""))
    return VALID_PHASES.get(key, "")


def phase_from_index_title():
    content = read_text(INDEX_PATH)
    match = re.search(r"<title[^>]*>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
    title = html.unescape(clean(re.sub(r"<[^>]+>", "", match.group(1)))) if match else ""
    status = re.search(
        r"\b(Sim\s*6|Pre[-\s]?Offseason|Offseason Preview|FA\s*[123](?:\s*/?\s*TC)?|TC|Preseason)\b",
        title,
        re.IGNORECASE,
    )
    if not status:
        return "", title
    return normalize_phase(status.group(1)), title


def choose_phase_interactively():
    print("Choose offseason media package phase:")
    for number_label, phase in OFFSEASON_PHASE_OPTIONS:
        print(f"  {number_label}. {phase}")

    while True:
        choice = clean(input("Type 1-4: "))
        for number_label, phase in OFFSEASON_PHASE_OPTIONS:
            if choice == number_label:
                return phase
        print("Invalid choice. Type 1, 2, 3, or 4.")


def player_url(player):
    url = player.get("url") or ""
    if url.startswith("./"):
        return url
    if url.startswith("../players/"):
        return "./players/" + os.path.basename(url)
    if player.get("file"):
        return "./players/" + player["file"]
    return url


def compact_player(player):
    return {
        "name": player.get("name", ""),
        "team": player.get("teamLabel") or player.get("lastTeam") or player.get("teamName") or player.get("team", ""),
        "pos": player.get("pos", ""),
        "age": int_number(player.get("age"), None),
        "overall": int_number(player.get("overall") or player.get("currentRating"), None),
        "potential": int_number(player.get("potential") or player.get("futureRating"), None),
        "salary": player.get("currentSalaryText", ""),
        "url": player_url(player),
    }


def free_agent_pool(free_agents):
    return [compact_player(player) for player in free_agents.get("players", []) if player.get("name")]


def active_players(players):
    rows = []
    for player in players:
        team = clean(player.get("teamLabel") or player.get("team"))
        if not team or team.casefold() in {"fa", "free agent", "freeagent", "freeagents", "draft"}:
            continue
        rows.append(player)
    return rows


def top_players(players, key, limit=15, where=None):
    rows = [row for row in players if where is None or where(row)]
    return [
        compact_player(row)
        for row in sorted(rows, key=lambda row: (int_number(row.get(key), -1), -int_number(row.get("age"), 99)), reverse=True)[:limit]
    ]


def cap_entries(capreport):
    rows = []
    for section in capreport.get("sections", []):
        for entry in section.get("entries", []):
            rows.append({
                "team": entry.get("team", ""),
                "league": section.get("title", "").replace(" Cap Report", ""),
                "rosterFile": entry.get("rosterFile", ""),
                "salary": entry.get("salary", 0),
                "salaryText": entry.get("salaryText") or money(entry.get("salary")),
                "capRoom": entry.get("capRoom", 0),
                "capRoomText": entry.get("capRoomText") or money(entry.get("capRoom")),
                "budgetRoom": entry.get("budgetRoom", 0),
                "budgetRoomText": entry.get("budgetRoomText") or money(entry.get("budgetRoom")),
            })
    return rows


def build_cap_outlook(capreport):
    entries = cap_entries(capreport)
    return {
        "mostCapRoom": sorted(entries, key=lambda row: number(row["capRoom"]), reverse=True)[:12],
        "leastCapRoom": sorted(entries, key=lambda row: number(row["capRoom"]))[:12],
        "biggestBudgets": sorted(entries, key=lambda row: number(row["budgetRoom"]), reverse=True)[:12],
    }


def build_team_lookup(teams):
    lookup = {}
    for team in teams if isinstance(teams, list) else teams.get("teams", []):
        name = team.get("name") or team.get("team") or ""
        roster = team.get("rosterFile") or team.get("file") or ""
        if name:
            lookup[name] = {"team": name, "rosterFile": roster, "starPlayer": team.get("starPlayer", "")}
    return lookup


def build_roster_needs(players, capreport, limit=18):
    cap_by_team = {entry["team"]: entry for entry in cap_entries(capreport)}
    teams = {}
    for player in active_players(players):
        team = clean(player.get("teamLabel") or player.get("team"))
        pos = clean(player.get("pos")).upper()
        row = teams.setdefault(team, {"team": team, "counts": {"guard": 0, "wing": 0, "big": 0}, "topPlayers": []})
        for group, positions in POS_GROUPS.items():
            if pos in positions:
                row["counts"][group] += 1
        row["topPlayers"].append(player)

    output = []
    for team, row in teams.items():
        needs = []
        if row["counts"]["guard"] < 4:
            needs.append("guard depth")
        if row["counts"]["wing"] < 2:
            needs.append("wing depth")
        if row["counts"]["big"] < 4:
            needs.append("frontcourt depth")
        top = sorted(row["topPlayers"], key=lambda player: int_number(player.get("overall"), 0), reverse=True)[:3]
        cap = cap_by_team.get(team, {})
        output.append({
            "team": team,
            "needs": needs or ["depth/upgrade optional"],
            "positionCounts": row["counts"],
            "topPlayers": [compact_player(player) for player in top],
            "capRoom": cap.get("capRoomText", ""),
            "budgetRoom": cap.get("budgetRoomText", ""),
        })

    return sorted(output, key=lambda row: (len(row["needs"]), number(str(row.get("capRoom", "0")))), reverse=True)[:limit]


def strip_tags(value):
    return clean(html.unescape(re.sub(r"<[^>]+>", "", value)))


def parse_transactions(limit=30):
    content = read_text(TRANSACTIONS_PATH)
    rows = []
    pattern = re.compile(
        r"<tr[^>]*class=row[12][^>]*>\s*"
        r"<td[^>]*>(.*?)</td>\s*"
        r"<td[^>]*>(.*?)</td>\s*"
        r"<td[^>]*>(.*?)</td>",
        re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(content):
        rows.append({
            "date": strip_tags(match.group(1)),
            "team": strip_tags(match.group(2)),
            "action": strip_tags(match.group(3)),
        })
        if len(rows) >= limit:
            break
    return rows


def short_contracts(players, limit=25):
    rows = []
    for player in active_players(players):
        contracts = player.get("contracts") if isinstance(player.get("contracts"), list) else []
        if len(contracts) > 1:
            continue
        compact = compact_player(player)
        compact["contractYearsRemaining"] = len(contracts)
        compact["contract"] = contracts[0] if contracts else {}
        rows.append(compact)
    return sorted(rows, key=lambda row: (row.get("overall") or 0, row.get("potential") or 0), reverse=True)[:limit]


def build_camp_watch(players):
    active = active_players(players)
    return {
        "youngUpside": top_players(active, "potential", 20, where=lambda row: int_number(row.get("age"), 99) <= 25),
        "veteranRegressionRisk": top_players(active, "overall", 20, where=lambda row: int_number(row.get("age"), 0) >= 32),
        "highVariancePlayers": [
            compact_player(row)
            for row in sorted(
                active,
                key=lambda row: int_number(row.get("potential"), 0) - int_number(row.get("overall"), 0),
                reverse=True,
            )[:20]
        ],
    }


def build_market_board(free_agents):
    pool = free_agent_pool(free_agents)
    by_overall = sorted(pool, key=lambda row: (row.get("overall") or 0, row.get("potential") or 0), reverse=True)
    by_potential = sorted(pool, key=lambda row: (row.get("potential") or 0, -(row.get("age") or 99)), reverse=True)
    young = [row for row in by_potential if row.get("age") is not None and row["age"] <= 25]
    return {
        "topByOverall": by_overall[:25],
        "topByPotential": by_potential[:25],
        "youngUpside": young[:25],
        "veteranHelp": [row for row in by_overall if row.get("age") is not None and row["age"] >= 30][:20],
        "positionBoards": {
            pos: [row for row in by_overall if row.get("pos") == pos][:12]
            for pos in ["PG", "SG", "SF", "PF", "C"]
        },
    }


def phase_focus(phase):
    focus = {
        "Sim 6": "Set the table before FA1: expiring contracts, cap-room teams, roster holes, and the free-agent board.",
        "FA1": "Preview the opening market: best players available, likely bidders, cap-space pressure, and teams that need to strike early.",
        "FA2": "React to the first wave: recent signings, winners and losers, overpay/bargain angles, and the best remaining free agents.",
        "FA3": "Frame the final free-agency pass: remaining value, last roster holes, and teams still short before camp.",
        "TC": "Shift from market to development: camp stakes, young-player leap candidates, veterans at risk, and volatile rosters.",
        "FA3/TC": "Blend final free agency with camp stakes: remaining value, roster completion, development bets, and regression risk.",
        "Preseason": "Preview the new season: roster changes, camp outcomes to watch, and early pressure points before games count.",
    }
    return focus.get(phase, "Build an offseason editorial briefing from current roster, cap, free-agent, and transaction data.")


def article_prompts(phase):
    common = [
        {
            "id": "offseason-board",
            "title": "The Offseason Board",
            "prompt": "Write a ranked offseason board using the top free-agent, cap-space, and team-need context. Explain not just who is best, but who changes the market.",
        },
        {
            "id": "cap-space-power-rankings",
            "title": "Cap Space Power Rankings",
            "prompt": "Rank the teams with the most meaningful spending flexibility. Tie every ranking to roster need and realistic market leverage.",
        },
    ]
    phase_specific = {
        "Sim 6": [
            {
                "id": "sim-6-pressure-index",
                "title": "Sim 6 Pressure Index",
                "prompt": "Identify the teams facing the hardest offseason decisions before FA1: expiring talent, cap stress, roster holes, and contender timelines.",
            },
            {
                "id": "free-agent-market-preview",
                "title": "Free Agent Market Preview",
                "prompt": "Preview the free-agent class before bidding begins. Group players by stars, starters, upside bets, specialists, and risky veterans.",
            },
        ],
        "FA1": [
            {
                "id": "fa1-market-preview",
                "title": "FA1 Market Preview",
                "prompt": "Write the FA1 market opener: top targets, teams with money, likely bidding wars, and which clubs cannot afford to wait.",
            },
        ],
        "FA2": [
            {
                "id": "fa1-winners-losers",
                "title": "FA1 Winners and Losers",
                "prompt": "Use recent transactions and remaining free agents to judge the first wave. Separate smart aggression from panic spending.",
            },
            {
                "id": "best-remaining-free-agents",
                "title": "Best Remaining Free Agents",
                "prompt": "Rank the best players still available after FA1 and explain fit, risk, and likely bidder profiles.",
            },
        ],
        "FA3": [
            {
                "id": "final-fa-board",
                "title": "Final Free Agency Board",
                "prompt": "Build the final FA board before camp: remaining starters, rotation players, specialists, and cheap upside swings.",
            },
        ],
        "TC": [
            {
                "id": "training-camp-stakes",
                "title": "Training Camp Stakes",
                "prompt": "Write a camp-stakes feature focused on young upside, veteran decline risk, and teams whose season depends on internal development.",
            },
        ],
        "FA3/TC": [
            {
                "id": "final-board-and-camp-stakes",
                "title": "Final Board and Camp Stakes",
                "prompt": "Blend the final free-agent board with training-camp stakes: who can still be signed, who needs to pop, and which rosters are fragile.",
            },
        ],
        "Preseason": [
            {
                "id": "preseason-pressure-points",
                "title": "Preseason Pressure Points",
                "prompt": "Preview the season through roster pressure points: new signings, unresolved weaknesses, young players who must develop, and teams with thin margins.",
            },
        ],
    }
    return common + phase_specific.get(phase, [])


def build_package(phase):
    players = load_json(PLAYERS_PATH, [])
    free_agents = load_json(FREE_AGENTS_PATH, {"players": []})
    capreport = load_json(CAPREPORT_PATH, {"sections": []})
    standings = load_json(STANDINGS_PATH, {"sections": []})
    teams = load_json(TEAMS_PATH, [])

    return {
        "source": [
            CONTEXT_PATHS["players"],
            CONTEXT_PATHS["freeAgents"],
            CONTEXT_PATHS["capReport"],
            CONTEXT_PATHS["standings"],
            CONTEXT_PATHS["teams"],
            CONTEXT_PATHS["transactions"],
        ],
        "phase": phase,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "summary": phase_focus(phase),
        "availableContext": CONTEXT_PATHS,
        "sections": {
            "marketBoard": build_market_board(free_agents),
            "recentTransactions": parse_transactions(),
            "capOutlook": build_cap_outlook(capreport),
            "teamNeeds": build_roster_needs(players, capreport),
            "shortContracts": short_contracts(players),
            "campWatch": build_camp_watch(players),
            "standingsSnapshot": standings,
            "teamDirectory": build_team_lookup(teams),
        },
        "articlePrompts": article_prompts(phase),
        "writerNotes": [
            "Use this as an evidence pack, not an auto-written article.",
            "For Sim 6 and FA1, emphasize market setup and team needs more than transaction judgment.",
            "For FA2, emphasize what changed after the first wave and who remains available.",
            "For FA3/TC and TC, emphasize roster completion, internal development, and regression risk.",
            "Every article should cite concrete players, cap situations, or roster holes from the package.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description="Build the standalone ESL offseason media prompt package.")
    parser.add_argument("--phase", help="Skip the prompt and use: Sim 6, FA1, FA2, FA3, TC, FA3/TC, or Preseason.")
    parser.add_argument("--dry-run", action="store_true", help="Print a summary without writing the package.")
    args = parser.parse_args()

    phase = normalize_phase(args.phase) if args.phase else choose_phase_interactively()
    if not phase:
        valid = ", ".join(VALID_PHASES.values())
        raise SystemExit(f"Unknown phase. Valid phases: {valid}")

    package = build_package(phase)
    if args.dry_run:
        print(json.dumps({
            "phase": package["phase"],
            "output": OUTPUT_PATH,
            "articlePromptCount": len(package["articlePrompts"]),
            "freeAgentCount": len(package["sections"]["marketBoard"]["topByOverall"]),
            "transactionCount": len(package["sections"]["recentTransactions"]),
        }, indent=4))
        return

    os.makedirs(PROMPTS_DIR, exist_ok=True)
    atomic_dump_json(OUTPUT_PATH, package, indent=4)
    print(f"Final count: 1 offseason editorial package saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
