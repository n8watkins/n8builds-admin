-- The blog newsletter (docs/DATABASE.md, lib/newsletter/). Personal data, kept
-- apart from the waitlist's tables: leaving one list never touches the other.

CREATE TABLE newsletter_subscribers (
  -- The first 32 hex characters of the SHA-256 of the normalized address.
  id TEXT PRIMARY KEY CHECK (length(id) = 32),
  email TEXT NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 100 AND email = lower(trim(email))),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  -- Epoch ms while unconfirmed (7 days after the last confirm email); null once confirmed.
  expires_at INTEGER,
  -- SHA-256 of the newest confirm link's token, until it is used.
  confirm_hash TEXT UNIQUE CHECK (confirm_hash IS NULL OR length(confirm_hash) = 64),
  -- The unsubscribe link's token, in every email to this address. Kept as is:
  -- each digest needs it, and all it can do is delete this row.
  unsubscribe_token TEXT NOT NULL UNIQUE CHECK (length(unsubscribe_token) BETWEEN 20 AND 100),
  CHECK ((confirmed_at IS NULL) = (expires_at IS NOT NULL))
);
CREATE INDEX newsletter_subscribers_expires ON newsletter_subscribers (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX newsletter_subscribers_confirmed ON newsletter_subscribers (confirmed_at) WHERE confirmed_at IS NOT NULL;

-- One row per weekly digest: no personal data.
CREATE TABLE newsletter_digests (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  -- The posts it carries were published after posts_since, up to created_at.
  posts_since TEXT NOT NULL,
  -- JSON: [{ title, slug, publishedAt, excerpt }].
  posts TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'skipped')),
  -- Confirmed subscribers when it started (the ones it goes to).
  recipients INTEGER NOT NULL DEFAULT 0,
  -- Why it was skipped or stopped, for the owner.
  note TEXT NOT NULL DEFAULT '',
  finished_at TEXT
);
CREATE INDEX newsletter_digests_status ON newsletter_digests (status, created_at);

-- Who has had which digest: a run that stops resumes where it left off.
CREATE TABLE newsletter_deliveries (
  digest_id INTEGER NOT NULL REFERENCES newsletter_digests (id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers (id) ON DELETE CASCADE,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (digest_id, subscriber_id)
) WITHOUT ROWID;
CREATE INDEX newsletter_deliveries_subscriber ON newsletter_deliveries (subscriber_id);
