CREATE TABLE principals (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE identity_links (
  issuer TEXT NOT NULL,
  subject TEXT NOT NULL,
  principal_id TEXT NOT NULL REFERENCES principals(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (issuer, subject)
);

CREATE TABLE resources (
  code TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('link', 'note')),
  target_url TEXT,
  ciphertext TEXT,
  nonce TEXT,
  proof TEXT,
  creation_token TEXT,
  single_use INTEGER NOT NULL DEFAULT 0 CHECK (single_use IN (0, 1)),
  expires_at INTEGER NOT NULL,
  principal_id TEXT REFERENCES principals(id),
  created_at INTEGER NOT NULL,
  CHECK ((kind = 'link' AND target_url IS NOT NULL AND ciphertext IS NULL) OR (kind = 'note' AND target_url IS NULL AND ciphertext IS NOT NULL AND nonce IS NOT NULL AND proof IS NOT NULL))
);

CREATE INDEX resources_expiry_idx ON resources(expires_at);
CREATE INDEX resources_principal_idx ON resources(principal_id);

CREATE TABLE counters (
  name TEXT PRIMARY KEY NOT NULL,
  value INTEGER NOT NULL
);

INSERT INTO counters(name, value) VALUES ('short-code', 0);
