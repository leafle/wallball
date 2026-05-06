# Wallball Agent Rules

## Project Shape

- Wallball is a Vite + TypeScript browser game with Phaser available for the game shell. Keep the fixed logical resolution at `1280x720` via `src/game/config.ts` unless a bead explicitly changes the runtime layout contract.
- Keep deterministic gameplay logic in plain TypeScript modules under `src/game/domain/` and `src/game/systems/`. Phaser scenes, DOM prototypes, and UI wiring should orchestrate these modules, not hide rules or scoring inside render lifecycle code.
- Current UI entry is `src/main.ts`, which mounts the batting prototype, remote match lab, predefined rosters, gameplay controls, and remote room client. Treat `src/game/ui/` as presentation/control glue and `src/game/input/` as the shared keyboard/touch intent abstraction.
- Use `src/game/data/fixtures.ts` for local predefined teams, players, and interaction prompts. Keep stable IDs for players, teams, prompts, matches, and high scores so Dolt records remain valid if display names change.
- Remote two-player code currently flows through `src/game/remote/*` and `server/remote-room-middleware.ts`. It should synchronize high-level player intents and deterministic state transitions, not frame-by-frame physics state.

## V0 Gameplay Scope

- The v0 slice is an arcade wallball loop: pitching, batting timing, wall target contact, ball result/rebound, fielding recovery, outs, half-innings, scoring, match recording, high scores, and friend-specific interaction hooks.
- Preserve the core play camera as wall-facing from behind the pitcher. The pitcher stays in the lower foreground; the batter, pitch path, wall target, and rebound direction must remain readable on desktop and phone-sized viewports.
- Phones are a v0 target. Touch controls must be large, `pointerdown` based, reachable with thumbs, and clear of the ball, wall target, active fielder, and essential HUD text.
- Keep the first implementation focused. Do not add polished art, career mode, full sports simulation, or remote multiplayer complexity unless the assigned bead explicitly asks for it.
- Friend-group specificity is product scope, not flavor. Player identities, rosters, rivalry history, matchup prompts, and match-history callouts should be modeled as data-driven systems.

## Architecture Rules

- Prefer tested, deterministic functions for calculations: batting timing, launch vectors, wall/rebound behavior, scoring, inning transitions, high scores, match summaries, and interaction selection.
- Keep Phaser or DOM event handlers thin. They should translate input into intents, call deterministic modules, and render returned state.
- Use the shared gameplay control abstraction in `src/game/input/game-controls.ts` for keyboard and touch input. UI controls should expose `data-control-action`, `data-control-field-x`, and `data-control-field-y` attributes where practical.
- Keep remote play layered over the local deterministic loop. Do not fork separate gameplay rules for remote rooms.
- Avoid broad refactors during feature beads. If a file boundary needs improvement, keep it directly tied to the assigned behavior and cover it with tests.

## Testing Expectations

- Run `npm test` for behavior changes and before submission when practical. The test suite uses Vitest and should remain runnable in Node without browser globals.
- Run `npm run build` before submitting implementation work. Build is the minimum gate for TypeScript and Vite correctness.
- Add or update focused tests for deterministic modules and control contracts. Tests should cover real behavior, not just implementation details.
- Use browser/manual smoke checks for feel-sensitive work: swing timing, wall-facing camera readability, touch reachability, HUD overlap, mobile layout, and remote room join/create flows.
- Keep tests fast and targeted during development; the merge queue can run the full project gate, but your branch should catch obvious failures before submission.

## Dolt-Backed Data Rules

- Dolt is the target persistence layer for match history, high scores, friend/player data, rivalry summaries, and interaction prompts.
- Browser runtime code must not talk to Dolt directly. Put persistence behind a typed data boundary, using Vite middleware or a Node service for local development.
- Keep schema, migrations, seed data, and repository code in Git. Keep Dolt internals out of Git; `.dolt/` belongs in `.gitignore`.
- Fixture fallback is allowed during early UI/gameplay work so frontend progress is not blocked by local database setup, but v0 acceptance requires Dolt-backed persistence for durable records.
- Expected durable tables include players, teams, team membership, matches, match players/events, high scores, rivalries, and interaction prompts. Preserve stable IDs across fixture and Dolt seed data.

## Collaboration Rules

- Use beads for task tracking and keep changes scoped to the hooked issue.
- Respect active parallel work. If a bead says docs-only, do not edit UI, data, schema, or runtime implementation files.
- If requirements imply expanding scope beyond the bead, file or request a follow-up bead instead of folding unrelated work into the current branch.
