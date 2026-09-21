/**
 * The credit ledger.
 *
 * Three stores behind one interface. In-memory for local development; D1 on
 * Cloudflare, which is what videamax.com runs; and Upstash Redis REST for any
 * other host. Balances are integers — credits, never floats of dollars.
 *
 * The in-memory store is per process — on Workers, per isolate — so it loses
 * balances on every restart. It must never back real payments, and
 * lib/payments.ts refuses to open checkout while it is the active store.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
export interface LedgerEntry {
  at: number;
  delta: number;
  reason: string;
  ref?: string;
}

export interface CreditStore {
  balance(accountId: string): Promise<number>;
  history(accountId: string): Promise<LedgerEntry[]>;
  credit(accountId: string, amount: number, reason: string, ref?: string): Promise<number>;
  /** Returns the new balance, or null when there is not enough to spend. */
  debit(accountId: string, amount: number, reason: string, ref?: string): Promise<number | null>;
  /** The debit recorded under `ref`, if any — for refunds that happen out of band. */
  findCharge(ref: string): Promise<{ accountId: string; credits: number } | null>;
}

class MemoryStore implements CreditStore {
  private bal = new Map<string, number>();
  private log = new Map<string, LedgerEntry[]>();
  private seen = new Set<string>();

  async balance(id: string) { return this.bal.get(id) ?? 0; }
  async history(id: string) { return (this.log.get(id) ?? []).slice(-50).reverse(); }

  async credit(id: string, amount: number, reason: string, ref?: string) {
    // Stripe retries webhooks; crediting twice for one payment is the bug that
    // matters most here, so every credit with a ref is applied at most once.
    if (ref) {
      if (this.seen.has(ref)) return this.balance(id);
      this.seen.add(ref);
    }
    const next = (this.bal.get(id) ?? 0) + amount;
    this.bal.set(id, next);
    const l = this.log.get(id) ?? [];
    l.push({ at: Date.now(), delta: amount, reason, ref });
    this.log.set(id, l);
    return next;
  }

  async findCharge(ref: string) {
    for (const [accountId, entries] of this.log) {
      const e = entries.find((x) => x.ref === ref && x.delta < 0);
      if (e) return { accountId, credits: -e.delta };
    }
    return null;
  }

  async debit(id: string, amount: number, reason: string, ref?: string) {
    const current = this.bal.get(id) ?? 0;
    if (current < amount) return null;
    const next = current - amount;
    this.bal.set(id, next);
    const l = this.log.get(id) ?? [];
    l.push({ at: Date.now(), delta: -amount, reason, ref });
    this.log.set(id, l);
    return next;
  }
}

class UpstashStore implements CreditStore {
  constructor(private url: string, private token: string) {}

  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Upstash ${res.status}`);
    return (await res.json()).result as T;
  }

  async balance(id: string) { return Number((await this.cmd<string>('GET', `bal:${id}`)) ?? 0); }

  async history(id: string) {
    const raw = await this.cmd<string[]>('LRANGE', `log:${id}`, 0, 49);
    return (raw ?? []).map((r) => JSON.parse(r) as LedgerEntry);
  }

  private async append(id: string, e: LedgerEntry) {
    await this.cmd('LPUSH', `log:${id}`, JSON.stringify(e));
    await this.cmd('LTRIM', `log:${id}`, 0, 199);
  }

  async credit(id: string, amount: number, reason: string, ref?: string) {
    if (ref) {
      const fresh = await this.cmd<number>('SETNX', `ref:${ref}`, '1');
      if (fresh === 0) return this.balance(id);
      await this.cmd('EXPIRE', `ref:${ref}`, 60 * 60 * 24 * 90);
    }
    const next = await this.cmd<number>('INCRBY', `bal:${id}`, amount);
    await this.append(id, { at: Date.now(), delta: amount, reason, ref });
    return next;
  }

  async debit(id: string, amount: number, reason: string, ref?: string) {
    const next = await this.cmd<number>('DECRBY', `bal:${id}`, amount);
    if (next < 0) {
      await this.cmd('INCRBY', `bal:${id}`, amount); // put it back
      return null;
    }
    await this.append(id, { at: Date.now(), delta: -amount, reason, ref });
    if (ref) {
      await this.cmd('SET', `charge:${ref}`, JSON.stringify({ accountId: id, credits: amount }), 'EX', 60 * 60 * 24 * 90);
    }
    return next;
  }

  async findCharge(ref: string) {
    const raw = await this.cmd<string | null>('GET', `charge:${ref}`);
    return raw ? (JSON.parse(raw) as { accountId: string; credits: number }) : null;
  }
}

/* ── D1 ───────────────────────────────────────────────────────────────────────
 * Schema in migrations/0001_credit_ledger.sql. Just the D1 surface used here,
 * declared locally rather than pulling in the full workers-types package.
 */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

class D1Store implements CreditStore {
  private db(): D1Database {
    const db = (getCloudflareContext().env as { DB?: D1Database }).DB;
    if (!db) throw new Error('CREDIT_STORE=d1 but no DB binding is configured');
    return db;
  }

  async balance(id: string) {
    const row = await this.db()
      .prepare('SELECT credits FROM credit_balances WHERE account_id = ?1')
      .bind(id)
      .first<{ credits: number }>();
    return row?.credits ?? 0;
  }

  async history(id: string) {
    const { results } = await this.db()
      .prepare('SELECT at, delta, reason, ref FROM credit_ledger WHERE account_id = ?1 ORDER BY id DESC LIMIT 50')
      .bind(id)
      .all<{ at: number; delta: number; reason: string; ref: string | null }>();
    return results.map((r) => ({ at: r.at, delta: r.delta, reason: r.reason, ref: r.ref ?? undefined }));
  }

  /**
   * The ledger row and the balance change go in one batch, which D1 runs as a
   * single transaction. `ref` is UNIQUE, so a retried Stripe webhook fails the
   * first statement, the whole batch rolls back, and the credit is not applied
   * twice — the database enforces it, not a read-then-write in this code.
   */
  async credit(id: string, amount: number, reason: string, ref?: string) {
    const db = this.db();
    try {
      await db.batch([
        db.prepare('INSERT INTO credit_ledger (account_id, at, delta, reason, ref) VALUES (?1, ?2, ?3, ?4, ?5)')
          .bind(id, Date.now(), amount, reason, ref ?? null),
        db.prepare(
          'INSERT INTO credit_balances (account_id, credits) VALUES (?1, ?2) ' +
          'ON CONFLICT(account_id) DO UPDATE SET credits = credits + excluded.credits',
        ).bind(id, amount),
      ]);
    } catch (e) {
      if (ref && /UNIQUE/i.test(e instanceof Error ? e.message : String(e))) return this.balance(id);
      throw e;
    }
    return this.balance(id);
  }

  /** One conditional UPDATE: it cannot take a balance below zero, even under concurrency. */
  async debit(id: string, amount: number, reason: string, ref?: string) {
    const db = this.db();
    const row = await db
      .prepare(
        'UPDATE credit_balances SET credits = credits - ?1 ' +
        'WHERE account_id = ?2 AND credits >= ?1 RETURNING credits',
      )
      .bind(amount, id)
      .first<{ credits: number }>();
    if (!row) return null;
    await db
      .prepare('INSERT INTO credit_ledger (account_id, at, delta, reason, ref) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, Date.now(), -amount, reason, ref ?? null)
      .run();
    return row.credits;
  }

  async findCharge(ref: string) {
    const row = await this.db()
      .prepare('SELECT account_id, delta FROM credit_ledger WHERE ref = ?1 AND delta < 0')
      .bind(ref)
      .first<{ account_id: string; delta: number }>();
    return row ? { accountId: row.account_id, credits: -row.delta } : null;
  }
}

let store: CreditStore | null = null;

/** True when balances survive a restart — the precondition for taking money. */
export function isDurableStore(): boolean {
  return process.env.CREDIT_STORE === 'd1' || process.env.CREDIT_STORE === 'upstash';
}

export function getStore(): CreditStore {
  if (store) return store;
  const { CREDIT_STORE, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (CREDIT_STORE === 'd1') {
    store = new D1Store();
  } else if (CREDIT_STORE === 'upstash' && UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    store = new UpstashStore(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
  } else {
    store = new MemoryStore();
  }
  return store;
}
