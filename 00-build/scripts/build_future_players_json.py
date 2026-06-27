import os
import sys

from atomic_write import atomic_dump_json
from build_youth_intake_json import XLSX_PATH, BUILD_DIR, build_future_players_payload


OUTPUT_PATH = os.path.join(BUILD_DIR, "database", "future_players.json")


def main():
    dry_run = "--dry-run" in sys.argv[1:]
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    if not os.path.exists(XLSX_PATH):
        print(f"Error: spreadsheet not found at {XLSX_PATH}")
        return 1

    payload = build_future_players_payload(XLSX_PATH)

    if not dry_run:
        atomic_dump_json(OUTPUT_PATH, payload, indent=4, ensure_ascii=False)

    prefix = "[dry-run] Would write" if dry_run else "Wrote"
    print(f"{prefix} {OUTPUT_PATH} ({len(payload)} players)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
