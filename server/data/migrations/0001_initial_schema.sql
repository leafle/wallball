-- Initial Dolt migration for Wallball persistence.
-- This mirrors server/data/schema.sql so a fresh Dolt database can be created
-- either from the schema snapshot or from the first ordered migration.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(64) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  nickname VARCHAR(120),
  bio TEXT,
  tags JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS team_players (
  team_id VARCHAR(64) NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  batting_order INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, player_id),
  UNIQUE KEY team_players_batting_order_idx (team_id, batting_order),
  KEY team_players_player_idx (player_id),
  CONSTRAINT team_players_team_fk
    FOREIGN KEY (team_id) REFERENCES teams (id),
  CONSTRAINT team_players_player_fk
    FOREIGN KEY (player_id) REFERENCES players (id),
  CONSTRAINT team_players_batting_order_positive_chk
    CHECK (batting_order > 0)
);

CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(64) NOT NULL,
  played_at TIMESTAMP NOT NULL,
  away_team_id VARCHAR(64) NOT NULL,
  home_team_id VARCHAR(64) NOT NULL,
  away_score INT NOT NULL,
  home_score INT NOT NULL,
  innings INT NOT NULL,
  winner_team_id VARCHAR(64),
  loser_team_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY matches_played_at_idx (played_at),
  KEY matches_away_team_idx (away_team_id),
  KEY matches_home_team_idx (home_team_id),
  CONSTRAINT matches_away_team_fk
    FOREIGN KEY (away_team_id) REFERENCES teams (id),
  CONSTRAINT matches_home_team_fk
    FOREIGN KEY (home_team_id) REFERENCES teams (id),
  CONSTRAINT matches_winner_team_fk
    FOREIGN KEY (winner_team_id) REFERENCES teams (id),
  CONSTRAINT matches_loser_team_fk
    FOREIGN KEY (loser_team_id) REFERENCES teams (id),
  CONSTRAINT matches_scores_non_negative_chk
    CHECK (away_score >= 0 AND home_score >= 0),
  CONSTRAINT matches_innings_positive_chk
    CHECK (innings > 0)
);

CREATE TABLE IF NOT EXISTS match_events (
  match_id VARCHAR(64) NOT NULL,
  event_index INT NOT NULL,
  kind VARCHAR(64) NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  inning INT NOT NULL,
  payload JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, event_index),
  KEY match_events_player_idx (player_id),
  KEY match_events_kind_idx (kind),
  CONSTRAINT match_events_match_fk
    FOREIGN KEY (match_id) REFERENCES matches (id),
  CONSTRAINT match_events_player_fk
    FOREIGN KEY (player_id) REFERENCES players (id),
  CONSTRAINT match_events_event_index_non_negative_chk
    CHECK (event_index >= 0),
  CONSTRAINT match_events_inning_positive_chk
    CHECK (inning > 0)
);

CREATE TABLE IF NOT EXISTS high_scores (
  category VARCHAR(64) NOT NULL,
  player_id VARCHAR(64) NOT NULL,
  value INT NOT NULL,
  match_id VARCHAR(64) NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  PRIMARY KEY (category, player_id, match_id),
  KEY high_scores_category_value_idx (category, value, recorded_at),
  KEY high_scores_player_idx (player_id),
  KEY high_scores_match_idx (match_id),
  CONSTRAINT high_scores_player_fk
    FOREIGN KEY (player_id) REFERENCES players (id),
  CONSTRAINT high_scores_match_fk
    FOREIGN KEY (match_id) REFERENCES matches (id),
  CONSTRAINT high_scores_value_non_negative_chk
    CHECK (value >= 0)
);

CREATE TABLE IF NOT EXISTS interaction_prompts (
  id VARCHAR(64) NOT NULL,
  trigger_kind VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  tags JSON NOT NULL,
  batter_player_id VARCHAR(64),
  pitcher_player_id VARCHAR(64),
  player_ids JSON,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY interaction_prompts_trigger_idx (trigger_kind),
  KEY interaction_prompts_batter_idx (batter_player_id),
  KEY interaction_prompts_pitcher_idx (pitcher_player_id),
  CONSTRAINT interaction_prompts_batter_fk
    FOREIGN KEY (batter_player_id) REFERENCES players (id),
  CONSTRAINT interaction_prompts_pitcher_fk
    FOREIGN KEY (pitcher_player_id) REFERENCES players (id),
  CONSTRAINT interaction_prompts_trigger_chk
    CHECK (trigger_kind IN ('player-matchup', 'match-history'))
);

INSERT IGNORE INTO schema_migrations (version, name)
VALUES ('0001', 'initial_wallball_schema');
