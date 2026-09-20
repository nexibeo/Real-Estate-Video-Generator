/**
 * The credit ledger.
 *
 * Two stores behind one interface: an in-memory map for local development, and
 * Upstash Redis REST for production. Swapping in Postgres means implementing
 * four methods. Balances are integers — credits, never floats of dollars.
 */
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
    return next;
  }
}

let store: CreditStore | null = null;

export function getStore(): CreditStore {
  if (store) return store;
  const { CREDIT_STORE, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
  if (CREDIT_STORE === 'upstash' && UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    store = new UpstashStore(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
  } else {
    store = new MemoryStore();
  }
  return store;
}
