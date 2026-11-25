import { describe, it, expect } from 'vitest';
import { PromptSchedule, type StorageLike } from './schedule';

const DAY = 24 * 60 * 60 * 1000;

function mem(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function setup() {
  const storage = mem();
  let session = mem();
  let t = 1_000_000_000_000;
  const make = () => new PromptSchedule({ storage, session, now: () => t });
  return {
    storage,
    make,
    newSession: () => {
      session = mem();
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

/** Simulates `n` separate visits (fresh tab sessions). */
function visit(env: ReturnType<typeof setup>, n = 1) {
  for (let i = 0; i < n; i++) {
    env.newSession();
    env.make().recordVisit();
  }
}

describe('PromptSchedule', () => {
  it('is not due before the 3rd visit', () => {
    const env = setup();
    visit(env, 2);
    expect(env.make().isDue()).toBe(false);
    visit(env);
    expect(env.make().isDue()).toBe(true);
  });

  it('counts a visit once per tab session, however many mounts', () => {
    const env = setup();
    env.newSession();
    const s = env.make();
    s.recordVisit();
    s.recordVisit();
    env.make().recordVisit();
    expect(env.make().read().visits).toBe(1);
  });

  it('waits 30 days after being shown', () => {
    const env = setup();
    visit(env, 3);
    env.make().markShown();
    expect(env.make().isDue()).toBe(false);
    env.advance(29 * DAY);
    expect(env.make().isDue()).toBe(false);
    env.advance(1 * DAY);
    expect(env.make().isDue()).toBe(true);
  });

  it('waits 90 days after a submission', () => {
    const env = setup();
    visit(env, 3);
    env.make().markSubmitted();
    env.advance(60 * DAY);
    expect(env.make().isDue()).toBe(false);
    env.advance(30 * DAY);
    expect(env.make().isDue()).toBe(true);
  });

  it('survives corrupt stored state', () => {
    const env = setup();
    env.storage.setItem('scholium-feedback-prompt', '{not json');
    expect(env.make().read()).toEqual({ visits: 0, lastShown: null, lastSubmitted: null });
    env.storage.setItem('scholium-feedback-prompt', JSON.stringify({ visits: 'x', lastShown: NaN }));
    expect(env.make().read()).toEqual({ visits: 0, lastShown: null, lastSubmitted: null });
  });

  it('never throws when storage is unusable', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    const s = new PromptSchedule({ storage: broken, session: broken });
    expect(() => {
      s.recordVisit();
      s.markShown();
      s.markSubmitted();
    }).not.toThrow();
    expect(s.isDue()).toBe(false);
  });

  it('honours custom options', () => {
    const storage = mem();
    const s = new PromptSchedule({ storage, session: mem(), options: { minVisits: 1 } });
    s.recordVisit();
    expect(s.isDue()).toBe(true);
  });
});
