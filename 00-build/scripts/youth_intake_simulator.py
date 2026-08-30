"""Deterministic, auditable Youth Intake simulation engine."""

from __future__ import annotations

import copy
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


SCHEMA_VERSION = 1
PRIMARY_POSITIONS = ("PG", "SG", "SF", "PF", "C")
DIVISION_LABELS = {
    "CLB": "Champions League",
    "ELB": "Europa League",
    "ECL": "Conference League",
}


class SimulationError(ValueError):
    """Raised when an official simulation cannot be completed safely."""


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_name(value):
    folded = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    ascii_text = folded.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_text)


def safe_season_slug(value):
    slug = re.sub(r"[^a-z0-9-]+", "-", str(value or "").strip().lower()).strip("-")
    if not slug:
        raise SimulationError("A season label is required.")
    return slug


def canonical_hash(payload):
    encoded = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def prospect_key(player):
    components = [
        normalize_name(player.get("name") or f"{player.get('FirstName', '')} {player.get('LastName', '')}"),
        str(player.get("DOB", "") or ""),
        str(player.get("Height", "") or ""),
    ]
    return "|".join(components)


class CounterRng:
    """SHA-256 counter RNG with unbiased bounded integer sampling."""

    def __init__(self, seed):
        self.seed = str(seed)
        self.counter = 0

    def _next_int(self):
        material = f"{self.seed}:{self.counter}".encode("utf-8")
        self.counter += 1
        return int.from_bytes(hashlib.sha256(material).digest(), "big")

    def below(self, upper):
        if not isinstance(upper, int) or upper <= 0:
            raise ValueError("upper must be a positive integer")
        space = 1 << 256
        limit = space - (space % upper)
        while True:
            value = self._next_int()
            if value < limit:
                return value % upper

    def shuffle(self, items):
        for index in range(len(items) - 1, 0, -1):
            swap = self.below(index + 1)
            items[index], items[swap] = items[swap], items[index]

    def weighted_choice(self, weights):
        normalized = [(str(value), int(weight)) for value, weight in weights.items() if int(weight) > 0]
        total = sum(weight for _, weight in normalized)
        if not total:
            raise SimulationError("A slot has no positive tier weights.")
        roll = self.below(total)
        cursor = 0
        for value, weight in normalized:
            cursor += weight
            if roll < cursor:
                return value, roll, total
        raise AssertionError("weighted choice did not resolve")


def standings_teams(standings):
    teams = []
    for section in standings.get("sections", []):
        slug = str(section.get("slug", "")).lower()
        division = next((code for code in DIVISION_LABELS if slug.startswith(code.lower())), "")
        if not division:
            continue
        for entry in section.get("teams", []):
            wins = int(entry.get("wins", 0) or 0)
            losses = int(entry.get("losses", 0) or 0)
            games = wins + losses
            pct = float(entry.get("pct", wins / games if games else 0) or 0)
            teams.append({
                "team": str(entry.get("team", "")).strip(),
                "division": division,
                "divisionLabel": DIVISION_LABELS[division],
                "wins": wins,
                "losses": losses,
                "pct": pct,
                "record": f"{wins}-{losses}",
            })
    return [team for team in teams if team["team"]]


def config_lookup(config):
    return {
        normalize_name(entry.get("team")): {
            "team": str(entry.get("team", "")).strip(),
            "gm": str(entry.get("gm", "")).strip(),
            "positionFocus": str(entry.get("positionFocus", "")).upper().strip(),
        }
        for entry in config.get("teams", [])
        if str(entry.get("team", "")).strip()
    }


def validate_team_config(standings, config):
    league = standings_teams(standings)
    lookup = config_lookup(config)
    league_keys = {normalize_name(team["team"]) for team in league}
    issues = []
    for team in league:
        key = normalize_name(team["team"])
        info = lookup.get(key)
        if not info:
            issues.append(f"Missing app configuration for {team['team']}.")
            continue
        if info["positionFocus"] not in PRIMARY_POSITIONS:
            issues.append(f"{team['team']} requires a PG, SG, SF, PF or C Academy Focus.")
        if not info["gm"]:
            issues.append(f"{team['team']} requires a GM name.")
    for key, info in lookup.items():
        if key not in league_keys:
            issues.append(f"Configured team {info['team']} is not present in standings.json.")
    if len(league) != 24:
        issues.append(f"Expected 24 standings teams, found {len(league)}.")
    return issues


def eligible_prospects(prospects, excluded_names):
    excluded = {normalize_name(name) for name in excluded_names if normalize_name(name)}
    eligible = []
    seen_identities = set()
    for raw in prospects:
        player = copy.deepcopy(raw)
        name = str(player.get("name") or f"{player.get('FirstName', '')} {player.get('LastName', '')}").strip()
        normalized = normalize_name(name)
        pool_identity = str(player.get("poolIdentity") or "").strip()
        if not pool_identity:
            name_pot = str(player.get("Name + Pot") or "").strip()
            column2 = str(player.get("Column2") or "").strip()
            pool_identity = f"{name_pot}|{column2}" if name_pot and column2 else name_pot or name
        normalized_identity = normalize_name(pool_identity)
        tier = str(player.get("tier") or player.get("Tier") or "").strip().upper()
        position = str(player.get("Position") or player.get("position") or "").strip().upper()
        if not name or normalized in excluded or normalized_identity in seen_identities:
            continue
        if tier not in {"A", "B", "C", "D"} or position not in PRIMARY_POSITIONS:
            continue
        seen_identities.add(normalized_identity)
        player["name"] = name
        player["poolIdentity"] = pool_identity
        player["tier"] = tier
        player["tierRaw"] = str(player.get("tierRaw") or player.get("Tier") or tier)
        player["Position"] = position
        player["prospectKey"] = prospect_key(player)
        eligible.append(player)
    return eligible


def pool_summary(prospects, excluded_names):
    eligible = eligible_prospects(prospects, excluded_names)
    by_tier = {}
    by_tier_position = {}
    for player in eligible:
        tier = player["tier"]
        position = player["Position"]
        by_tier[tier] = by_tier.get(tier, 0) + 1
        key = f"{tier}:{position}"
        by_tier_position[key] = by_tier_position.get(key, 0) + 1
    return {
        "total": len(eligible),
        "excluded": max(0, len(prospects) - len(eligible)),
        "byTier": by_tier,
        "byTierPosition": by_tier_position,
    }


def build_slots(teams, rules):
    slots = []
    division_rules = rules.get("divisionSlots", {})
    for team in teams:
        templates = division_rules.get(team["division"], [])
        for template in templates:
            slot = {
                "slotId": f"{normalize_name(team['team'])}:{template['id']}",
                "slotKey": template["id"],
                "slotLabel": template["label"],
                "slotType": template["type"],
                "tierWeights": dict(template["tierWeights"]),
                "team": team["team"],
                "division": team["division"],
            }
            slots.append(slot)
    return slots


def _team_reveal_order(teams):
    ordered_teams = sorted(teams, key=lambda team: str(team.get("team", "")).casefold())
    return [team["team"] for team in ordered_teams]


def _slot_order(slot_key):
    order = {"guaranteed-b": 0, "guaranteed-c": 1, "wildcard-1": 2, "wildcard-2": 3}
    return order.get(slot_key, 99)


def generate_simulation(*, standings, config, rules, prospects, excluded_names, seed, season, mode, manual_awards=None):
    issues = validate_team_config(standings, config)
    if issues:
        raise SimulationError(" ".join(issues))
    if not seed:
        raise SimulationError("A simulation seed is required.")

    teams = standings_teams(standings)
    config_by_team = config_lookup(config)
    eligible = eligible_prospects(prospects, excluded_names)
    if not eligible:
        raise SimulationError("No eligible future prospects are available.")
    manual_awards = [
        copy.deepcopy(award) for award in (manual_awards or [])
        if str(award.get("status", "active")).lower() in {"active", "staged", "published"}
    ]

    enriched_teams = []
    for team in teams:
        info = config_by_team[normalize_name(team["team"])]
        enriched_teams.append({**team, **info, "intakePlayers": []})

    team_by_name = {team["team"]: team for team in enriched_teams}
    rng = CounterRng(seed)
    slots = build_slots(enriched_teams, rules)
    expected = int(rules.get("expectedProspects", 72))
    if len(slots) != expected:
        raise SimulationError(f"Rules produced {len(slots)} slots; expected {expected}.")
    rng.shuffle(slots)

    focus_threshold = int(rules.get("focusChanceBasisPoints", 4000))
    if focus_threshold < 0 or focus_threshold > 10000:
        raise SimulationError("focusChanceBasisPoints must be between 0 and 10000.")

    awarded_keys = {
        str((award.get("player") or {}).get("prospectKey") or award.get("prospectKey") or "").strip()
        for award in manual_awards
    }
    awarded_keys.discard("")
    if len(awarded_keys) != len(manual_awards):
        raise SimulationError("Manual awards contain a missing or duplicate prospect key.")
    remaining = [player for player in eligible if player["prospectKey"] not in awarded_keys]
    selected_keys = set(awarded_keys)
    audit = []
    allocation_order = []

    for allocation_index, slot in enumerate(slots, start=1):
        team = team_by_name[slot["team"]]
        tier, tier_roll, tier_total = rng.weighted_choice(slot["tierWeights"])
        focus_roll = rng.below(10000)
        focus_applied = focus_roll < focus_threshold
        focus = team["positionFocus"]
        candidates = [
            player
            for player in remaining
            if player["tier"] == tier
            and (
                player["Position"] == focus
                if focus_applied
                else player["Position"] != focus
            )
        ]
        if not candidates:
            branch = f"focused position {focus}" if focus_applied else f"non-{focus} positions"
            raise SimulationError(
                f"No eligible Tier {tier} prospects remain for {team['team']} "
                f"({slot['slotLabel']}, {branch}). No selections were saved."
            )

        pick_index = rng.below(len(candidates))
        player = copy.deepcopy(candidates[pick_index])
        key = player["prospectKey"]
        if key in selected_keys:
            raise AssertionError("duplicate prospect selected")
        selected_keys.add(key)
        remaining = [candidate for candidate in remaining if candidate["prospectKey"] != key]

        roll_record = {
            "allocationIndex": allocation_index,
            "slotId": slot["slotId"],
            "slotKey": slot["slotKey"],
            "slotLabel": slot["slotLabel"],
            "slotType": slot["slotType"],
            "team": team["team"],
            "division": team["division"],
            "tier": tier,
            "tierWeights": slot["tierWeights"],
            "tierRoll": tier_roll,
            "tierRollRange": tier_total,
            "focus": focus,
            "focusRoll": focus_roll,
            "focusThreshold": focus_threshold,
            "focusApplied": focus_applied,
            "focusOutcome": "Focused" if focus_applied else "Random",
            "eligibleCount": len(candidates),
            "playerIndex": pick_index,
            "prospectKey": key,
            "playerName": player["name"],
        }
        audit.append(roll_record)
        allocation_order.append(slot["slotId"])

        player.update({
            "slotId": slot["slotId"],
            "slotKey": slot["slotKey"],
            "slotLabel": slot["slotLabel"],
            "slotType": slot["slotType"],
            "wildcard": slot["slotType"] == "wildcard",
            "selectedTier": tier,
            "focusRoll": focus_roll,
            "focusThreshold": focus_threshold,
            "focusApplied": focus_applied,
            "focusOutcome": roll_record["focusOutcome"],
            "eligibleCount": len(candidates),
            "allocationIndex": allocation_index,
        })
        team["intakePlayers"].append(player)

    for award_offset, award in enumerate(manual_awards, start=1):
        team_name = str(award.get("team", "")).strip()
        team = team_by_name.get(team_name)
        if not team:
            raise SimulationError(f"Manual award references unknown team {team_name or 'blank'}.")
        if str(award.get("division", "")).upper() != team["division"]:
            raise SimulationError(f"Manual award division does not match {team_name}.")
        player = copy.deepcopy(award.get("player") or {})
        key = str(player.get("prospectKey") or award.get("prospectKey") or "").strip()
        player.update({
            "prospectKey": key,
            "awardId": award.get("awardId", ""),
            "manualAward": True,
            "awardType": award.get("awardType", ""),
            "awardNote": award.get("note", ""),
            "awardedAt": award.get("awardedAt", ""),
            "slotId": award.get("slotId", f"{normalize_name(team_name)}:manual-award:{award_offset}"),
            "slotKey": award.get("slotKey", "manual-award"),
            "slotLabel": award.get("slotLabel", "Extra award"),
            "slotType": "manual-award",
            "wildcard": bool(award.get("wildcard", False)),
            "selectedTier": award.get("selectedTier") or player.get("tier", ""),
            "focusRoll": award.get("focusRoll"),
            "focusThreshold": award.get("focusThreshold"),
            "focusApplied": bool(award.get("focusApplied", False)),
            "focusOutcome": award.get("focusOutcome", "Random"),
            "eligibleCount": award.get("eligibleCount", 0),
            "allocationIndex": len(slots) + award_offset,
        })
        team["intakePlayers"].append(player)
        allocation_order.append(player["slotId"])
        audit.append({
            "allocationIndex": player["allocationIndex"],
            "awardId": award.get("awardId", ""),
            "manualAward": True,
            "slotId": player["slotId"],
            "slotKey": player["slotKey"],
            "slotLabel": player["slotLabel"],
            "slotType": "manual-award",
            "team": team_name,
            "division": team["division"],
            "tier": player["selectedTier"],
            "tierWeights": award.get("tierWeights", {}),
            "tierRoll": award.get("tierRoll"),
            "tierRollRange": award.get("tierRollRange"),
            "focus": team["positionFocus"],
            "focusRoll": player["focusRoll"],
            "focusThreshold": player["focusThreshold"],
            "focusApplied": player["focusApplied"],
            "focusOutcome": player["focusOutcome"],
            "eligibleCount": player["eligibleCount"],
            "playerIndex": award.get("playerIndex"),
            "prospectKey": key,
            "playerName": player.get("name", ""),
            "seed": award.get("seed", ""),
            "note": award.get("note", ""),
        })

    for team in enriched_teams:
        team["intakePlayers"].sort(key=lambda player: _slot_order(player.get("slotKey")))

    reveal_order = _team_reveal_order(enriched_teams)
    result = {
        "schemaVersion": SCHEMA_VERSION,
        "rulesVersion": str(rules.get("rulesVersion", "1")),
        "season": safe_season_slug(season),
        "status": "test" if mode == "test" else "draft",
        "mode": mode,
        "seed": str(seed),
        "generatedAt": utc_now(),
        "focusPolicy": {
            "chanceBasisPoints": focus_threshold,
            "randomBranchExcludesFocus": True,
        },
        "allocationOrder": allocation_order,
        "revealOrder": reveal_order,
        "teams": enriched_teams,
        "audit": audit,
        "manualAwards": manual_awards,
        "awardTransactions": [],
        "awardsRevision": 0,
        "counts": {
            "teams": len(enriched_teams),
            "prospects": len(selected_keys),
            "CLB": sum(len(team["intakePlayers"]) for team in enriched_teams if team["division"] == "CLB"),
            "ELB": sum(len(team["intakePlayers"]) for team in enriched_teams if team["division"] == "ELB"),
            "ECL": sum(len(team["intakePlayers"]) for team in enriched_teams if team["division"] == "ECL"),
        },
    }
    result["draftHash"] = canonical_hash(result)
    return result


def selected_players(simulation):
    for team in simulation.get("teams", []):
        for player in team.get("intakePlayers", []):
            yield team, player
