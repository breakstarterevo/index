import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "00-build" / "scripts"
sys.path.insert(0, str(SCRIPTS))

from build_youth_intake_json import (  # noqa: E402
    _enrich_intake_player,
    build_youth_intake_payload,
)


class YouthIntakeJsonTests(unittest.TestCase):
    def test_live_ratings_replace_current_fields_but_preserve_potential_fields(self):
        intake_player = {
            "name": "Mike Dunleavy",
            "Position": "SF",
            "Age": 19,
            "InsideScoring": 10,
            "PotInside": 75,
            "JumpShot": 20,
            "PotJumpShot": 85,
            "3pUsage": 60,
            "Fouling": 40,
            "InjuryAvoidance": 80,
            "POT": 127,
        }
        rated_player = {
            "name": "Mike Dunleavy",
            "playerId": "player355",
            "team": "Draft",
            "pos": "SG",
            "age": "21",
            "Ins": "37",
            "Jps": "47",
            "Fts": "77",
            "3ps": "72",
            "Hnd": "43",
            "Pas": "26",
            "Psd": "43",
            "Prd": "40",
            "Stl": "33",
            "Blk": "27",
            "Orb": "24",
            "Drb": "41",
            "Str": "57",
            "Qkn": "65",
            "Jmp": "55",
            "Sta": "76",
            "overall": "100",
            "potential": "127",
        }

        enriched = _enrich_intake_player(
            intake_player,
            "AC Milan",
            {"mikedunleavy": [rated_player]},
        )

        self.assertEqual(enriched["InsideScoring"], "37")
        self.assertEqual(enriched["JumpShot"], "47")
        self.assertEqual(enriched["Position"], "SG")
        self.assertEqual(enriched["Age"], "21")
        self.assertEqual(enriched["playerId"], "player355")
        self.assertEqual(enriched["overall"], 100)
        self.assertEqual(enriched["potential"], 127)
        self.assertEqual(enriched["PotInside"], 75)
        self.assertEqual(enriched["PotJumpShot"], 85)
        self.assertEqual(enriched["3pUsage"], 60)
        self.assertEqual(enriched["Fouling"], 40)
        self.assertEqual(enriched["InjuryAvoidance"], 80)

    def test_name_only_intake_record_receives_available_live_fields(self):
        rated_player = {
            "name": "Alvin Robertson",
            "playerId": "player423",
            "team": "Draft",
            "pos": "PG",
            "age": "21",
            "Ins": "46",
            "Jps": "68",
            "overall": "109",
            "potential": "138",
        }

        enriched = _enrich_intake_player(
            {"name": "Alvin Robertson", "tierRaw": "", "tier": ""},
            "Monaco",
            {"alvinrobertson": [rated_player]},
        )

        self.assertEqual(enriched["InsideScoring"], "46")
        self.assertEqual(enriched["JumpShot"], "68")
        self.assertEqual(enriched["Position"], "PG")
        self.assertEqual(enriched["Age"], "21")
        self.assertEqual(enriched["overall"], 109)
        self.assertEqual(enriched["potential"], 138)

    def test_name_only_intake_record_prefers_unique_draft_roster_match(self):
        draft_player = {
            "name": "Mike Dunleavy",
            "playerId": "player355",
            "team": "Draft",
            "pos": "SG",
            "age": "21",
            "Ins": "37",
            "overall": "100",
            "potential": "127",
        }
        veteran_player = {
            "name": "Mike Dunleavy",
            "playerId": "player738",
            "team": "roster27",
            "pos": "SG",
            "age": "28",
            "Ins": "49",
            "overall": "105",
            "potential": "105",
        }

        enriched = _enrich_intake_player(
            {"name": "Mike Dunleavy", "tierRaw": "", "tier": ""},
            "AC Milan",
            {"mikedunleavy": [draft_player, veteran_player]},
        )

        self.assertEqual(enriched["playerId"], "player355")
        self.assertEqual(enriched["InsideScoring"], "37")
        self.assertEqual(enriched["Age"], "21")
        self.assertEqual(enriched["overall"], 100)

    def test_legacy_payload_prefers_preserved_prospect_over_same_name_database_row(self):
        sheets = {
            "Database": [
                ["FirstName", "LastName", "Position", "Age", "InsideScoring", "PotInside", "POT", "Tier"],
                ["Charles", "Smith", "PF", "22", "50", "48", "110", "B"],
            ],
            "Intake List": [
                ["Team", "GM"],
                ["AC Milan", "Test GM"],
                ["Charles", "Smith"],
            ],
            "TeamList": [
                ["Team", "GM", "Tier", "Position Focus"],
                ["AC Milan", "Test GM", "Tier 1 Premier", "PF"],
            ],
        }
        preserved_prospect = {
            "name": "Charles Smith",
            "FirstName": "Charles",
            "LastName": "Smith",
            "Position": "PF",
            "Age": 22,
            "InsideScoring": 79,
            "PotInside": 83,
            "POT": 110,
            "Tier": "B",
            "tier": "B",
        }
        live_player = {
            "name": "Charles Smith",
            "playerId": "player507",
            "team": "Draft",
            "pos": "PF",
            "age": "22",
            "Ins": "79",
            "overall": "102",
            "potential": "110",
        }

        payload = build_youth_intake_payload(
            "Youth Intake.xlsx",
            {"charlessmith": [live_player]},
            sheets=sheets,
            prospect_lookup={"charlessmith": [preserved_prospect]},
        )
        player = payload["teams"][0]["intakePlayers"][0]

        self.assertEqual(player["InsideScoring"], "79")
        self.assertEqual(player["PotInside"], 83)
        self.assertEqual(player["playerId"], "player507")


if __name__ == "__main__":
    unittest.main()
