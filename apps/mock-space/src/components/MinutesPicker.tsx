import { Clock } from "lucide-react";
import { MAX_MINUTES, MIN_MINUTES } from "@/lib/minutes";

interface MinutesPickerProps {
  minutes: string;
  valid: boolean;
  onChange: (value: string) => void;
  onBlurClamp: () => void;
}

export default function MinutesPicker({ minutes, valid, onChange, onBlurClamp }: MinutesPickerProps) {
  return (
    <>
      <label
        htmlFor="minutes"
        className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        <Clock size={14} /> Time allowed
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="minutes"
          type="number"
          inputMode="numeric"
          min={MIN_MINUTES}
          max={MAX_MINUTES}
          step={5}
          value={minutes}
          data-testid="minutes"
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlurClamp}
          aria-invalid={!valid}
          aria-describedby="minutes-hint"
          className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums outline-none focus:ring-2"
          style={
            {
              "--tw-ring-color": "hsl(var(--primary) / 0.4)",
              borderColor: valid ? undefined : "hsl(var(--destructive))",
            } as React.CSSProperties
          }
        />
        <span className="text-sm text-muted-foreground">minutes</span>
      </div>
      <p
        id="minutes-hint"
        className="mt-1.5 text-xs"
        style={{ color: valid ? undefined : "hsl(var(--destructive))" }}
      >
        {valid ? (
          <span className="text-muted-foreground">
            Between {MIN_MINUTES} and {MAX_MINUTES} minutes.
          </span>
        ) : (
          `Enter a whole number of minutes between ${MIN_MINUTES} and ${MAX_MINUTES}.`
        )}
      </p>
    </>
  );
}
