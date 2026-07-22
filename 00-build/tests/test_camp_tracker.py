import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_camp_tracker_json.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_camp_tracker_json", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def player(name, player_id):
    return {"name": name, "playerId": player_id, "teamLabel": "Test Team"}


def tracker_row(name, regular="0", rehab="0", row=2):
    return {"Name": name, "Reg Camp": regular, "Rehab Camp": rehab, "_row_number": row}


class CampTrackerMatchingTests(unittest.TestCase):
    def test_unique_name_maps_to_player_id(self):
        payload = MODULE.build_tracker_payload([player("Larry Bird", "player1")], [tracker_row("Larry Bird", "2")])
        self.assertEqual(payload["players"]["player1"]["regular"], 2)
        self.assertEqual(payload["issues"], [])

    def test_missing_database_player_is_flagged(self):
        payload = MODULE.build_tracker_payload([], [tracker_row("Missing Player")])
        self.assertEqual(payload["issues"][0]["type"], "player_not_in_database")
        self.assertEqual(payload["players"], {})

    def test_duplicate_database_name_is_ambiguous(self):
        players = [player("Same Name", "player1"), player("Same Name", "player2")]
        payload = MODULE.build_tracker_payload(players, [tracker_row("Same Name")])
        self.assertEqual(payload["issues"][0]["type"], "ambiguous_database_name")
        self.assertEqual(len(payload["issues"][0]["candidates"]), 2)

    def test_duplicate_tracker_name_is_flagged(self):
        rows = [tracker_row("Same Name", row=2), tracker_row("Same Name", row=5)]
        payload = MODULE.build_tracker_payload([player("Same Name", "player1")], rows)
        self.assertEqual(payload["issues"][0]["type"], "duplicate_tracker_name")
        self.assertEqual(payload["issues"][0]["rows"], [2, 5])

    def test_invalid_regular_count_is_flagged(self):
        payload = MODULE.build_tracker_payload([player("Larry Bird", "player1")], [tracker_row("Larry Bird", "4")])
        self.assertEqual(payload["issues"][0]["type"], "invalid_camp_count")
        self.assertEqual(payload["players"], {})


if __name__ == "__main__":
    unittest.main()
