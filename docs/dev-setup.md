# Wallball Dev Setup

## Prerequisites

- Node.js with npm.
- Dolt available on your `PATH` for local persistence work.
- Gas Town tools available in this workspace: `gt` for worker workflow and `bd` for beads issue tracking.

Install JavaScript dependencies from the repository root:

```sh
npm install
```

## Npm Commands

Use these commands from the repository root:

```sh
npm run dev       # Start the Vite dev server
npm test          # Run Vitest once
npm run smoke:remote # Run remote room gameplay smoke flow
npm run build     # Type-check and build with Vite
npm run preview   # Preview the production build locally
```

`npm run build` runs `tsc --noEmit` before `vite build`, so it is the fastest full TypeScript/Vite gate. `npm test` covers deterministic TypeScript modules, including rules, systems, remote room behavior, control input, fixtures, and schema shape.

`npm run smoke:remote` drives a deterministic remote room path through the in-memory client, API, store, and local-loop bridge. It covers create/join, participant readiness, pitch/swing/fielding/recovery intent sequencing, match recording, and the local-play fallback when a remote room or second participant is unavailable. It does not require auth, matchmaking, or production networking.

## Gas Town Workflow

This repo uses Gas Town plus beads for task tracking.

Start or recover context:

```sh
gt prime
bd prime
gt hook
bd show <issue-id>
```

Normal polecat flow:

```sh
git fetch origin main
git checkout -b polecat/<name> origin/main
# make the scoped change
npm test
npm run build
git status
git add <files>
git commit -m "<type>: <description> (<issue-id>)"
gt done --pre-verified --target main
```

Keep work scoped to the hooked bead. Use `bd update <issue-id> --notes "..."` for findings that should survive session restarts. When a task is docs-only, edit only documentation files and do not touch implementation, schema, migration, UI, or data files.

## Dolt Data Setup

Dolt stores durable Wallball data: teams, players, team membership, matches, match events, high scores, and interaction prompts. The Dolt database internals stay untracked; `.dolt/` is ignored by Git.

For a fresh local Dolt database, initialize Dolt from the repository root or from the chosen local data directory:

```sh
dolt init
```

Apply the current schema snapshot from the repository root:

```sh
dolt sql < server/data/schema.sql
```

Or apply the ordered initial migration:

```sh
dolt sql < server/data/migrations/0001_initial_schema.sql
```

Both files currently create the same first schema and record migration version `0001` in `schema_migrations`.

Useful Dolt checks:

```sh
dolt status
dolt sql -q "show tables"
dolt sql -q "select version, name, applied_at from schema_migrations"
```

The schema is Git-tracked in `server/data/schema.sql`; migrations live under `server/data/migrations/`. Keep future schema changes in both the snapshot and a new ordered migration. Do not commit `.dolt/`.

## Data Model Notes

- `teams`, `players`, and `team_players` map to predefined rosters in `src/game/data/fixtures.ts`.
- `matches` and `match_events` map to match records from `src/game/domain/match-summary.ts`.
- `high_scores` maps to records from `src/game/domain/high-scores.ts`.
- `interaction_prompts` maps to friend interaction prompts from `src/game/domain/friend-interactions.ts`.
- The SQL column `trigger_kind` maps to the TypeScript `trigger` field because `TRIGGER` is reserved in Dolt/MySQL syntax.
- Use stable string IDs for teams, players, matches, and prompts so fixture data and Dolt records survive display-name changes.

Browser runtime code should not connect directly to Dolt. Put persistence behind a typed server-side boundary, such as Vite middleware or a local Node service. Fixture fallback is acceptable for early UI/gameplay work, but durable v0 records should flow through Dolt-backed storage.

## Verification

For docs-only changes, at minimum confirm the docs diff is scoped correctly:

```sh
git status
git diff --stat
```

When the JavaScript toolchain is available, also run the quick project gates:

```sh
npm test
npm run build
```
