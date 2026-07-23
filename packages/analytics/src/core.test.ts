import { describe, it, expect } from 'vitest';
import { Tracker, sanitizeProps, type QueuedEvent, type StorageLike, type TrackerDeps } from './core';

function memStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

function makeTracker(over: Partial<TrackerDeps> = {}) {
  const sent: QueuedEvent[][] = [];
  let n = 0;
  const deps: TrackerDeps = {
    appKey: 'test-app',
    storage: memStorage(),
    session: memStorage(),
    enabled: true,
    browserDoNotTrack: false,
    send: (rows) => {
      sent.push(rows.slice());
    },
    randomId: () => `id-${++n}`,
    now: () => 1_000_000,
    ...over,
  };
  return { tracker: new Tracker(deps), sent, deps };
}

describe('sanitizeProps', () => {
  it('keeps numbers, booleans, and strings ≤64 chars', () => {
    expect(sanitizeProps({ n: 42, ok: true, no: false, s: 'hello' })).toEqual({
      n: 42,
      ok: true,
      no: false,
      s: 'hello',
    });
  });

  it('drops long strings, nested objects, arrays, null/undefined, and non-finite numbers', () => {
    const out = sanitizeProps({
      long: 'x'.repeat(65),
      obj: { a: 1 },
      arr: [1, 2],
      nope: null,
      missing: undefined,
      nan: NaN,
      inf: Infinity,
      fn: () => 1,
      keep: 7,
    });
    expect(out).toEqual({ keep: 7 });
  });

  it('keeps a string exactly at the 64-char limit', () => {
    const s = 'y'.repeat(64);
    expect(sanitizeProps({ s })).toEqual({ s });
  });
});

describe('Tracker gating', () => {
  it('is a no-op when disabled', () => {
    const { tracker, sent } = makeTracker({ enabled: false });
    tracker.track('app_open');
    expect(tracker.pending()).toBe(0);
    void tracker.flush();
    expect(sent).toHaveLength(0);
  });

  it('is a no-op under browser Do-Not-Track / GPC', () => {
    const { tracker } = makeTracker({ browserDoNotTrack: true });
    tracker.track('app_open');
    expect(tracker.pending()).toBe(0);
  });

  it('is a no-op after the user opts out, and drops buffered events', () => {
    const { tracker } = makeTracker();
    tracker.track('a');
    expect(tracker.pending()).toBe(1);
    tracker.setOptOut(true);
    expect(tracker.pending()).toBe(0);
    tracker.track('b');
    expect(tracker.pending()).toBe(0);
    expect(tracker.isOptedOut()).toBe(true);
  });
});

describe('Tracker batching', () => {
  it('auto-flushes once the batch size is reached', () => {
    const { tracker, sent } = makeTracker({ batchSize: 3 });
    tracker.track('a');
    tracker.track('b');
    expect(sent).toHaveLength(0);
    tracker.track('c'); // hits threshold
    expect(sent).toHaveLength(1);
    expect(sent[0]).toHaveLength(3);
    expect(tracker.pending()).toBe(0);
  });

  it('flush() drains the queue via send()', () => {
    const { tracker, sent } = makeTracker();
    tracker.track('a', { cards: 10 }, '/study/x');
    void tracker.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0][0]).toMatchObject({
      name: 'a',
      path: '/study/x',
      props: { cards: 10 },
      app_key: 'test-app',
      user_id: null,
    });
  });

  it('merges baseProps into every event and lets them win over per-call props', () => {
    const { tracker, sent } = makeTracker({ baseProps: { debug: true } });
    tracker.track('a', { cards: 3, debug: false });
    void tracker.flush();
    expect(sent[0][0].props).toEqual({ cards: 3, debug: true });
  });

  it('attributes events to the identified user', () => {
    const { tracker, sent } = makeTracker();
    tracker.identify('user-123');
    tracker.track('study_complete');
    void tracker.flush();
    expect(sent[0][0].user_id).toBe('user-123');
  });

  it('never throws when the sink rejects', async () => {
    const { tracker } = makeTracker({
      send: () => {
        throw new Error('network down');
      },
    });
    tracker.track('a');
    await expect(tracker.flush()).resolves.toBeUndefined();
    expect(tracker.pending()).toBe(0); // dropped, not re-queued
  });
});

describe('session id', () => {
  it('is stable within the idle window and rotates once idle is exceeded', () => {
    let t = 1_000;
    const { tracker, sent } = makeTracker({ now: () => t, sessionIdleMs: 1_000 });

    tracker.track('a');
    void tracker.flush();
    const first = sent[0][0].session_id;

    t += 500; // still within idle
    tracker.track('b');
    void tracker.flush();
    expect(sent[1][0].session_id).toBe(first);

    t += 2_000; // beyond idle → new session
    tracker.track('c');
    void tracker.flush();
    expect(sent[2][0].session_id).not.toBe(first);
  });
});

describe('anon id', () => {
  it('persists in storage and is reused across tracker instances', () => {
    const storage = memStorage();
    const a = makeTracker({ storage });
    a.tracker.track('a');
    void a.tracker.flush();
    const id = a.sent[0][0].anon_id;

    const b = makeTracker({ storage });
    b.tracker.track('b');
    void b.tracker.flush();
    expect(b.sent[0][0].anon_id).toBe(id);
  });
});
