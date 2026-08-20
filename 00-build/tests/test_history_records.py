import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_history_records.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_history_records", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class HistoryStoryBuildTests(unittest.TestCase):
    def test_movement_rules_cover_all_three_tiers(self):
        self.assertEqual(MODULE.movement_marker("CLB", 1, 8), "C")
        self.assertEqual(MODULE.movement_marker("CLB", 8, 8), "R")
        self.assertEqual(MODULE.movement_marker("ELB", 2, 8), "P")
        self.assertEqual(MODULE.movement_marker("ELB", 8, 8), "R")
        self.assertEqual(MODULE.movement_marker("ECL", 1, 8), "P")
        self.assertEqual(MODULE.movement_marker("ECL", 8, 8), "")

    def test_supercup_champion_uses_final_playoff_game_and_name_mapping(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory)
            (database / "supercup").mkdir()
            (database / "supercup" / "game_results.json").write_text(
                json.dumps(
                    {
                        "results": [
                            {"section": "Regular Season", "winnerName": "Ignore"},
                            {"section": "Playoffs", "winnerName": "Alpha", "loserName": "Beta", "homeScore": 91, "awayScore": 88},
                            {"section": "Playoffs", "winnerName": "Gamma", "loserName": "Alpha", "homeScore": 102, "awayScore": 97, "date": "4/30/1985"},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            champion = MODULE.supercup_champion(database, {"gamma": {"file": "roster3.htm"}})
            self.assertEqual(champion["team"], "Gamma")
            self.assertEqual(champion["file"], "roster3.htm")
            self.assertEqual(champion["opponent"], "Alpha")

    def test_promotion_journey_scores_and_classifies_above_threshold(self):
        rows = [
            {"season": "season-1", "label": "1981-1982", "tier": "ECL", "movement": "P", "position": 1, "wins": 28, "losses": 14, "pct": 0.667},
            {"season": "season-2", "label": "1982-1983", "tier": "ELB", "movement": "P", "position": 1, "wins": 27, "losses": 15, "pct": 0.643},
            {"season": "season-3", "label": "1983-1984", "tier": "CLB", "movement": "", "position": 3, "wins": 25, "losses": 17, "pct": 0.595},
        ]
        result = MODULE.score_era_window(rows, [])
        self.assertEqual(result["classification"], "Promotion Journey")
        self.assertEqual(result["promotions"], 2)
        self.assertGreaterEqual(result["score"], 10)

    def test_multiple_titles_classify_as_dynasty(self):
        rows = [
            {"season": "season-1", "tier": "CLB", "movement": "C", "position": 1, "wins": 30, "losses": 12, "pct": 0.714},
            {"season": "season-2", "tier": "CLB", "movement": "C", "position": 1, "wins": 31, "losses": 11, "pct": 0.738},
        ]
        titles = [{"season": "season-1", "tier": "CLB"}, {"season": "season-2", "tier": "CLB"}]
        self.assertEqual(MODULE.score_era_window(rows, titles)["classification"], "Dynasty")

    def test_manual_and_location_bonuses_raise_rivalry_score(self):
        matchup = {
            "combined": {"games": 8, "wins": 4, "losses": 4, "avgDiff": 0},
            "supercup": {"games": 1},
        }
        automatic = MODULE.rivalry_score(matchup)
        manual = MODULE.rivalry_score(matchup, {"location": "Milan"})
        self.assertEqual(manual - automatic, 12)

    def test_registry_rejects_unknown_and_reversed_duplicate_pairs(self):
        teams = {"roster1.htm": {"team": "One"}, "roster2.htm": {"team": "Two"}}
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "rivalries.json"
            source.write_text(json.dumps({"rivalries": [{"teams": ["roster1.htm", "roster9.htm"], "name": "Unknown"}]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unknown team"):
                MODULE.load_rivalry_registry(teams, source)
            source.write_text(
                json.dumps(
                    {
                        "rivalries": [
                            {"teams": ["roster1.htm", "roster2.htm"], "name": "First"},
                            {"teams": ["roster2.htm", "roster1.htm"], "name": "Reverse"},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "duplicates"):
                MODULE.load_rivalry_registry(teams, source)

    def test_head_to_head_emits_one_unique_pair_with_season_splits(self):
        index = MODULE.read_json(MODULE.HISTORY_ROOT / "index.json", {"seasons": []})
        feed = MODULE.build_head_to_head(index)
        keys = [tuple(sorted(team["file"] for team in row["teams"])) for row in feed["matchups"]]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertTrue(feed["matchups"])
        self.assertTrue(all(row["seasons"] for row in feed["matchups"]))
        self.assertTrue(all(row["games"] for row in feed["matchups"]))
        self.assertTrue(all(len(row["games"]) == row["combined"]["games"] for row in feed["matchups"]))
        self.assertTrue(all(game["venue"] in {"Home", "Away"} for row in feed["matchups"] for game in row["games"]))
        self.assertTrue(
            all(
                row["venueSplits"]["home"]["games"] + row["venueSplits"]["away"]["games"]
                == row["combined"]["games"]
                for row in feed["matchups"]
            )
        )

    def test_real_archive_timeline_extracts_completed_seasons(self):
        index = MODULE.read_json(MODULE.HISTORY_ROOT / "index.json", {"seasons": []})
        player_index = MODULE.read_json(MODULE.HISTORY_ROOT / "player_index.json", {"seasonMaps": {}})
        timeline = MODULE.timeline_records(index, MODULE.championship_records(), player_index)
        self.assertEqual(len(timeline), len(index["seasons"]))
        self.assertTrue(all(row["bestRegularSeason"].get("team") for row in timeline))
        self.assertTrue(all(len(row["championships"]) == 3 for row in timeline))


if __name__ == "__main__":
    unittest.main()
