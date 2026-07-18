import os
import re
import json
import subprocess
from html import unescape
from html.parser import HTMLParser

from atomic_write import atomic_dump_json

# 1. PATH SETUP
ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
ROSTERS_DIR = os.path.normpath(os.path.join(PROJECT_ROOT, "rosters"))
PLAYERS_DIR = os.path.normpath(os.path.join(PROJECT_ROOT, "players"))
PLAYERS_OUT = os.path.join(DATABASE_DIR, "players.json")
PLAYER_STATS_OUT = os.path.join(DATABASE_DIR, "player_stats.json")
PLAYER_GAMELOGS_OUT = os.path.join(DATABASE_DIR, "player_gamelogs.json")
TEAM_STATS_OUT = os.path.join(DATABASE_DIR, "team_stats.json")
TEAMS_OUT = os.path.join(DATABASE_DIR, "teams.json")
STANDINGS_OUT = os.path.join(DATABASE_DIR, "standings.json")
CAPREPORT_OUT = os.path.join(DATABASE_DIR, "capreport.json")
INJURIES_OUT = os.path.join(DATABASE_DIR, "injuries.json")
SCHEDULE_OUT = os.path.join(DATABASE_DIR, "schedule.json")
FREE_AGENTS_OUT = os.path.join(DATABASE_DIR, "freeagents.json")
LEADERS_OUT = os.path.join(DATABASE_DIR, "leaders.json")
GAME_RESULTS_OUT = os.path.join(DATABASE_DIR, "game_results.json")
AWARDS_OUT = os.path.join(DATABASE_DIR, "awards.json")
SEASON_AWARDS_OUT = os.path.join(DATABASE_DIR, "season_awards.json")
STANDINGS_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "standings.htm"))
CAPREPORT_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "capreport.htm"))
INJURIES_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "injuries.htm"))
SCHEDULE_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "schedule.htm"))
FREE_AGENTS_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "freeagents.htm"))
DRAFT_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "draft.htm"))
LEADERS_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "leaders.htm"))
AWARDS_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "awards.htm"))
SEASON_AWARDS_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "seasonawards.htm"))
MDB_PATH = os.path.normpath(os.path.join(PROJECT_ROOT, "LeagueOutput.mdb"))

# The 16 numerical stats in your roster files
ATTR_KEYS = [
    "Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", 
    "Psd", "Prd", "Stl", "Blk", "Qkn", "Str", "Jmp", "Sta"
]
POTENTIAL_KEYS = ["Ins", "Jps", "Fts", "3ps", "Hnd", "Pas", "Orb", "Drb", "Psd", "Prd", "Stl", "Blk"]

PLAYER_STAT_TABLES = {
    "Season Averages",
    "Shooting Averages",
    "Season Totals",
    "Efficiency",
    "Playoff Averages",
    "Playoff Shooting",
    "Career Highs",
}

PLAYER_GAMELOG_TITLE = "Game Logs"
TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")

def clean(txt):
    text = unescape(txt).replace("\xa0", " ") if "&" in txt or "\xa0" in txt else txt
    stripped = text.strip()
    if not stripped:
        return ""
    if not any(character.isspace() for character in stripped):
        return stripped
    return WHITESPACE_RE.sub(" ", stripped)


def normalize_name(name):
    return clean(name).casefold()


def player_id_from_file(value):
    match = re.search(r"player(\d+)\.html?$", str(value or ""), re.IGNORECASE)
    return match.group(1) if match else ""


def find_rating(ratings, name, player_file=""):
    player_id = player_id_from_file(player_file)
    if player_id:
        rating = ratings["by_id"].get(player_id)
        if rating:
            return rating
    return ratings["by_name"].get(normalize_name(name), {})


def strip_tags(value):
    if "<" not in value:
        return clean(value)
    return clean(TAG_RE.sub(" ", value))


def parse_money_value(value):
    text = strip_tags(value)
    negative = "(" in text and ")" in text
    digits = re.sub(r"[^0-9.]", "", text)
    if not digits:
        return None

    amount = float(digits)
    if negative:
        amount *= -1
    return amount


def parse_numeric_value(value):
    text = strip_tags(value)
    if text in {"", "-"}:
        return text

    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text


def parse_current_salary(html):
    contract_match = re.search(
        r"<td class=tableheader[^>]*>\s*&nbsp;Contract</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not contract_match:
        return {"currentSalary": None, "currentSalaryText": ""}

    value_row_match = re.search(
        r"<tr[^>]*class=row1[^>]*>(.*?)</tr>",
        contract_match.group(1),
        re.IGNORECASE | re.DOTALL,
    )
    if not value_row_match:
        return {"currentSalary": None, "currentSalaryText": ""}

    cells = re.findall(
        r"<td[^>]*class=main[^>]*>(.*?)</td>",
        value_row_match.group(1),
        re.IGNORECASE | re.DOTALL,
    )
    value_cells = [cell for cell in cells if "$" in strip_tags(cell)]
    if not value_cells:
        return {"currentSalary": None, "currentSalaryText": ""}

    current_salary_cell = value_cells[0]
    return {
        "currentSalary": parse_money_value(current_salary_cell),
        "currentSalaryText": strip_tags(current_salary_cell),
    }


def parse_bird_years(html):
    match = re.search(r"Bird\s+Years:\s*&nbsp;\s*(\d+)", html, re.IGNORECASE)
    if not match:
        match = re.search(r"Bird\s+Years:\s*(\d+)", strip_tags(html), re.IGNORECASE)
    return int(match.group(1)) if match else 0


def slugify(value):
    text = clean(value).lower().replace("+/-", "plus_minus").replace("%", "_pct")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def parse_two_column_player_table(html, title, first_key, second_key):
    table_match = re.search(
        rf"<td class=tableheader[^>]*>\s*&nbsp;{re.escape(title)}</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not table_match:
        return []

    rows = []
    row_matches = re.finditer(
        r"<tr(?:[^>]*class=(?P<class>[^\s>]+)[^>]*)?>(?P<html>.*?)</tr>",
        table_match.group(1),
        re.IGNORECASE | re.DOTALL,
    )
    for row_match in row_matches:
        cells = re.findall(
            r"<td[^>]*class=main[^>]*>(.*?)</td>",
            row_match.group("html"),
            re.IGNORECASE | re.DOTALL,
        )
        if len(cells) < 2:
            continue

        rows.append(
            {
                first_key: strip_tags(cells[0]),
                second_key: strip_tags(cells[1]),
                "rowClass": (row_match.group("class") or "").lower(),
            }
        )
    return rows


def parse_player_awards_and_achievements(html):
    awards = parse_two_column_player_table(html, "Awards & Achievements", "season", "award")
    for award in awards:
        text = award.get("award", "")
        count_match = re.match(r"^(?P<label>.*?):\s*(?P<count>\d+)$", text)
        award["isTotal"] = award.get("season") == "Total"
        if count_match:
            award["label"] = clean(count_match.group("label"))
            award["count"] = int(count_match.group("count"))

    return {
        "awards": awards,
        "achievementTotals": [award for award in awards if award.get("isTotal")],
        "seasonAwards": [award for award in awards if not award.get("isTotal")],
    }


def parse_player_transactions(html):
    return parse_two_column_player_table(html, "Transactions", "date", "action")


def make_unique_headers(headers):
    counts = {}
    unique = []

    for header in headers:
        key = slugify(header)
        if not key:
            key = "value"

        counts[key] = counts.get(key, 0) + 1
        if counts[key] > 1:
            key = f"{key}_{counts[key]}"

        unique.append(key)

    return unique


def parse_team_season_info(html, team):
    table_match = re.search(
        r"<td class=tableheader[^>]*>\s*&nbsp;Season Info</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    stats = {}

    if not table_match:
        return {
            "teamId": team["id"],
            "team": team["name"],
            "file": team["file"],
            "url": team["url"],
            "stats": stats,
        }

    row_matches = re.finditer(
        r"<tr[^>]*class=row[12][^>]*>(.*?)</tr>",
        table_match.group(1),
        re.IGNORECASE | re.DOTALL,
    )

    for row_match in row_matches:
        cells = re.findall(
            r"<td[^>]*class=main[^>]*>(.*?)</td>",
            row_match.group(1),
            re.IGNORECASE | re.DOTALL,
        )
        if len(cells) < 12:
            continue

        label = strip_tags(cells[0]).rstrip(":")
        key = slugify(label)
        if not key:
            continue

        stats[key] = {
            "label": label,
            "team": {
                "value": parse_numeric_value(cells[1]),
                "conferenceRank": parse_numeric_value(cells[2]),
                "totalRank": parse_numeric_value(cells[3]),
            },
            "opponent": {
                "value": parse_numeric_value(cells[5]),
                "conferenceRank": parse_numeric_value(cells[6]),
                "totalRank": parse_numeric_value(cells[7]),
            },
            "margin": {
                "value": parse_numeric_value(cells[9]),
                "conferenceRank": parse_numeric_value(cells[10]),
                "totalRank": parse_numeric_value(cells[11]),
            },
        }

    return {
        "teamId": team["id"],
        "team": team["name"],
        "file": team["file"],
        "url": team["url"],
        "stats": stats,
    }


def load_mdb_ratings():
    if not os.path.exists(MDB_PATH):
        print(f"Warning: {MDB_PATH} not found. Skipping OVR/POT import.")
        return {"by_id": {}, "by_name": {}}

    powershell_script = rf"""
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$path = '{MDB_PATH.replace("'", "''")}'
$connStr = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$path;Persist Security Info=False;"
$conn = New-Object System.Data.OleDb.OleDbConnection($connStr)
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT ID, Name, OverallRating, OverallPotential, Greed, Winner, Loyalty, Happiness FROM Player"
$adapter = New-Object System.Data.OleDb.OleDbDataAdapter($cmd)
$table = New-Object System.Data.DataTable
[void]$adapter.Fill($table)
$conn.Close()
$rows = foreach ($row in $table.Rows) {{
    [PSCustomObject]@{{
        id = [string]$row.ID
        name = [string]$row.Name
        overall = if ($null -eq $row.OverallRating -or [string]::IsNullOrWhiteSpace([string]$row.OverallRating)) {{ "" }} else {{ [string]$row.OverallRating }}
        potential = if ($null -eq $row.OverallPotential -or [string]::IsNullOrWhiteSpace([string]$row.OverallPotential)) {{ "" }} else {{ [string]$row.OverallPotential }}
        greed = if ($null -eq $row.Greed -or [string]::IsNullOrWhiteSpace([string]$row.Greed)) {{ "" }} else {{ [string]$row.Greed }}
        playForWinner = if ($null -eq $row.Winner -or [string]::IsNullOrWhiteSpace([string]$row.Winner)) {{ "" }} else {{ [string]$row.Winner }}
        loyalty = if ($null -eq $row.Loyalty -or [string]::IsNullOrWhiteSpace([string]$row.Loyalty)) {{ "" }} else {{ [string]$row.Loyalty }}
        happiness = if ($null -eq $row.Happiness -or [string]::IsNullOrWhiteSpace([string]$row.Happiness)) {{ "" }} else {{ [string]$row.Happiness }}
    }}
}}
$rows | ConvertTo-Json -Compress
"""

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", powershell_script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
    except Exception as exc:
        print(f"Warning: failed to read ratings from MDB ({exc}).")
        return {"by_id": {}, "by_name": {}}

    raw = result.stdout.strip()
    if not raw:
        return {"by_id": {}, "by_name": {}}

    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"Warning: could not parse MDB ratings JSON ({exc}).")
        return {"by_id": {}, "by_name": {}}

    if isinstance(rows, dict):
        rows = [rows]

    ratings_by_id = {}
    ratings_by_name = {}
    duplicate_names = set()
    for row in rows:
        name = normalize_name(row.get("name", ""))
        rating = {
            "overall": row.get("overall", "") or "",
            "potential": row.get("potential", "") or "",
            "greed": row.get("greed", "") or "",
            "playForWinner": row.get("playForWinner", "") or "",
            "loyalty": row.get("loyalty", "") or "",
            "happiness": row.get("happiness", "") or "",
        }
        player_id = str(row.get("id", "") or "").strip()
        if player_id:
            ratings_by_id[player_id] = rating
        if not name:
            continue
        if name in ratings_by_name:
            duplicate_names.add(name)
        else:
            ratings_by_name[name] = rating

    for name in duplicate_names:
        ratings_by_name.pop(name, None)

    print(
        f"Loaded OVR/POT ratings for {len(ratings_by_id)} MDB player IDs "
        f"({len(duplicate_names)} duplicate names require ID matching)."
    )
    return {"by_id": ratings_by_id, "by_name": ratings_by_name}

def extract_team_metadata(html, filename):
    team_id = os.path.splitext(filename)[0]
    title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = clean(title_match.group(1)) if title_match else team_id

    return {
        "id": team_id,
        "name": title,
        "file": filename,
        "url": f"../rosters/{filename}"
    }

class RosterParser(HTMLParser):
    def __init__(self, team):
        super().__init__()
        self.team = team
        self.rows = []
        self.in_player_row = False
        self.table_depth = 0
        self.current_columns = []
        self.temp_data = ""
        self.current_link = ""

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag == "table":
            self.table_depth += 1
            
        if tag == "tr" and self.table_depth == 1:
            cls = attr_dict.get("class", "").lower()
            if "row1" in cls or "row2" in cls:
                self.in_player_row = True
                self.current_columns = []
                self.current_link = ""

        if self.in_player_row:
            if tag == "td" and self.table_depth == 1:
                self.temp_data = ""
            
            if tag == "a" and self.table_depth == 1:
                self.current_link = attr_dict.get("href", "")

    def handle_data(self, data):
        if self.in_player_row and self.table_depth == 1:
            self.temp_data += data

    def handle_endtag(self, tag):
        if tag == "td" and self.in_player_row and self.table_depth == 1:
            val = clean(self.temp_data)
            # We only want columns with text (skipping the empty color-box columns)
            if val:
                self.current_columns.append(val)
            self.temp_data = ""

        if tag == "tr" and self.in_player_row and self.table_depth == 1:
            self.process_row()
            self.in_player_row = False
            
        if tag == "table":
            self.table_depth -= 1

    def process_row(self):
        d = self.current_columns
        # Valid rows usually have ~22 columns of text (Info + 16 stats)
        if len(d) < 20:
            return

        try:
            player = {
                "name": d[1],
                "url": self.current_link,
                "team": self.team,
                "pos": d[2],
                "age": d[3],
                "ht": d[4],
                "wt": d[5]
            }

            # Map the 16 numerical stats
            for i, key in enumerate(ATTR_KEYS):
                # Since we skip the empty rating boxes, stats start at index 6
                val_idx = 6 + i
                if val_idx < len(d):
                    player[key] = d[val_idx]

            self.rows.append(player)
        except Exception:
            pass


def build_team_lookup(teams):
    lookup = {}
    for team in teams:
        name = clean(team.get("name", ""))
        if name:
            lookup[normalize_name(name)] = team["id"]
    return lookup


def rating_number(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return -1


def attach_star_players(teams, players):
    star_by_team = {}

    for player in players:
        team_id = player.get("team", "")
        if not team_id:
            continue

        overall = rating_number(player.get("overall"))
        if overall < 0:
            continue

        current_star = star_by_team.get(team_id)
        if not current_star or overall > rating_number(current_star.get("overall")):
            star_by_team[team_id] = {
                "name": player.get("name", ""),
                "url": player.get("url", ""),
                "pos": player.get("pos", ""),
                "age": player.get("age", ""),
                "overall": player.get("overall", ""),
                "potential": player.get("potential", ""),
            }

    for team in teams:
        team["starPlayer"] = star_by_team.get(team["id"])


def parse_player_page(html, filename, team_lookup, ratings):
    name_matches = re.findall(r"<td class=teamheader>([^<]+?)&nbsp;", html, re.IGNORECASE)
    name = clean(name_matches[-1]) if name_matches else ""
    if not name:
        return None

    meta_matches = re.findall(r"<tr><td class=teamheader2 width=\*>(.*?)</tr>", html, re.IGNORECASE | re.DOTALL)
    details_line = strip_tags(meta_matches[0]) if len(meta_matches) > 0 else ""
    born_line = strip_tags(meta_matches[1]) if len(meta_matches) > 1 else ""

    detail_match = re.search(
        r"#(?P<number>\d+)\s+(?P<pos>[A-Z0-9\-\/]+)\s+\|\s+(?P<ht>\d+\-\d+),\s+(?P<wt>\d+)lbs\s+\|\s+(?P<team>.*?)\s+\|\s+Experience:\s+(?P<experience>.+)$",
        details_line,
        re.IGNORECASE,
    )

    if detail_match:
        pos = clean(detail_match.group("pos"))
        ht = clean(detail_match.group("ht"))
        wt = clean(detail_match.group("wt"))
        raw_team = clean(detail_match.group("team"))
        experience = clean(detail_match.group("experience"))
    else:
        pos = ""
        ht = ""
        wt = ""
        raw_team = ""
        experience = ""

    age_match = re.search(r"Born:\s.*?\((\d+)\)", born_line, re.IGNORECASE)
    age = age_match.group(1) if age_match else ""

    attributes_section = re.search(
        r"&nbsp;Attributes</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    current_row_match = re.search(
        r"<tr class=row1 align=right>(.*?)</tr>",
        attributes_section.group(1) if attributes_section else "",
        re.IGNORECASE | re.DOTALL,
    )

    values = []
    if current_row_match:
        values = [
            strip_tags(cell)
            for cell in re.findall(r"<td class=main[^>]*>(.*?)</td>", current_row_match.group(1), re.IGNORECASE | re.DOTALL)
        ]

    attr_values = values[1:1 + len(ATTR_KEYS)] if len(values) > len(ATTR_KEYS) else []
    player = {
        "playerId": f"player{player_id_from_file(filename)}",
        "name": name,
        "url": f"../players/{filename}",
        "team": team_lookup.get(normalize_name(raw_team), raw_team),
        "teamLabel": raw_team,
        "pos": pos,
        "age": age,
        "ht": ht,
        "wt": wt,
        "experience": experience,
        "birdYears": parse_bird_years(html),
        "source": "player_page",
    }
    player.update(parse_current_salary(html))
    player.update(parse_player_awards_and_achievements(html))
    player["transactions"] = parse_player_transactions(html)

    for key, value in zip(ATTR_KEYS, attr_values):
        player[key] = value

    rating_data = find_rating(ratings, name, filename)
    player["overall"] = rating_data.get("overall", "")
    player["potential"] = rating_data.get("potential", "")
    player["greed"] = rating_data.get("greed", "")
    player["playForWinner"] = rating_data.get("playForWinner", "")
    player["loyalty"] = rating_data.get("loyalty", "")
    player["happiness"] = rating_data.get("happiness", "")
    return player


def parse_stat_table(table_html):
    header_match = re.search(
        r"<tr[^>]*>(?P<headers>.*?</tr>)",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    if not header_match:
        return {"headers": [], "rows": []}

    header_cells = re.findall(
        r"<td[^>]*class=header[^>]*>(.*?)</td>",
        header_match.group("headers"),
        re.IGNORECASE | re.DOTALL,
    )
    headers = [strip_tags(cell) for cell in header_cells]

    while headers and not headers[-1]:
        headers.pop()

    header_keys = make_unique_headers(headers)
    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    rows = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        values = [parse_numeric_value(cell) for cell in cells]

        if not any(str(value).strip() for value in values):
            continue

        row = {"rowClass": row_class.lower()}
        for index, key in enumerate(header_keys):
            row[key] = values[index] if index < len(values) else ""

        extra_values = values[len(header_keys):]
        if any(str(value).strip() for value in extra_values):
            row["extra"] = extra_values

        rows.append(row)

    return {
        "headers": headers,
        "rows": rows,
    }


def parse_player_data_tables(html):
    tables = {}
    logs = {"title": PLAYER_GAMELOG_TITLE, "headers": [], "rows": []}
    table_matches = re.finditer(
        r"<table[^>]*>(?P<table>.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )

    for table_match in table_matches:
        table_html = table_match.group("table")
        title_match = re.search(
            r"<td[^>]*class=tableheader[^>]*>(.*?)</td>",
            table_html,
            re.IGNORECASE | re.DOTALL,
        )
        if not title_match:
            continue

        title = strip_tags(title_match.group(1))
        if title in PLAYER_STAT_TABLES:
            table_key = slugify(title)
            tables[table_key] = {
                "title": title,
                **parse_stat_table(table_html[title_match.end():]),
            }
        elif title == PLAYER_GAMELOG_TITLE:
            logs = {
                "title": title,
                **parse_stat_table(table_html[title_match.end():]),
            }

    return tables, logs


def player_page_record_base(filename, player):
    return {
        "playerId": player.get("playerId", f"player{player_id_from_file(filename)}"),
        "name": player.get("name", ""),
        "url": player.get("url", f"../players/{filename}"),
        "team": player.get("team", ""),
        "teamLabel": player.get("teamLabel", ""),
        "pos": player.get("pos", ""),
    }


def parse_player_stats_and_gamelogs_page(html, filename, player):
    tables, logs = parse_player_data_tables(html)
    base = player_page_record_base(filename, player)

    return (
        {
            **base,
            "stats": tables,
        },
        {
            **base,
            "gameLogs": logs,
        },
    )


def parse_player_stats_page(html, filename, player):
    return parse_player_stats_and_gamelogs_page(html, filename, player)[0]


def parse_player_gamelogs_page(html, filename, player):
    return parse_player_stats_and_gamelogs_page(html, filename, player)[1]


def parse_standings_sections(html):
    sections = []
    title_matches = list(
        re.finditer(r"<td class=newheader>(.*?)</td>", html, re.IGNORECASE | re.DOTALL)
    )

    for index, title_match in enumerate(title_matches):
        section_title = strip_tags(title_match.group(1))
        start = title_match.end()
        end = title_matches[index + 1].start() if index + 1 < len(title_matches) else len(html)
        section_html = html[start:end]
        table_match = re.search(
            r"<table[^>]*>(.*?)</table>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )

        if not table_match:
            continue

        table_html = table_match.group(1)
        row_matches = re.findall(
            r"<tr class=(row1|row2)\s+align=center>(.*?)</tr>",
            table_html,
            re.IGNORECASE | re.DOTALL,
        )
        teams = []

        for row_class, row_html in row_matches:
            cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
            link_match = re.search(
                r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                row_html,
                re.IGNORECASE | re.DOTALL,
            )

            if len(cells) < 14 or not link_match:
                continue

            team_name = strip_tags(link_match.group(2))
            roster_url = clean(link_match.group(1))
            roster_file = roster_url.split("/")[-1]

            teams.append(
                {
                    "team": team_name,
                    "rosterUrl": roster_url,
                    "rosterFile": roster_file,
                    "wins": parse_numeric_value(cells[1]),
                    "losses": parse_numeric_value(cells[2]),
                    "pct": parse_numeric_value(cells[3]),
                    "gb": parse_numeric_value(cells[4]),
                    "home": strip_tags(cells[5]),
                    "road": strip_tags(cells[6]),
                    "division": strip_tags(cells[7]),
                    "conference": strip_tags(cells[8]),
                    "pf": parse_numeric_value(cells[9]),
                    "pa": parse_numeric_value(cells[10]),
                    "diff": parse_numeric_value(cells[11]),
                    "streak": strip_tags(cells[12]),
                    "last10": strip_tags(cells[13]),
                    "rowClass": row_class.lower(),
                }
            )

        if teams:
            sections.append(
                {
                    "title": section_title,
                    "slug": re.sub(r"[^a-z0-9]+", "-", section_title.lower()).strip("-"),
                    "teams": teams,
                }
            )

    return sections


def parse_capreport_sections(html):
    sections = []
    title_matches = list(
        re.finditer(r"<td class=newheader>(.*?)</td>", html, re.IGNORECASE | re.DOTALL)
    )

    for index, title_match in enumerate(title_matches):
        section_title = strip_tags(title_match.group(1))
        start = title_match.end()
        end = title_matches[index + 1].start() if index + 1 < len(title_matches) else len(html)
        section_html = html[start:end]
        table_match = re.search(
            r"<table[^>]*>(.*?)</table>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )

        if not table_match:
            continue

        table_html = table_match.group(1)
        row_matches = re.findall(
            r"<tr align=center class=(row1|row2)>(.*?)</tr>",
            table_html,
            re.IGNORECASE | re.DOTALL,
        )
        entries = []

        for row_class, row_html in row_matches:
            cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
            link_match = re.search(
                r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                row_html,
                re.IGNORECASE | re.DOTALL,
            )

            if len(cells) < 7 or not link_match:
                continue

            team_name = strip_tags(link_match.group(2))
            roster_url = clean(link_match.group(1))
            roster_file = roster_url.split("/")[-1]

            entries.append(
                {
                    "pick": parse_numeric_value(cells[0]),
                    "team": team_name,
                    "rosterUrl": roster_url,
                    "rosterFile": roster_file,
                    "salary": parse_money_value(cells[2]),
                    "salaryText": strip_tags(cells[2]),
                    "capRoom": parse_money_value(cells[3]),
                    "capRoomText": strip_tags(cells[3]),
                    "budgetRoom": parse_money_value(cells[4]),
                    "budgetRoomText": strip_tags(cells[4]),
                    "midException": parse_money_value(cells[5]),
                    "midExceptionText": strip_tags(cells[5]),
                    "lowException": parse_money_value(cells[6]),
                    "lowExceptionText": strip_tags(cells[6]),
                    "rowClass": row_class.lower(),
                }
            )

        if entries:
            sections.append(
                {
                    "title": section_title,
                    "slug": re.sub(r"[^a-z0-9]+", "-", section_title.lower()).strip("-"),
                    "entries": entries,
                }
            )

    return sections


def parse_injuries(html, team_lookup):
    table_match = re.search(
        r"<td class=header[^>]*>\s*&nbsp;Pos</td>.*?</tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )

    if not table_match:
        return []

    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
        table_match.group(1),
        re.IGNORECASE | re.DOTALL,
    )
    injuries = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 5:
            continue

        player_link = re.search(
            r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            cells[1],
            re.IGNORECASE | re.DOTALL,
        )
        team_link = re.search(
            r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            cells[2],
            re.IGNORECASE | re.DOTALL,
        )

        player_name = strip_tags(player_link.group(2)) if player_link else strip_tags(cells[1])
        player_url = clean(player_link.group(1)) if player_link else ""
        team_name = strip_tags(team_link.group(2)) if team_link else strip_tags(cells[2])
        roster_url = clean(team_link.group(1)) if team_link else ""

        injuries.append(
            {
                "pos": strip_tags(cells[0]),
                "name": player_name,
                "url": player_url,
                "team": team_lookup.get(normalize_name(team_name), team_name),
                "teamName": team_name,
                "rosterUrl": roster_url,
                "length": strip_tags(cells[3]),
                "injury": strip_tags(cells[4]),
                "rowClass": row_class.lower(),
            }
        )

    return injuries


def extract_rating_color(cell_html):
    color_match = re.search(r"bgcolor=([#A-Za-z0-9]+)", cell_html, re.IGNORECASE)
    return color_match.group(1) if color_match else ""


def normalize_player_file(url):
    url_text = normalize_schedule_url(url)
    match = re.search(r"player\d+\.htm", url_text, re.IGNORECASE)
    return match.group(0).lower() if match else ""


def normalize_color_tables(html):
    return re.sub(
        r"<table border=1 cellpadding=0 cellspacing=0><td bgcolor=([#A-Za-z0-9]+) width=10 height=10></td></tr></table>",
        lambda match: f"__COLOR__{match.group(1)}__",
        html,
        flags=re.IGNORECASE,
    )


def parse_potential_grade_tables(html, team=None, team_label=None):
    normalized_html = normalize_color_tables(html)
    section_matches = re.finditer(
        r"<tr><td class=tableheader[^>]*>\s*&nbsp;Potentials</td></tr>(.*?)(?=<tr><td class=tableheader|\Z)",
        normalized_html,
        re.IGNORECASE | re.DOTALL,
    )
    potentials = []

    for section_match in section_matches:
        section_html = section_match.group(1)
        header_match = re.search(r"<tr[^>]*align=center[^>]*>(.*?)</tr>", section_html, re.IGNORECASE | re.DOTALL)
        if not header_match:
            continue

        headers = [
            strip_tags(cell)
            for cell in re.findall(r"<td[^>]*class=header[^>]*>(.*?)</td>", header_match.group(1), re.IGNORECASE | re.DOTALL)
        ]
        headers = [header.lstrip("#").strip() or "#" for header in headers]
        row_matches = re.findall(
            r"<tr[^>]*align=center[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )

        for row_class, row_html in row_matches:
            cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
            if len(cells) < 8:
                continue

            values = [strip_tags(cell) for cell in cells]
            row = {}
            for index, header in enumerate(headers):
                if index < len(values):
                    row[header] = values[index]

            player_link = re.search(
                r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
                row_html,
                re.IGNORECASE | re.DOTALL,
            )
            name = strip_tags(player_link.group(3)) if player_link else row.get("Name", "")
            player_url = normalize_schedule_url(player_link.group(2)) if player_link else ""
            if not name:
                continue

            grades = {}
            for key in POTENTIAL_KEYS:
                value = clean(row.get(key, ""))
                if value:
                    grades[key] = value

            if not grades:
                continue

            cur_color_match = re.search(r"__COLOR__([#A-Za-z0-9]+)__", cells[headers.index("Cur")] if "Cur" in headers and headers.index("Cur") < len(cells) else "", re.IGNORECASE)
            fut_color_match = re.search(r"__COLOR__([#A-Za-z0-9]+)__", cells[headers.index("Fut")] if "Fut" in headers and headers.index("Fut") < len(cells) else "", re.IGNORECASE)
            potentials.append(
                {
                    "name": name,
                    "url": player_url,
                    "file": normalize_player_file(player_url),
                    "team": team or "",
                    "teamLabel": team_label or "",
                    "potentials": grades,
                    "potentialCurrentColor": cur_color_match.group(1) if cur_color_match else "",
                    "potentialFutureColor": fut_color_match.group(1) if fut_color_match else "",
                    "rowClass": row_class.lower(),
                }
            )

    return potentials


def build_potential_grade_lookup(entries):
    by_file = {}
    by_name = {}

    for entry in entries:
        file_key = entry.get("file", "")
        name_key = normalize_name(entry.get("name", ""))
        if file_key:
            by_file[file_key] = entry
        if name_key:
            by_name.setdefault(name_key, entry)

    return by_file, by_name


def attach_potential_grades(players, potential_entries):
    by_file, by_name = build_potential_grade_lookup(potential_entries)
    attached = 0

    for player in players:
        file_key = normalize_player_file(player.get("url", ""))
        name_key = normalize_name(player.get("name", ""))
        entry = by_file.get(file_key) or by_name.get(name_key)
        if not entry:
            continue

        player["potentials"] = entry.get("potentials", {})
        if entry.get("potentialCurrentColor"):
            player["potentialCurrentColor"] = entry["potentialCurrentColor"]
        if entry.get("potentialFutureColor"):
            player["potentialFutureColor"] = entry["potentialFutureColor"]
        attached += 1

    return attached


def zero_contracts(years):
    return [
        {
            "year": year,
            "salary": 0.0,
            "salaryText": "$0",
        }
        for year in years
    ]


def parse_contract_table(html, team=None, team_label=None):
    table_match = re.search(
        r"<tr><td class=tableheader[^>]*>\s*&nbsp;Contract</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )
    if not table_match:
        return [], []

    table_html = table_match.group(1)
    header_match = re.search(r"<tr[^>]*align=center[^>]*>(.*?)</tr>", table_html, re.IGNORECASE | re.DOTALL)
    if not header_match:
        return [], []

    headers = [
        strip_tags(cell)
        for cell in re.findall(r"<td[^>]*class=header[^>]*>(.*?)</td>", header_match.group(1), re.IGNORECASE | re.DOTALL)
    ]
    years = [header for header in headers if re.fullmatch(r"\d{4}", header)]
    if not years:
        return [], []

    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*align=center[^>]*>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    contracts = []
    bird_years_by_file = {}
    bird_years_by_name = {}

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < len(years) + 1:
            continue

        player_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[0],
            re.IGNORECASE | re.DOTALL,
        )
        name = strip_tags(player_link.group(3)) if player_link else strip_tags(cells[0])
        player_url = normalize_schedule_url(player_link.group(2)) if player_link else ""
        if not name:
            continue

        bird_years = parse_bird_years(row_html)
        file_key = normalize_player_file(player_url)
        name_key = normalize_name(name)
        if bird_years:
            if file_key:
                bird_years_by_file[file_key] = bird_years
            if name_key:
                bird_years_by_name[name_key] = bird_years

        year_entries = []
        for index, year in enumerate(years, start=1):
            salary_text = strip_tags(cells[index]) if index < len(cells) else "$0"
            if not salary_text:
                salary_text = "$0"
            year_entries.append(
                {
                    "year": year,
                    "salary": parse_money_value(salary_text) or 0.0,
                    "salaryText": salary_text,
                }
            )

        contracts.append(
            {
                "name": name,
                "url": player_url,
                "file": file_key,
                "team": team or "",
                "teamLabel": team_label or "",
                "contracts": year_entries,
                "birdYears": bird_years,
                "rowClass": row_class.lower(),
            }
        )

    for entry in contracts:
        if entry.get("birdYears"):
            continue
        file_key = entry.get("file", "")
        name_key = normalize_name(entry.get("name", ""))
        entry["birdYears"] = bird_years_by_file.get(file_key) or bird_years_by_name.get(name_key) or 0

    return contracts, years


def attach_contracts(players, contract_entries, contract_years):
    by_file = {}
    by_name = {}
    duplicate_contract_names = set()
    player_name_counts = {}

    for player in players:
        name_key = normalize_name(player.get("name", ""))
        if name_key:
            player_name_counts[name_key] = player_name_counts.get(name_key, 0) + 1

    for entry in contract_entries:
        file_key = entry.get("file", "")
        name_key = normalize_name(entry.get("name", ""))
        if file_key:
            by_file[file_key] = entry
        if name_key:
            if name_key in by_name:
                duplicate_contract_names.add(name_key)
            else:
                by_name[name_key] = entry

    for name_key in duplicate_contract_names:
        by_name.pop(name_key, None)

    attached = 0
    default_contracts = zero_contracts(contract_years)

    for player in players:
        file_key = normalize_player_file(player.get("url", ""))
        name_key = normalize_name(player.get("name", ""))
        entry = by_file.get(file_key)
        if not entry and player_name_counts.get(name_key) == 1:
            entry = by_name.get(name_key)
        if entry:
            player["contracts"] = entry.get("contracts", zero_contracts(contract_years))
            if entry.get("birdYears"):
                player["birdYears"] = int(entry.get("birdYears") or 0)
            attached += 1
        else:
            player["contracts"] = [contract.copy() for contract in default_contracts]
            player.setdefault("birdYears", 0)

    return attached


def latest_stat_team(stats_entry):
    rows = stats_entry.get("stats", {}).get("season_averages", {}).get("rows", [])

    for row in rows:
        team = clean(row.get("team", ""))
        if not team or normalize_name(team) in {"fa", "career", "draft"}:
            continue
        return team

    return ""


def build_stat_team_lookup(players, player_stats):
    players_by_file = {
        normalize_player_file(player.get("url", "")): player
        for player in players
        if normalize_player_file(player.get("url", ""))
    }
    players_by_name = {
        normalize_name(player.get("name", "")): player
        for player in players
        if normalize_name(player.get("name", ""))
    }
    candidates = {}

    for stats_entry in player_stats:
        file_key = normalize_player_file(stats_entry.get("url", ""))
        name_key = normalize_name(stats_entry.get("name", ""))
        player = players_by_file.get(file_key) if file_key else players_by_name.get(name_key)
        stat_team = latest_stat_team(stats_entry)

        if not player or not stat_team:
            continue
        if normalize_name(player.get("team")) in {"fa", "draft"} or normalize_name(player.get("teamLabel")) in {"fa", "freeagent", "freeagents", "draft"}:
            continue

        stat_team_key = normalize_name(stat_team)
        candidate = (
            player.get("team", "") or "",
            player.get("teamLabel", "") or player.get("team", "") or "",
        )
        team_counts = candidates.setdefault(stat_team_key, {})
        team_counts[candidate] = team_counts.get(candidate, 0) + 1

    lookup = {}
    for stat_team_key, team_counts in candidates.items():
        team_id, team_label = min(
            team_counts,
            key=lambda candidate: (-team_counts[candidate], candidate[0], candidate[1]),
        )
        lookup[stat_team_key] = {
            "lastTeamId": team_id,
            "lastTeam": team_label,
        }

    return lookup


def build_last_team_lookup(players, player_stats=None, stat_team_lookup=None):
    player_stats = player_stats or []
    stat_team_lookup = stat_team_lookup or {}
    stats_by_file = {
        normalize_player_file(entry.get("url", "")): entry
        for entry in player_stats
        if normalize_player_file(entry.get("url", ""))
    }
    stats_by_name = {
        normalize_name(entry.get("name", "")): entry
        for entry in player_stats
        if normalize_name(entry.get("name", ""))
    }
    lookup = {}

    for player in players:
        file_key = normalize_player_file(player.get("url", ""))
        name_key = normalize_name(player.get("name", ""))
        team = player.get("team", "")
        team_label = player.get("teamLabel", "")
        stats_entry = stats_by_file.get(file_key) if file_key else stats_by_name.get(name_key)
        stat_team = latest_stat_team(stats_entry) if stats_entry else ""

        if normalize_name(team) in {"fa", "draft"} or normalize_name(team_label) in {"fa", "freeagent", "freeagents", "draft"}:
            team = ""
            team_label = ""

        if (not team and not team_label) and stat_team:
            stat_team_entry = stat_team_lookup.get(normalize_name(stat_team), {})
            team = stat_team_entry.get("lastTeamId", "")
            team_label = stat_team_entry.get("lastTeam", "") or stat_team

        if not team and not team_label:
            continue

        value = {
            "lastTeamId": team or "",
            "lastTeam": team_label or team or "",
            "birdYears": player.get("birdYears", 0) or 0,
        }
        if file_key:
            lookup[file_key] = value
        if name_key:
            lookup.setdefault(name_key, value)

    return lookup


def attach_last_team(players, last_team_lookup):
    attached = 0

    for player in players:
        file_key = normalize_player_file(player.get("url", ""))
        name_key = normalize_name(player.get("name", ""))
        entry = last_team_lookup.get(file_key) if file_key else last_team_lookup.get(name_key)

        if entry:
            player["lastTeamId"] = entry.get("lastTeamId", "")
            player["lastTeam"] = entry.get("lastTeam", "")
            player["birdYears"] = entry.get("birdYears", player.get("birdYears", 0) or 0)
            attached += 1
        else:
            player.setdefault("lastTeamId", "")
            player.setdefault("lastTeam", "")
            player.setdefault("birdYears", player.get("birdYears", 0) or 0)

    return attached


def parse_free_agents(html, ratings, last_team_lookup=None):
    last_team_lookup = last_team_lookup or {}
    normalized_html = re.sub(
        r"<table border=1 cellpadding=0 cellspacing=0><td bgcolor=([#A-Za-z0-9]+) width=10 height=10></td></tr></table>",
        lambda match: f"__COLOR__{match.group(1)}__",
        html,
        flags=re.IGNORECASE,
    )
    row_matches = re.findall(
        r"<tr align=center class=(row1|row2)>(.*?)</tr>",
        normalized_html,
        re.IGNORECASE | re.DOTALL,
    )
    free_agents = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 24:
            continue

        player_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[1],
            re.IGNORECASE | re.DOTALL,
        )
        if not player_link:
            continue

        name = strip_tags(player_link.group(3))
        player_url = normalize_schedule_url(player_link.group(2))
        player_file = player_url.split("/")[-1]
        rating_data = find_rating(ratings, name, player_file)
        file_key = normalize_player_file(player_file)
        last_team = last_team_lookup.get(file_key) if file_key else last_team_lookup.get(normalize_name(name))
        last_team = last_team or {}
        player_number = parse_numeric_value(cells[0])
        cur_color_match = re.search(r"__COLOR__([#A-Za-z0-9]+)__", cells[6], re.IGNORECASE)
        fut_color_match = re.search(r"__COLOR__([#A-Za-z0-9]+)__", cells[7], re.IGNORECASE)
        cur_color = cur_color_match.group(1) if cur_color_match else extract_rating_color(cells[6])
        fut_color = fut_color_match.group(1) if fut_color_match else extract_rating_color(cells[7])

        agent = {
            "number": player_number,
            "name": name,
            "url": player_url,
            "file": player_file,
            "pos": strip_tags(cells[2]),
            "age": parse_numeric_value(cells[3]),
            "ht": strip_tags(cells[4]),
            "wt": parse_numeric_value(cells[5]),
            "currentRatingColor": cur_color,
            "futureRatingColor": fut_color,
            "currentRating": rating_data.get("overall", "") or "",
            "futureRating": rating_data.get("potential", "") or "",
            "lastTeam": last_team.get("lastTeam", "") or "",
            "lastTeamId": last_team.get("lastTeamId", "") or "",
            "birdYears": last_team.get("birdYears", 0) or 0,
            "greed": rating_data.get("greed", "") or "",
            "playForWinner": rating_data.get("playForWinner", "") or "",
            "loyalty": rating_data.get("loyalty", "") or "",
            "happiness": rating_data.get("happiness", "") or "",
            "Ins": parse_numeric_value(cells[8]),
            "Jps": parse_numeric_value(cells[9]),
            "Fts": parse_numeric_value(cells[10]),
            "3ps": parse_numeric_value(cells[11]),
            "Hnd": parse_numeric_value(cells[12]),
            "Pas": parse_numeric_value(cells[13]),
            "Orb": parse_numeric_value(cells[14]),
            "Drb": parse_numeric_value(cells[15]),
            "Psd": parse_numeric_value(cells[16]),
            "Prd": parse_numeric_value(cells[17]),
            "Stl": parse_numeric_value(cells[18]),
            "Blk": parse_numeric_value(cells[19]),
            "Qkn": parse_numeric_value(cells[20]),
            "Jmp": parse_numeric_value(cells[21]),
            "Str": parse_numeric_value(cells[22]),
            "Sta": parse_numeric_value(cells[23]),
            "rowClass": row_class.lower(),
        }
        free_agents.append(agent)

    return free_agents


def parse_leader_rows(table_html, team_lookup):
    row_matches = re.findall(
        r"<tr class=(row1|row2)>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    leaders = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 5:
            continue

        rank = parse_numeric_value(cells[0])
        player_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[2],
            re.IGNORECASE | re.DOTALL,
        )
        team_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[3],
            re.IGNORECASE | re.DOTALL,
        )

        player_name = strip_tags(cells[2])
        team_name = strip_tags(cells[3])
        value_text = strip_tags(cells[4])

        if player_name == "" and team_name == "" and value_text == "":
            continue

        leaders.append(
            {
                "rank": rank,
                "player": player_name,
                "playerUrl": normalize_schedule_url(player_link.group(2)) if player_link else "",
                "playerFile": normalize_schedule_url(player_link.group(2)).split("/")[-1] if player_link else "",
                "team": team_lookup.get(normalize_name(team_name), team_name) if team_name else "",
                "teamName": team_name,
                "teamUrl": normalize_schedule_url(team_link.group(2)) if team_link else "",
                "teamFile": normalize_schedule_url(team_link.group(2)).split("/")[-1] if team_link else "",
                "value": parse_numeric_value(value_text),
                "valueText": value_text,
                "rowClass": row_class.lower(),
            }
        )

    return leaders


def parse_leaders_sections(html, team_lookup):
    sections = []
    title_matches = list(
        re.finditer(r"<tr><td class=newheader>(.*?)</td></tr>", html, re.IGNORECASE | re.DOTALL)
    )

    for index, title_match in enumerate(title_matches):
        title = strip_tags(title_match.group(1))
        start = title_match.end()
        end = title_matches[index + 1].start() if index + 1 < len(title_matches) else len(html)
        section_html = html[start:end]
        categories = []
        table_matches = re.findall(
            r"<table width=375 border=0 cellspacing=0 cellpadding=0>(.*?)</table>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )

        for table_html in table_matches:
            category_match = re.search(
                r"<tr><td class=tableheader colspan=6>&nbsp;(.*?)</td></tr>",
                table_html,
                re.IGNORECASE | re.DOTALL,
            )
            if not category_match:
                continue

            category_name = strip_tags(category_match.group(1))
            leaders = parse_leader_rows(table_html, team_lookup)
            categories.append(
                {
                    "title": category_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", category_name.lower()).strip("-"),
                    "leaders": leaders,
                }
            )

        sections.append(
            {
                "title": title,
                "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
                "categories": categories,
            }
        )

    return sections


def parse_award_rows(table_html, team_lookup):
    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    awards = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 9:
            continue

        date_text = strip_tags(cells[0])
        player_name = strip_tags(cells[2])
        team_name = strip_tags(cells[3])
        if not date_text and not player_name and not team_name:
            continue

        player_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[2],
            re.IGNORECASE | re.DOTALL,
        )
        team_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[3],
            re.IGNORECASE | re.DOTALL,
        )
        player_url = normalize_schedule_url(player_link.group(2)) if player_link else ""
        team_url = normalize_schedule_url(team_link.group(2)) if team_link else ""

        awards.append(
            {
                "date": date_text,
                "pos": strip_tags(cells[1]),
                "player": player_name,
                "playerUrl": player_url,
                "playerFile": player_url.split("/")[-1] if player_url else "",
                "team": team_lookup.get(normalize_name(team_name), team_name) if team_name else "",
                "teamName": team_name,
                "teamUrl": team_url,
                "teamFile": team_url.split("/")[-1] if team_url else "",
                "ppg": parse_numeric_value(cells[4]),
                "rpg": parse_numeric_value(cells[5]),
                "apg": parse_numeric_value(cells[6]),
                "spg": parse_numeric_value(cells[7]),
                "bpg": parse_numeric_value(cells[8]),
                "rowClass": row_class.lower(),
            }
        )

    return awards


def parse_awards_sections(html, team_lookup):
    sections = []
    title_matches = list(
        re.finditer(r"<tr><td class=newheader>(.*?)</td></tr>", html, re.IGNORECASE | re.DOTALL)
    )

    for index, title_match in enumerate(title_matches):
        title = strip_tags(title_match.group(1))
        start = title_match.end()
        end = title_matches[index + 1].start() if index + 1 < len(title_matches) else len(html)
        section_html = html[start:end]
        categories = []
        table_matches = re.findall(
            r"<table width=800 border=\s*0\s*cellspacing=\s*0\s*cellpadding=\s*0\s*>(.*?)</table>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )

        for table_html in table_matches:
            category_match = re.search(
                r"<tr><td class=tableheader colspan=\d+>&nbsp;(.*?)</td></tr>",
                table_html,
                re.IGNORECASE | re.DOTALL,
            )
            if not category_match:
                continue

            category_name = strip_tags(category_match.group(1))
            awards = parse_award_rows(table_html, team_lookup)
            categories.append(
                {
                    "title": category_name,
                    "slug": re.sub(r"[^a-z0-9]+", "-", category_name.lower()).strip("-"),
                    "awards": awards,
                }
            )

        sections.append(
            {
                "title": title,
                "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
                "categories": categories,
            }
        )

    return sections


def parse_season_award_rows(table_html):
    row_matches = re.findall(
        r"<tr[^>]*class=(row1|row2)[^>]*>(.*?)</tr>",
        table_html,
        re.IGNORECASE | re.DOTALL,
    )
    awards = []

    for row_class, row_html in row_matches:
        cells = re.findall(r"<td[^>]*class=main[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 9:
            continue

        award = strip_tags(cells[0])
        person_name = strip_tags(cells[2])
        team_name = strip_tags(cells[3])
        if not award and not person_name and not team_name:
            continue

        person_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[2],
            re.IGNORECASE | re.DOTALL,
        )
        team_link = re.search(
            r'<a[^>]+href=(["\']?)([^"\'\s>]+)\1[^>]*>(.*?)</a>',
            cells[3],
            re.IGNORECASE | re.DOTALL,
        )
        person_url = normalize_schedule_url(person_link.group(2)) if person_link else ""
        team_url = normalize_schedule_url(team_link.group(2)) if team_link else ""

        awards.append(
            {
                "award": award,
                "pos": strip_tags(cells[1]),
                "person": person_name,
                "personUrl": person_url,
                "personFile": person_url.split("/")[-1] if person_url else "",
                "team": team_name,
                "teamUrl": team_url,
                "teamFile": team_url.split("/")[-1] if team_url else "",
                "ppg": parse_numeric_value(cells[4]),
                "rpg": parse_numeric_value(cells[5]),
                "apg": parse_numeric_value(cells[6]),
                "spg": parse_numeric_value(cells[7]),
                "bpg": parse_numeric_value(cells[8]),
                "rowClass": row_class.lower(),
            }
        )

    return awards


def empty_season_awards_data():
    return {
        "source": os.path.basename(SEASON_AWARDS_PATH),
        "missing": True,
        "sectionCount": 0,
        "awardCount": 0,
        "sections": [],
    }


def parse_season_awards_sections(html):
    sections = []
    table_matches = re.findall(
        r"<table[^>]*>\s*<tr><td class=tableheader[^>]*>&nbsp;(.*?)</td></tr>(.*?)</table>",
        html,
        re.IGNORECASE | re.DOTALL,
    )

    for title_html, table_html in table_matches:
        title = strip_tags(title_html)
        if not title:
            continue

        sections.append(
            {
                "title": title,
                "slug": re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-"),
                "awards": parse_season_award_rows(table_html),
            }
        )

    return {
        "source": os.path.basename(SEASON_AWARDS_PATH),
        "missing": False,
        "sectionCount": len(sections),
        "awardCount": sum(len(section["awards"]) for section in sections),
        "sections": sections,
    }


def normalize_schedule_url(url):
    return clean(url).replace("\\", "/")


def strip_leading_at_sign(value):
    text = clean(value)
    if text.startswith("@"):
        return clean(text[1:])
    return text


def parse_played_schedule_game(game_html, team_lookup):
    link_match = re.search(
        r"<a[^>]+href=(['\"]?)([^'\"\s>]+)\1[^>]*>(.*?)</a>",
        game_html,
        re.IGNORECASE | re.DOTALL,
    )
    if not link_match:
        return None

    boxscore_url = normalize_schedule_url(link_match.group(2))
    summary = strip_tags(link_match.group(3))
    score_match = re.match(
        r"(?P<first>.+?)\s+(?P<first_score>\d+)\s*,\s*(?P<second>.+?)\s+(?P<second_score>\d+)$",
        summary,
        re.IGNORECASE,
    )
    if not score_match:
        return None

    first_raw = clean(score_match.group("first"))
    second_raw = clean(score_match.group("second"))
    first_team = strip_leading_at_sign(first_raw)
    second_team = strip_leading_at_sign(second_raw)
    first_score = int(score_match.group("first_score"))
    second_score = int(score_match.group("second_score"))
    first_is_home = first_raw.startswith("@")
    second_is_home = second_raw.startswith("@")

    if first_is_home == second_is_home:
        return None

    if first_is_home:
        home_team, home_score = first_team, first_score
        away_team, away_score = second_team, second_score
    else:
        home_team, home_score = second_team, second_score
        away_team, away_score = first_team, first_score

    return {
        "status": "completed",
        "matchupText": summary,
        "boxscoreUrl": boxscore_url,
        "boxscoreFile": boxscore_url.split("/")[-1],
        "homeTeam": team_lookup.get(normalize_name(home_team), home_team),
        "homeTeamName": home_team,
        "homeScore": home_score,
        "awayTeam": team_lookup.get(normalize_name(away_team), away_team),
        "awayTeamName": away_team,
        "awayScore": away_score,
        "winner": team_lookup.get(normalize_name(home_team), home_team) if home_score > away_score else team_lookup.get(normalize_name(away_team), away_team),
        "winnerName": home_team if home_score > away_score else away_team,
        "margin": abs(home_score - away_score),
    }


def parse_scheduled_game_links(game_html, team_lookup):
    link_matches = re.findall(
        r"<a[^>]+href=(['\"]?)([^'\"\s>]+)\1[^>]*>(.*?)</a>",
        game_html,
        re.IGNORECASE | re.DOTALL,
    )
    if len(link_matches) < 2:
        return None

    away_url = normalize_schedule_url(link_matches[0][1])
    away_name = strip_tags(link_matches[0][2])
    home_url = normalize_schedule_url(link_matches[1][1])
    home_name = strip_tags(link_matches[1][2])

    return {
        "status": "scheduled",
        "matchupText": strip_tags(game_html),
        "awayTeam": team_lookup.get(normalize_name(away_name), away_name),
        "awayTeamName": away_name,
        "awayRosterUrl": away_url,
        "awayRosterFile": away_url.split("/")[-1],
        "homeTeam": team_lookup.get(normalize_name(home_name), home_name),
        "homeTeamName": home_name,
        "homeRosterUrl": home_url,
        "homeRosterFile": home_url.split("/")[-1],
    }


def parse_schedule_sections(html, team_lookup):
    sections = []
    section_matches = list(
        re.finditer(r"<tr><td class=tableheader>&nbsp;(.*?)</td></tr>", html, re.IGNORECASE | re.DOTALL)
    )

    for index, section_match in enumerate(section_matches):
        section_title = strip_tags(section_match.group(1))
        start = section_match.end()
        end = section_matches[index + 1].start() if index + 1 < len(section_matches) else len(html)
        section_html = html[start:end]
        date_tables = re.findall(
            r"<table width=250 border=0 cellspacing=0 cellpadding=0>(.*?)</table>",
            section_html,
            re.IGNORECASE | re.DOTALL,
        )
        days = []

        for table_html in date_tables:
            date_match = re.search(
                r"<td class=header[^>]*>&nbsp;(.*?)</td>",
                table_html,
                re.IGNORECASE | re.DOTALL,
            )
            if not date_match:
                continue

            date_text = strip_tags(date_match.group(1))
            row_matches = re.findall(
                r"<tr[^>]*class=(row1|row2)[^>]*>\s*<td[^>]*class=main[^>]*>(.*?)</td>\s*</tr>",
                table_html,
                re.IGNORECASE | re.DOTALL,
            )
            games = []

            for row_class, game_html in row_matches:
                game = parse_played_schedule_game(game_html, team_lookup)
                if not game:
                    game = parse_scheduled_game_links(game_html, team_lookup)
                if not game:
                    continue

                game["rowClass"] = row_class.lower()
                games.append(game)

            if games:
                days.append(
                    {
                        "date": date_text,
                        "games": games,
                    }
                )

        if days:
            sections.append(
                {
                    "title": section_title,
                    "slug": re.sub(r"[^a-z0-9]+", "-", section_title.lower()).strip("-"),
                    "days": days,
                }
            )

    return sections


def build_game_results(schedule_sections):
    results = []

    for section in schedule_sections:
        for day in section.get("days", []):
            for game in day.get("games", []):
                if game.get("status") != "completed":
                    continue

                results.append(
                    {
                        "section": section.get("title", ""),
                        "sectionSlug": section.get("slug", ""),
                        "date": day.get("date", ""),
                        "matchupText": game.get("matchupText", ""),
                        "boxscoreUrl": game.get("boxscoreUrl", ""),
                        "boxscoreFile": game.get("boxscoreFile", ""),
                        "homeTeam": game.get("homeTeam", ""),
                        "homeTeamName": game.get("homeTeamName", ""),
                        "homeScore": game.get("homeScore", ""),
                        "awayTeam": game.get("awayTeam", ""),
                        "awayTeamName": game.get("awayTeamName", ""),
                        "awayScore": game.get("awayScore", ""),
                        "winner": game.get("winner", ""),
                        "winnerName": game.get("winnerName", ""),
                        "loser": game.get("awayTeam", "") if game.get("winner") == game.get("homeTeam") else game.get("homeTeam", ""),
                        "loserName": game.get("awayTeamName", "") if game.get("winner") == game.get("homeTeam") else game.get("homeTeamName", ""),
                        "margin": game.get("margin", ""),
                    }
                )

    return results

def main():
    os.makedirs(DATABASE_DIR, exist_ok=True)

    if not os.path.exists(ROSTERS_DIR):
        print(f"Error: {ROSTERS_DIR} not found.")
        return

    if not os.path.exists(PLAYERS_DIR):
        print(f"Error: {PLAYERS_DIR} not found.")
        return

    if not os.path.exists(STANDINGS_PATH):
        print(f"Error: {STANDINGS_PATH} not found.")
        return

    if not os.path.exists(CAPREPORT_PATH):
        print(f"Error: {CAPREPORT_PATH} not found.")
        return

    if not os.path.exists(INJURIES_PATH):
        print(f"Error: {INJURIES_PATH} not found.")
        return

    if not os.path.exists(SCHEDULE_PATH):
        print(f"Error: {SCHEDULE_PATH} not found.")
        return

    if not os.path.exists(FREE_AGENTS_PATH):
        print(f"Error: {FREE_AGENTS_PATH} not found.")
        return

    if not os.path.exists(LEADERS_PATH):
        print(f"Error: {LEADERS_PATH} not found.")
        return

    ratings = load_mdb_ratings()
    all_teams = []
    all_team_stats = []
    potential_grade_entries = []
    contract_entries = []
    contract_years = []
    roster_files = [f for f in os.listdir(ROSTERS_DIR) if f.lower().endswith((".htm", ".html"))]

    for file in roster_files:
        path = os.path.join(ROSTERS_DIR, file)
        with open(path, "r", encoding="latin-1") as f:
            html = f.read()

        team = extract_team_metadata(html, file)
        all_teams.append(team)
        all_team_stats.append(parse_team_season_info(html, team))
        potential_grade_entries.extend(parse_potential_grade_tables(html, team=team["id"], team_label=team["name"]))
        roster_contracts, roster_contract_years = parse_contract_table(html, team=team["id"], team_label=team["name"])
        contract_entries.extend(roster_contracts)
        for year in roster_contract_years:
            if year not in contract_years:
                contract_years.append(year)

    team_lookup = build_team_lookup(all_teams)
    all_players = []
    all_player_stats = []
    all_player_gamelogs = []
    player_files = sorted(
        f for f in os.listdir(PLAYERS_DIR)
        if f.lower().endswith((".htm", ".html"))
    )

    for file in player_files:
        path = os.path.join(PLAYERS_DIR, file)
        with open(path, "r", encoding="latin-1") as f:
            html = f.read()

        player = parse_player_page(html, file, team_lookup, ratings)
        if player:
            player_stats, player_gamelogs = parse_player_stats_and_gamelogs_page(html, file, player)
            all_players.append(player)
            all_player_stats.append(player_stats)
            all_player_gamelogs.append(player_gamelogs)

    with open(FREE_AGENTS_PATH, "r", encoding="latin-1") as f:
        free_agents_html = f.read()

    potential_grade_entries.extend(parse_potential_grade_tables(free_agents_html, team="FA", team_label="FA"))

    if os.path.exists(DRAFT_PATH):
        with open(DRAFT_PATH, "r", encoding="latin-1") as f:
            draft_html = f.read()
        potential_grade_entries.extend(parse_potential_grade_tables(draft_html, team="Draft", team_label="Draft"))
    else:
        print(f"Warning: {DRAFT_PATH} not found. Skipping draft potential grades.")

    stat_team_lookup = build_stat_team_lookup(all_players, all_player_stats)
    last_team_lookup = build_last_team_lookup(all_players, all_player_stats, stat_team_lookup)
    attached_last_team_count = attach_last_team(all_players, last_team_lookup)
    attached_potential_count = attach_potential_grades(all_players, potential_grade_entries)
    attached_contract_count = attach_contracts(all_players, contract_entries, contract_years)
    all_players.sort(key=lambda player: player["name"])
    all_player_stats.sort(key=lambda player: player["name"])
    all_player_gamelogs.sort(key=lambda player: player["name"])

    atomic_dump_json(PLAYERS_OUT, all_players, separators=(",", ":"))

    player_stats_data = {
        "source": "players/*.htm",
        "players": all_player_stats,
    }

    atomic_dump_json(PLAYER_STATS_OUT, player_stats_data, separators=(",", ":"))

    player_gamelogs_data = {
        "source": "players/*.htm",
        "players": all_player_gamelogs,
    }

    atomic_dump_json(PLAYER_GAMELOGS_OUT, player_gamelogs_data, separators=(",", ":"))

    team_stats_data = {
        "source": "rosters/*.htm",
        "teams": sorted(all_team_stats, key=lambda team: team["team"]),
    }

    atomic_dump_json(TEAM_STATS_OUT, team_stats_data, indent=4)

    attach_star_players(all_teams, all_players)
    all_teams.sort(key=lambda team: team["name"])

    atomic_dump_json(TEAMS_OUT, all_teams, indent=4)

    with open(STANDINGS_PATH, "r", encoding="latin-1") as f:
        standings_html = f.read()

    standings_data = {
        "source": os.path.basename(STANDINGS_PATH),
        "sections": parse_standings_sections(standings_html),
    }

    atomic_dump_json(STANDINGS_OUT, standings_data, indent=4)

    with open(CAPREPORT_PATH, "r", encoding="latin-1") as f:
        capreport_html = f.read()

    capreport_data = {
        "source": os.path.basename(CAPREPORT_PATH),
        "sections": parse_capreport_sections(capreport_html),
    }

    atomic_dump_json(CAPREPORT_OUT, capreport_data, indent=4)

    with open(INJURIES_PATH, "r", encoding="latin-1") as f:
        injuries_html = f.read()

    injuries_data = {
        "source": os.path.basename(INJURIES_PATH),
        "injuries": parse_injuries(injuries_html, team_lookup),
    }

    atomic_dump_json(INJURIES_OUT, injuries_data, indent=4)

    with open(SCHEDULE_PATH, "r", encoding="latin-1") as f:
        schedule_html = f.read()

    schedule_data = {
        "source": os.path.basename(SCHEDULE_PATH),
        "sections": parse_schedule_sections(schedule_html, team_lookup),
    }

    atomic_dump_json(SCHEDULE_OUT, schedule_data, indent=4)

    game_results_data = {
        "source": os.path.basename(SCHEDULE_PATH),
        "results": build_game_results(schedule_data["sections"]),
    }

    atomic_dump_json(GAME_RESULTS_OUT, game_results_data, indent=4)

    free_agents_data = {
        "source": os.path.basename(FREE_AGENTS_PATH),
        "players": parse_free_agents(free_agents_html, ratings, last_team_lookup),
    }

    atomic_dump_json(FREE_AGENTS_OUT, free_agents_data, indent=4)

    with open(LEADERS_PATH, "r", encoding="latin-1") as f:
        leaders_html = f.read()

    leaders_data = {
        "source": os.path.basename(LEADERS_PATH),
        "sections": parse_leaders_sections(leaders_html, team_lookup),
    }

    atomic_dump_json(LEADERS_OUT, leaders_data, indent=4)

    awards_section_count = 0
    awards_count = 0
    if os.path.exists(AWARDS_PATH):
        with open(AWARDS_PATH, "r", encoding="latin-1") as f:
            awards_html = f.read()

        awards_data = {
            "source": os.path.basename(AWARDS_PATH),
            "sections": parse_awards_sections(awards_html, team_lookup),
        }
        awards_section_count = len(awards_data["sections"])
        awards_count = sum(
            len(category.get("awards", []))
            for section in awards_data["sections"]
            for category in section.get("categories", [])
        )

        atomic_dump_json(AWARDS_OUT, awards_data, indent=4)
    else:
        print(f"Warning: {AWARDS_PATH} not found. Skipping awards JSON.")

    if os.path.exists(SEASON_AWARDS_PATH):
        with open(SEASON_AWARDS_PATH, "r", encoding="latin-1") as f:
            season_awards_html = f.read()
        season_awards_data = parse_season_awards_sections(season_awards_html)
    else:
        season_awards_data = empty_season_awards_data()

    atomic_dump_json(SEASON_AWARDS_OUT, season_awards_data, indent=4)
    if season_awards_data.get("missing"):
        print(f"Warning: {SEASON_AWARDS_PATH} not found. Wrote empty season awards JSON.")
    else:
        print(
            f"Final count: {season_awards_data['awardCount']} season awards across "
            f"{season_awards_data['sectionCount']} sections saved to {SEASON_AWARDS_OUT}"
        )
        
    print(f"\nFinal count: {len(all_players)} players saved to {PLAYERS_OUT}")
    print(f"Final count: {attached_last_team_count} players enriched with last-team data")
    print(f"Final count: {attached_potential_count} players enriched with potential letter grades")
    print(f"Final count: {attached_contract_count} players enriched with roster contract tables")
    print(f"Final count: {len(all_player_stats)} player stat records saved to {PLAYER_STATS_OUT}")
    print(f"Final count: {len(all_player_gamelogs)} player game log records saved to {PLAYER_GAMELOGS_OUT}")
    print(f"Final count: {len(team_stats_data['teams'])} team stat records saved to {TEAM_STATS_OUT}")
    print(f"Final count: {len(all_teams)} teams saved to {TEAMS_OUT}")
    print(f"Final count: {len(standings_data['sections'])} standings sections saved to {STANDINGS_OUT}")
    print(f"Final count: {len(capreport_data['sections'])} cap report sections saved to {CAPREPORT_OUT}")
    print(f"Final count: {len(injuries_data['injuries'])} injuries saved to {INJURIES_OUT}")
    print(f"Final count: {len(schedule_data['sections'])} schedule sections saved to {SCHEDULE_OUT}")
    print(f"Final count: {len(game_results_data['results'])} game results saved to {GAME_RESULTS_OUT}")
    print(f"Final count: {len(free_agents_data['players'])} free agents saved to {FREE_AGENTS_OUT}")
    print(f"Final count: {len(leaders_data['sections'])} leader sections saved to {LEADERS_OUT}")
    if awards_section_count:
        print(f"Final count: {awards_count} awards across {awards_section_count} sections saved to {AWARDS_OUT}")

if __name__ == "__main__":
    main()
