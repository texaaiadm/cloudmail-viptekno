-- Skema D1 untuk cloudmail-inbox
-- Terapkan:  wrangler d1 execute cloudmail_inbox --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  to_json          TEXT NOT NULL,      -- JSON array [{name,address}]
  from_addr        TEXT,
  from_name        TEXT,
  subject          TEXT,
  intro            TEXT,               -- ringkasan 150 char
  text             TEXT,               -- plain text body
  html             TEXT,               -- html body (single string)
  attachments_json TEXT DEFAULT '[]',  -- JSON [{id,filename,size,mime}]
  received_at      TEXT NOT NULL,      -- ISO timestamp
  seen             INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at DESC);
