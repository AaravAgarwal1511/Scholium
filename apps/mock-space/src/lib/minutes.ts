export const MIN_MINUTES = 10;
export const MAX_MINUTES = 150;
export const DEFAULT_MINUTES = 90;

export function isValidMinutes(minutes: string): boolean {
  const parsed = Number(minutes);
  return (
    minutes.trim() !== "" &&
    Number.isInteger(parsed) &&
    parsed >= MIN_MINUTES &&
    parsed <= MAX_MINUTES
  );
}

// The browser will not stop someone typing 900 into a number input, so this
// clamps on blur rather than starting a nine-hour mock.
export function clampMinutes(parsed: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(parsed)));
}
