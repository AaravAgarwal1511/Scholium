import type { StorageLike } from './schedule';

/** Probe Web Storage; fall back to an in-memory shim in private mode / when
 *  storage is blocked, so nothing here ever throws. */
export function safeStorage(get: () => Storage): StorageLike {
  try {
    const s = get();
    const probe = '__scholium_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
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
}

/** Pathname only — the query string can carry tokens and never leaves the browser. */
export function currentPath(): string {
  try {
    return window.location.pathname;
  } catch {
    return '';
  }
}
