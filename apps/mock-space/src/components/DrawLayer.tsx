import { useRef, useState } from "react";
import type { Stroke } from "@/lib/model";
import type { PageGeometry } from "@/lib/pdfRender";
import type { Tool } from "@/lib/tools";

/** Minimum movement, in points, before a new vertex is recorded. */
const RESAMPLE_PT = 0.7;
const STROKE_WIDTH_PT = 1.4;
/** Fat invisible hit path, so the eraser does not demand pixel accuracy. */
const HIT_WIDTH_PT = 9;
/** Black in both themes, like the typed answers and like the exported ink. */
const INK = "#000";

interface Props {
  pageIndex: number;
  geometry: PageGeometry;
  scale: number;
  strokes: Stroke[];
  tool: Tool;
  locked: boolean;
  onCommit(stroke: Stroke): void;
  onErase(strokeId: string): void;
}

/**
 * The SVG viewBox is the page in model points, so stroke coordinates *are* model
 * coordinates — no conversion on the way in, and none on the way out to
 * `drawSvgPath` at export. Stroke width is in points too, so it thickens with zoom
 * exactly as ink on paper would.
 *
 * Erasing removes a whole stroke. Splitting strokes mid-line would need geometry
 * we do not otherwise carry, and a drawn line cannot be silently "improved" the way
 * a sentence can — the append-only rule has nothing to protect here.
 */
export default function DrawLayer({
  pageIndex,
  geometry,
  scale,
  strokes,
  tool,
  locked,
  onCommit,
  onErase,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<number[] | null>(null);

  const active = !locked && (tool === "draw" || tool === "erase");

  function toModel(e: React.PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect();
    return [(e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale];
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (tool !== "draw" || locked) return;
    e.preventDefault();
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    setDraft(toModel(e));
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!draft || tool !== "draw") return;
    const [x, y] = toModel(e);
    const lastX = draft[draft.length - 2];
    const lastY = draft[draft.length - 1];
    if (Math.hypot(x - lastX, y - lastY) < RESAMPLE_PT) return;
    setDraft([...draft, x, y]);
  }

  function onPointerUp() {
    if (!draft) return;
    if (draft.length >= 4) {
      onCommit({
        id: crypto.randomUUID(),
        page: pageIndex,
        points: draft,
        widthPt: STROKE_WIDTH_PT,
      });
    }
    setDraft(null);
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${geometry.widthPt} ${geometry.heightPt}`}
      width={geometry.widthPt * scale}
      height={geometry.heightPt * scale}
      className="absolute inset-0"
      style={{
        pointerEvents: active ? "auto" : "none",
        cursor: tool === "draw" ? "crosshair" : tool === "erase" ? "cell" : "default",
        // Above the paper, below the answer boxes' own pointer handling when writing.
        zIndex: active ? 10 : 0,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {strokes.map((stroke) => (
        <g key={stroke.id}>
          <path
            d={toPath(stroke.points)}
            fill="none"
            stroke={INK}
            strokeWidth={stroke.widthPt}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
          {tool === "erase" && !locked && (
            <path
              d={toPath(stroke.points)}
              fill="none"
              stroke="transparent"
              strokeWidth={HIT_WIDTH_PT}
              strokeLinecap="round"
              pointerEvents="stroke"
              data-stroke={stroke.id}
              onPointerDown={() => onErase(stroke.id)}
              onPointerEnter={(e) => e.buttons === 1 && onErase(stroke.id)}
            />
          )}
        </g>
      ))}

      {draft && draft.length >= 4 && (
        <path
          d={toPath(draft)}
          fill="none"
          stroke={INK}
          strokeWidth={STROKE_WIDTH_PT}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

/** Flat `[x0, y0, x1, y1, …]` → an SVG path. The exporter builds the same string. */
function toPath(points: number[]): string {
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length; i += 2) d += ` L ${points[i]} ${points[i + 1]}`;
  return d;
}
