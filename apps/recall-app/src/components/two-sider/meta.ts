import { Anchor, Swords, PenLine, type LucideIcon } from "lucide-react";
import type { Side } from "@/types";

// The three drills form a ladder: each attacks a different failure mode and
// unlocks the next. Order matters — Anchor must come before the others.
export interface StageMeta {
  key: "anchor" | "faceoff" | "blank";
  name: string;
  tagline: string;
  principle: string;
  icon: LucideIcon;
}

export const STAGES: StageMeta[] = [
  { key: "anchor", name: "Anchor", tagline: "Compress each point to a trigger word", principle: "Chunking", icon: Anchor },
  { key: "faceoff", name: "Face-Off", tagline: "Sort shuffled points onto the right side", principle: "Discrimination", icon: Swords },
  { key: "blank", name: "Blank Slate", tagline: "Rebuild both lists from an empty page", principle: "Free recall", icon: PenLine },
];

// The two sides borrow the app's two brand hues so colour encodes stance:
// indigo (primary) for "for", amber (accent) for "against".
export interface SideTheme {
  text: string;
  softBg: string;
  border: string;
  ring: string;
  solid: string;
  solidText: string;
  solidHover: string;
}

const FOR_THEME: SideTheme = {
  text: "text-primary",
  softBg: "bg-primary/10",
  border: "border-primary",
  ring: "border-primary/40",
  solid: "bg-primary",
  solidText: "text-primary-foreground",
  solidHover: "hover:bg-primary/90",
};

const AGAINST_THEME: SideTheme = {
  text: "text-accent",
  softBg: "bg-accent/10",
  border: "border-accent",
  ring: "border-accent/40",
  solid: "bg-accent",
  solidText: "text-accent-foreground",
  solidHover: "hover:bg-accent/90",
};

export function sideTheme(stance: Side): SideTheme {
  return stance === "for" ? FOR_THEME : AGAINST_THEME;
}
