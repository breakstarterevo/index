import json
import os
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
PROJECT_ROOT = os.path.dirname(BUILD_DIR)

XLSX_PATH = os.path.join(PROJECT_ROOT, "00-assets", "spreadsheet", "Youth Intake.xlsx")
OUTPUT_PATH = os.path.join(BUILD_DIR, "database", "youth_intake.json")
OUTPUT_PLAYERS_PATH = os.path.join(BUILD_DIR, "database", "youth_intake_players.json")

TEAM_ALIASES = {
    "arsenal": "Sheffield United",
}


def _col_letters_to_index(letters: str) -> int:
    index = 0
    for ch in letters:
        if not ("A" <= ch <= "Z"):
            return -1
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def _cell_ref_to_index(cell_ref: str) -> int:
    match = re.match(r"([A-Z]+)\d+", str(cell_ref or ""))
    if not match:
        return -1
    return _col_letters_to_index(match.group(1))


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())


def _canonical_team_name(value: str) -> str:
    text = str(value or "").strip()
    return TEAM_ALIASES.get(_normalize_key(text), text)


def _first_non_empty(items):
    for item in items:
        if str(item or "").strip():
            return item
    return ""


def _map_tier_label(raw_tier: str) -> str:
    key = _normalize_key(raw_tier)
    tier_map = {
        "tier1": "CLB",
        "tier1premier": "CLB",
        "premier": "CLB",
        "championsleague": "CLB",
        "clb": "CLB",
        "tier2": "ELB",
        "tier2europa": "ELB",
        "tier2development": "ELB",
        "development": "ELB",
        "europaleague": "ELB",
        "elb": "ELB",
        "tier3": "ECL",
        "tier3conference": "ECL",
        "tier3prospect": "ECL",
        "prospect": "ECL",
        "conferenceleague": "ECL",
        "ecl": "ECL",
    }
    return tier_map.get(key, str(raw_tier or "").strip())


def _parse_overall(value):
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        number = float(text)
        return int(number) if number.is_integer() else number
    except ValueError:
        return text


def _xlsx_sheet_rows(path: str):
    ns = {
        "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }

    with zipfile.ZipFile(path, "r") as zf:
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        wb_rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {}
        for rel in wb_rels.findall("rel:Relationship", ns):
            rel_targets[rel.attrib.get("Id", "")] = rel.attrib.get("Target", "")

        shared_strings = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst.findall("m:si", ns):
                text = "".join(t.text or "" for t in si.findall(".//m:t", ns))
                shared_strings.append(text)

        workbook_sheets = workbook.find("m:sheets", ns)
        if workbook_sheets is None:
            return {}

        out = {}
        for sheet_node in workbook_sheets.findall("m:sheet", ns):
            sheet_name = sheet_node.attrib.get("name", "Sheet")
            rel_id = sheet_node.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", "")
            target = rel_targets.get(rel_id, "")
            if not target:
                out[sheet_name] = []
                continue
            sheet_path = target if target.startswith("xl/") else posixpath.normpath(posixpath.join("xl", target))
            if sheet_path not in zf.namelist():
                out[sheet_name] = []
                continue

            sheet_xml = ET.fromstring(zf.read(sheet_path))
            sheet_data = sheet_xml.find("m:sheetData", ns)
            if sheet_data is None:
                out[sheet_name] = []
                continue

            rows = []
            for row in sheet_data.findall("m:row", ns):
                row_cells = {}
                for c in row.findall("m:c", ns):
                    ref = c.attrib.get("r", "")
                    idx = _cell_ref_to_index(ref)
                    if idx < 0:
                        continue
                    t = c.attrib.get("t", "")
                    value = ""
                    if t == "inlineStr":
                        value = "".join(n.text or "" for n in c.findall(".//m:t", ns))
                    else:
                        v_node = c.find("m:v", ns)
                        raw = (v_node.text if v_node is not None else "") or ""
                        if t == "s":
                            try:
                                s_idx = int(raw)
                                value = shared_strings[s_idx] if 0 <= s_idx < len(shared_strings) else ""
                            except (TypeError, ValueError):
                                value = ""
                        else:
                            value = raw
                    row_cells[idx] = str(value).strip()
                if not row_cells:
                    continue
                width = max(row_cells.keys()) + 1
                expanded = [""] * width
                for idx, val in row_cells.items():
                    expanded[idx] = val
                rows.append(expanded)
            out[sheet_name] = rows
        return out


def _find_sheet(sheets, desired_name):
    desired = _normalize_key(desired_name)
    for name, rows in sheets.items():
        if _normalize_key(name) == desired:
            return name, rows
    # Fallback: contains match to tolerate naming typos/spacing.
    for name, rows in sheets.items():
        if desired in _normalize_key(name):
            return name, rows
    return "", []


def _find_database_sheets(sheets):
    found = []
    seen = set()
    for desired_name in ("Current Intake", "DATATBASE", "DATABASE", "TIER 1", "TIER 2", "TIER 3"):
        sheet_name, rows = _find_sheet(sheets, desired_name)
        key = _normalize_key(sheet_name)
        if sheet_name and key not in seen:
            seen.add(key)
            found.append((sheet_name, rows))
    return found


def _populated_field_count(player):
    return sum(1 for value in player.values() if str(value or "").strip())


def _build_combined_database_lookup(sheets):
    lookup = {}
    sheet_names = []
    for sheet_name, rows in _find_database_sheets(sheets):
        sheet_names.append(sheet_name)
        for key, player in _build_database_lookup(rows).items():
            existing = lookup.get(key)
            if existing is None or _populated_field_count(player) > _populated_field_count(existing):
                lookup[key] = player
    return lookup, sheet_names


def _build_combined_current_intake_players(sheets):
    players_by_name = {}
    for _sheet_name, rows in _find_database_sheets(sheets):
        for player in _build_current_intake_players(rows):
            key = _normalize_key(player.get("name", ""))
            if not key:
                continue
            existing = players_by_name.get(key)
            if existing is None or _populated_field_count(player) > _populated_field_count(existing):
                players_by_name[key] = player
    return sorted(players_by_name.values(), key=lambda p: str(p.get("name", "")).lower())


def _build_database_lookup(rows):
    if not rows:
        return {}

    header_row_index = 0
    header = rows[0]
    if len(rows) > 1:
        # Try to detect a likely header row near the top.
        for i, row in enumerate(rows[:8]):
            if len(row) > 4 and _normalize_key(row[0]) in {"name", "player", "playername"}:
                header_row_index = i
                header = row
                break

    header_norm = [_normalize_key(value) for value in header]
    first_name_col = header_norm.index("firstname") if "firstname" in header_norm else -1
    last_name_col = header_norm.index("lastname") if "lastname" in header_norm else -1

    modern_layout = first_name_col >= 0 and last_name_col >= 0
    name_col = 0
    start_col = first_name_col if modern_layout else 3
    end_col = len(header) - 1 if modern_layout else min(27, len(header) - 1)

    if not modern_layout and len(header) <= name_col:
        return {}

    range_headers = []
    for col in range(start_col, end_col + 1):
        raw = header[col] if col < len(header) else ""
        text = str(raw or "").strip()
        range_headers.append(text if text else f"col_{col + 1}")

    lookup = {}
    for row in rows[header_row_index + 1:]:
        if modern_layout:
            first = str(row[first_name_col] if len(row) > first_name_col else "").strip()
            last = str(row[last_name_col] if len(row) > last_name_col else "").strip()
            name = f"{first} {last}".strip()
        else:
            if len(row) <= name_col:
                continue
            name = str(row[name_col] or "").strip()

        if not name or re.fullmatch(r"0+(?:\s+0+)?", name):
            continue

        player = {"name": name}
        for idx, col in enumerate(range(start_col, end_col + 1)):
            key = range_headers[idx]
            raw = row[col] if len(row) > col else ""
            value = str(raw or "").strip()
            # Preserve numeric-looking values as numbers where safe.
            if value:
                try:
                    n = float(value)
                    value = int(n) if n.is_integer() else n
                except ValueError:
                    pass
            player[key] = value

        # Keep normalized tier if present in the exported range.
        tier_key = next((k for k in player.keys() if _normalize_key(k) == "tier"), "")
        if tier_key:
            player["tierRaw"] = str(player.get(tier_key, "") or "").strip()
            player["tier"] = _map_tier_label(player.get(tier_key, ""))
        else:
            player["tierRaw"] = ""
            player["tier"] = ""

        lookup[_normalize_key(name)] = player
    return lookup


def _build_current_intake_players(rows):
    if not rows:
        return []

    header = rows[0]
    header_norm = [_normalize_key(value) for value in header]
    first_name_col = header_norm.index("firstname") if "firstname" in header_norm else -1
    last_name_col = header_norm.index("lastname") if "lastname" in header_norm else -1
    modern_layout = first_name_col >= 0 and last_name_col >= 0
    name_col = 0
    start_col = first_name_col if modern_layout else 3

    keys = []
    for col in range(start_col, len(header)):
        label = str(header[col] or "").strip()
        keys.append(label if label else f"col_{col + 1}")

    players = []
    for row in rows[1:]:
        if modern_layout:
            first = str(row[first_name_col] if len(row) > first_name_col else "").strip()
            last = str(row[last_name_col] if len(row) > last_name_col else "").strip()
            name = f"{first} {last}".strip()
        else:
            name = str(row[name_col] if len(row) > name_col else "").strip()

        if not name or re.fullmatch(r"0+(?:\s+0+)?", name):
            continue

        player = {"name": name}
        for idx, col in enumerate(range(start_col, start_col + len(keys))):
            key = keys[idx]
            raw = row[col] if len(row) > col else ""
            value = str(raw or "").strip()
            if value:
                try:
                    n = float(value)
                    value = int(n) if n.is_integer() else n
                except ValueError:
                    pass
            player[key] = value

        # Normalize tier labels when a tier-like field exists.
        for field in list(player.keys()):
            if _normalize_key(field) == "tier":
                player["tierRaw"] = str(player[field] or "").strip()
                player["tier"] = _map_tier_label(player[field])
                break

        players.append(player)

    players.sort(key=lambda p: str(p.get("name", "")).lower())
    return players


def _build_position_focus_map(rows):
    if not rows:
        return {}

    header_row_index = 0
    header = rows[0]
    for i, row in enumerate(rows[:8]):
        h = [_normalize_key(v) for v in row]
        if any("team" in col for col in h) and any("focus" in col for col in h):
            header_row_index = i
            header = row
            break

    header_norm = [_normalize_key(v) for v in header]

    def find_col(*tokens):
        for idx, col in enumerate(header_norm):
            if any(token in col for token in tokens):
                return idx
        return -1

    team_col = find_col("team")
    focus_col = find_col("positionfocus", "academyfocus", "focus")
    tier_col = find_col("tier")
    gm_col = find_col("gm", "manager", "owner", "coach")
    if team_col < 0:
        return {}

    focus_map = {}
    for row in rows[header_row_index + 1:]:
        if len(row) <= team_col:
            continue
        team = _canonical_team_name(row[team_col] if len(row) > team_col else "")
        if not team:
            continue
        focus_raw = row[focus_col] if focus_col >= 0 and len(row) > focus_col else ""
        tier_raw = row[tier_col] if tier_col >= 0 and len(row) > tier_col else ""
        focus_map[_normalize_key(team)] = {
            "team": team,
            "gm": str(row[gm_col] if gm_col >= 0 and len(row) > gm_col else "" or "").strip(),
            "positionFocus": str(focus_raw or "").strip(),
            "tierRaw": str(tier_raw or "").strip(),
            "tier": _map_tier_label(tier_raw),
        }
    return focus_map


def _build_intake_map(rows, known_team_names=None):
    if not rows:
        return {}

    known_team_names = {
        _normalize_key(name)
        for name in (known_team_names or [])
        if str(name or "").strip()
    }

    def is_header_row(first, second):
        first_key = _normalize_key(first)
        second_key = _normalize_key(second)
        return first_key == "team" and second_key in {"", "manager", "user", "owner", "coach", "gm"}

    def is_team_row(first):
        return _normalize_key(_canonical_team_name(first)) in known_team_names

    intake_by_team = {}
    current_team = ""

    for row in rows:
        first = str(row[0] if len(row) > 0 else "").strip()
        second = str(row[1] if len(row) > 1 else "").strip()

        if not first and not second:
            continue

        if is_header_row(first, second):
            current_team = ""
            continue

        if is_team_row(first):
            current_team = _canonical_team_name(first)
            intake_by_team.setdefault(current_team, [])
            continue

        if not current_team:
            continue

        full = f"{first} {second}".strip()
        if full:
            intake_by_team[current_team].append(full)

    return intake_by_team


def build_youth_intake_payload(xlsx_path: str):
    sheets = _xlsx_sheet_rows(xlsx_path)
    intake_sheet_name, intake_rows = _find_sheet(sheets, "INTAKE list")
    focus_sheet_name, focus_rows = _find_sheet(sheets, "Position focus")
    if not focus_sheet_name:
        focus_sheet_name, focus_rows = _find_sheet(sheets, "TeamList")

    player_lookup, db_sheet_names = _build_combined_database_lookup(sheets)
    focus_map = _build_position_focus_map(focus_rows)
    intake_map = _build_intake_map(intake_rows, known_team_names=[info.get("team", "") for info in focus_map.values()])

    all_team_names = []
    seen = set()
    for team_name in list(focus_map.keys()) + [ _normalize_key(name) for name in intake_map.keys() ]:
        if team_name and team_name not in seen:
            seen.add(team_name)
            all_team_names.append(team_name)

    teams = []
    for team_key in sorted(all_team_names):
        focus_info = focus_map.get(team_key, {})
        team_name = focus_info.get("team") or _first_non_empty([name for name in intake_map.keys() if _normalize_key(name) == team_key]) or team_key
        intake_names = intake_map.get(team_name, [])
        if not intake_names:
            for raw_name, raw_intake in intake_map.items():
                if _normalize_key(raw_name) == team_key:
                    intake_names = raw_intake
                    break

        intake_players = []
        for player_name in intake_names:
            db_data = player_lookup.get(_normalize_key(player_name), {})
            if db_data:
                intake_players.append(db_data)
            else:
                intake_players.append({
                    "name": player_name,
                    "tierRaw": "",
                    "tier": "",
                })

        teams.append({
            "team": team_name,
            "gm": focus_info.get("gm", ""),
            "tierRaw": focus_info.get("tierRaw", ""),
            "tier": focus_info.get("tier", ""),
            "positionFocus": focus_info.get("positionFocus", ""),
            "intakePlayers": intake_players,
        })

    return {
        "source": os.path.relpath(xlsx_path, PROJECT_ROOT).replace("\\", "/"),
        "sheetsUsed": {
            "database": db_sheet_names,
            "intakeList": intake_sheet_name,
            "positionFocus": focus_sheet_name,
        },
        "tierMapping": {
            "Tier 1 Premier": "CLB",
            "Tier 2 Europa": "ELB",
            "Tier 3 Conference": "ECL",
        },
        "teams": teams,
        "counts": {
            "teams": len(teams),
            "databasePlayers": len(player_lookup),
        },
    }


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    if not os.path.exists(XLSX_PATH):
        print(f"Error: spreadsheet not found at {XLSX_PATH}")
        return 1

    payload = build_youth_intake_payload(XLSX_PATH)
    sheets = _xlsx_sheet_rows(XLSX_PATH)
    players_payload = _build_combined_current_intake_players(sheets)

    atomic_dump_json(OUTPUT_PATH, payload, indent=2, ensure_ascii=False)
    atomic_dump_json(OUTPUT_PLAYERS_PATH, players_payload, indent=4, ensure_ascii=False)

    print(f"Wrote {OUTPUT_PATH} ({payload.get('counts', {}).get('teams', 0)} teams)")
    print(f"Wrote {OUTPUT_PLAYERS_PATH} ({len(players_payload)} players)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
