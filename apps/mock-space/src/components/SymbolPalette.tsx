import { SYMBOL_GROUPS } from "@/lib/tools";

interface Props {
  disabled: boolean;
  onInsert(symbol: string): void;
}

/**
 * Inserting a symbol is exactly the same operation as typing one: it appends at the
 * end and leaves the pending word erasable.
 *
 * `onMouseDown → preventDefault` stops the button taking focus. Without it, clicking
 * the palette would blur the answer box, which commits the word in progress — so
 * reaching for a `θ` would silently freeze whatever you were half way through typing.
 */
export default function SymbolPalette({ disabled, onInsert }: Props) {
  return (
    <div
      data-testid="symbol-palette"
      className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-popover p-3 shadow-hover"
    >
      {SYMBOL_GROUPS.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {group.symbols.map((symbol) => (
              <button
                key={symbol}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onInsert(symbol)}
                className="rounded-md border border-border py-1.5 text-sm hover:bg-muted disabled:opacity-40"
                style={{ fontFamily: '"MockSpaceAnswer", sans-serif' }}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
      ))}
      {disabled && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Click into an answer box first.
        </p>
      )}
    </div>
  );
}
