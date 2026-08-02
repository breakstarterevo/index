"""
build_supercup_json.py
Run the existing JSON build pipeline against the raw 00-SuperCup export.

Usage:
  python 00-build/scripts/build_supercup_json.py
  python 00-build/scripts/build_supercup_json.py --dry-run
"""

import os
import sys

import build_players_json as league_builder


ROOT = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(ROOT)
PROJECT_ROOT = os.path.dirname(BUILD_DIR)
SUPERCUP_ROOT = os.path.join(PROJECT_ROOT, "00-SuperCup")
SUPERCUP_DATABASE_DIR = os.path.join(BUILD_DIR, "database", "supercup")
DRY_RUN = "--dry-run" in sys.argv


def configure_supercup_paths():
    os.makedirs(SUPERCUP_DATABASE_DIR, exist_ok=True)

    league_builder.PROJECT_ROOT = SUPERCUP_ROOT
    league_builder.DATABASE_DIR = SUPERCUP_DATABASE_DIR

    league_builder.ROSTERS_DIR = os.path.normpath(os.path.join(SUPERCUP_ROOT, "rosters"))
    league_builder.PLAYERS_DIR = os.path.normpath(os.path.join(SUPERCUP_ROOT, "players"))
    league_builder.BOXES_DIR = os.path.normpath(os.path.join(SUPERCUP_ROOT, "boxes"))

    league_builder.PLAYERS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "players.json")
    league_builder.PLAYER_STATS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "player_stats.json")
    league_builder.PLAYER_GAMELOGS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "player_gamelogs.json")
    league_builder.TEAM_STATS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "team_stats.json")
    league_builder.TEAMS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "teams.json")
    league_builder.STANDINGS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "standings.json")
    league_builder.CAPREPORT_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "capreport.json")
    league_builder.INJURIES_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "injuries.json")
    league_builder.SCHEDULE_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "schedule.json")
    league_builder.FREE_AGENTS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "freeagents.json")
    league_builder.LEADERS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "leaders.json")
    league_builder.GAME_RESULTS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "game_results.json")
    league_builder.BOX_SCORES_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "box_scores.json")
    league_builder.AWARDS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "awards.json")
    league_builder.SEASON_AWARDS_OUT = os.path.join(SUPERCUP_DATABASE_DIR, "season_awards.json")

    league_builder.STANDINGS_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "standings.htm"))
    league_builder.CAPREPORT_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "capreport.htm"))
    league_builder.INJURIES_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "injuries.htm"))
    league_builder.SCHEDULE_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "schedule.htm"))
    league_builder.FREE_AGENTS_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "freeagents.htm"))
    league_builder.DRAFT_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "draft.htm"))
    league_builder.LEADERS_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "leaders.htm"))
    league_builder.AWARDS_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "awards.htm"))
    league_builder.SEASON_AWARDS_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "seasonawards.htm"))
    league_builder.MDB_PATH = os.path.normpath(os.path.join(SUPERCUP_ROOT, "LeagueOutput.mdb"))


def main():
    configure_supercup_paths()

    if DRY_RUN:
        print("Super Cup JSON build [DRY RUN]")
        print(f"  source: {SUPERCUP_ROOT}")
        print(f"  output: {SUPERCUP_DATABASE_DIR}")
        return

    print("Super Cup JSON build")
    print(f"  source: {SUPERCUP_ROOT}")
    print(f"  output: {SUPERCUP_DATABASE_DIR}")
    league_builder.main()


if __name__ == "__main__":
    main()
