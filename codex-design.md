# Wallball Codex Design

## Scope

This document captures the remaining setup and design direction after the local Gas Town setup has been completed in this repository. The goal is to start a modern browser game inspired by early-1990s RBI Baseball gameplay, adapted to Wallball: a baseball variant played against the outside of a building with a painted square target.

The project should prioritize a playable vertical slice before broader game systems. The first milestone is not a complete sports simulation; it is a tight arcade loop that proves batting, pitching, rebound physics, fielding, outs, innings, and scoring can work together.

## Game Direction

Wallball has two teams that alternate batting and pitching/fielding. Each team has two or three players: one pitcher and one or two outfielders. Everyone bats. The field is anchored by a building wall with a square target painted on it.

The game should feel modern in presentation but retro in gameplay values:

- Fast readable action
- Snappy input timing
- Exaggerated but predictable ball movement
- Clear camera framing
- Simple rules surfaced through play
- Deterministic state machines instead of realism-first simulation

The first version should use placeholder art and programmatic shapes where needed. Asset polish can come after the core loop feels good.

## Technical Stack

Use a browser-based TypeScript stack:

- Vite for dev server, bundling, and fast reloads
- TypeScript for game code
- Phaser 3 for scenes, sprites, input, asset loading, animation, and arcade-style collision
- npm for package scripts and dependency management

This stack is a better fit than raw Canvas 2D because the game needs scenes, animation, input handling, collision helpers, asset loading, and state transitions. Phaser gives those primitives without forcing the project to become a custom engine immediately.

Avoid Three.js for the first prototype. The reference feel is sprite-based arcade baseball, and the main challenge is timing and readability rather than 3D physical realism.

## Runtime Shape

Use a fixed logical game resolution with responsive browser scaling. A good starting point is 1280x720 because it supports a modern layout while preserving simple arcade framing.

The game should eventually have separate camera compositions for batting and fielding, but the first prototype can use a single simplified field view if that gets the loop playable sooner.

Expected npm scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest"
}
```

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
    systems/
      BallPhysics.ts
      Batting.ts
      Fielding.ts
      Pitching.ts
      Scoring.ts
    ui/
      Hud.ts
assets/
  sprites/
  audio/
docs/
  dev-setup.md
  gameplay-direction.md
```

Keep scene files focused on Phaser lifecycle and orchestration. Put gameplay rules, scoring, and deterministic calculations into plain TypeScript modules under `domain/` and `systems/` so they can be tested without rendering.

## First Playable Slice

The first playable slice should contain:

- A batting view with a pitcher, batter, wall target, and ball
- Pitch input or automated pitching
- Batter swing timing
- Ball contact result based on timing and pitch position
- Wall rebound behavior
- Fielding players that can recover the ball
- Simple out and scoring rules
- Half-inning transition after a small number of outs
- Minimal HUD for inning, score, outs, and current batter

The first pass can use simple geometric sprites. The important part is whether the loop is understandable and fun enough to tune.

## Gas Town Workflow

This repo should remain the main development workspace, with Gas Town initialized locally. Gas Town work should be split into small, reviewable beads rather than broad feature requests.

Recommended first beads:

1. Scaffold the Vite, TypeScript, Phaser, and Vitest baseline.
2. Add the Phaser game shell, boot flow, and placeholder scene.
3. Add core domain types for teams, players, inning state, outs, score, and batter order.
4. Prototype batting timing and ball launch.
5. Prototype wall target collision and rebound behavior.
6. Prototype fielding movement and ball recovery.
7. Wire outs, scoring, and half-inning transitions.
8. Add basic automated tests for rules and ball-result calculations.
9. Add a short `docs/dev-setup.md` with commands for local development.

Each bead should include a clear acceptance condition, such as "npm run build passes" or "rules tests cover half-inning transition." Avoid assigning open-ended polish work until the loop exists.

## Testing Strategy

Use Vitest for deterministic TypeScript modules:

- Rules
- Scoring
- Batter order
- Inning transitions
- Ball launch calculations
- Rebound calculations

Use manual browser testing for feel-sensitive work:

- Swing timing
- Camera readability
- Fielding controls
- HUD clarity

Use build verification as the minimum gate for all implementation work:

```sh
npm run build
```

When tests exist, use:

```sh
npm test
```

## Setup Commands Still To Run

After this design is accepted, scaffold the browser game:

```sh
npm create vite@latest . -- --template vanilla-ts
npm install
npm install phaser
npm install --save-dev vitest
```

Then update `package.json` with the expected scripts and begin the first Gas Town bead.

## Open Design Decisions

These can wait until the first playable slice starts:

- Whether the main field camera is side-view, isometric, or a custom wall-facing arcade view
- Exact rules for hits, catches, fouls, and wall target scoring
- Whether players are controlled one at a time or as a team
- Whether pitching is player-controlled, AI-controlled, or both
- Whether the first game mode is local two-player or single-player against simple AI

The setup should not block on these questions. The architecture should keep them isolated so the first slice can teach us what feels best.
