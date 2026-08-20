# History Story Sources

`rivalries.json` adds named or location-based rivalries to the automatically generated history rankings.

- Use stable `rosterN.htm` IDs from archived standings.
- Each entry must contain exactly two different teams and a public name.
- `location` is optional and supplies the location badge and ranking bonus.
- `featured` places the rivalry in the featured/local filter and ahead of ordinary automatic results.
- Manual pairs remain visible before they reach the automatic six-game minimum.

The season archive command validates this file and regenerates `00-build/history/history_stories.json`.
