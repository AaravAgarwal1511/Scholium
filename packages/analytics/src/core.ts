// Framework-free analytics core: a batching event queue with a per-origin anon id,
// an idle-expiring session id, prop sanitisation, and an injected sink.
//
// Every browser/transport dependency (storage, sink, clock, id generator) is
// INJECTED, so this file imports no DOM and no network and can be unit-tested in
// plain Node. The React layer (AnalyticsProvider) wires in the real localStorage /
// sessionStorage / fetch / supabase client.

export type PropValue = string | number | boolean;
export type EventProps = Record<string, PropValue>;

export interface QueuedEvent {
  name: string;
  path?: string;
  props: EventProps;
  client_ts: string;
  anon_id: string;
  session_id: string;
  app_key: string;
  user_id: string | null;
}

/** The slice of the Web Storage API this module needs. localStorage and
 *  sessionStorage both satisfy it; tests pass an in-memory fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TrackerDeps {
  appKey: string;
  /** localStorage-like: persists the anon id and the opt-out flag (long-lived). */
  storage: StorageLike;
  /** sessionStorage-like: holds the current session id + last-activity stamp. */
  session: StorageLike;
  /** Master switch — PROD && VITE_ANALYTICS_ENABLED. When false, track() is a no-op. */
  enabled: boolean;
  /** Browser Do-Not-Track / Global Privacy Control snapshot, read once by the provider. */
  browserDoNotTrack: boolean;
  /** Sends a batch to the backend (the normal, non-unload path). MUST NOT throw.
   *  The unload path uses drain() + a keepalive transport in AnalyticsProvider. */
  send: (rows: QueuedEvent[]) => Promise<void> | void;
  /** Merged into every event's props and always wins over per-call props. Used to
   *  stamp `{ debug: true }` during the against-production Phase 3 verification so
   *  those rows can be found and deleted afterward. */
  baseProps?: EventProps;
  now?: () => number; // default Date.now
  randomId?: () => string; // default crypto.randomUUID
  batchSize?: number; // default 20 — auto-flush threshold
  sessionIdleMs?: number; // default 30 min
}

// Reuses the exact key SingleSessionGuard writes, so anon_id === the device id.
const DEVICE_KEY = 'scholium-device-id';
const OPT_OUT_KEY = 'scholium-analytics-opt-out';
const SESSION_KEY = 'scholium-analytics-session';
const MAX_STRING = 64;

/** Keep numbers, booleans, and strings ≤64 chars. Drop everything else — nested
 *  objects, arrays, null/undefined, functions, NaN/Infinity, over-long strings —
 *  so no free text or structured payload can ever reach the events table. */
export function sanitizeProps(raw: Record<string, unknown>): EventProps {
  const out: EventProps = {};
  for (const key of Object.keys(raw)) {
    const v = raw[key];
    if (typeof v === 'number') {
      if (Number.isFinite(v)) out[key] = v;
    } else if (typeof v === 'boolean') {
      out[key] = v;
    } else if (typeof v === 'string' && v.length <= MAX_STRING) {
      out[key] = v;
    }
  }
  return out;
}

export class Tracker {
  // Not a constructor parameter property: those emit runtime code and are banned
  // under `erasableSyntaxOnly`, which poetry-notes' tsconfig enables (and which
  // compiles this package's raw source).
  private readonly deps: TrackerDeps;
  private queue: QueuedEvent[] = [];
  private userId: string | null = null;
  private readonly now: () => number;
  private readonly randomId: () => string;
  private readonly batchSize: number;
  private readonly sessionIdleMs: number;

  constructor(deps: TrackerDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
    this.randomId = deps.randomId ?? defaultRandomId;
    this.batchSize = deps.batchSize ?? 20;
    this.sessionIdleMs = deps.sessionIdleMs ?? 30 * 60 * 1000;
  }

  identify(userId: string | null): void {
    this.userId = userId;
  }

  isOptedOut(): boolean {
    if (this.deps.browserDoNotTrack) return true;
    return this.deps.storage.getItem(OPT_OUT_KEY) === 'true';
  }

  setOptOut(optedOut: boolean): void {
    this.deps.storage.setItem(OPT_OUT_KEY, optedOut ? 'true' : 'false');
    if (optedOut) this.queue = []; // drop anything already buffered
  }

  track(name: string, props: Record<string, unknown> = {}, path?: string): void {
    if (!this.deps.enabled || this.isOptedOut()) return;
    this.queue.push({
      name,
      path,
      props: { ...sanitizeProps(props), ...(this.deps.baseProps ?? {}) },
      client_ts: new Date(this.now()).toISOString(),
      anon_id: this.anonId(),
      session_id: this.sessionId(),
      app_key: this.deps.appKey,
      user_id: this.userId,
    });
    if (this.queue.length >= this.batchSize) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue;
    this.queue = [];
    try {
      await this.deps.send(batch);
    } catch {
      // Best-effort: never throw, and never re-queue (keeps memory bounded and
      // avoids a dead endpoint degrading a study session or an exam attempt).
    }
  }

  /** Removes and returns all buffered events without sending them. Used by the
   *  unload path, which POSTs them itself with a keepalive transport. */
  drain(): QueuedEvent[] {
    const batch = this.queue;
    this.queue = [];
    return batch;
  }

  /** Number of buffered events not yet flushed — for tests/introspection. */
  pending(): number {
    return this.queue.length;
  }

  private anonId(): string {
    let id = this.deps.storage.getItem(DEVICE_KEY);
    if (!id) {
      id = this.randomId();
      this.deps.storage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  /** Stable within a 30-min idle window; rotates once idle is exceeded. Stored as
   *  "id|lastActivityMs" so no second key is needed. */
  private sessionId(): string {
    const nowMs = this.now();
    const raw = this.deps.session.getItem(SESSION_KEY);
    if (raw) {
      const sep = raw.indexOf('|');
      if (sep > 0) {
        const id = raw.slice(0, sep);
        const last = Number(raw.slice(sep + 1));
        if (Number.isFinite(last) && nowMs - last <= this.sessionIdleMs) {
          this.deps.session.setItem(SESSION_KEY, `${id}|${nowMs}`);
          return id;
        }
      }
    }
    const id = this.randomId();
    this.deps.session.setItem(SESSION_KEY, `${id}|${nowMs}`);
    return id;
  }
}

function defaultRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
