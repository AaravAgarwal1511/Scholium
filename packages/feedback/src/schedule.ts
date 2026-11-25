// When to show the bottom-right feedback prompt. Framework-free and fully
// injectable (storage + clock), so the rules are unit-tested in plain Node.
//
// State is per browser origin, i.e. per app: each app asks on its own cadence.
// Rules (defaults):
//   * not before the 3rd visit (a "visit" = a browser session, counted once per tab session)
//   * not before DWELL_MS on the page in this visit (enforced by the provider's timer)
//   * at most once per 30 days — whether it was rated, dismissed or just ignored
//   * not for 90 days after the user sends any feedback (via prompt OR footer)

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PromptState {
  visits: number;
  lastShown: number | null;
  lastSubmitted: number | null;
}

export interface ScheduleOptions {
  minVisits?: number;
  showEveryMs?: number;
  afterSubmitMs?: number;
}

const DAY = 24 * 60 * 60 * 1000;
export const PROMPT_DEFAULTS = {
  minVisits: 3,
  showEveryMs: 30 * DAY,
  afterSubmitMs: 90 * DAY,
  dwellMs: 2 * 60 * 1000,
} as const;

const STATE_KEY = 'scholium-feedback-prompt';
const VISIT_KEY = 'scholium-feedback-visit';

const EMPTY: PromptState = { visits: 0, lastShown: null, lastSubmitted: null };

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export class PromptSchedule {
  private readonly storage: StorageLike;
  private readonly session: StorageLike;
  private readonly now: () => number;
  private readonly opts: Required<ScheduleOptions>;

  constructor(deps: {
    storage: StorageLike;
    session: StorageLike;
    now?: () => number;
    options?: ScheduleOptions;
  }) {
    this.storage = deps.storage;
    this.session = deps.session;
    this.now = deps.now ?? (() => Date.now());
    this.opts = {
      minVisits: deps.options?.minVisits ?? PROMPT_DEFAULTS.minVisits,
      showEveryMs: deps.options?.showEveryMs ?? PROMPT_DEFAULTS.showEveryMs,
      afterSubmitMs: deps.options?.afterSubmitMs ?? PROMPT_DEFAULTS.afterSubmitMs,
    };
  }

  read(): PromptState {
    try {
      const raw = this.storage.getItem(STATE_KEY);
      if (!raw) return { ...EMPTY };
      const p = JSON.parse(raw) as Record<string, unknown>;
      return {
        visits: num(p.visits) ?? 0,
        lastShown: num(p.lastShown),
        lastSubmitted: num(p.lastSubmitted),
      };
    } catch {
      return { ...EMPTY };
    }
  }

  private write(s: PromptState): void {
    try {
      this.storage.setItem(STATE_KEY, JSON.stringify(s));
    } catch {
      // storage full / blocked: the prompt just won't remember — harmless
    }
  }

  /** Count this visit, once per tab session. Idempotent within a session. */
  recordVisit(): void {
    try {
      if (this.session.getItem(VISIT_KEY)) return;
      this.session.setItem(VISIT_KEY, '1');
    } catch {
      return; // no session storage → don't inflate the count on every mount
    }
    const s = this.read();
    this.write({ ...s, visits: s.visits + 1 });
  }

  /** Eligible right now, ignoring dwell time (the provider's timer owns that). */
  isDue(): boolean {
    const s = this.read();
    const t = this.now();
    if (s.visits < this.opts.minVisits) return false;
    if (s.lastSubmitted !== null && t - s.lastSubmitted < this.opts.afterSubmitMs) return false;
    if (s.lastShown !== null && t - s.lastShown < this.opts.showEveryMs) return false;
    return true;
  }

  markShown(): void {
    this.write({ ...this.read(), lastShown: this.now() });
  }

  markSubmitted(): void {
    this.write({ ...this.read(), lastSubmitted: this.now() });
  }
}
