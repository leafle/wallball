import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const schemaPath = resolve("server/data/schema.sql");

describe("Dolt schema", () => {
  it("defines the first persistence tables for fixtures and match history", () => {
    const schema = normalizedSchema();

    expect(schema).toContain("create table if not exists teams");
    expect(schema).toContain("create table if not exists players");
    expect(schema).toContain("create table if not exists team_players");
    expect(schema).toContain("create table if not exists matches");
    expect(schema).toContain("create table if not exists match_events");
    expect(schema).toContain("create table if not exists high_scores");
    expect(schema).toContain("create table if not exists interaction_prompts");
  });

  it("keeps roster and match columns aligned with the TypeScript domain models", () => {
    const schema = normalizedSchema();

    expect(schema).toMatch(/players[\s\S]*id varchar\(64\) not null/);
    expect(schema).toMatch(/players[\s\S]*display_name varchar\(120\) not null/);
    expect(schema).toMatch(/players[\s\S]*tags json not null/);
    expect(schema).toMatch(/team_players[\s\S]*batting_order int not null/);
    expect(schema).toMatch(/matches[\s\S]*away_team_id varchar\(64\) not null/);
    expect(schema).toMatch(/matches[\s\S]*home_team_id varchar\(64\) not null/);
    expect(schema).toMatch(/matches[\s\S]*away_score int not null/);
    expect(schema).toMatch(/matches[\s\S]*home_score int not null/);
    expect(schema).toMatch(/match_events[\s\S]*event_index int not null/);
    expect(schema).toMatch(/match_events[\s\S]*kind varchar\(64\) not null/);
    expect(schema).toMatch(/match_events[\s\S]*player_id varchar\(64\) not null/);
  });

  it("models high scores and interaction prompts with stable player and match references", () => {
    const schema = normalizedSchema();

    expect(schema).toMatch(/high_scores[\s\S]*category varchar\(64\) not null/);
    expect(schema).toMatch(/high_scores[\s\S]*player_id varchar\(64\) not null/);
    expect(schema).toMatch(/high_scores[\s\S]*value int not null/);
    expect(schema).toMatch(/high_scores[\s\S]*match_id varchar\(64\) not null/);
    expect(schema).toMatch(
      /interaction_prompts[\s\S]*trigger_kind varchar\(64\) not null/
    );
    expect(schema).not.toMatch(
      /interaction_prompts[\s\S]*\strigger varchar\(64\)/
    );
    expect(schema).toMatch(
      /interaction_prompts[\s\S]*batter_player_id varchar\(64\)/
    );
    expect(schema).toMatch(
      /interaction_prompts[\s\S]*pitcher_player_id varchar\(64\)/
    );
    expect(schema).toMatch(/interaction_prompts[\s\S]*player_ids json/);
  });
});

function normalizedSchema(): string {
  return readFileSync(schemaPath, "utf8")
    .replace(/\s+/g, " ")
    .toLowerCase();
}
