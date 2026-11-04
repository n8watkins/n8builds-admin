-- Anonymous counts (docs/DATABASE.md): no IP, user agent, cookie or email.

-- Every daily counter: short-link clicks, contact messages, the game's tallies.
CREATE TABLE analytics_daily (
  metric TEXT NOT NULL CHECK (length(metric) BETWEEN 1 AND 40),
  day TEXT NOT NULL CHECK (length(day) = 10),
  field TEXT NOT NULL DEFAULT '' CHECK (length(field) <= 40),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (metric, day, field)
) WITHOUT ROWID;
CREATE INDEX analytics_daily_day ON analytics_daily (day);

-- The dino game (lib/game/stats.ts).
CREATE TABLE game_salts (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  salt TEXT NOT NULL
) WITHOUT ROWID;

-- A player is a salted daily hash, never an IP or user agent.
CREATE TABLE game_players (
  day TEXT NOT NULL CHECK (length(day) = 10),
  site TEXT NOT NULL CHECK (site IN ('n8builds', 'portfolio')),
  player TEXT NOT NULL CHECK (length(player) = 24),
  rounds INTEGER NOT NULL DEFAULT 0 CHECK (rounds >= 0),
  PRIMARY KEY (day, site, player)
) WITHOUT ROWID;

CREATE TABLE game_rounds (
  id TEXT PRIMARY KEY CHECK (length(id) = 24),
  player TEXT NOT NULL,
  site TEXT NOT NULL CHECK (site IN ('n8builds', 'portfolio')),
  country TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX game_rounds_expires ON game_rounds (expires_at);

CREATE TABLE game_top (
  round_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 60),
  site TEXT NOT NULL CHECK (site IN ('n8builds', 'portfolio')),
  country TEXT NOT NULL,
  day TEXT NOT NULL
) WITHOUT ROWID;
CREATE INDEX game_top_score ON game_top (score DESC);
