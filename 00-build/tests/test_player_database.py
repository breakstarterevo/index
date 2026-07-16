import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_player_database_json.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_player_database_json", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class PlayerDatabaseBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest, cls.feeds, cls.diagnostics = MODULE.build_database()

    def player(self, snapshot, name):
        return next(player for player in self.feeds[snapshot]["players"] if player["name"] == name)

    def test_expected_snapshots_exist(self):
        self.assertEqual(self.manifest["currentSnapshot"], "current")
        self.assertTrue({"current", "season-1", "season-2", "season-3"}.issubset(self.feeds))
        warnings = MODULE.validate_database(self.manifest, self.feeds)
        self.assertTrue(all("lack a matching statistics row" in warning for warning in warnings))

    def test_ac_green_development_history(self):
        season_one_source = MODULE.load_json(
            MODULE.HISTORY_DIR / "season-1" / "database" / "players.json", []
        )
        season_one = next(player for player in season_one_source if player["name"] == "A.C. Green")
        self.assertEqual((int(season_one["overall"]), int(season_one["potential"])), (84, 111))
        self.assertFalse(any(player["name"] == "A.C. Green" for player in self.feeds["season-1"]["players"]))

        # Season 1 lists Green as a Draft record, so his first published snapshot
        # is Season 2. The rostered feeds still verify the cross-file identity.
        season_two = self.player("season-2", "A.C. Green")
        season_three = self.player("season-3", "A.C. Green")
        self.assertEqual((season_two["overall"], season_two["potential"]), (92, 111))
        self.assertEqual((season_three["overall"], season_three["potential"]), (99, 103))
        self.assertEqual(season_two["historyKey"], season_three["historyKey"])

    def test_draft_and_zero_rated_records_are_excluded(self):
        for feed in self.feeds.values():
            self.assertTrue(all(player["team"].casefold() != "draft" for player in feed["players"]))
            self.assertTrue(all(max(player["overall"] or 0, player["potential"] or 0) > 0 for player in feed["players"]))

    def test_career_stats_only_ship_in_current_feed(self):
        self.assertTrue(any("careerRegular" in player for player in self.feeds["current"]["players"]))
        self.assertTrue(all("careerRegular" not in player for player in self.feeds["season-3"]["players"]))

    def test_team_abbreviations_are_snapshot_derived(self):
        green = self.player("season-3", "A.C. Green")
        self.assertEqual(green["team"], "Valencia")
        self.assertEqual(green["teamAbbr"], "VAL")
        self.assertTrue(all(player["teamAbbr"] == "FA" for player in self.feeds["current"]["players"] if player["team"] == "FA"))

    def test_contracts_come_from_selected_snapshot(self):
        green = self.player("season-3", "A.C. Green")
        self.assertEqual(green["currentSalary"], 5000000)
        self.assertIn({"year": "1983", "salary": 5000000}, green["contracts"])

    def test_dry_run_writer_creates_no_files(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "player-database"
            MODULE.write_outputs(self.manifest, self.feeds, target, dry_run=True)
            self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
