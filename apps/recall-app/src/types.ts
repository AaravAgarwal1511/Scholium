export interface Card {
  term: string;
  definition: string;
}

export interface Chapter {
  id: string;
  name: string;
  cards: Card[];
  cardCount?: number; // populated when cards are not loaded
}

export interface Section {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface Subject {
  id: string;
  name: string;
  emoji: string;
  accent: "blue" | "orange";
  sections: Section[];
}

export interface User {
  email: string;
  name: string;
}

export type Passes = Record<string, number>;

// ── Two-Sider: essay questions with points argued on two sides ──────────────
export type Side = "for" | "against";

export interface SidePoint {
  letter: string;  // mnemonic initial, e.g. "D"
  keyword: string; // the point compressed to one trigger word, e.g. "Dumping"
  point: string;   // the full point, one sentence
}

export interface TwoSiderSide {
  stance: Side;
  label: string;    // how the side reads in this question, e.g. "FOR tariffs"
  mnemonic: string; // the initials of the keywords, e.g. "DRIVES"
  points: SidePoint[];
}

export interface TwoSider {
  id: string;
  subject: string;
  emoji: string;
  question: string;
  marks?: number;
  sides: [TwoSiderSide, TwoSiderSide]; // [for, against]
}

// localStorage: two-sider id → highest stage completed (0 none, 1 anchor, 2 face-off, 3 blank slate)
export type TwoSiderProgress = Record<string, number>;
