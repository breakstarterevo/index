"""Build a stable player-ID camp tracker from the published Google Sheet."""

import csv
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

from atomic_write import atomic_dump_json


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
PLAYERS_PATH = os.path.join(BUILD_DIR, "database", "players.json")
OUTPUT_PATH = os.path.join(BUILD_DIR, "database", "camp_tracker.json")
TRACKER_URL = "https://docs.google.com/spreadsheets/d/1ZCa_G7E9h6Z7Yf6gdFCBL9Aj4nhi92Um2rxb0rgDYew/gviz/tq?tqx=out:csv"
REGULAR_CAREER_LIMIT = 3
REHAB_CAREER_LIMIT = 1


def normalize_name(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").strip().casefold())


def player_id(player):
    explicit = str(player.get("playerId") or "").strip()
    if explicit:
        return explicit
    match = re.search(r"player(\d+)", str(player.get("url") or ""), re.IGNORECASE)
    return f"player{match.group(1)}" if match else ""


def parse_camp_count(value, limit, field, tracker_name, row_number, issues):
    text = str(value or "").strip()
    if not text:
        return 0
    try:
        number = float(text)
    except ValueError:
        number = None
    if number is None or not number.is_integer() or number < 0 or number > limit:
        issues.append(
            {
                "type": "invalid_camp_count",
                "severity": "warning",
                "name": tracker_name,
                "row": row_number,
                "field": field,
                "value": text,
                "message": f'{tracker_name} has invalid {field} value "{text}"; expected a whole number from 0 to {limit}.',
            }
        )
        return None
    return int(number)


def build_tracker_payload(players, tracker_rows, source_url=TRACKER_URL):
    database_by_name = defaultdict(list)
    for player in players:
        name = str(player.get("name") or "").strip()
        pid = player_id(player)
        key = normalize_name(name)
        if not key or not pid:
            continue
        if not any(candidate["playerId"] == pid for candidate in database_by_name[key]):
            database_by_name[key].append(
                {
                    "playerId": pid,
                    "name": name,
                    "team": player.get("teamLabel") or player.get("team") or "",
                }
            )

    rows_by_name = defaultdict(list)
    for row in tracker_rows:
        name = str(row.get("Name") or "").strip()
        if not name:
            continue
        rows_by_name[normalize_name(name)].append(row)

    issues = []
    matched_players = {}
    for key, rows in rows_by_name.items():
        tracker_name = str(rows[0].get("Name") or "").strip()
        row_numbers = [int(row.get("_row_number") or 0) for row in rows]
        if len(rows) > 1:
            issues.append(
                {
                    "type": "duplicate_tracker_name",
                    "severity": "warning",
                    "name": tracker_name,
                    "rows": row_numbers,
                    "message": f'{tracker_name} appears {len(rows)} times in the camp tracker (rows {", ".join(map(str, row_numbers))}).',
                }
            )
            continue

        candidates = database_by_name.get(key, [])
        if not candidates:
            issues.append(
                {
                    "type": "player_not_in_database",
                    "severity": "warning",
                    "name": tracker_name,
                    "row": row_numbers[0],
                    "message": f'{tracker_name} is in the camp tracker but was not found in players.json.',
                }
            )
            continue
        if len(candidates) > 1:
            issues.append(
                {
                    "type": "ambiguous_database_name",
                    "severity": "warning",
                    "name": tracker_name,
                    "row": row_numbers[0],
                    "candidates": candidates,
                    "message": f'{tracker_name} matches multiple players.json records: {", ".join(candidate["playerId"] for candidate in candidates)}.',
                }
            )
            continue

        row = rows[0]
        regular = parse_camp_count(row.get("Reg Camp"), REGULAR_CAREER_LIMIT, "Reg Camp", tracker_name, row_numbers[0], issues)
        rehab = parse_camp_count(row.get("Rehab Camp"), REHAB_CAREER_LIMIT, "Rehab Camp", tracker_name, row_numbers[0], issues)
        if regular is None or rehab is None:
            continue

        match = candidates[0]
        matched_players[match["playerId"]] = {
            "playerId": match["playerId"],
            "name": match["name"],
            "sourceName": tracker_name,
            "regular": regular,
            "rehab": rehab,
        }

    issue_counts = defaultdict(int)
    for issue in issues:
        issue_counts[issue["type"]] += 1

    flagged_name_keys = {normalize_name(issue.get("name")) for issue in issues if issue.get("name")}
    return {
        "source": {
            "type": "google_sheets_csv",
            "url": source_url,
            "fetchedAtUtc": datetime.now(timezone.utc).isoformat(),
        },
        "careerLimits": {"regular": REGULAR_CAREER_LIMIT, "rehab": REHAB_CAREER_LIMIT},
        "players": dict(sorted(matched_players.items())),
        "issues": issues,
        "summary": {
            "trackerNames": len(rows_by_name),
            "matchedPlayers": len(matched_players),
            "flaggedNames": len(flagged_name_keys),
            "totalIssues": len(issues),
            "issueCounts": dict(sorted(issue_counts.items())),
        },
    }


def load_tracker_rows(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff")))
    headers = [str(header or "").strip() for header in (reader.fieldnames or [])]
    required = {"Name", "Reg Camp"}
    missing = sorted(required.difference(headers))
    if missing:
        raise ValueError(f'Camp tracker is missing required column(s): {", ".join(missing)}')

    rows = []
    for row_number, source_row in enumerate(reader, start=2):
        row = {str(key or "").strip(): value for key, value in source_row.items()}
        row["_row_number"] = row_number
        rows.append(row)
    return rows


def download_tracker_csv(url=TRACKER_URL):
    request = urllib.request.Request(url, headers={"User-Agent": "ESL-site-build/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8-sig")


def print_issues(issues):
    for issue in issues:
        print(f'  [WARN] {issue["type"]}: {issue["message"]}', flush=True)


def main():
    dry_run = "--dry-run" in sys.argv
    if not os.path.exists(PLAYERS_PATH):
        raise FileNotFoundError(f"players.json not found: {PLAYERS_PATH}")

    with open(PLAYERS_PATH, "r", encoding="utf-8") as handle:
        players = json.load(handle)

    try:
        csv_text = download_tracker_csv()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"[ERROR] Camp tracker spreadsheet could not be downloaded: {error}", flush=True)
        return 1

    tracker_rows = load_tracker_rows(csv_text)
    payload = build_tracker_payload(players if isinstance(players, list) else [], tracker_rows)
    print_issues(payload["issues"])

    summary = payload["summary"]
    action = "would write" if dry_run else "wrote"
    if not dry_run:
        os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
        atomic_dump_json(OUTPUT_PATH, payload, indent=2)
    print(
        f'Camp tracker: {summary["matchedPlayers"]} matched, {summary["flaggedNames"]} flagged; {action} {OUTPUT_PATH}',
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
