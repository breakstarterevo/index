import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_players_json.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_players_json", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def player(name, player_id, team, team_label):
    return {
        "name": name,
        "url": f"../players/{player_id}.htm",
        "team": team,
        "teamLabel": team_label,
    }


def stats(name, player_id, stat_team):
    return {
        "name": name,
        "url": f"../players/{player_id}.htm",
        "stats": {
            "season_averages": {
                "rows": [{"season": "1983", "team": stat_team}],
            }
        },
    }


class LastTeamLookupTests(unittest.TestCase):
    def test_stat_team_uses_majority_current_roster_not_first_match(self):
        players = [
            player("Transferred Player", "player1", "roster13", "Benfica"),
            player("Sporting Player One", "player2", "roster23", "Sporting CP"),
            player("Sporting Player Two", "player3", "roster23", "Sporting CP"),
        ]
        player_stats = [
            stats("Transferred Player", "player1", "SCP"),
            stats("Sporting Player One", "player2", "SCP"),
            stats("Sporting Player Two", "player3", "SCP"),
        ]

        lookup = MODULE.build_stat_team_lookup(players, player_stats)

        self.assertEqual(
            lookup["scp"],
            {"lastTeamId": "roster23", "lastTeam": "Sporting CP"},
        )

    def test_duplicate_name_does_not_override_file_specific_stats(self):
        players = [
            player("Duplicate Player", "player1", "FA", "FA"),
            player("Duplicate Player", "player2", "FA", "FA"),
        ]
        player_stats = [
            stats("Duplicate Player", "player1", ""),
            stats("Duplicate Player", "player2", "MON"),
        ]
        stat_team_lookup = {
            "mon": {"lastTeamId": "roster20", "lastTeam": "Monaco"},
        }

        lookup = MODULE.build_last_team_lookup(players, player_stats, stat_team_lookup)
        MODULE.attach_last_team(players, lookup)

        self.assertEqual(players[0]["lastTeam"], "")
        self.assertEqual(players[0]["lastTeamId"], "")
        self.assertEqual(players[1]["lastTeam"], "Monaco")
        self.assertEqual(players[1]["lastTeamId"], "roster20")


if __name__ == "__main__":
    unittest.main()
