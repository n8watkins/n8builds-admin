-- The /upcoming waitlist (docs/DATABASE.md). Personal data: kept apart from
-- the anonymous counters in n8builds-analytics.

CREATE TABLE waitlist_subscribers (
  id TEXT PRIMARY KEY CHECK (length(id) = 32),
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 100 AND email = lower(trim(email))),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  requested_note TEXT NOT NULL DEFAULT '' CHECK (length(requested_note) <= 500),
  interest TEXT NOT NULL DEFAULT '' CHECK (length(interest) <= 40),
  referrer TEXT NOT NULL DEFAULT '' CHECK (length(referrer) <= 200),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  -- Epoch ms while unconfirmed; null once confirmed (kept until the person leaves).
  expires_at INTEGER,
  CHECK ((confirmed_at IS NULL) = (expires_at IS NOT NULL))
);
CREATE INDEX waitlist_subscribers_created ON waitlist_subscribers (created_at);
CREATE INDEX waitlist_subscribers_expires ON waitlist_subscribers (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE waitlist_projects (
  subscriber_id TEXT NOT NULL REFERENCES waitlist_subscribers (id) ON DELETE CASCADE,
  project TEXT NOT NULL CHECK (length(project) BETWEEN 1 AND 40),
  status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed')),
  requested_at TEXT NOT NULL,
  confirmed_at TEXT,
  PRIMARY KEY (subscriber_id, project)
) WITHOUT ROWID;
CREATE INDEX waitlist_projects_by_project ON waitlist_projects (project, status);

-- Only the SHA-256 of each link's token: a leaked row holds no working link.
CREATE TABLE waitlist_tokens (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  subscriber_id TEXT NOT NULL REFERENCES waitlist_subscribers (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('confirm', 'leave')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
) WITHOUT ROWID;
CREATE INDEX waitlist_tokens_subscriber ON waitlist_tokens (subscriber_id);
CREATE INDEX waitlist_tokens_expires ON waitlist_tokens (expires_at);
