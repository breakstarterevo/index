"""Build a compact ESL player-to-headshot feed from Basketball GM photo data.

Use ``--refresh`` to update the committed upstream snapshots. Ordinary builds
read those snapshots and do not require network access.
"""

import argparse
import json
import os
import re
import unicodedata
import urllib.request
from collections import defaultdict

from atomic_write import atomic_dump_json


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
DATABASE_DIR = os.path.join(BUILD_DIR, "database")
SOURCE_DIR = os.path.join(BUILD_DIR, "sources", "player-photos")

PLAYERS_PATH = os.path.join(DATABASE_DIR, "players.json")
OUTPUT_PATH = os.path.join(DATABASE_DIR, "player_photos.json")
PHOTO_URLS_PATH = os.path.join(SOURCE_DIR, "photo-urls.json")
PLAYER_NAMES_PATH = os.path.join(SOURCE_DIR, "player-names.json")
OVERRIDES_PATH = os.path.join(PROJECT_ROOT, "00-assets", "data", "player-photo-overrides.json")

PHOTO_URLS_URL = "https://raw.githubusercontent.com/alexnoob/BasketBall-GM-Rosters/master/player-photos.json"
PLAYER_NAMES_URL = "https://zengm.com/files/player-photos.json"
DESCRIPTION_RE = re.compile(r"^URL to photo of (.+) \((\d{4}) draft class\)$", re.DOTALL)


def normalize_name(value):
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def download_json(url):
    request = urllib.request.Request(url, headers={"User-Agent": "ESL-player-photo-sync/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object from {url}")
    return payload


def load_json(path, fallback=None):
    if not os.path.exists(path):
        if fallback is not None:
            return fallback
        raise FileNotFoundError(path)
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_player_names(template):
    records = {}
    for source_id, description in template.items():
        match = DESCRIPTION_RE.match(str(description or "").strip())
        if match:
            records[source_id] = {
                "name": re.sub(r"\s+", " ", match.group(1)).strip(),
                "draftYear": int(match.group(2)),
            }
    return records


def current_league_year(players):
    years = []
    for player in players:
        for contract in player.get("contracts") or []:
            value = str(contract.get("year") or "")
            if value.isdigit():
                years.append(int(value))
                break
    return min(years) if years else None


def load_overrides():
    payload = load_json(OVERRIDES_PATH, {"byPlayerId": {}, "byName": {}})
    return {
        "byPlayerId": payload.get("byPlayerId") or {},
        "byName": {normalize_name(key): value for key, value in (payload.get("byName") or {}).items()},
    }


def normalize_photo_url(value):
    url = str(value or "").strip()
    if url.startswith("http://"):
        return f"https://{url[len('http://'):]}"
    return url if url.startswith("https://") else ""


def select_candidate(player, candidates, records, league_year):
    if len(candidates) == 1:
        return candidates[0], "name"
    if not candidates or not league_year:
        return None, "ambiguous" if candidates else "unmatched"
    try:
        birth_year = league_year - int(player.get("age"))
    except (TypeError, ValueError):
        return None, "ambiguous"
    plausible = [
        source_id for source_id in candidates
        if 17 <= records[source_id]["draftYear"] - birth_year <= 26
    ]
    return (plausible[0], "name-and-age") if len(plausible) == 1 else (None, "ambiguous")


def build_feed(players, photo_urls, template, overrides):
    records = parse_player_names(template)
    candidates_by_name = defaultdict(list)
    for source_id, record in records.items():
        if source_id in photo_urls:
            candidates_by_name[normalize_name(record["name"])].append(source_id)

    league_year = current_league_year(players)
    matches = {}
    counts = defaultdict(int)
    unmatched_names = set()
    ambiguous_names = set()

    for player in players:
        player_id = str(player.get("playerId") or "").strip()
        player_name = str(player.get("name") or "").strip()
        normalized_name = normalize_name(player_name)
        if not player_id or not normalized_name:
            counts["unmatched"] += 1
            continue

        source_id = overrides["byPlayerId"].get(player_id)
        match_method = "player-id-override" if source_id else ""
        if not source_id:
            source_id = overrides["byName"].get(normalized_name)
            match_method = "name-override" if source_id else ""
        if not source_id:
            source_id, match_method = select_candidate(
                player, candidates_by_name.get(normalized_name, []), records, league_year
            )

        url = normalize_photo_url(photo_urls.get(source_id)) if source_id else ""
        if not url:
            counts[match_method or "unmatched"] += 1
            if match_method == "ambiguous":
                ambiguous_names.add(player_name)
            else:
                unmatched_names.add(player_name)
            continue

        record = records.get(source_id, {})
        matches[player_id] = {
            "url": url,
            "sourceId": source_id,
            "sourceName": record.get("name", player_name),
            "match": match_method,
        }
        counts["matched"] += 1
        counts[match_method] += 1

    return {
        "version": 1,
        "source": {"photoUrls": PHOTO_URLS_URL, "playerNames": PLAYER_NAMES_URL},
        "counts": {
            "players": len(players),
            "matched": counts["matched"],
            "unmatched": len(players) - counts["matched"],
            "ambiguous": counts["ambiguous"],
            "name": counts["name"],
            "nameAndAge": counts["name-and-age"],
            "overrides": counts["player-id-override"] + counts["name-override"],
        },
        "players": dict(sorted(matches.items())),
        "review": {
            "ambiguousNames": sorted(ambiguous_names),
            "unmatchedNames": sorted(unmatched_names),
        },
    }


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    atomic_dump_json(path, payload, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Download fresh source snapshots")
    parser.add_argument("--dry-run", action="store_true", help="Report coverage without writing")
    args = parser.parse_args()

    if args.refresh:
        print("Refreshing Basketball GM player-photo sources...")
        photo_urls = download_json(PHOTO_URLS_URL)
        player_names = download_json(PLAYER_NAMES_URL)
        if not args.dry_run:
            write_json(PHOTO_URLS_PATH, photo_urls)
            write_json(PLAYER_NAMES_PATH, player_names)
    else:
        try:
            photo_urls = load_json(PHOTO_URLS_PATH)
            player_names = load_json(PLAYER_NAMES_PATH)
        except FileNotFoundError as error:
            raise SystemExit(f"Missing {error.filename}. Run this script once with --refresh.") from error

    players = load_json(PLAYERS_PATH)
    feed = build_feed(players, photo_urls, player_names, load_overrides())
    counts = feed["counts"]
    print(
        f"Player photos: {counts['matched']}/{counts['players']} matched "
        f"({counts['ambiguous']} ambiguous; {counts['unmatched']} without a photo)"
    )
    if not args.dry_run:
        write_json(OUTPUT_PATH, feed)
        print(f"Wrote {os.path.relpath(OUTPUT_PATH, PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
