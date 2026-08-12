import importlib.util
import sys
import unittest
from datetime import datetime
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_monthly_jsons.py"
sys.path.insert(0, str(SCRIPT.parent))
SPEC = importlib.util.spec_from_file_location("build_monthly_jsons", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class MonthlyDateParsingTests(unittest.TestCase):
    def test_infers_one_order_for_ambiguous_export_dates(self):
        self.assertEqual(MODULE.infer_game_date_format(["10/16/1984"]), "%m/%d/%Y")
        self.assertEqual(MODULE.infer_game_date_format(["16/10/1984"]), "%d/%m/%Y")
        self.assertEqual(MODULE.infer_game_date_format(["03/04/1985"]), "%d/%m/%Y")

    def test_parses_iso_dates_and_timestamps_without_changing_slash_order(self):
        date_format = MODULE.infer_game_date_format(["1984-10-16", "1985-04-18"])
        self.assertEqual(MODULE.parse_game_date("1984-10-16", date_format), datetime(1984, 10, 16))
        self.assertEqual(
            MODULE.parse_game_date("1985-04-18T13:45:00Z", date_format),
            datetime(1985, 4, 18, 13, 45),
        )

    def test_parses_multiple_separators_with_the_export_order(self):
        self.assertEqual(
            MODULE.parse_game_date("10-16-1984", "%m/%d/%Y"),
            datetime(1984, 10, 16),
        )
        self.assertEqual(
            MODULE.parse_game_date("16.10.1984", "%d/%m/%Y"),
            datetime(1984, 10, 16),
        )
        self.assertEqual(
            MODULE.parse_game_date("1984/10/16", "%d/%m/%Y"),
            datetime(1984, 10, 16),
        )

    def test_latest_sim_results_accepts_iso_dates(self):
        result = MODULE.build_latest_sim_results(
            {
                "results": [
                    {"date": "1985-03-31", "section": "Regular Season"},
                    {"date": "1985-04-01", "section": "Preseason"},
                    {"date": "1985-04-18", "section": "Regular Season"},
                ]
            }
        )

        self.assertEqual(result["period"]["label"], "April 1985")
        self.assertEqual([game["date"] for game in result["results"]], ["1985-04-18"])

    def test_empty_results_keep_an_explicit_empty_period(self):
        self.assertEqual(
            MODULE.build_latest_sim_results({"results": []}),
            {"source": ["game_results.json"], "period": None, "results": []},
        )


if __name__ == "__main__":
    unittest.main()
