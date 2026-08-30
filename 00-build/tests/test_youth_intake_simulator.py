import copy
import csv
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "00-build" / "scripts"
SOURCES = ROOT / "00-build" / "sources" / "youth-intake"
sys.path.insert(0, str(SCRIPTS))

from youth_intake_simulator import (  # noqa: E402
    CounterRng,
    SimulationError,
    eligible_prospects,
    generate_simulation,
    normalize_name,
)
import youth_intake_app as app  # noqa: E402


def synthetic_inputs():
    divisions = ("CLB", "ELB", "ECL")
    sections = []
    config = {"teams": []}
    for division_index, division in enumerate(divisions):
        teams = []
        for team_index in range(8):
            name = f"{division} Team {team_index + 1}"
            wins = 8 + team_index + division_index
            teams.append({"team": name, "wins": wins, "losses": 22 - team_index, "pct": wins / 30})
            config["teams"].append({
                "team": name,
                "gm": f"GM {name}",
                "positionFocus": ("PG", "SG", "SF", "PF", "C")[team_index % 5],
            })
        sections.append({"slug": division.lower(), "teams": teams})

    prospects = []
    for tier in ("A", "B", "C", "D"):
        for position in ("PG", "SG", "SF", "PF", "C"):
            for index in range(80):
                prospects.append({
                    "name": f"{tier} {position} Prospect {index}",
                    "tier": tier,
                    "Position": position,
                    "DOB": f"{tier}-{position}-{index}",
                    "Height": 72 + index % 12,
                    "Age": 19 + index % 4,
                })
    rules = json.loads((SOURCES / "rules.json").read_text(encoding="utf-8"))
    return {"standings": {"sections": sections}, "config": config, "rules": rules, "prospects": prospects}


class YouthIntakeSimulatorTests(unittest.TestCase):
    def simulate(self, seed="fixed-seed", exclusions=()):
        data = synthetic_inputs()
        return generate_simulation(
            **data,
            excluded_names=exclusions,
            seed=seed,
            season="Season 9",
            mode="test",
        )

    def test_fixed_totals_and_no_duplicates(self):
        result = self.simulate()
        self.assertEqual(result["counts"], {"teams": 24, "prospects": 72, "CLB": 16, "ELB": 24, "ECL": 32})
        names = [
            normalize_name(player["name"])
            for team in result["teams"]
            for player in team["intakePlayers"]
        ]
        self.assertEqual(len(names), len(set(names)))

    def test_reveal_order_is_alphabetical_by_team(self):
        result = self.simulate("alphabetical-reveal")
        expected = sorted((team["team"] for team in result["teams"]), key=str.casefold)
        self.assertEqual(result["revealOrder"], expected)

    def test_deterministic_selection_and_slot_shuffle(self):
        first = self.simulate("replay-seed")
        second = self.simulate("replay-seed")
        self.assertEqual(first["allocationOrder"], second["allocationOrder"])
        self.assertEqual(
            [(row["slotId"], row["tier"], row["focusOutcome"], row["playerName"]) for row in first["audit"]],
            [(row["slotId"], row["tier"], row["focusOutcome"], row["playerName"]) for row in second["audit"]],
        )
        self.assertNotEqual(first["allocationOrder"], self.simulate("different-seed")["allocationOrder"])

    def test_focus_branch_is_exact(self):
        result = self.simulate("focus-seed")
        focus_by_team = {team["team"]: team["positionFocus"] for team in result["teams"]}
        focused = random = 0
        for team in result["teams"]:
            for player in team["intakePlayers"]:
                if player["focusApplied"]:
                    focused += 1
                    self.assertEqual(player["Position"], focus_by_team[team["team"]])
                else:
                    random += 1
                    self.assertNotEqual(player["Position"], focus_by_team[team["team"]])
        self.assertGreater(focused, 0)
        self.assertGreater(random, 0)

    def test_wildcard_tiers_never_leave_declared_weights(self):
        result = self.simulate("wildcard-seed")
        for row in result["audit"]:
            self.assertIn(row["tier"], row["tierWeights"])
            if row["slotType"] == "guaranteed":
                self.assertEqual(len(row["tierWeights"]), 1)

    def test_weighted_choice_boundaries(self):
        class BoundaryRng:
            def __init__(self, value):
                self.value = value

            def below(self, upper):
                self.assert_upper = upper
                return self.value

        weights = {"A": 25, "B": 25, "D": 50}
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(0), weights)[0], "A")
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(24), weights)[0], "A")
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(25), weights)[0], "B")
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(49), weights)[0], "B")
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(50), weights)[0], "D")
        self.assertEqual(CounterRng.weighted_choice(BoundaryRng(99), weights)[0], "D")

    def test_excluded_names_are_never_selected(self):
        baseline = self.simulate("excluded-seed")
        excluded = [baseline["audit"][0]["playerName"], baseline["audit"][1]["playerName"]]
        rerun = self.simulate("excluded-seed", excluded)
        selected = {normalize_name(row["playerName"]) for row in rerun["audit"]}
        self.assertTrue(selected.isdisjoint({normalize_name(name) for name in excluded}))

    def test_pool_normalizes_duplicate_names(self):
        prospects = [
            {"name": "José Calderón", "tier": "B", "Position": "PG", "DOB": "one", "Height": 75},
            {"name": "Jose Calderon", "tier": "B", "Position": "PG", "DOB": "two", "Height": 76},
        ]
        eligible = eligible_prospects(prospects, ())
        self.assertEqual(len(eligible), 1)

    def test_pool_keeps_same_name_when_name_plus_pot_differs(self):
        prospects = [
            {"name": "Charles Jones", "Name + Pot": "Charles Jones100", "tier": "B", "Position": "PG", "DOB": "one", "Height": 75},
            {"name": "Charles Jones", "Name + Pot": "Charles Jones120", "tier": "A", "Position": "SG", "DOB": "two", "Height": 76},
        ]
        eligible = eligible_prospects(prospects, ())
        self.assertEqual(len(eligible), 2)
        self.assertEqual({player["poolIdentity"] for player in eligible}, {"Charles Jones100", "Charles Jones120"})

    def test_pool_keeps_same_name_and_pot_when_column2_differs(self):
        prospects = [
            {"name": "Charles Jones", "Name + Pot": "Charles Jones93", "Column2": "CharlesJones81", "tier": "C", "Position": "PG"},
            {"name": "Charles Jones", "Name + Pot": "Charles Jones93", "Column2": "CharlesJones80", "tier": "C", "Position": "SG"},
            {"name": "Charles Jones", "Name + Pot": "Charles Jones93", "Column2": "CharlesJones80", "tier": "C", "Position": "SG"},
        ]
        eligible = eligible_prospects(prospects, ())
        self.assertEqual(len(eligible), 2)
        self.assertEqual(
            {player["poolIdentity"] for player in eligible},
            {"Charles Jones93|CharlesJones80", "Charles Jones93|CharlesJones81"},
        )

    def test_insufficient_pool_aborts(self):
        data = synthetic_inputs()
        data["prospects"] = [player for player in data["prospects"] if player["tier"] != "C"]
        with self.assertRaisesRegex(SimulationError, "No eligible Tier C prospects"):
            generate_simulation(
                **data,
                excluded_names=(),
                seed="short-pool",
                season="Season 9",
                mode="official",
            )

    def test_incomplete_focus_blocks_generation(self):
        data = synthetic_inputs()
        broken = copy.deepcopy(data["config"])
        broken["teams"][0]["positionFocus"] = ""
        data["config"] = broken
        with self.assertRaisesRegex(SimulationError, "requires a PG"):
            generate_simulation(
                **data,
                excluded_names=(),
                seed="bad-config",
                season="Season 9",
                mode="official",
            )


class YouthIntakeAppStateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.build = root / "00-build"
        self.database = self.build / "database"
        self.source = self.build / "sources" / "youth-intake"
        self.database.mkdir(parents=True)
        self.source.mkdir(parents=True)
        data = synthetic_inputs()
        self.paths = {
            "PROJECT_ROOT": root,
            "BUILD_DIR": self.build,
            "DATABASE_DIR": self.database,
            "SOURCE_DIR": self.source,
            "DRAFT_PATH": self.source / "drafts" / "current.json",
            "VOIDS_DIR": self.source / "voids",
            "SEASONS_DIR": self.source / "seasons",
            "AWARDS_DIR": self.source / "awards",
            "CONFIG_PATH": self.source / "config.json",
            "RULES_PATH": self.source / "rules.json",
            "USED_PATH": self.source / "used-prospects.json",
            "CURRENT_SOURCE_PATH": self.source / "current.json",
            "STANDINGS_PATH": self.database / "standings.json",
            "FUTURE_PLAYERS_PATH": self.database / "future_players.json",
            "PLAYERS_PATH": self.database / "players.json",
            "PUBLIC_INTAKE_PATH": self.database / "youth_intake.json",
        }
        for path, payload in (
            (self.paths["STANDINGS_PATH"], data["standings"]),
            (self.paths["CONFIG_PATH"], data["config"]),
            (self.paths["RULES_PATH"], data["rules"]),
            (self.paths["FUTURE_PLAYERS_PATH"], data["prospects"]),
            (self.paths["PLAYERS_PATH"], []),
            (self.paths["USED_PATH"], {"schemaVersion": 1, "players": []}),
        ):
            path.write_text(json.dumps(payload), encoding="utf-8")
        self.patcher = mock.patch.multiple(app, **self.paths)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.temp.cleanup()

    def test_test_draw_does_not_create_official_state(self):
        result = app.generate(season="season-9", mode="test", seed="disposable")
        self.assertEqual(result["status"], "test")
        self.assertFalse(self.paths["DRAFT_PATH"].exists())
        self.assertFalse(self.paths["CURRENT_SOURCE_PATH"].exists())
        self.assertEqual(json.loads(self.paths["USED_PATH"].read_text())["players"], [])

    def test_official_draft_survives_then_voids_with_reason(self):
        draft = app.create_official_draft({"season": "season-9"})
        self.assertTrue(self.paths["DRAFT_PATH"].exists())
        recovered = app.read_json(self.paths["DRAFT_PATH"])
        self.assertEqual(recovered["draftHash"], draft["draftHash"])
        voided = app.void_draft("Commissioner test void")
        self.assertEqual(voided["voidReason"], "Commissioner test void")
        self.assertFalse(self.paths["DRAFT_PATH"].exists())
        self.assertEqual(len(list(self.paths["VOIDS_DIR"].glob("*.json"))), 1)

    def test_publish_is_idempotent_and_reserves_all_players(self):
        draft = app.create_official_draft({"season": "season-9"})
        first = app.publish_draft(draft["draftHash"])
        second = app.publish_draft(draft["draftHash"])
        self.assertFalse(first.get("idempotent", False))
        self.assertTrue(second["idempotent"])
        self.assertTrue(self.paths["CURRENT_SOURCE_PATH"].exists())
        self.assertTrue(self.paths["PUBLIC_INTAKE_PATH"].exists())
        ledger = json.loads(self.paths["USED_PATH"].read_text(encoding="utf-8"))
        self.assertEqual(len(ledger["players"]), 72)

    def test_published_rights_trade_preserves_draw_and_updates_public_feed(self):
        draft = app.create_official_draft({"season": "season-9"})
        published = app.publish_draft(draft["draftHash"])["publication"]
        intake_team = published["teams"][0]
        player = intake_team["intakePlayers"][0]
        destination = published["teams"][1]["team"]

        result = app.transfer_rights({
            "prospectKey": player["prospectKey"],
            "toTeam": destination,
            "note": "Trade 14: future consideration",
            "expectedRevision": 0,
        })

        current = json.loads(self.paths["CURRENT_SOURCE_PATH"].read_text(encoding="utf-8"))
        public = json.loads(self.paths["PUBLIC_INTAKE_PATH"].read_text(encoding="utf-8"))
        season = json.loads((self.paths["SEASONS_DIR"] / "season-9.json").read_text(encoding="utf-8"))
        public_player = next(
            prospect
            for team in public["teams"]
            for prospect in team["intakePlayers"]
            if prospect.get("prospectKey") == player["prospectKey"]
        )

        self.assertEqual(current["draftHash"], draft["draftHash"])
        self.assertEqual(current["publicationHash"], published["publicationHash"])
        self.assertEqual(current["rightsRevision"], 1)
        self.assertEqual(current["rightsTransfers"][0]["fromTeam"], intake_team["team"])
        self.assertEqual(current["rightsTransfers"][0]["toTeam"], destination)
        self.assertEqual(season["rightsHash"], current["rightsHash"])
        self.assertEqual(public_player["intakeTeam"], intake_team["team"])
        self.assertEqual(public_player["rightsTeam"], destination)
        self.assertEqual(result["transfer"]["transactionId"], current["rightsTransfers"][0]["transactionId"])

    def test_rights_trade_rejects_same_owner_and_stale_revision(self):
        draft = app.create_official_draft({"season": "season-9"})
        published = app.publish_draft(draft["draftHash"])["publication"]
        intake_team = published["teams"][0]
        player = intake_team["intakePlayers"][0]
        destination = published["teams"][1]["team"]

        with self.assertRaisesRegex(SimulationError, "already owns"):
            app.transfer_rights({
                "prospectKey": player["prospectKey"],
                "toTeam": intake_team["team"],
                "note": "No-op",
                "expectedRevision": 0,
            })

        app.transfer_rights({
            "prospectKey": player["prospectKey"],
            "toTeam": destination,
            "note": "First trade",
            "expectedRevision": 0,
        })
        with self.assertRaisesRegex(SimulationError, "Reload"):
            app.transfer_rights({
                "prospectKey": player["prospectKey"],
                "toTeam": intake_team["team"],
                "note": "Stale browser",
                "expectedRevision": 0,
            })
        returned = app.transfer_rights({
            "prospectKey": player["prospectKey"],
            "toTeam": intake_team["team"],
            "note": "Rights returned",
            "expectedRevision": 1,
        })
        self.assertEqual(returned["transfer"]["fromTeam"], destination)
        self.assertEqual(returned["publication"]["rightsRevision"], 2)

    def test_staged_award_supplements_draw_and_removal_restores_pool(self):
        before = app.bootstrap_payload("season-9")["pool"]["total"]
        created = app.create_staged_award({
            "season": "season-9",
            "team": "ELB Team 1",
            "awardType": "europa-wildcard",
            "note": "Commissioner compensation",
            "seed": "staged-award-seed",
            "expectedRevision": 0,
        })
        award = created["award"]
        self.assertEqual(award["division"], "ELB")
        self.assertIn(award["selectedTier"], {"A", "B", "D"})
        self.assertEqual(created["bootstrap"]["pool"]["total"], before - 1)

        result = app.generate(season="season-9", mode="test", seed="draw-with-award")
        self.assertEqual(result["counts"]["prospects"], 73)
        self.assertEqual(result["counts"]["ELB"], 25)
        selected = [player for team in result["teams"] for player in team["intakePlayers"]]
        self.assertEqual(sum(bool(player.get("manualAward")) for player in selected), 1)
        self.assertEqual(len({player["prospectKey"] for player in selected}), 73)

        removed = app.remove_staged_award({
            "season": "season-9",
            "awardId": award["awardId"],
            "expectedRevision": 1,
        })
        self.assertEqual(removed["bootstrap"]["pool"]["total"], before)

    def test_award_types_enforce_divisions_and_refresh_lock(self):
        with self.assertRaisesRegex(SimulationError, "not available"):
            app.create_staged_award({
                "season": "season-9", "team": "CLB Team 1", "awardType": "europa-wildcard",
                "note": "Invalid division", "seed": "invalid-award", "expectedRevision": 0,
            })
        created = app.create_staged_award({
            "season": "season-9", "team": "CLB Team 1", "awardType": "guaranteed-b",
            "note": "Guaranteed award", "seed": "guaranteed-award", "expectedRevision": 0,
        })
        self.assertEqual(created["award"]["selectedTier"], "B")
        with self.assertRaisesRegex(SimulationError, "staged individual awards"):
            app.refresh_pool()

    def test_staged_award_is_published_and_fbb3_reduces_fillers(self):
        app.create_staged_award({
            "season": "season-9", "team": "ECL Team 1", "awardType": "ecl-wildcard-a",
            "note": "Academy ruling", "seed": "publish-award", "expectedRevision": 0,
        })
        draft = app.create_official_draft({"season": "season-9"})
        self.assertEqual(draft["counts"]["ECL"], 33)
        published = app.publish_draft(draft["draftHash"])["publication"]
        self.assertEqual(published["manualAwards"][0]["status"], "published")
        archive_bytes, _ = app.build_fbb3_export(published)
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            manifest_name = next(name for name in archive.namelist() if name.endswith("-export.json"))
            manifest = json.loads(archive.read(manifest_name))
        self.assertEqual(manifest["divisions"]["ECL"]["realProspects"], 33)
        self.assertEqual(manifest["divisions"]["ECL"]["fillerProspects"], 68)

    def test_published_award_reversal_is_audited_and_restores_eligibility(self):
        draft = app.create_official_draft({"season": "season-9"})
        publication = app.publish_draft(draft["draftHash"])["publication"]
        created = app.create_published_award({
            "season": "season-9", "team": "CLB Team 1", "awardType": "guaranteed-b",
            "note": "Published compensation", "seed": "published-award", "expectedRevision": 0,
        })
        award = created["award"]
        self.assertEqual(created["publication"]["counts"]["prospects"], 73)
        self.assertEqual(created["publication"]["awardsRevision"], 1)
        self.assertIn(award["slotId"], created["publication"]["allocationOrder"])
        self.assertEqual(created["publication"]["audit"][-1]["awardId"], award["awardId"])
        with self.assertRaisesRegex(SimulationError, "Reload"):
            app.reverse_published_award({"awardId": award["awardId"], "reason": "Stale", "expectedRevision": 0})

        reversed_result = app.reverse_published_award({
            "awardId": award["awardId"], "reason": "Commissioner correction", "expectedRevision": 1,
        })
        self.assertEqual(reversed_result["publication"]["counts"]["prospects"], 72)
        self.assertEqual(reversed_result["publication"]["awardsRevision"], 2)
        self.assertEqual(reversed_result["award"]["status"], "reversed")
        self.assertNotIn(award["slotId"], reversed_result["publication"]["allocationOrder"])
        self.assertEqual(reversed_result["publication"]["audit"][-1]["awardStatus"], "reversed")
        ledger = json.loads(self.paths["USED_PATH"].read_text(encoding="utf-8"))
        ledger_award = next(entry for entry in ledger["players"] if entry.get("awardId") == award["awardId"])
        self.assertEqual(ledger_award["status"], "reversed")
        eligible_names = {normalize_name(player["name"]) for player in eligible_prospects(
            json.loads(self.paths["FUTURE_PLAYERS_PATH"].read_text(encoding="utf-8")),
            app.collect_excluded_names(ledger),
        )}
        self.assertIn(normalize_name(award["playerName"]), eligible_names)

    def test_published_award_reversal_requires_intake_team_rights(self):
        draft = app.create_official_draft({"season": "season-9"})
        app.publish_draft(draft["draftHash"])
        created = app.create_published_award({
            "season": "season-9", "team": "CLB Team 1", "awardType": "guaranteed-c",
            "note": "Published award", "seed": "rights-award", "expectedRevision": 0,
        })
        award = created["award"]
        app.transfer_rights({
            "prospectKey": award["prospectKey"], "toTeam": "CLB Team 2",
            "note": "Award rights traded", "expectedRevision": 0,
        })
        with self.assertRaisesRegex(SimulationError, "Return this prospect's youth rights"):
            app.reverse_published_award({
                "awardId": award["awardId"], "reason": "Correction", "expectedRevision": 1,
            })

    def test_fbb3_export_uses_draw_divisions_and_zero_rated_fillers(self):
        draft = app.create_official_draft({"season": "season-9"})
        archive_bytes, archive_name = app.build_fbb3_export(draft)
        self.assertEqual(archive_name, "season-9-FBB3-Youth-Intake.zip")
        expectations = {
            "CLB": (16, 65, 81),
            "ELB": (24, 55, 79),
            "ECL": (32, 69, 101),
        }
        with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
            names = archive.namelist()
            self.assertEqual(len([name for name in names if name.endswith(".csv")]), 3)
            for division, (real_count, filler_count, total_count) in expectations.items():
                filename = next(name for name in names if f"-{division}-" in name)
                payload = archive.read(filename)
                self.assertTrue(payload.startswith(b"\xef\xbb\xbf"))
                rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
                self.assertEqual(len(rows), total_count)
                self.assertEqual(len(rows[:real_count]), real_count)
                fillers = rows[real_count:]
                self.assertEqual(len(fillers), filler_count)
                self.assertTrue(all(row["LastName"] == "Mascot" for row in fillers))
                self.assertTrue(all(int(row["InsideScoring"]) == 0 for row in fillers))
                self.assertTrue(all(int(row["InjuryAvoidance"]) == 0 for row in fillers))

    def test_stale_input_blocks_publish_without_partial_files(self):
        draft = app.create_official_draft({"season": "season-9"})
        config = json.loads(self.paths["CONFIG_PATH"].read_text(encoding="utf-8"))
        config["teams"][0]["gm"] = "Changed after draw"
        self.paths["CONFIG_PATH"].write_text(json.dumps(config), encoding="utf-8")
        with self.assertRaisesRegex(SimulationError, "changed after the draw"):
            app.publish_draft(draft["draftHash"])
        self.assertTrue(self.paths["DRAFT_PATH"].exists())
        self.assertFalse(self.paths["CURRENT_SOURCE_PATH"].exists())
        self.assertFalse(self.paths["PUBLIC_INTAKE_PATH"].exists())


if __name__ == "__main__":
    unittest.main()
