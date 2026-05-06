# Wallball Dolt Data

This folder contains the first Git-tracked Dolt schema artifacts. The Dolt
database directory itself stays untracked through `.gitignore`.

Apply the current schema snapshot from the repository root:

```sh
dolt sql < server/data/schema.sql
```

Apply the initial migration directly:

```sh
dolt sql < server/data/migrations/0001_initial_schema.sql
```

The schema maps to the existing TypeScript data contracts:

- `teams`, `players`, and `team_players` store predefined rosters from
  `src/game/data/fixtures.ts`.
- `matches` and `match_events` store `CompletedMatch` and `MatchEvent` records
  from `src/game/domain/match-summary.ts`.
- `high_scores` stores `HighScore` records from
  `src/game/domain/high-scores.ts`.
- `interaction_prompts` stores `InteractionPrompt` rows from
  `src/game/domain/friend-interactions.ts`. The SQL column is named
  `trigger_kind` because `TRIGGER` is reserved in Dolt/MySQL syntax; it maps to
  the TypeScript `trigger` field.

Use stable string IDs for teams, players, matches, and prompts so fixture data,
match history, high scores, and interaction prompts can survive display-name
changes.
