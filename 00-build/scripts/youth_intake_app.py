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
    SimulationError,
    canonical_hash,
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
            if len(players) != rule["real"]:
                raise SimulationError(
                    f"{division} export requires {rule['real']} intake prospects; found {len(players)}."
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
        name = str(player.get("name", "") or "").strip()
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


def bootstrap_payload():
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
    }


def generate(*, season, mode, seed=None):
    inputs = load_inputs()
    simulation = generate_simulation(
        standings=inputs["standings"],
        config=inputs["config"],
        rules=inputs["rules"],
        prospects=inputs["prospects"],
        excluded_names=inputs["excludedNames"],
        seed=seed or secrets.token_hex(32),
        season=safe_season_slug(season),
        mode=mode,
    )
    simulation["inputHashes"] = inputs["hashes"]
    simulation["draftHash"] = canonical_hash({
        key: value for key, value in simulation.items() if key != "draftHash"
    })
    return simulation


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
            continue
        entry = {
            "prospectKey": player.get("prospectKey") or prospect_key(player),
            "name": name,
            "season": publication.get("season", ""),
            "team": team.get("team", ""),
            "publishedAt": publication.get("publishedAt", ""),
            "source": "commissioner-app",
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
    publication["publicationHash"] = canonical_hash(publication)
    write_json(season_path, publication)
    write_json(CURRENT_SOURCE_PATH, publication)
    _update_used_ledger(publication)

    ratings = _load_player_ratings(str(PLAYERS_PATH))
    public_payload = build_app_youth_intake_payload(publication, ratings)
    write_json(PUBLIC_INTAKE_PATH, public_payload)
    DRAFT_PATH.unlink(missing_ok=True)
    return {
        "publication": publication,
        "publicPath": str(PUBLIC_INTAKE_PATH.relative_to(PROJECT_ROOT)).replace("\\", "/"),
    }


def refresh_pool():
    if DRAFT_PATH.exists():
        raise SimulationError("Void or publish the active draft before refreshing the prospect pool.")
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
                    self._json(HTTPStatus.OK, {"ok": True, "data": bootstrap_payload()})
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
