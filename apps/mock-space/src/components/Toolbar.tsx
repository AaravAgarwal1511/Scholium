import { Eraser, Omega, Pen, PenLine } from "lucide-react";
import type { Tool } from "@/lib/tools";

const TOOLS: ReadonlyArray<{ id: Tool; label: string; Icon: typeof Pen }> = [
  { id: "write", label: "Write", Icon: PenLine },
  { id: "draw", label: "Draw", Icon: Pen },
  { id: "erase", label: "Erase drawing", Icon: Eraser },
];

interface Props {
  tool: Tool;
  disabled: boolean;
  paletteOpen: boolean;
  onToolChange(tool: Tool): void;
  onTogglePalette(): void;
}

export default function Toolbar({
  tool,
  disabled,
  paletteOpen,
  onToolChange,
  onTogglePalette,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          aria-label={label}
          aria-pressed={tool === id}
          disabled={disabled}
          data-testid={`tool-${id}`}
          onClick={() => onToolChange(id)}
          className="rounded p-1.5 disabled:opacity-40"
          style={
            tool === id
              ? { background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }
              : undefined
          }
        >
          <Icon size={16} />
        </button>
      ))}

      <button
        aria-label="Insert symbol"
        aria-expanded={paletteOpen}
        disabled={disabled}
        data-testid="tool-symbols"
        // Like the symbols themselves, this must not take focus: blurring the answer
        // box commits the word in progress, so merely opening the palette would
        // freeze whatever the student was half way through typing.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onTogglePalette}
        className="rounded p-1.5 disabled:opacity-40"
        style={
          paletteOpen
            ? { background: "hsl(var(--accent) / 0.14)", color: "hsl(var(--accent))" }
            : undefined
        }
      >
        <Omega size={16} />
      </button>
    </div>
  );
}
