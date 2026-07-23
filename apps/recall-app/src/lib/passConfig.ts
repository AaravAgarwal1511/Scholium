/** Per-pass label and colour tokens, shared by PassBadge and the Home/Study pages.
 *  Kept out of PassBadge.tsx so that file only exports a component (react-refresh). */
export const PASS_CONFIG: Record<
  number,
  { label: string; bg: string; text: string; dot: string; ring: string }
> = {
  1: {
    label: "Pass 1 · Matching",
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
    ring: "border-primary/40",
  },
  2: {
    label: "Pass 2 · Multiple Choice",
    bg: "bg-accent/10",
    text: "text-accent",
    dot: "bg-accent",
    ring: "border-accent/40",
  },
  3: {
    label: "Pass 3 · Fill in Blank",
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
    ring: "border-success/40",
  },
  4: {
    label: "Pass 4 · Complete Recall",
    bg: "bg-pass4/10",
    text: "text-pass4",
    dot: "bg-pass4",
    ring: "border-pass4/40",
  },
};
