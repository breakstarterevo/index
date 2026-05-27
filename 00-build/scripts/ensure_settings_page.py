"""
ensure_settings_page.py
Keeps the browser-only league settings page present after generated HTML refreshes.
"""

import os

from atomic_write import atomic_write_text

ROOT_FOLDER = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SETTINGS_PATH = os.path.join(ROOT_FOLDER, "00-assets", "html", "settings.htm")

SETTINGS_HTML = """<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.25, maximum-scale=5.0, user-scalable=yes">
  <title>ESL Settings</title>
  <link rel="icon" type="image/png" href="../../00-build/database/favicon.png">
  <link rel="stylesheet" href="../css/styles.css">
  <script src="../js/sort.js" defer></script>
  <script src="../js/features.js" defer></script>
</head>
<body>
  <main id="league-settings-root"></main>
</body>
</html>
"""


def main():
    if os.path.exists(SETTINGS_PATH):
        print(f"SKIPPED (present): {SETTINGS_PATH}")
        return

    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    atomic_write_text(SETTINGS_PATH, SETTINGS_HTML, newline="\n")
    print(f"CREATED: {SETTINGS_PATH}")


if __name__ == "__main__":
    main()
