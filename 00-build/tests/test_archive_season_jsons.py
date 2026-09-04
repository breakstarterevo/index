import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "archive_season_jsons.py"
SPEC = importlib.util.spec_from_file_location("archive_season_jsons", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class PlayerIdentityIndexTests(unittest.TestCase):
    def write_season(self, root, number, players):
        season = root / f"season-{number}"
        database = season / "database"
        database.mkdir(parents=True)
        (database / "players.json").write_text(json.dumps(players), encoding="utf-8")
        (season / "manifest.json").write_text(
            json.dumps({"label": f"Season {number}"}), encoding="utf-8"
        )

    def test_stable_player_file_prevents_false_age_split(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            seasons = (
                (1, "player501.htm", 22),
                (2, "player255.htm", 22),
                (3, "player255.htm", 23),
                (4, "player255.htm", 24),
                (5, "player255.htm", 24),
            )
            for number, player_file, age in seasons:
                self.write_season(root, number, [{
                    "name": "Steve Nash",
                    "url": f"../players/{player_file}",
                    "ht": "6-3",
                    "wt": "195",
                    "age": str(age),
                }])

            index = MODULE.build_player_identity_index(root)
            identities = [row for row in index["identities"] if row["name"] == "Steve Nash"]
            self.assertEqual(len(identities), 1)
            self.assertEqual(len(identities[0]["appearances"]), 5)
            self.assertEqual(
                index["seasonMaps"]["season-5"]["player255.htm"],
                identities[0]["key"],
            )

    def test_reused_player_file_does_not_merge_a_different_person(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.write_season(root, 1, [{
                "name": "First Player", "url": "../players/player1.htm",
                "ht": "6-3", "wt": "190", "age": "22",
            }])
            self.write_season(root, 2, [{
                "name": "Second Player", "url": "../players/player1.htm",
                "ht": "6-3", "wt": "190", "age": "22",
            }])

            index = MODULE.build_player_identity_index(root)
            self.assertEqual(len(index["identities"]), 2)

    def test_unambiguous_adjacent_seasons_survive_file_and_age_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.write_season(root, 4, [{
                "name": "Cedi Osman", "url": "../players/player356.htm",
                "ht": "6-7", "wt": "230", "age": "22",
            }])
            self.write_season(root, 5, [{
                "name": "Cedi Osman", "url": "../players/player89.htm",
                "ht": "6-7", "wt": "231", "age": "20",
            }])

            index = MODULE.build_player_identity_index(root)
            identities = [row for row in index["identities"] if row["name"] == "Cedi Osman"]
            self.assertEqual(len(identities), 1)
            self.assertEqual(len(identities[0]["appearances"]), 2)

    def test_concurrent_same_name_players_remain_separate(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.write_season(root, 3, [{
                "name": "Solomon Alabi", "url": "../players/player832.htm",
                "ht": "7-1", "wt": "251", "age": "22",
            }])
            self.write_season(root, 4, [
                {
                    "name": "Solomon Alabi", "url": "../players/player832.htm",
                    "ht": "7-1", "wt": "251", "age": "23",
                },
                {
                    "name": "Solomon Alabi", "url": "../players/player345.htm",
                    "ht": "7-1", "wt": "253", "age": "21",
                },
            ])
            self.write_season(root, 5, [
                {
                    "name": "Solomon Alabi", "url": "../players/player832.htm",
                    "ht": "7-1", "wt": "251", "age": "24",
                },
                {
                    "name": "Solomon Alabi", "url": "../players/player345.htm",
                    "ht": "7-1", "wt": "253", "age": "22",
                },
            ])

            index = MODULE.build_player_identity_index(root)
            identities = [row for row in index["identities"] if row["name"] == "Solomon Alabi"]
            self.assertEqual(len(identities), 2)
            self.assertEqual(sorted(len(identity["appearances"]) for identity in identities), [2, 3])


if __name__ == "__main__":
    unittest.main()
