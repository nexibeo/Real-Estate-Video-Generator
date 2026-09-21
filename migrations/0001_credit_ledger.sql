-- The credit ledger. Applied with:
--   npx wrangler d1 migrations apply videamax-credits --remote

-- One row per account. The CHECK makes a negative balance impossible at the
-- database level, whatever the application code does.
CREATE TABLE credit_balances (
  account_id TEXT PRIMARY KEY,
  credits    INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0)
);

-- Every change, append-only. `ref` is UNIQUE so an external event (a Stripe
-- checkout session) can be applied at most once; NULL refs are unconstrained.
CREATE TABLE credit_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT    NOT NULL,
  at         INTEGER NOT NULL,
  delta      INTEGER NOT NULL,
  reason     TEXT    NOT NULL,
  ref        TEXT    UNIQUE
);

CREATE INDEX credit_ledger_by_account ON credit_ledger (account_id, id DESC);
