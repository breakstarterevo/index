"""
build_supercup_knockout.py
Generate a unified Super Cup knockout page from the raw playoffs export plus built JSON.

Usage:
  python 00-build/scripts/build_supercup_knockout.py
  python 00-build/scripts/build_supercup_knockout.py --dry-run
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import datetime
from typing import Dict, List, Tuple


SCRIPT_ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_ROOT = os.path.dirname(SCRIPT_ROOT)
PROJECT_ROOT = os.path.dirname(BUILD_ROOT)
DRY_RUN = "--dry-run" in sys.argv

STANDINGS_JSON = os.path.join(BUILD_ROOT, "database", "supercup", "standings.json")
GAME_RESULTS_JSON = os.path.join(BUILD_ROOT, "database", "supercup", "game_results.json")
PLAYOFFS_HTML = os.path.join(PROJECT_ROOT, "00-SuperCup", "playoffs.htm")
OUTPUT_HTML = os.path.join(PROJECT_ROOT, "00-assets", "html", "supercup-knockout.htm")
DEFAULT_PLAYOFFS_HTML = """<title>Super Cup Knockout</title>
<h3>Super Cup</h3>
<td bgcolor="#f2f2f2">First Round</td>
<td bgcolor="#f2f2f2">Second Round</td>
<td bgcolor="#f2f2f2">Semifinals</td>
<td bgcolor="#f2f2f2">Final</td>
"""

FIRST_ROUND_SLOT_ORDER: List[Tuple[int, int]] = [
    (2, 15),
    (7, 10),
    (6, 11),
    (3, 14),
    (4, 13),
    (5, 12),
    (8, 9),
    (1, 16),
]


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_playoffs_html_text() -> Tuple[str, bool]:
    if not os.path.exists(PLAYOFFS_HTML):
        return DEFAULT_PLAYOFFS_HTML, False
    with open(PLAYOFFS_HTML, "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read(), True


def parse_date(value: str) -> datetime:
    raw = str(value or "").strip()
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.strptime(raw, "%m/%d/%Y")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value).strip().lower()).strip("-")


def team_mark(value: str) -> str:
    words = [part for part in re.split(r"[\s\-]+", str(value).strip()) if part]
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][:2].upper()
    return "".join(word[0] for word in words[:2]).upper()


TEAM_LOGO_FILES = {
    "AC Milan": "acmilan.jpg",
    "AFC Richmond": "richmond.jpg",
    "Ajax": "ajax.jpg",
    "Aston Villa": "astonvilla.jpg",
    "Atletico Madrid": "atletico.jpg",
    "Barcelona": "barcelona.jpg",
    "Bayern Munich": "bayern.jpg",
    "Benfica": "benfica.jpg",
    "Brighton": "brighton.jpg",
    "Chelsea": "chelsea.jpg",
    "Crystal Palace": "crystalpalace.jpg",
    "FL Fart": "flfart.jpg",
    "Inter Milan": "intermilan.jpg",
    "Juventus": "juventus.jpg",
    "Manchester City": "manchestercity.jpg",
    "Manchester United": "manutd.jpg",
    "Marseille": "marseille.jpg",
    "Monaco": "monaco.jpg",
    "Paris Saint-Germain": "psg.jpg",
    "Real Madrid": "realmadrid.jpg",
    "AC Sparta Praha": "acspartapraha.png",
    "Arsenal": "arsenal.png",
    "Tottenham Hotspur": "tottenham.jpg",
    "Valencia": "valencia.jpg",
}


def team_logo_src(team_name: str) -> str:
    filename = TEAM_LOGO_FILES.get(str(team_name).strip())
    if not filename:
        return ""
    return f"../photos/{filename}"


def build_seed_maps(standings_data):
    sections = standings_data.get("sections", [])
    teams = list((sections[0] or {}).get("teams", [])) if sections else []
    seeded = teams[:16]
    seed_by_team = {}
    team_meta = {}
    for index, team in enumerate(seeded, start=1):
        name = str(team.get("team") or "").strip()
        roster_file = str(team.get("rosterFile") or "").strip()
        seed_by_team[name] = index
        team_meta[name] = {
            "seed": index,
            "team": name,
            "rosterFile": roster_file,
            "rosterUrl": team.get("rosterUrl") or f"./rosters/{roster_file}",
        }
    return seed_by_team, team_meta


def extract_title_bits(playoffs_html: str):
    page_title_match = re.search(r"<title>(.*?)</title>", playoffs_html, flags=re.I | re.S)
    page_title = page_title_match.group(1).strip() if page_title_match else "Super Cup Knockout"

    h3_match = re.search(r"<h3>(.*?)</h3>", playoffs_html, flags=re.I | re.S)
    comp_title = h3_match.group(1).strip() if h3_match else "Super Cup"

    round_titles = re.findall(
        r'bgcolor="#f2f2f2"[^>]*>\s*([^<]+?)\s*</td>',
        playoffs_html,
        flags=re.I,
    )
    round_titles = [title.strip() for title in round_titles[:4]]
    if len(round_titles) < 4:
        round_titles = ["First Round", "Second Round", "Semifinals", "Final"]

    return page_title, comp_title, round_titles


def playoff_results_by_round(game_results_data):
    playoff_games = [game for game in game_results_data.get("results", []) if game.get("sectionSlug") == "playoffs"]
    playoff_games.sort(key=lambda game: (parse_date(game["date"]), game.get("boxscoreFile", "")))
    grouped = {}
    for game in playoff_games:
        grouped.setdefault(game["date"], []).append(game)
    ordered_dates = sorted(grouped.keys(), key=parse_date)
    return [grouped[date] for date in ordered_dates]


def team_rows_from_game(game, seed_by_team, team_meta):
    away = {
        "team": game["awayTeamName"],
        "seed": seed_by_team.get(game["awayTeamName"], 99),
        "score": game["awayScore"],
        "won": game["winnerName"] == game["awayTeamName"],
        "rosterFile": (team_meta.get(game["awayTeamName"]) or {}).get("rosterFile", ""),
    }
    home = {
        "team": game["homeTeamName"],
        "seed": seed_by_team.get(game["homeTeamName"], 99),
        "score": game["homeScore"],
        "won": game["winnerName"] == game["homeTeamName"],
        "rosterFile": (team_meta.get(game["homeTeamName"]) or {}).get("rosterFile", ""),
    }
    rows = sorted([away, home], key=lambda row: (row["seed"], row["team"]))
    return rows


def build_match(game, seed_by_team, team_meta):
    rows = team_rows_from_game(game, seed_by_team, team_meta)
    return {
        "date": game["date"],
        "boxscoreFile": game.get("boxscoreFile", ""),
        "rows": rows,
        "participants": {row["team"] for row in rows},
    }


def build_seed_row(seed: int, team_name: str, team_meta):
    return {
        "team": team_name,
        "seed": seed,
        "score": None,
        "won": False,
        "rosterFile": (team_meta.get(team_name) or {}).get("rosterFile", ""),
    }


def build_placeholder_match(slot: int, rows: List[dict], *, date: str = "TBD", boxscore_file: str = ""):
    participants = {row["team"] for row in rows if row.get("team") != "TBD"}
    return {
        "slot": slot,
        "date": date,
        "boxscoreFile": boxscore_file,
        "rows": rows,
        "participants": participants,
    }


def build_first_round_placeholders(seed_by_team, team_meta):
    team_by_seed = {seed: team for team, seed in seed_by_team.items()}
    matches = []
    slot_participants = {}
    for slot, (seed_a, seed_b) in enumerate(FIRST_ROUND_SLOT_ORDER, start=1):
        rows = [
            build_seed_row(seed_a, team_by_seed.get(seed_a, "TBD"), team_meta),
            build_seed_row(seed_b, team_by_seed.get(seed_b, "TBD"), team_meta),
        ]
        match = build_placeholder_match(slot, rows)
        matches.append(match)
        slot_participants[slot] = set(match["participants"])
    return matches, slot_participants


def build_empty_round(slot_count: int):
    rounds = []
    for slot in range(1, slot_count + 1):
        rows = [
            {"team": "TBD", "seed": "TBD", "score": None, "won": False, "rosterFile": ""},
            {"team": "TBD", "seed": "TBD", "score": None, "won": False, "rosterFile": ""},
        ]
        rounds.append(build_placeholder_match(slot, rows))
    return rounds


def build_bracket(round_groups, seed_by_team, team_meta):
    first_round_games, slot_participants = build_first_round_placeholders(seed_by_team, team_meta)

    if round_groups:
        played_first_round = []
        for game in round_groups[0]:
            rows = team_rows_from_game(game, seed_by_team, team_meta)
            seed_pair = tuple(sorted(row["seed"] for row in rows))
            try:
                slot = FIRST_ROUND_SLOT_ORDER.index(seed_pair) + 1
            except ValueError as error:
                raise ValueError(f"Could not place first-round matchup for seeds {seed_pair}") from error
            match = build_match(game, seed_by_team, team_meta)
            match["slot"] = slot
            played_first_round.append(match)
            slot_participants[slot] = set(match["participants"])
        played_by_slot = {match["slot"]: match for match in played_first_round}
        first_round_games = [played_by_slot.get(slot, match) for slot, match in enumerate(first_round_games, start=1)]

    quarter_slot_groups = {
        1: slot_participants[1] | slot_participants[2],
        2: slot_participants[3] | slot_participants[4],
        3: slot_participants[5] | slot_participants[6],
        4: slot_participants[7] | slot_participants[8],
    }
    quarter_games = build_empty_round(4)
    quarter_participants = dict(quarter_slot_groups)
    if len(round_groups) > 1:
        played_quarters = []
        for game in round_groups[1]:
            match = build_match(game, seed_by_team, team_meta)
            for slot, participants in quarter_slot_groups.items():
                if participants and match["participants"].issubset(participants):
                    match["slot"] = slot
                    played_quarters.append(match)
                    quarter_participants[slot] = set(match["participants"])
                    break
            else:
                raise ValueError(f"Could not place quarterfinal matchup: {match['participants']}")
        played_by_slot = {match["slot"]: match for match in played_quarters}
        quarter_games = [played_by_slot.get(slot, match) for slot, match in enumerate(quarter_games, start=1)]

    semi_slot_groups = {
        1: quarter_participants[1] | quarter_participants[2],
        2: quarter_participants[3] | quarter_participants[4],
    }
    semi_games = build_empty_round(2)
    semi_participants = {}
    if len(round_groups) > 2:
        played_semis = []
        for game in round_groups[2]:
            match = build_match(game, seed_by_team, team_meta)
            for slot, participants in semi_slot_groups.items():
                if participants and match["participants"].issubset(participants):
                    match["slot"] = slot
                    played_semis.append(match)
                    semi_participants[slot] = set(match["participants"])
                    break
            else:
                raise ValueError(f"Could not place semifinal matchup: {match['participants']}")
        played_by_slot = {match["slot"]: match for match in played_semis}
        semi_games = [played_by_slot.get(slot, match) for slot, match in enumerate(semi_games, start=1)]

    final_games = build_empty_round(1)
    if len(round_groups) > 3:
        played_finals = []
        for game in round_groups[3]:
            match = build_match(game, seed_by_team, team_meta)
            match["slot"] = 1
            played_finals.append(match)
        if played_finals:
            final_games = [played_finals[0]]

    return [first_round_games, quarter_games, semi_games, final_games]


def roster_href(roster_file: str) -> str:
    if not roster_file:
        return "#"
    return f"./unified-roster-supercup.htm?file={roster_file}"


def box_href(boxscore_file: str) -> str:
    if not boxscore_file:
        return "#"
    return f"../../00-SuperCup/boxes/{boxscore_file}"


def render_match_inner(match) -> str:
    row_bits = []
    box_available = bool(match["boxscoreFile"])
    for row in match["rows"]:
        team_class = "knockout-team is-winner" if row["won"] else "knockout-team"
        team = row["team"]
        seed_label = row["seed"] if row["seed"] not in (None, "") else "TBD"
        score_value = row["score"]
        score_text = html.escape("TBD" if score_value in (None, "", "TBD") else str(score_value))
        score_href = html.escape(box_href(match["boxscoreFile"]), quote=True) if box_available else "#"
        logo_src = team_logo_src(team)
        if logo_src:
            logo_html = f'<img class="knockout-logo knockout-logo--image" src="{html.escape(logo_src, quote=True)}" alt="{html.escape(team)} logo">'
        else:
            logo_html = f'<span class="knockout-logo" aria-hidden="true">{html.escape(team_mark(team))}</span>'
        if row.get("rosterFile"):
            team_html = f'<a class="knockout-team-name" href="{html.escape(roster_href(row["rosterFile"]), quote=True)}">{logo_html}<span class="knockout-team-label">{html.escape(team)}</span></a>'
        else:
            team_html = f'<span class="knockout-team-name knockout-team-name--static">{logo_html}<span class="knockout-team-label">{html.escape(team)}</span></span>'
        if box_available and score_value not in (None, "", "TBD"):
            score_html = f'<a class="knockout-score" href="{score_href}" aria-label="Open box score for {html.escape(team)} vs opponent">{score_text}</a>'
        else:
            score_html = f'<span class="knockout-score knockout-score--pending">{score_text}</span>'
        row_bits.append(
            "<div class=\"%s\">"
            "<span class=\"knockout-seed\">#%s</span>"
            "%s"
            "%s"
            "</div>"
            % (
                team_class,
                html.escape(str(seed_label)),
                team_html,
                score_html,
            )
        )

    meta = html.escape(match["date"] or "TBD")
    if box_available:
        link = html.escape(box_href(match["boxscoreFile"]), quote=True)
        meta_html = f'<div class="knockout-meta"><span>{meta}</span><a href="{link}">Box</a></div>'
    else:
        meta_html = f'<div class="knockout-meta"><span>{meta}</span><span class="knockout-meta-placeholder">Awaiting tip</span></div>'
    return "".join(row_bits) + meta_html


def render_match_card(match) -> str:
    inner = render_match_inner(match)
    return (
        "<article class=\"knockout-card\">"
        + inner
        + "</article>"
    )


def slot_class(round_index: int, slot: int) -> str:
    return f"round-{round_index + 1}-slot-{slot}"


def branch_class(round_index: int, branch: int) -> str:
    return f"branch-round-{round_index + 1}-slot-{branch}"


def render_outgoing_branch(round_index: int, branch: int) -> str:
    return (
        f'<div class="knockout-branch {branch_class(round_index, branch)}" aria-hidden="true">'
        '<span class="knockout-branch-arm knockout-branch-arm--top"></span>'
        '<span class="knockout-branch-arm knockout-branch-arm--bottom"></span>'
        '<span class="knockout-branch-spine"></span>'
        '<span class="knockout-branch-mid"></span>'
        '</div>'
    )


def render_round_column(title: str, matches: List[dict], round_index: int) -> str:
    cards = "".join(
        f'<article class="knockout-card {slot_class(round_index, match["slot"])}">{render_match_inner(match)}</article>'
        for match in matches
    )
    branches = ""
    branch_count = len(matches) // 2 if round_index < 3 else 0
    if branch_count:
        branches = "".join(render_outgoing_branch(round_index, branch_index + 1) for branch_index in range(branch_count))
    return (
        "<section class=\"knockout-round\">"
        f"<div class=\"knockout-round-head\">{html.escape(title)}</div>"
        f"<div class=\"knockout-round-body\">{branches}{cards}</div>"
        "</section>"
    )


def render_html(page_title: str, comp_title: str, round_titles: List[str], rounds: List[List[dict]], has_classic_bracket: bool) -> str:
    round_columns = "".join(
        render_round_column(title, matches, index)
        for index, (title, matches) in enumerate(zip(round_titles, rounds))
    )
    classic_bracket_link = (
        '<a class="quick-link" href="../../00-SuperCup/playoffs.htm">Classic Bracket</a>'
        if has_classic_bracket
        else '<span class="quick-link quick-link--disabled">Classic Bracket Pending</span>'
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(comp_title)} Knockout</title>
  <link rel="stylesheet" href="../css/styles.css">
  <style>
    :root {{ --ink:#0f0f0f; --blue:#111b36; --paper:#f4f2ec; --card:#fff; --mid:#524633; --line:#ddd5c6; --green:#1f6d3d; --font-sans:"Graphik","Helvetica Neue",Helvetica,Arial,sans-serif; --font-serif:"Tiempos Headline","Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; padding:1rem; background:var(--paper); color:var(--ink); font-family:var(--font-sans); }}
    .shell {{ width:min(1280px,100%); display:grid; gap:1rem; }}
    .hero {{ background:var(--card); border:1px solid var(--ink); border-top:4px solid var(--blue); box-shadow:4px 4px 0 rgba(17,27,54,.12); padding:.85rem 1rem; }}
    .kicker {{ font-size:.65rem; letter-spacing:.2em; text-transform:uppercase; color:var(--blue); font-weight:800; margin-bottom:.22rem; }}
    .title {{ margin:0; font-family:var(--font-serif); font-size:clamp(1.7rem,3vw,2.4rem); line-height:1.02; }}
    .lede {{ margin:.35rem 0 0; color:var(--mid); font-size:.9rem; line-height:1.4; max-width:760px; }}
    .quick-links {{ display:flex; flex-wrap:wrap; gap:.45rem; margin-top:.8rem; }}
    .quick-link {{ border:1px solid var(--line); background:#faf8f2; padding:.42rem .5rem; font-size:.66rem; letter-spacing:.14em; text-transform:uppercase; color:var(--blue); text-decoration:none; }}
    .quick-link:hover {{ border-color:var(--blue); background:#f2efe7; }}
    .quick-link--disabled {{ color:var(--mid); opacity:.7; }}
    .knockout-grid {{ display:grid; gap:1rem; grid-template-columns:repeat(4,minmax(220px,1fr)); align-items:start; }}
    .knockout-round {{ background:var(--card); border:1px solid var(--line); min-width:0; }}
    .knockout-round-head {{ border-bottom:2px solid var(--blue); color:var(--blue); font-size:.7rem; font-weight:800; letter-spacing:.16em; padding:.72rem .8rem; text-transform:uppercase; }}
    .knockout-round-body {{ position:relative; min-height:920px; padding:.8rem; }}
    .knockout-card {{ position:absolute; left:.8rem; right:.8rem; border:1px solid var(--line); background:#faf8f2; padding:.58rem .62rem; transform:translateY(-50%); }}
    .knockout-team {{ display:grid; grid-template-columns:36px minmax(0,1fr) 42px; gap:.45rem; align-items:center; padding:.18rem 0; }}
    .knockout-team + .knockout-team {{ border-top:1px solid rgba(17,27,54,.08); margin-top:.18rem; padding-top:.38rem; }}
    .knockout-team.is-winner .knockout-team-name, .knockout-team.is-winner .knockout-score {{ color:var(--green); font-weight:800; }}
    .knockout-seed {{ color:var(--mid); font-size:.63rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }}
    .knockout-team-name {{ color:inherit; display:flex; align-items:center; gap:.52rem; font-family:var(--font-serif); font-size:.98rem; line-height:1.15; min-width:0; overflow-wrap:anywhere; text-decoration:none; }}
    .knockout-team-name:hover {{ color:var(--blue); text-decoration:underline; }}
    .knockout-team-name--static:hover {{ color:inherit; text-decoration:none; }}
    .knockout-team-label {{ min-width:0; overflow-wrap:anywhere; }}
    .knockout-logo {{ width:1.5rem; height:1.5rem; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto; background:#d1a74d; color:var(--blue); border:1px solid rgba(17,27,54,.18); font-family:var(--font-sans); font-size:.56rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }}
    .knockout-logo--image {{ object-fit:cover; background:#fff; padding:0; }}
    .knockout-score {{ justify-self:end; font-size:1rem; font-weight:700; color:inherit; text-decoration:none; }}
    .knockout-score:hover {{ color:var(--blue); text-decoration:underline; }}
    .knockout-score--pending {{ color:var(--mid); font-size:.82rem; letter-spacing:.08em; text-transform:uppercase; }}
    .knockout-meta {{ display:flex; justify-content:space-between; gap:.6rem; margin-top:.45rem; padding-top:.42rem; border-top:1px solid rgba(17,27,54,.08); color:var(--mid); font-size:.62rem; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }}
    .knockout-meta a {{ color:var(--blue); text-decoration:none; }}
    .knockout-meta a:hover {{ text-decoration:underline; }}
    .knockout-meta-placeholder {{ opacity:.75; }}
    .knockout-branch {{ position:absolute; right:-2rem; width:2.8rem; pointer-events:none; }}
    .knockout-branch-arm,.knockout-branch-spine,.knockout-branch-mid {{ position:absolute; display:block; background:rgba(17,27,54,.34); }}
    .knockout-branch-arm {{ left:0; width:1.35rem; height:2px; }}
    .knockout-branch-arm--top {{ top:0; }}
    .knockout-branch-arm--bottom {{ bottom:0; }}
    .knockout-branch-spine {{ left:1.35rem; top:0; width:2px; height:100%; }}
    .knockout-branch-mid {{ left:1.35rem; top:50%; width:1.45rem; height:2px; transform:translateY(-50%); }}

    .round-1-slot-1 {{ top:6.25%; }}
    .round-1-slot-2 {{ top:18.75%; }}
    .round-1-slot-3 {{ top:31.25%; }}
    .round-1-slot-4 {{ top:43.75%; }}
    .round-1-slot-5 {{ top:56.25%; }}
    .round-1-slot-6 {{ top:68.75%; }}
    .round-1-slot-7 {{ top:81.25%; }}
    .round-1-slot-8 {{ top:93.75%; }}

    .round-2-slot-1 {{ top:12.5%; }}
    .round-2-slot-2 {{ top:37.5%; }}
    .round-2-slot-3 {{ top:62.5%; }}
    .round-2-slot-4 {{ top:87.5%; }}

    .round-3-slot-1 {{ top:25%; }}
    .round-3-slot-2 {{ top:75%; }}

    .round-4-slot-1 {{ top:50%; }}

    .branch-round-1-slot-1 {{ top:6.25%; height:12.5%; }}
    .branch-round-1-slot-2 {{ top:31.25%; height:12.5%; }}
    .branch-round-1-slot-3 {{ top:56.25%; height:12.5%; }}
    .branch-round-1-slot-4 {{ top:81.25%; height:12.5%; }}

    .branch-round-2-slot-1 {{ top:12.5%; height:25%; }}
    .branch-round-2-slot-2 {{ top:62.5%; height:25%; }}

    .branch-round-3-slot-1 {{ top:25%; height:50%; }}

    @media (max-width: 1080px) {{
      .knockout-grid {{ grid-template-columns:repeat(2,minmax(220px,1fr)); }}
      .knockout-round-body {{ min-height:auto; display:grid; gap:.7rem; }}
      .knockout-card {{ position:relative; left:auto; right:auto; top:auto; transform:none; }}
      .knockout-branch {{ display:none; }}
    }}
    @media (max-width: 640px) {{ body {{ padding:.7rem; }} .knockout-grid {{ grid-template-columns:1fr; }} .hero {{ padding:.78rem .82rem; }} }}
  </style>
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div class="kicker">{html.escape(page_title)}</div>
      <h1 class="title">{html.escape(comp_title)} Knockout</h1>
      <p class="lede">Initial seeds are corrected from the official PLB standings order, and each matchup shows the actual game score instead of the old 1-0 placeholders.</p>
      <nav class="quick-links" aria-label="Super Cup quick links">
        <a class="quick-link" href="./supercup-dashboard.htm">Dashboard</a>
        <a class="quick-link" href="../../00-SuperCup/standings.htm">Classic Standings</a>
        {classic_bracket_link}
      </nav>
    </header>
    <section class="knockout-grid">
      {round_columns}
    </section>
  </main>
</body>
</html>
"""


def main():
    standings_data = load_json(STANDINGS_JSON)
    game_results_data = load_json(GAME_RESULTS_JSON)
    playoffs_html, has_classic_bracket = load_playoffs_html_text()
    page_title, comp_title, round_titles = extract_title_bits(playoffs_html)
    seed_by_team, team_meta = build_seed_maps(standings_data)
    rounds = build_bracket(playoff_results_by_round(game_results_data), seed_by_team, team_meta)
    output = render_html(page_title, comp_title, round_titles, rounds, has_classic_bracket)

    if DRY_RUN:
        print("Super Cup knockout build [DRY RUN]")
        if has_classic_bracket:
            print(f"  source playoffs: {PLAYOFFS_HTML}")
        else:
            print(f"  source playoffs: missing; using fallback labels")
        print(f"  source standings: {STANDINGS_JSON}")
        print(f"  source game results: {GAME_RESULTS_JSON}")
        print(f"  output: {OUTPUT_HTML}")
        return

    with open(OUTPUT_HTML, "w", encoding="utf-8") as handle:
        handle.write(output)

    print("Super Cup knockout build")
    print(f"  output: {OUTPUT_HTML}")


if __name__ == "__main__":
    main()
