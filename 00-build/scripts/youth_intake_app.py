"""Local commissioner server for the Youth Intake Simulator."""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import webbrowser
import zipfile
from datetime import date, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from atomic_write import atomic_dump_json
from build_youth_intake_json import (
    OUTPUT_PATH as PUBLIC_INTAKE_PATH_TEXT,
    PLAYERS_PATH as PLAYERS_PATH_TEXT,
    _load_player_ratings,
    build_app_youth_intake_payload,
)
from youth_intake_simulator import (
    CounterRng,
    SimulationError,
    canonical_hash,
    eligible_prospects,
    generate_simulation,
    normalize_name,
    pool_summary,
    prospect_key,
    safe_season_slug,
    selected_players,
    standings_teams,
    utc_now,
    validate_team_config,
)


SCRIPT_DIR = Path(__file__).resolve().parent
BUILD_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BUILD_DIR.parent
DATABASE_DIR = BUILD_DIR / "database"
SOURCE_DIR = BUILD_DIR / "sources" / "youth-intake"
DRAFT_PATH = SOURCE_DIR / "drafts" / "current.json"
VOIDS_DIR = SOURCE_DIR / "voids"
SEASONS_DIR = SOURCE_DIR / "seasons"
AWARDS_DIR = SOURCE_DIR / "awards"
CONFIG_PATH = SOURCE_DIR / "config.json"
RULES_PATH = SOURCE_DIR / "rules.json"
USED_PATH = SOURCE_DIR / "used-prospects.json"
CURRENT_SOURCE_PATH = SOURCE_DIR / "current.json"
STANDINGS_PATH = DATABASE_DIR / "standings.json"
FUTURE_PLAYERS_PATH = DATABASE_DIR / "future_players.json"
PLAYERS_PATH = Path(PLAYERS_PATH_TEXT)
PUBLIC_INTAKE_PATH = Path(PUBLIC_INTAKE_PATH_TEXT)
POSITIONS = ("PG", "SG", "SF", "PF", "C")
FBB3_FIELDS = (
    "FirstName", "LastName", "Height", "Weight", "Position", "DOB", "Age",
    "Uniform", "City", "State", "College", "InsideScoring", "PotInside",
    "JumpShot", "PotJumpShot", "FtShot", "PotFtShot", "3pShot", "Pot3pShot",
    "3pUsage", "Handling", "PotHandling", "Passing", "PotPassing",
    "PostDefense", "PotPostDefense", "PerimeterDefense", "PotPerimeterDefense",
    "Stealing", "PotStealing", "Blocking", "PotBlocking", "OReb", "PotOReb",
    "DReb", "PotDReb", "Fouling", "Strength", "Quickness", "Jumping",
    "Stamina", "Picname", "InjuryAvoidance",
)
FBB3_DIVISIONS = {
    "CLB": {"tier": "T1", "real": 16, "total": 81},
    "ELB": {"tier": "T2", "real": 24, "total": 79},
    "ECL": {"tier": "T3", "real": 32, "total": 101},
}
AWARD_TYPES = {
    "guaranteed-b": {
        "label": "Guaranteed B", "divisions": ("CLB", "ELB", "ECL"),
        "tierWeights": {"B": 1}, "wildcard": False,
    },
    "guaranteed-c": {
        "label": "Guaranteed C", "divisions": ("CLB", "ELB", "ECL"),
        "tierWeights": {"C": 1}, "wildcard": False,
    },
    "europa-wildcard": {
        "label": "Europa Wildcard", "divisions": ("ELB",),
        "tierWeights": {"A": 25, "B": 25, "D": 50}, "wildcard": True,
    },
    "ecl-wildcard-a": {
        "label": "ECL Wildcard A", "divisions": ("ECL",),
        "tierWeights": {"A": 50, "D": 50}, "wildcard": True,
    },
    "ecl-wildcard-b": {
        "label": "ECL Wildcard B", "divisions": ("ECL",),
        "tierWeights": {"B": 50, "D": 50}, "wildcard": True,
    },
}


def read_json(path, default=None):
    try:
        with Path(path).open("r", encoding="utf-8") as source:
            return json.load(source)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_dump_json(str(path), payload, indent=2, ensure_ascii=False)


def _fbb3_filler_row(team_name, index):
    birthday = date(2000, 2, 17) + timedelta(days=index % 300)
    row = {field: 0 for field in FBB3_FIELDS}
    row.update({
        "FirstName": team_name,
        "LastName": "Mascot",
        "Height": 77,
        "Weight": 195,
        "Position": "PG",
        "DOB": f"{birthday.month}/{birthday.day}/{birthday.year}",
        "Age": 40,
        "College": "North Carolina",
    })
    return row


def _fbb3_csv_bytes(players, filler_count, mascot_names):
    output = io.StringIO(newline="")
    writer = csv.DictWriter(
        output,
        fieldnames=FBB3_FIELDS,
        extrasaction="ignore",
        lineterminator="\r\n",
    )
    writer.writeheader()
    for player in players:
        writer.writerow({field: player.get(field, "") for field in FBB3_FIELDS})
    for index in range(filler_count):
        writer.writerow(_fbb3_filler_row(mascot_names[index % len(mascot_names)], index))
    return output.getvalue().encode("utf-8-sig")


def build_fbb3_export(simulation):
    if not simulation or simulation.get("status") not in {"draft", "published"}:
        raise SimulationError("Only an official draft or published intake can be exported.")
    teams = simulation.get("teams", [])
    mascot_names = sorted(
        {str(team.get("team", "")).strip() for team in teams if str(team.get("team", "")).strip()}
    )
    if not mascot_names:
        raise SimulationError("The official intake has no team names for mascot fillers.")

    players_by_division = {division: [] for division in FBB3_DIVISIONS}
    for team in teams:
        division = str(team.get("division", "")).upper()
        if division not in players_by_division:
            raise SimulationError(f"Unsupported intake division: {division or 'blank'}")
        players_by_division[division].extend(team.get("intakePlayers", []))

    season = safe_season_slug(simulation.get("season"))
    archive = io.BytesIO()
    manifest = {}
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for division, rule in FBB3_DIVISIONS.items():
            players = players_by_division[division]
            if len(players) < rule["real"] or len(players) > rule["total"]:
                raise SimulationError(
                    f"{division} export supports {rule['real']} to {rule['total']} intake prospects; found {len(players)}."
                )
            filler_count = rule["total"] - len(players)
            filename = f"{season}-{rule['tier']}-{division}-Youth-Intake.csv"
            payload = _fbb3_csv_bytes(players, filler_count, mascot_names)
            bundle.writestr(filename, payload)
            manifest[division] = {
                "filename": filename,
                "realProspects": len(players),
                "fillerProspects": filler_count,
                "totalRows": rule["total"],
                "columns": len(FBB3_FIELDS),
            }
        bundle.writestr(
            f"{season}-FBB3-export.json",
            json.dumps({
                "season": season,
                "draftHash": simulation.get("draftHash", ""),
                "generatedAt": utc_now(),
                "divisions": manifest,
            }, indent=2, ensure_ascii=False).encode("utf-8"),
        )
    return archive.getvalue(), f"{season}-FBB3-Youth-Intake.zip"


def fbb3_export_source(requested_hash=""):
    draft = read_json(DRAFT_PATH)
    current = read_json(CURRENT_SOURCE_PATH)
    requested_hash = str(requested_hash or "")
    for candidate in (draft, current):
        if candidate and (not requested_hash or requested_hash == str(candidate.get("draftHash", ""))):
            return candidate
    if requested_hash:
        raise SimulationError("That official intake is no longer the active or published draw.")
    raise SimulationError("Generate an official draw before exporting FBB3 CSVs.")


def names_from_intake(payload):
    names = []
    for team in (payload or {}).get("teams", []):
        for player in team.get("intakePlayers", []):
            name = str(player.get("name", "") or "").strip()
            if name:
                names.append(name)
    return names


def _award_path(season):
    return AWARDS_DIR / f"{safe_season_slug(season)}.json"


def read_award_state(season):
    season = safe_season_slug(season)
    return read_json(_award_path(season), {
        "schemaVersion": 1,
        "season": season,
        "revision": 0,
        "awards": [],
        "transactions": [],
    })


def active_staged_awards(season):
    return [
        award for award in read_award_state(season).get("awards", [])
        if str(award.get("status", "staged")).lower() == "staged"
    ]


def all_staged_awards():
    awards = []
    for path in AWARDS_DIR.glob("*.json"):
        state = read_json(path, {}) or {}
        awards.extend(
            award for award in state.get("awards", [])
            if str(award.get("status", "staged")).lower() == "staged"
        )
    return awards


def award_types_payload():
    return [
        {"id": key, **value}
        for key, value in AWARD_TYPES.items()
    ]


def _refresh_counts(publication):
    teams = publication.get("teams", [])
    publication["counts"] = {
        "teams": len(teams),
        "prospects": sum(len(team.get("intakePlayers", [])) for team in teams),
        "CLB": sum(len(team.get("intakePlayers", [])) for team in teams if team.get("division") == "CLB"),
        "ELB": sum(len(team.get("intakePlayers", [])) for team in teams if team.get("division") == "ELB"),
        "ECL": sum(len(team.get("intakePlayers", [])) for team in teams if team.get("division") == "ECL"),
    }
    return publication["counts"]


def _award_capacity(division, extra_count=0):
    rule = FBB3_DIVISIONS[division]
    return max(0, rule["total"] - rule["real"] - int(extra_count or 0))


def seed_used_ledger():
    ledger = read_json(USED_PATH, {"schemaVersion": 1, "players": []})
    existing = {normalize_name(player.get("name")) for player in ledger.get("players", [])}
    additions = []
    sources = []
    current_public = read_json(PUBLIC_INTAKE_PATH, {})
    if current_public:
        sources.append(("legacy-or-current-public-intake", current_public))
    for archived in BUILD_DIR.glob("history/season-*/database/youth_intake.json"):
        payload = read_json(archived, {})
        if payload:
            sources.append((archived.as_posix(), payload))
    for source_label, payload in sources:
        for name in names_from_intake(payload):
            key = normalize_name(name)
            if not key or key in existing:
                continue
            existing.add(key)
            additions.append({
                "prospectKey": key,
                "name": name,
                "season": str(payload.get("season", "") or ""),
                "team": "",
                "publishedAt": str(payload.get("publishedAt", "") or ""),
                "source": source_label,
            })
    if additions:
        ledger.setdefault("players", []).extend(additions)
        ledger["updatedAt"] = utc_now()
        write_json(USED_PATH, ledger)
    return ledger


def collect_excluded_names(ledger=None):
    names = set()
    for player in read_json(PLAYERS_PATH, []) or []:
        name = str(player.get("name", "") or "").strip()
        if name:
            names.add(name)
    ledger = ledger or read_json(USED_PATH, {"players": []})
    for player in ledger.get("players", []):
        if str(player.get("status", "active")).lower() == "reversed":
            continue
        name = str(player.get("name", "") or "").strip()
        if name:
            names.add(name)
    for award in all_staged_awards():
        name = str((award.get("player") or {}).get("name", "") or "").strip()
        if name:
            names.add(name)
    for season_path in SEASONS_DIR.glob("*.json"):
        names.update(names_from_intake(read_json(season_path, {})))
    names.update(names_from_intake(read_json(PUBLIC_INTAKE_PATH, {})))
    for archived in BUILD_DIR.glob("history/season-*/database/youth_intake.json"):
        names.update(names_from_intake(read_json(archived, {})))
    return names


def load_inputs():
    ledger = read_json(USED_PATH, {"schemaVersion": 1, "players": []})
    standings = read_json(STANDINGS_PATH, {})
    config = read_json(CONFIG_PATH, {"schemaVersion": 1, "teams": []})
    rules = read_json(RULES_PATH, {})
    prospects = read_json(FUTURE_PLAYERS_PATH, [])
    if not standings:
        raise SimulationError("standings.json is missing or invalid. Run the main site build first.")
    if not prospects:
        raise SimulationError("future_players.json is missing or invalid. Refresh the prospect pool.")
    excluded_names = collect_excluded_names(ledger)
    hashes = {
        "standings": canonical_hash(standings),
        "config": canonical_hash(config),
        "rules": canonical_hash(rules),
        "prospectPool": canonical_hash(prospects),
        "exclusions": canonical_hash(sorted(normalize_name(name) for name in excluded_names)),
    }
    return {
        "standings": standings,
        "config": config,
        "rules": rules,
        "prospects": prospects,
        "excludedNames": excluded_names,
        "ledger": ledger,
        "hashes": hashes,
    }


def default_season():
    numbers = []
    for directory in (BUILD_DIR / "history").glob("season-*"):
        match = re.search(r"season-(\d+)", directory.name, re.IGNORECASE)
        if match:
            numbers.append(int(match.group(1)))
    for file_path in SEASONS_DIR.glob("season-*.json"):
        match = re.search(r"season-(\d+)", file_path.stem, re.IGNORECASE)
        if match:
            numbers.append(int(match.group(1)))
    return f"season-{max(numbers, default=0) + 1}"


def bootstrap_payload(season=None):
    inputs = load_inputs()
    standings = standings_teams(inputs["standings"])
    config_by_name = {
        normalize_name(team.get("team")): team
        for team in inputs["config"].get("teams", [])
    }
    teams = []
    for team in standings:
        info = config_by_name.get(normalize_name(team["team"]), {})
        teams.append({
            **team,
            "gm": str(info.get("gm", "") or ""),
            "positionFocus": str(info.get("positionFocus", "") or ""),
        })
    issues = validate_team_config(inputs["standings"], inputs["config"])
    selected_season = safe_season_slug(season or default_season())
    staged_state = read_award_state(selected_season)
    staged = active_staged_awards(selected_season)
    staged_counts = {
        division: sum(1 for award in staged if award.get("division") == division)
        for division in FBB3_DIVISIONS
    }
    return {
        "schemaVersion": 1,
        "defaultSeason": default_season(),
        "teams": teams,
        "positions": list(POSITIONS),
        "rules": inputs["rules"],
        "pool": pool_summary(inputs["prospects"], inputs["excludedNames"]),
        "validation": {"ok": not issues, "issues": issues},
        "inputHashes": inputs["hashes"],
        "activeDraft": read_json(DRAFT_PATH),
        "currentPublished": read_json(CURRENT_SOURCE_PATH),
        "awardTypes": award_types_payload(),
        "awardSeason": selected_season,
        "stagedAwards": staged,
        "awardRevision": int(staged_state.get("revision", 0) or 0),
        "awardCapacity": {
            division: _award_capacity(division, staged_counts[division])
            for division in FBB3_DIVISIONS
        },
    }


def generate(*, season, mode, seed=None):
    inputs = load_inputs()
    season = safe_season_slug(season)
    simulation = generate_simulation(
        standings=inputs["standings"],
        config=inputs["config"],
        rules=inputs["rules"],
        prospects=inputs["prospects"],
        excluded_names=inputs["excludedNames"],
        seed=seed or secrets.token_hex(32),
        season=season,
        mode=mode,
        manual_awards=active_staged_awards(season),
    )
    simulation["inputHashes"] = inputs["hashes"]
    simulation["draftHash"] = canonical_hash({
        key: value for key, value in simulation.items() if key != "draftHash"
    })
    return simulation


def _validate_award_note(value, label="award note"):
    note = str(value or "").strip()
    if not note:
        raise SimulationError(f"A commissioner {label} is required.")
    if len(note) > 240:
        raise SimulationError(f"The commissioner {label} must be 240 characters or fewer.")
    return note


def _award_team(inputs, requested_team):
    teams = standings_teams(inputs["standings"])
    by_key = {normalize_name(team["team"]): team for team in teams}
    team = by_key.get(normalize_name(requested_team))
    if not team:
        raise SimulationError("Choose a valid team for the individual award.")
    config_by_key = {
        normalize_name(entry.get("team")): entry
        for entry in inputs["config"].get("teams", [])
    }
    info = config_by_key.get(normalize_name(team["team"]), {})
    focus = str(info.get("positionFocus", "")).upper().strip()
    if focus not in POSITIONS:
        raise SimulationError(f"{team['team']} requires a valid Academy Focus before receiving an award.")
    return {**team, "positionFocus": focus, "gm": str(info.get("gm", "")).strip()}


def _roll_award(payload, *, status):
    inputs = load_inputs()
    team = _award_team(inputs, payload.get("team"))
    award_type = str(payload.get("awardType", "")).strip().lower()
    rule = AWARD_TYPES.get(award_type)
    if not rule:
        raise SimulationError("Choose a valid individual award type.")
    if team["division"] not in rule["divisions"]:
        raise SimulationError(f"{rule['label']} is not available to {team['division']} teams.")
    note = _validate_award_note(payload.get("note"))

    seed = str(payload.get("seed") or secrets.token_hex(32))
    rng = CounterRng(seed)
    tier, tier_roll, tier_total = rng.weighted_choice(rule["tierWeights"])
    threshold = int(inputs["rules"].get("focusChanceBasisPoints", 4000))
    focus_roll = rng.below(10000)
    focus_applied = focus_roll < threshold
    candidates = [
        player for player in eligible_prospects(inputs["prospects"], inputs["excludedNames"])
        if player["tier"] == tier and (
            player["Position"] == team["positionFocus"]
            if focus_applied else player["Position"] != team["positionFocus"]
        )
    ]
    if not candidates:
        branch = f"focused position {team['positionFocus']}" if focus_applied else f"non-{team['positionFocus']} positions"
        raise SimulationError(
            f"No eligible Tier {tier} prospects remain for {team['team']} ({rule['label']}, {branch})."
        )
    player_index = rng.below(len(candidates))
    player = dict(candidates[player_index])
    awarded_at = utc_now()
    award_id = "award-" + canonical_hash({
        "seed": seed,
        "team": team["team"],
        "awardType": award_type,
        "prospectKey": player["prospectKey"],
        "awardedAt": awarded_at,
    })[:16]
    slot_label = f"Extra award · {rule['label']}"
    player.update({
        "awardId": award_id,
        "manualAward": True,
        "awardType": award_type,
        "awardNote": note,
        "awardedAt": awarded_at,
        "slotId": f"{normalize_name(team['team'])}:manual-award:{award_id}",
        "slotKey": f"manual-award-{award_type}",
        "slotLabel": slot_label,
        "slotType": "manual-award",
        "wildcard": bool(rule["wildcard"]),
        "selectedTier": tier,
        "focusRoll": focus_roll,
        "focusThreshold": threshold,
        "focusApplied": focus_applied,
        "focusOutcome": "Focused" if focus_applied else "Random",
        "eligibleCount": len(candidates),
    })
    return {
        "awardId": award_id,
        "status": status,
        "season": safe_season_slug(payload.get("season")),
        "team": team["team"],
        "division": team["division"],
        "awardType": award_type,
        "awardLabel": rule["label"],
        "slotId": player["slotId"],
        "slotKey": player["slotKey"],
        "slotLabel": slot_label,
        "wildcard": bool(rule["wildcard"]),
        "tierWeights": dict(rule["tierWeights"]),
        "selectedTier": tier,
        "tierRoll": tier_roll,
        "tierRollRange": tier_total,
        "focus": team["positionFocus"],
        "focusRoll": focus_roll,
        "focusThreshold": threshold,
        "focusApplied": focus_applied,
        "focusOutcome": player["focusOutcome"],
        "eligibleCount": len(candidates),
        "playerIndex": player_index,
        "prospectKey": player["prospectKey"],
        "playerName": player["name"],
        "seed": seed,
        "note": note,
        "awardedAt": awarded_at,
        "player": player,
    }


def create_staged_award(payload):
    if DRAFT_PATH.exists():
        raise SimulationError("Void or publish the active official draft before changing individual awards.")
    season = safe_season_slug(payload.get("season"))
    current = read_json(CURRENT_SOURCE_PATH)
    if current and safe_season_slug(current.get("season")) == season:
        raise SimulationError("Use the published-award action for the current published season.")
    state = read_award_state(season)
    expected = payload.get("expectedRevision")
    revision = int(state.get("revision", 0) or 0)
    if expected is not None and int(expected) != revision:
        raise SimulationError("Individual awards changed. Reload the commissioner app and try again.")
    award = _roll_award({**payload, "season": season}, status="staged")
    division_awards = sum(
        1 for entry in state.get("awards", [])
        if entry.get("status") == "staged" and entry.get("division") == award["division"]
    )
    if _award_capacity(award["division"], division_awards) <= 0:
        raise SimulationError(f"{award['division']} has reached its FBB3 prospect capacity.")
    revision += 1
    state.setdefault("awards", []).append(award)
    state.setdefault("transactions", []).append({
        "revision": revision, "action": "created", "awardId": award["awardId"],
        "team": award["team"], "playerName": award["playerName"], "recordedAt": award["awardedAt"],
        "note": award["note"],
    })
    state["revision"] = revision
    state["updatedAt"] = utc_now()
    write_json(_award_path(season), state)
    return {"award": award, "awardState": state, "bootstrap": bootstrap_payload(season)}


def remove_staged_award(payload):
    if DRAFT_PATH.exists():
        raise SimulationError("Void or publish the active official draft before changing individual awards.")
    season = safe_season_slug(payload.get("season"))
    state = read_award_state(season)
    revision = int(state.get("revision", 0) or 0)
    if payload.get("expectedRevision") is not None and int(payload["expectedRevision"]) != revision:
        raise SimulationError("Individual awards changed. Reload the commissioner app and try again.")
    award_id = str(payload.get("awardId", "")).strip()
    award = next((entry for entry in state.get("awards", []) if entry.get("awardId") == award_id and entry.get("status") == "staged"), None)
    if not award:
        raise SimulationError("That staged individual award is no longer available.")
    state["awards"] = [entry for entry in state.get("awards", []) if entry.get("awardId") != award_id]
    revision += 1
    state.setdefault("transactions", []).append({
        "revision": revision, "action": "removed", "awardId": award_id,
        "team": award["team"], "playerName": award["playerName"], "recordedAt": utc_now(),
        "note": "Removed before official draw",
    })
    state["revision"] = revision
    state["updatedAt"] = utc_now()
    write_json(_award_path(season), state)
    return {"removed": award, "awardState": state, "bootstrap": bootstrap_payload(season)}


def save_config(payload):
    if DRAFT_PATH.exists():
        raise SimulationError("Void the active official draft before changing team configuration.")
    standings = read_json(STANDINGS_PATH, {})
    config = {
        "schemaVersion": 1,
        "updatedAt": utc_now(),
        "teams": [
            {
                "team": str(team.get("team", "")).strip(),
                "gm": str(team.get("gm", "")).strip(),
                "positionFocus": str(team.get("positionFocus", "")).upper().strip(),
            }
            for team in payload.get("teams", [])
        ],
    }
    issues = validate_team_config(standings, config)
    if issues:
        raise SimulationError(" ".join(issues))
    write_json(CONFIG_PATH, config)
    return config


def create_official_draft(payload):
    if DRAFT_PATH.exists():
        raise SimulationError("An official draft already exists. Publish or void it before generating another.")
    draft = generate(season=payload.get("season"), mode="official")
    write_json(DRAFT_PATH, draft)
    return draft


def void_draft(reason):
    reason = str(reason or "").strip()
    if not reason:
        raise SimulationError("A void reason is required.")
    draft = read_json(DRAFT_PATH)
    if not draft:
        raise SimulationError("No active official draft exists.")
    voided = {
        **draft,
        "status": "void",
        "voidedAt": utc_now(),
        "voidReason": reason,
    }
    name = f"{voided['season']}-{voided['draftHash'][:12]}.json"
    write_json(VOIDS_DIR / name, voided)
    DRAFT_PATH.unlink(missing_ok=True)
    return voided


def _update_used_ledger(publication):
    ledger = read_json(USED_PATH, {"schemaVersion": 1, "players": []})
    by_name = {
        normalize_name(entry.get("name")): entry
        for entry in ledger.get("players", [])
        if normalize_name(entry.get("name"))
    }
    for team, player in selected_players(publication):
        name = str(player.get("name", "") or "").strip()
        key = normalize_name(name)
        if key in by_name:
            by_name[key].update({
                "status": "active",
                "season": publication.get("season", ""),
                "team": team.get("team", ""),
                "publishedAt": publication.get("publishedAt", ""),
                "awardId": player.get("awardId", by_name[key].get("awardId", "")),
            })
            continue
        entry = {
            "prospectKey": player.get("prospectKey") or prospect_key(player),
            "name": name,
            "season": publication.get("season", ""),
            "team": team.get("team", ""),
            "publishedAt": publication.get("publishedAt", ""),
            "source": "commissioner-app",
            "status": "active",
            "awardId": player.get("awardId", ""),
        }
        ledger.setdefault("players", []).append(entry)
        by_name[key] = entry
    ledger["updatedAt"] = utc_now()
    write_json(USED_PATH, ledger)
    return ledger


def publish_draft(requested_hash):
    draft = read_json(DRAFT_PATH)
    if not draft:
        current = read_json(CURRENT_SOURCE_PATH)
        if current and str(requested_hash or "") == str(current.get("draftHash", "")):
            ratings = _load_player_ratings(str(PLAYERS_PATH))
            write_json(PUBLIC_INTAKE_PATH, build_app_youth_intake_payload(current, ratings))
            return {
                "publication": current,
                "publicPath": str(PUBLIC_INTAKE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                "idempotent": True,
            }
        raise SimulationError("No active official draft exists.")
    if str(requested_hash or "") != str(draft.get("draftHash", "")):
        raise SimulationError("Draft hash mismatch. Reload the commissioner app before publishing.")
    inputs = load_inputs()
    if draft.get("inputHashes") != inputs["hashes"]:
        raise SimulationError("Standings, team configuration, rules, pool or exclusions changed after the draw. Void it and generate a new official draft.")

    season = safe_season_slug(draft.get("season"))
    season_path = SEASONS_DIR / f"{season}.json"
    existing = read_json(season_path)
    if existing and existing.get("draftHash") != draft.get("draftHash"):
        raise SimulationError(f"{season} already has a different published intake.")

    publication = existing or {
        **draft,
        "status": "published",
        "publishedAt": utc_now(),
    }
    for award in publication.get("manualAwards", []):
        if award.get("status") == "staged":
            award["status"] = "published"
    for team in publication.get("teams", []):
        for player in team.get("intakePlayers", []):
            if player.get("manualAward"):
                player["awardStatus"] = "published"
    publication.setdefault("awardTransactions", [])
    publication.setdefault("awardsRevision", 0)
    _refresh_counts(publication)
    publication["publicationHash"] = canonical_hash(publication)
    write_json(season_path, publication)
    write_json(CURRENT_SOURCE_PATH, publication)
    _update_used_ledger(publication)

    ratings = _load_player_ratings(str(PLAYERS_PATH))
    public_payload = build_app_youth_intake_payload(publication, ratings)
    write_json(PUBLIC_INTAKE_PATH, public_payload)
    award_state = read_award_state(season)
    if award_state.get("awards"):
        for award in award_state["awards"]:
            if award.get("status") == "staged":
                award["status"] = "published"
                award["publishedAt"] = publication["publishedAt"]
        award_state["updatedAt"] = utc_now()
        write_json(_award_path(season), award_state)
    DRAFT_PATH.unlink(missing_ok=True)
    return {
        "publication": publication,
        "publicPath": str(PUBLIC_INTAKE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    }


def _publication_player(publication, requested_key):
    requested_key = str(requested_key or "").strip()
    matches = []
    for team, player in selected_players(publication):
        key = str(player.get("prospectKey") or prospect_key(player)).strip()
        if key == requested_key:
            matches.append((team, player, key))
    if not requested_key:
        raise SimulationError("Choose a youth prospect before recording a rights trade.")
    if not matches:
        raise SimulationError("That prospect is not present in the current published intake.")
    if len(matches) != 1:
        raise SimulationError("That prospect key is not unique in the current published intake.")
    return matches[0]


def current_rights_team(publication, requested_key, intake_team):
    owner = str(intake_team or "").strip()
    requested_key = str(requested_key or "").strip()
    for transfer in publication.get("rightsTransfers", []):
        if str(transfer.get("prospectKey", "")).strip() == requested_key:
            owner = str(transfer.get("toTeam", "") or owner).strip()
    return owner


def transfer_rights(payload):
    publication = read_json(CURRENT_SOURCE_PATH)
    if not publication or publication.get("status") != "published":
        raise SimulationError("Publish an official intake before recording rights trades.")

    requested_revision = payload.get("expectedRevision")
    current_revision = int(publication.get("rightsRevision", 0) or 0)
    if requested_revision is not None and int(requested_revision) != current_revision:
        raise SimulationError("Youth-rights data changed. Reload the commissioner app and try again.")

    team, player, key = _publication_player(publication, payload.get("prospectKey"))
    teams_by_name = {
        normalize_name(entry.get("team")): str(entry.get("team", "")).strip()
        for entry in publication.get("teams", [])
        if str(entry.get("team", "")).strip()
    }
    destination = teams_by_name.get(normalize_name(payload.get("toTeam")))
    if not destination:
        raise SimulationError("Choose a valid destination team from the published intake.")

    note = str(payload.get("note", "") or "").strip()
    if not note:
        raise SimulationError("A trade note or reference is required.")
    if len(note) > 240:
        raise SimulationError("The trade note must be 240 characters or fewer.")

    intake_team = str(team.get("team", "") or "").strip()
    current_owner = current_rights_team(publication, key, intake_team)
    if normalize_name(destination) == normalize_name(current_owner):
        raise SimulationError(f"{destination} already owns the rights to {player.get('name', 'that prospect')}.")

    traded_at = utc_now()
    revision = current_revision + 1
    transfer = {
        "revision": revision,
        "prospectKey": key,
        "playerName": str(player.get("name", "") or "").strip(),
        "intakeTeam": intake_team,
        "fromTeam": current_owner,
        "toTeam": destination,
        "tradedAt": traded_at,
        "note": note,
    }
    transfer["transactionId"] = f"rights-{revision:04d}-{canonical_hash(transfer)[:12]}"

    publication.setdefault("rightsTransfers", []).append(transfer)
    publication["schemaVersion"] = max(2, int(publication.get("schemaVersion", 1) or 1))
    publication["rightsRevision"] = revision
    publication["rightsUpdatedAt"] = traded_at
    publication["rightsHash"] = canonical_hash({
        "season": publication.get("season", ""),
        "revision": revision,
        "transfers": publication["rightsTransfers"],
    })

    write_json(CURRENT_SOURCE_PATH, publication)
    season = safe_season_slug(publication.get("season"))
    season_path = SEASONS_DIR / f"{season}.json"
    season_publication = read_json(season_path)
    if season_publication and season_publication.get("draftHash") == publication.get("draftHash"):
        write_json(season_path, publication)

    ratings = _load_player_ratings(str(PLAYERS_PATH))
    write_json(PUBLIC_INTAKE_PATH, build_app_youth_intake_payload(publication, ratings))
    return {
        "publication": publication,
        "transfer": transfer,
        "publicPath": str(PUBLIC_INTAKE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    }


def _persist_publication(publication):
    write_json(CURRENT_SOURCE_PATH, publication)
    season_path = SEASONS_DIR / f"{safe_season_slug(publication.get('season'))}.json"
    write_json(season_path, publication)
    ratings = _load_player_ratings(str(PLAYERS_PATH))
    write_json(PUBLIC_INTAKE_PATH, build_app_youth_intake_payload(publication, ratings))


def _update_awards_audit(publication, transaction):
    revision = int(publication.get("awardsRevision", 0) or 0) + 1
    transaction["revision"] = revision
    transaction["transactionId"] = f"award-{revision:04d}-{canonical_hash(transaction)[:12]}"
    publication.setdefault("awardTransactions", []).append(transaction)
    publication["schemaVersion"] = max(3, int(publication.get("schemaVersion", 1) or 1))
    publication["awardsRevision"] = revision
    publication["awardsUpdatedAt"] = transaction["recordedAt"]
    publication["awardsHash"] = canonical_hash({
        "season": publication.get("season", ""),
        "revision": revision,
        "manualAwards": publication.get("manualAwards", []),
        "transactions": publication["awardTransactions"],
    })
    _refresh_counts(publication)
    return transaction


def create_published_award(payload):
    publication = read_json(CURRENT_SOURCE_PATH)
    if not publication or publication.get("status") != "published":
        raise SimulationError("Publish an official intake before adding a published individual award.")
    season = safe_season_slug(payload.get("season") or publication.get("season"))
    if season != safe_season_slug(publication.get("season")):
        raise SimulationError("Published awards can only be added to the current published season.")
    current_revision = int(publication.get("awardsRevision", 0) or 0)
    if payload.get("expectedRevision") is not None and int(payload["expectedRevision"]) != current_revision:
        raise SimulationError("Published individual awards changed. Reload the commissioner app and try again.")

    team_lookup = {
        normalize_name(team.get("team")): team
        for team in publication.get("teams", [])
    }
    target = team_lookup.get(normalize_name(payload.get("team")))
    if not target:
        raise SimulationError("Choose a valid team from the current published intake.")
    division = str(target.get("division", "")).upper()
    division_count = sum(
        len(team.get("intakePlayers", []))
        for team in publication.get("teams", [])
        if str(team.get("division", "")).upper() == division
    )
    if division_count >= FBB3_DIVISIONS[division]["total"]:
        raise SimulationError(f"{division} has reached its FBB3 prospect capacity.")

    award = _roll_award({**payload, "season": season, "team": target["team"]}, status="published")
    award["publishedAt"] = utc_now()
    existing_indexes = [
        int(player.get("allocationIndex", 0) or 0)
        for team in publication.get("teams", [])
        for player in team.get("intakePlayers", [])
    ]
    player = dict(award["player"])
    player["allocationIndex"] = max(existing_indexes, default=0) + 1
    player["awardStatus"] = "published"
    target.setdefault("intakePlayers", []).append(player)
    publication.setdefault("allocationOrder", []).append(player["slotId"])
    publication.setdefault("audit", []).append({
        "allocationIndex": player["allocationIndex"],
        "awardId": award["awardId"],
        "manualAward": True,
        "awardStatus": "published",
        "slotId": player["slotId"],
        "slotKey": player["slotKey"],
        "slotLabel": player["slotLabel"],
        "slotType": "manual-award",
        "team": award["team"],
        "division": award["division"],
        "tier": award["selectedTier"],
        "tierWeights": award["tierWeights"],
        "tierRoll": award["tierRoll"],
        "tierRollRange": award["tierRollRange"],
        "focus": award["focus"],
        "focusRoll": award["focusRoll"],
        "focusThreshold": award["focusThreshold"],
        "focusApplied": award["focusApplied"],
        "focusOutcome": award["focusOutcome"],
        "eligibleCount": award["eligibleCount"],
        "playerIndex": award["playerIndex"],
        "prospectKey": award["prospectKey"],
        "playerName": award["playerName"],
        "seed": award["seed"],
        "note": award["note"],
    })
    publication.setdefault("manualAwards", []).append(award)
    transaction = _update_awards_audit(publication, {
        "action": "created",
        "awardId": award["awardId"],
        "team": award["team"],
        "playerName": award["playerName"],
        "prospectKey": award["prospectKey"],
        "awardType": award["awardType"],
        "recordedAt": award["publishedAt"],
        "note": award["note"],
    })
    _update_used_ledger(publication)
    _persist_publication(publication)
    return {"publication": publication, "award": award, "transaction": transaction}


def reverse_published_award(payload):
    publication = read_json(CURRENT_SOURCE_PATH)
    if not publication or publication.get("status") != "published":
        raise SimulationError("No current published intake is available.")
    current_revision = int(publication.get("awardsRevision", 0) or 0)
    if payload.get("expectedRevision") is not None and int(payload["expectedRevision"]) != current_revision:
        raise SimulationError("Published individual awards changed. Reload the commissioner app and try again.")
    reason = _validate_award_note(payload.get("reason"), "reversal reason")
    award_id = str(payload.get("awardId", "")).strip()
    award = next((
        entry for entry in publication.get("manualAwards", [])
        if entry.get("awardId") == award_id and entry.get("status") == "published"
    ), None)
    if not award:
        raise SimulationError("That published individual award is no longer active.")
    prospect_key_value = str(award.get("prospectKey", ""))
    if normalize_name(current_rights_team(publication, prospect_key_value, award["team"])) != normalize_name(award["team"]):
        raise SimulationError("Return this prospect's youth rights to the intake team before reversing the award.")

    removed = False
    for team in publication.get("teams", []):
        before = len(team.get("intakePlayers", []))
        team["intakePlayers"] = [
            player for player in team.get("intakePlayers", [])
            if player.get("awardId") != award_id
        ]
        removed = removed or len(team["intakePlayers"]) != before
    if not removed:
        raise SimulationError("The awarded prospect is missing from the published intake.")
    reversed_at = utc_now()
    award["status"] = "reversed"
    award["reversedAt"] = reversed_at
    award["reversalReason"] = reason
    publication["allocationOrder"] = [
        slot_id for slot_id in publication.get("allocationOrder", [])
        if slot_id != award.get("slotId")
    ]
    for audit_entry in publication.get("audit", []):
        if audit_entry.get("awardId") == award_id:
            audit_entry["awardStatus"] = "reversed"
            audit_entry["reversedAt"] = reversed_at
            audit_entry["reversalReason"] = reason
    transaction = _update_awards_audit(publication, {
        "action": "reversed",
        "awardId": award_id,
        "team": award["team"],
        "playerName": award["playerName"],
        "prospectKey": prospect_key_value,
        "awardType": award["awardType"],
        "recordedAt": reversed_at,
        "note": reason,
    })
    ledger = read_json(USED_PATH, {"schemaVersion": 1, "players": []})
    for entry in ledger.get("players", []):
        if entry.get("awardId") == award_id or str(entry.get("prospectKey", "")) == prospect_key_value:
            entry["status"] = "reversed"
            entry["reversedAt"] = reversed_at
            entry["reversalReason"] = reason
    ledger["schemaVersion"] = max(2, int(ledger.get("schemaVersion", 1) or 1))
    ledger["updatedAt"] = reversed_at
    write_json(USED_PATH, ledger)
    _persist_publication(publication)
    return {"publication": publication, "award": award, "transaction": transaction}


def refresh_pool():
    if DRAFT_PATH.exists():
        raise SimulationError("Void or publish the active draft before refreshing the prospect pool.")
    if all_staged_awards():
        raise SimulationError("Remove or publish staged individual awards before refreshing the prospect pool.")
    script = SCRIPT_DIR / "build_future_players_json.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SimulationError((result.stderr or result.stdout or "Prospect-pool build failed.").strip())
    return {"ok": True, "output": result.stdout.strip(), "pool": bootstrap_payload()["pool"]}


class YouthIntakeHandler(SimpleHTTPRequestHandler):
    server_version = "ESLYouthIntake/1.0"

    def __init__(self, *args, token=None, **kwargs):
        self.api_token = token
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        if "/api/" in str(args[0] if args else ""):
            super().log_message(fmt, *args)

    def _is_local(self):
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def _authorized(self):
        return self._is_local() and secrets.compare_digest(
            str(self.headers.get("X-Youth-Intake-Token", "")),
            str(self.api_token or ""),
        )

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _download(self, body, filename):
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        if length > 1_000_000:
            raise SimulationError("Request body is too large.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise SimulationError(f"Invalid JSON request: {error.msg}") from error

    def _api_error(self, error):
        status = HTTPStatus.CONFLICT if isinstance(error, SimulationError) else HTTPStatus.INTERNAL_SERVER_ERROR
        self._json(status, {"ok": False, "error": str(error)})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in {"/api/youth-intake/bootstrap", "/api/youth-intake/export/fbb3"}:
            if not self._authorized():
                self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Invalid local app token."})
                return
            try:
                if parsed.path == "/api/youth-intake/bootstrap":
                    query = parse_qs(parsed.query)
                    self._json(HTTPStatus.OK, {"ok": True, "data": bootstrap_payload((query.get("season") or [None])[0])})
                else:
                    query = parse_qs(parsed.query)
                    simulation = fbb3_export_source((query.get("draftHash") or [""])[0])
                    body, filename = build_fbb3_export(simulation)
                    self._download(body, filename)
            except Exception as error:  # surfaced to the local commissioner
                self._api_error(error)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/youth-intake/"):
            self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found."})
            return
        if not self._authorized():
            self._json(HTTPStatus.FORBIDDEN, {"ok": False, "error": "Invalid local app token."})
            return
        try:
            body = self._body()
            if parsed.path == "/api/youth-intake/config":
                result = save_config(body)
            elif parsed.path == "/api/youth-intake/simulate/test":
                result = generate(
                    season=body.get("season") or default_season(),
                    mode="test",
                    seed=body.get("seed") or secrets.token_hex(32),
                )
            elif parsed.path == "/api/youth-intake/draft":
                result = create_official_draft(body)
            elif parsed.path == "/api/youth-intake/void":
                result = void_draft(body.get("reason"))
            elif parsed.path == "/api/youth-intake/publish":
                result = publish_draft(body.get("draftHash"))
            elif parsed.path == "/api/youth-intake/rights/transfer":
                result = transfer_rights(body)
            elif parsed.path == "/api/youth-intake/awards/staged/create":
                result = create_staged_award(body)
            elif parsed.path == "/api/youth-intake/awards/staged/remove":
                result = remove_staged_award(body)
            elif parsed.path == "/api/youth-intake/awards/published/create":
                result = create_published_award(body)
            elif parsed.path == "/api/youth-intake/awards/published/reverse":
                result = reverse_published_award(body)
            elif parsed.path == "/api/youth-intake/pool/refresh":
                result = refresh_pool()
            else:
                self._json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Unknown API endpoint."})
                return
            self._json(HTTPStatus.OK, {"ok": True, "data": result})
        except Exception as error:  # surfaced to the local commissioner
            self._api_error(error)


def main():
    parser = argparse.ArgumentParser(description="Run the local Youth Intake Commissioner app.")
    parser.add_argument("--port", type=int, default=8017)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    token = secrets.token_urlsafe(32)
    handler = lambda *handler_args, **handler_kwargs: YouthIntakeHandler(
        *handler_args,
        token=token,
        **handler_kwargs,
    )
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    url = (
        f"http://127.0.0.1:{args.port}/00-assets/html/"
        f"youth-intake-simulator.htm?token={token}"
    )
    print("Youth Intake Commissioner is running locally.", flush=True)
    print(url, flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
