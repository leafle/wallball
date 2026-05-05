# Wallball Unified Design

## Purpose

Wallball is a modern browser game inspired by early-1990s RBI Baseball gameplay and by the real wallball games played by an old high-school friend group. The game should not feel like a generic sports prototype. The specific players, rivalries, memories, match history, and recurring jokes between friends are part of the product.

The first milestone is a playable vertical slice that proves the core arcade loop works: batting, pitching, wall target contact, rebound physics, fielding, outs, innings, scoring, high scores, match history, and friend-driven interactions. A stretch goal for the first release is remote two-player play where friends can play from different phones in different places.

## Product Direction

Wallball has two teams that alternate batting and pitching/fielding. Each team has two or three players: one pitcher and one or two outfielders. Everyone bats. The field is anchored by a building wall with a painted square target.

The main gameplay camera is wall-facing from behind the pitcher. The pitcher should sit in the foreground, the batter and target wall should be readable ahead, and the view should make the wall target, pitch path, swing timing, and rebound direction obvious. Other camera treatments can be used later for replays or presentation, but the core play view is not an open question.

The game should feel modern in presentation but retro in gameplay values:

- Fast readable action
- Snappy input timing
- Exaggerated but predictable ball movement
- Clear camera framing
- Simple rules surfaced through play
- Deterministic state machines instead of realism-first simulation
- Player personality and friend history surfaced during play

The first version should use placeholder art and programmatic shapes where needed. Asset polish can come after the loop, records, and friend interactions are working.

## V0 Feature Scope

The v0 slice should include:

- A batting view with a pitcher, batter, wall target, and ball
- A main wall-facing camera from behind the pitcher
- Pitch input or automated pitching
- Batter swing timing
- Ball contact result based on timing and pitch position
- Wall target collision and rebound behavior
- Fielding players that can recover the ball
- Simple out and scoring rules
- Half-inning transition after a small number of outs
- Minimal HUD for inning, score, outs, current batter, and current matchup
- Phone-playable touch controls and responsive HUD layout
- High scores and leaderboard-style records
- Match history across sessions
- Friend/player profiles with names, nicknames, and simple personality metadata
- Predefined teams and rosters based on the real friend group
- In-game interaction hooks driven by player identity, match state, and prior history

The v0 core does not need online multiplayer, polished art, full career mode, or a complete sports simulation. It does need persistence and enough friend-specific context that the game feels rooted in the real group from the start.

## Predefined Teams

V0 should ship with predefined teams and players. Team selection should use this roster rather than generated teams or user-created rosters:

| Team | Players |
| --- | --- |
| Champions | Cainer, Minkus, Brandon |
| Woodland | Al, Danny, Regen |
| Team Cainer | Rich, JSack, Jeremy |
| EJ | Bobby, Nick, Andrew |

These teams should exist as both local fixture data and Dolt seed data. Use stable internal IDs for teams and players so match history, high scores, rivalry records, and interaction prompts can reference them safely even if display names are adjusted later.

## Technical Stack

Use a browser-based TypeScript stack:

- Vite for dev server, bundling, and fast reloads
- TypeScript for game code
- Phaser 3 for scenes, sprites, input, asset loading, animation, and arcade-style collision
- Vitest for deterministic module tests
- npm for scripts and dependency management
- Dolt for versioned match history, high scores, and friend/player data

Phaser is preferred over raw Canvas 2D because the game needs scenes, animation, input handling, collision helpers, asset loading, and state transitions. Phaser gives those primitives without turning the first version into a custom engine project.

Avoid Three.js for the first prototype. The reference feel is sprite-based arcade baseball, and the main challenge is timing, feedback, and readability rather than 3D physical realism.

## Runtime Shape

Use a fixed logical game resolution with responsive browser scaling. A good starting point is 1280x720 because it supports a modern landscape layout while preserving simple arcade framing.

The primary camera should be the wall-facing view from behind the pitcher across batting, pitching, and fielding phases unless playability testing proves a temporary fielding adjustment is necessary. On phones, this view should preserve the pitcher in the lower foreground, the target wall toward the upper field, and enough side space for thumb controls without covering active play.

Phones are a v0 target, not a later port. The first implementation should target mobile landscape play with a clear rotate-device prompt for portrait orientation if portrait play is not yet usable. Touch controls should be large, low-latency, and reachable with thumbs: a swing/action zone, directional fielding control, and any pitch controls should avoid tiny buttons and avoid covering the ball, wall target, or active fielder.

The HUD must have a mobile layout that preserves the essential information: inning, score, outs, current batter, current matchup, and short interaction callouts. Text should be readable on small screens without overlapping the playfield.

Because Dolt is not directly available from browser runtime code, persistence should sit behind a small boundary:

- The Phaser game calls a typed data API for players, match results, high scores, and interaction context.
- The first implementation can use a local Node service or Vite middleware backed by Dolt.
- If the persistence service is unavailable during early development, the app may temporarily fall back to local fixture data or localStorage, but the v0 acceptance target is Dolt-backed persistence.

Remote two-player mode should be treated as an optional first-release layer over the same deterministic game state, not a separate game. The local loop should expose player inputs and state transitions cleanly enough that a network session can synchronize high-level events such as pitch selection, swing timing, fielder movement input, inning transitions, and final match recording.

Expected npm scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest"
}
```

If a local persistence service is added, include a clear script such as `npm run dev:data` or `npm run dev:all` rather than hiding it in manual steps.

## Repository Layout

Target structure:

```text
src/
  main.ts
  game/
    config.ts
    scenes/
      BootScene.ts
      BattingScene.ts
      FieldingScene.ts
      InningScene.ts
    domain/
      GameState.ts
      Rules.ts
      Teams.ts
      Players.ts
      Rosters.ts
      MatchHistory.ts
      HighScores.ts
    systems/
      BallPhysics.ts
      Batting.ts
      Fielding.ts
      Pitching.ts
      Scoring.ts
      Interactions.ts
      TouchControls.ts
    data/
      GameDataClient.ts
      fixtures.ts
    ui/
      Hud.ts
      MobileHud.ts
      Leaderboard.ts
server/
  data/
    dolt.ts
    schema.sql
    repositories/
      players.ts
      matches.ts
      highScores.ts
docs/
  dev-setup.md
  gameplay-direction.md
.gastown/
  rules.md
assets/
  sprites/
  audio/
```

Keep scene files focused on Phaser lifecycle and orchestration. Put gameplay rules, scoring, high score calculations, match summaries, interaction triggers, and deterministic calculations into plain TypeScript modules so they can be tested without rendering.

## Dolt Data Plan

Dolt is a v0 dependency because match history and friend-specific records are central to the game. Use Dolt for data that should survive sessions and be inspectable over time:

- Player profiles: names, nicknames, preferred teams, personality tags, optional bio notes
- Team profiles and predefined roster membership
- Match records: date, teams, final score, innings, winner, loser, notable events
- High scores: category, player, value, match reference, timestamp
- Rivalry summaries: head-to-head record, streaks, memorable matchup stats
- Interaction seeds: stable identifiers or tags that can trigger in-game banter

Keep schema and migration files in Git. Keep the Dolt database itself managed by Dolt, not by Git. If Dolt is initialized inside the repository, add `.dolt/` to `.gitignore` so Git does not track Dolt internals.

Early schema tables:

```text
players
teams
team_players
matches
match_players
match_events
high_scores
player_rivalries
interaction_prompts
```

The browser game should not embed database details. It should depend on a small typed interface, for example:

```text
listPlayers()
listTeams()
getMatchHistory(playerId?)
recordMatch(summary)
getHighScores(category?)
getInteractionContext(matchup)
```

## Friend Interactions

Interactions between friends should be designed as a game system, not just flavor text. V0 should support small, deterministic hooks such as:

- Batter-versus-pitcher matchup lines
- Comeback, blowout, and rivalry callouts
- High score or streak notifications
- Match-history references before or after a game
- Player-specific reaction tags that can later drive animations, audio, or dialogue

Interaction logic should be data-driven enough that new friend-specific lines can be added without changing Phaser scenes. The first pass can display text in the HUD or between pitches. Later versions can upgrade this into audio, portraits, cut-ins, or richer presentation.

## First-Release Stretch: Remote Two-Player

Remote two-player mode should allow two friends to play from different phones in different places. It is a stretch goal for the first release, not a dependency for proving the core game loop.

The likely first version should be lightweight:

- One player creates a room and shares a short code or link.
- The second player joins from another phone.
- Each player controls their side during the relevant phase of play.
- The game records the completed match, high scores, and rivalry updates through the same Dolt-backed data path.
- Friend interaction hooks can use the real matchup and match history just as they do in local play.

The implementation should prefer a simple authoritative session model unless testing proves peer-to-peer is clearly better. The game should synchronize player intents and deterministic phase transitions rather than streaming raw physics state every frame. If latency makes live pitching/batting feel bad, the fallback should be a slightly more turn-based or lockstep timing model that preserves fairness and phone playability.

Remote multiplayer should not be started until the local mobile loop, persistence, and match recording are stable.

## First Gas Town Beads

Gas Town work should be split into small, reviewable beads with explicit acceptance conditions.

Recommended first beads:

1. Scaffold the Vite, TypeScript, Phaser, and Vitest baseline.
2. Add `.gitignore` with `node_modules/`, `dist/`, `.DS_Store`, `.gastown/sandboxes/`, `.dolt/`, and `*.log`.
3. Add the Phaser game shell, boot flow, placeholder scene, responsive scaling, and a visible canvas smoke test on desktop and phone-sized viewports.
4. Add `docs/dev-setup.md` with npm, Gas Town, and Dolt setup commands.
5. Add `.gastown/rules.md` describing the Phaser/TypeScript architecture, v0 scope, testing expectations, and Dolt-backed data requirements.
6. Add core domain types for teams, predefined rosters, players, inning state, outs, score, batter order, match summaries, and high scores.
7. Initialize Dolt and add the first schema for teams, players, roster membership, matches, match events, high scores, and interaction prompts.
8. Add a typed data client with fixture fallback and Dolt-backed repository tests where practical.
9. Add desktop keyboard controls and phone touch-control abstractions for swing, pitch, and fielding actions.
10. Add the behind-pitcher wall-facing camera framing with the pitcher, batter, wall target, and mobile-safe control zones.
11. Prototype batting timing and ball launch.
12. Prototype wall target collision and rebound behavior.
13. Prototype fielding movement and ball recovery.
14. Wire outs, scoring, half-inning transitions, match recording, and leaderboard updates.
15. Add the first friend interaction hooks for player matchup and match-history callouts.
16. Add automated tests for rules, scoring, inning transitions, ball-result calculations, rebound calculations, high score updates, predefined roster loading, and match summary generation.
17. Stretch: add remote two-player room creation, join flow, synchronized player intents, and match recording across two phones.

Avoid broad polish beads until the loop, persistence, and interaction hooks exist.

## Setup Commands

This repository already exists, so setup should happen in place rather than creating a new folder:

```sh
npm create vite@latest . -- --template vanilla-ts
npm install
npm install phaser
npm install --save-dev vitest
```

Initialize Dolt in the chosen data location:

```sh
dolt init
```

Gas Town commands should be documented in `docs/dev-setup.md`, including the local commands for starting the mayor/coordinator and worker crew if those commands are available in the environment.

Baseline verification:

```sh
npm run dev
npm run build
npm test
```

The first smoke test should confirm that the browser displays a Phaser canvas, loads a placeholder scene, and can reach fixture or Dolt-backed player data.

Phone smoke testing should confirm that a mobile-sized viewport can start the game, show readable HUD text, accept touch input, and keep controls clear of active gameplay.

## Testing Strategy

Use Vitest for deterministic TypeScript modules:

- Rules
- Scoring
- Batter order
- Inning transitions
- Ball launch calculations
- Rebound calculations
- Match summary generation
- High score updates
- Interaction trigger selection
- Data client behavior with fixture and Dolt-backed repositories
- Predefined team and roster loading

Use manual browser testing for feel-sensitive work:

- Swing timing
- Camera readability
- Behind-pitcher wall-facing framing on desktop and phone
- Fielding controls
- Touch control reachability and responsiveness
- Mobile landscape layout and portrait fallback
- HUD clarity
- Leaderboard visibility
- Friend interaction pacing
- Remote two-player room creation and join flow on separate phones if the stretch goal is implemented
- Network latency and fairness during pitch, swing, and fielding timing if the stretch goal is implemented

Use build verification as the minimum gate for all implementation work:

```sh
npm run build
```

When tests exist, use:

```sh
npm test
```

## Open Design Decisions

These can wait until the first playable slice starts:

- Exact rules for hits, catches, fouls, and wall target scoring
- Whether players are controlled one at a time or as a team
- Whether pitching is player-controlled, AI-controlled, or both
- Whether the first game mode is local two-player or single-player against simple AI
- Whether phone play should support portrait mode beyond a rotate-device prompt
- Whether friend interactions are text-only in v0 or include simple portraits/audio stings
- Whether Dolt access runs through Vite middleware, a separate local Node service, or a later production API
- Whether remote two-player should use WebSockets, WebRTC, or a hosted realtime service
- Whether remote two-player should be fully real-time, lockstep, or lightly turn-based for better fairness on phones

The setup should not block on these questions. The architecture should isolate rendering, deterministic rules, persistence, and interaction triggers so the first slice can teach us what feels best.
