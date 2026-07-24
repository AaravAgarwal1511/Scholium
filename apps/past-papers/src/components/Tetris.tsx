import { useEffect, useReducer } from "react";

// A small, self-contained Tetris. No assets, no deps — it exists only to make the
// wait while a large paper is composed less dull, so it is deliberately compact:
// one pure reducer drives the whole game, the component just renders state and
// forwards key presses. Board cells hold a colour index (0 = empty, 1–7 = piece).

const COLS = 10;
const ROWS = 20;

type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
type Cell = number;
type Grid = Cell[][];
type Piece = { matrix: Grid; x: number; y: number };

// Spawn orientations. The filled value doubles as the colour index into COLORS.
const SHAPES: Record<PieceType, Grid> = {
  I: [[1, 1, 1, 1]],
  O: [
    [2, 2],
    [2, 2],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
  ],
};

const TYPES = Object.keys(SHAPES) as PieceType[];

// Vivid fills that read on both light and dark backgrounds.
const COLORS: Record<number, string> = {
  1: "#22d3ee", // I — cyan
  2: "#facc15", // O — yellow
  3: "#c084fc", // T — purple
  4: "#4ade80", // S — green
  5: "#f87171", // Z — red
  6: "#60a5fa", // J — blue
  7: "#fb923c", // L — orange
};

// Points per simultaneous line clear (0–4 lines).
const LINE_SCORES = [0, 100, 300, 500, 800];

const emptyBoard = (): Grid => Array.from({ length: ROWS }, () => Array(COLS).fill(0));

function rotate(m: Grid): Grid {
  const r = m.length;
  const c = m[0].length;
  const out: Grid = Array.from({ length: c }, () => Array(r).fill(0));
  for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) out[x][r - 1 - y] = m[y][x];
  return out;
}

function collides(board: Grid, m: Grid, ox: number, oy: number): boolean {
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
  }
  return false;
}

function merge(board: Grid, p: Piece): Grid {
  const out = board.map((row) => row.slice());
  for (let y = 0; y < p.matrix.length; y++) {
    for (let x = 0; x < p.matrix[y].length; x++) {
      if (p.matrix[y][x] && p.y + y >= 0) out[p.y + y][p.x + x] = p.matrix[y][x];
    }
  }
  return out;
}

function clearLines(board: Grid): { board: Grid; cleared: number } {
  const kept = board.filter((row) => row.some((c) => !c));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0));
  return { board: kept, cleared };
}

// A 7-bag randomiser — every piece appears once before any repeats, which feels
// fairer than independent random draws.
function refill(): PieceType[] {
  const bag = [...TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function spawn(type: PieceType): Piece {
  const matrix = SHAPES[type];
  return { matrix, x: Math.floor((COLS - matrix[0].length) / 2), y: 0 };
}

type State = {
  board: Grid;
  piece: Piece;
  type: PieceType;
  next: PieceType;
  bag: PieceType[];
  score: number;
  lines: number;
  over: boolean;
};

type Action =
  | { kind: "left" | "right" | "rotate" | "soft" | "hard" | "tick" | "reset" };

function draw(bag: PieceType[]): { type: PieceType; bag: PieceType[] } {
  const next = bag.length ? bag : refill();
  return { type: next[0], bag: next.slice(1) };
}

function init(): State {
  const a = draw(refill());
  const b = draw(a.bag);
  return {
    board: emptyBoard(),
    piece: spawn(a.type),
    type: a.type,
    next: b.type,
    bag: b.bag,
    score: 0,
    lines: 0,
    over: false,
  };
}

// Fix the current piece into the board, clear lines, and bring in the next one.
// Returns a game-over state if the fresh piece has nowhere to spawn.
function lock(state: State, dropBonus = 0): State {
  const merged = merge(state.board, state.piece);
  const { board, cleared } = clearLines(merged);
  const piece = spawn(state.next);
  const { type: next, bag } = draw(state.bag);
  const base: State = {
    ...state,
    board,
    piece,
    type: state.next,
    next,
    bag,
    score: state.score + LINE_SCORES[cleared] + dropBonus,
    lines: state.lines + cleared,
  };
  if (collides(board, piece.matrix, piece.x, piece.y)) return { ...base, over: true };
  return base;
}

function reducer(state: State, action: Action): State {
  if (action.kind === "reset") return init();
  if (state.over) return state;

  const { board, piece } = state;

  switch (action.kind) {
    case "left":
    case "right": {
      const dx = action.kind === "left" ? -1 : 1;
      if (!collides(board, piece.matrix, piece.x + dx, piece.y)) {
        return { ...state, piece: { ...piece, x: piece.x + dx } };
      }
      return state;
    }
    case "rotate": {
      const matrix = rotate(piece.matrix);
      // Wall kicks: try in place, then nudged off each wall.
      for (const dx of [0, -1, 1, -2, 2]) {
        if (!collides(board, matrix, piece.x + dx, piece.y)) {
          return { ...state, piece: { ...piece, matrix, x: piece.x + dx } };
        }
      }
      return state;
    }
    case "tick":
    case "soft": {
      if (!collides(board, piece.matrix, piece.x, piece.y + 1)) {
        const bonus = action.kind === "soft" ? 1 : 0;
        return { ...state, piece: { ...piece, y: piece.y + 1 }, score: state.score + bonus };
      }
      return lock(state);
    }
    case "hard": {
      let dist = 0;
      while (!collides(board, piece.matrix, piece.x, piece.y + dist + 1)) dist++;
      return lock({ ...state, piece: { ...piece, y: piece.y + dist } }, dist * 2);
    }
    default:
      return state;
  }
}

// Where the current piece would land — drawn faintly so hard drops are aimable.
function ghostY(board: Grid, piece: Piece): number {
  let dist = 0;
  while (!collides(board, piece.matrix, piece.x, piece.y + dist + 1)) dist++;
  return piece.y + dist;
}

function Mini({ type }: { type: PieceType }) {
  const m = SHAPES[type];
  return (
    <div
      className="grid gap-px"
      style={{ gridTemplateColumns: `repeat(${m[0].length}, 12px)` }}
    >
      {m.flatMap((row, y) =>
        row.map((c, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: c ? COLORS[c] : "transparent",
            }}
          />
        ))
      )}
    </div>
  );
}

export default function Tetris() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Gravity. Speeds up every 10 cleared lines; resets the interval when it does.
  const level = Math.floor(state.lines / 10);
  useEffect(() => {
    if (state.over) return;
    const speed = Math.max(120, 800 - level * 70);
    const id = setInterval(() => dispatch({ kind: "tick" }), speed);
    return () => clearInterval(id);
  }, [level, state.over]);

  // Keyboard. The game only mounts inside the generating overlay, so owning the
  // arrow keys and space (page scroll) for its lifetime is fine.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Action["kind"]> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "rotate",
        ArrowDown: "soft",
        " ": "hard",
      };
      const kind = map[e.key];
      if (!kind) return;
      e.preventDefault();
      dispatch({ kind });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Compose what to paint: locked board + ghost + active piece.
  const view = state.board.map((row) => row.slice());
  const gy = ghostY(state.board, state.piece);
  for (let y = 0; y < state.piece.matrix.length; y++) {
    for (let x = 0; x < state.piece.matrix[y].length; x++) {
      if (!state.piece.matrix[y][x]) continue;
      const by = gy + y;
      const bx = state.piece.x + x;
      if (by >= 0 && by < ROWS && !view[by][bx]) view[by][bx] = -state.piece.matrix[y][x];
    }
  }
  for (let y = 0; y < state.piece.matrix.length; y++) {
    for (let x = 0; x < state.piece.matrix[y].length; x++) {
      if (!state.piece.matrix[y][x]) continue;
      const by = state.piece.y + y;
      const bx = state.piece.x + x;
      if (by >= 0) view[by][bx] = state.piece.matrix[y][x];
    }
  }

  return (
    <div className="flex items-start justify-center gap-4">
      <div
        className="relative grid gap-px rounded-lg p-1"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 16px)`,
          gridTemplateRows: `repeat(${ROWS}, 16px)`,
          background: "hsl(var(--muted) / 0.4)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {view.flatMap((row, y) =>
          row.map((c, x) => {
            const ghost = c < 0;
            const color = c ? COLORS[Math.abs(c)] : null;
            return (
              <div
                key={`${x}-${y}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: ghost ? "transparent" : color ?? "hsl(var(--background))",
                  boxShadow: ghost && color ? `inset 0 0 0 2px ${color}66` : undefined,
                }}
              />
            );
          })
        )}

        {state.over && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg text-center"
            style={{ background: "hsl(var(--background) / 0.85)" }}
          >
            <p className="font-display font-bold text-foreground">Game Over</p>
            <button
              type="button"
              onClick={() => dispatch({ kind: "reset" })}
              className="rounded-md px-3 py-1.5 text-sm font-semibold"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Next</p>
          <div className="flex h-[26px] items-center">
            <Mini type={state.next} />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Score</p>
          <p className="font-display font-bold text-lg text-foreground tabular-nums">{state.score}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Lines</p>
          <p className="font-display font-bold text-lg text-foreground tabular-nums">{state.lines}</p>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground max-w-[9rem]">
          ← → move · ↑ rotate · ↓ soft drop · space hard drop
        </p>
      </div>
    </div>
  );
}
