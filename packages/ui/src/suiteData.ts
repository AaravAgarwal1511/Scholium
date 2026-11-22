/**
 * Subject-first suite registry — data and pure helpers only.
 *
 * Kept free of React, DOM and component imports so it can be read from Node at
 * build time: scholium-home's prerender plugin (apps/scholium-home/prerender.ts)
 * uses the same subjects, tools and page copy to write a static HTML page per
 * subject and tool, and to check that vercel.json routes exactly these. Edit the
 * suite here and both the app and the static pages follow.
 */

import { SCHOLIUM_HOME_URL } from './constants';

/** Origin used for canonical URLs in the static pages. */
export const SUITE_SITE_URL = SCHOLIUM_HOME_URL;

export interface SuiteTool {
  id: string;
  title: string;
  icon: string;
  description: string;
  /** Path segment the tool is mounted at, and its Vite `base`. */
  mount: string;
  /** Tool has a no-signup trial at `<tool url>/demo`. */
  hasDemo: boolean;
  noLogin: boolean;
}

export interface SuiteSubject {
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
  /** Cambridge IGCSE syllabus code, shown next to the name everywhere. */
  code?: string;
  /** Tool ids, in display order. */
  tools: string[];
}

export const SUITE_TOOLS: SuiteTool[] = [
  {
    id: 'language-hub',
    title: 'Language Hub',
    icon: '🗣️',
    description: 'Vocabulary flashcards, drills and dictation for French and Spanish.',
    mount: 'language-hub',
    hasDemo: true,
    noLogin: false,
  },
  {
    id: 'recall-app',
    title: 'Recall Master',
    icon: '🧠',
    description: 'Spaced-repetition cards for the definitions examiners expect.',
    mount: 'recall',
    hasDemo: true,
    noLogin: false,
  },
  {
    id: 'past-papers',
    title: 'Past Papers',
    icon: '📄',
    description: 'Build a custom paper from real exam questions, mark scheme included.',
    mount: 'past-papers',
    hasDemo: false,
    noLogin: true,
  },
  {
    id: 'poetry-notes',
    title: 'Poetry Notes',
    icon: '📓',
    description: 'Annotate poems and keep your notes beside the verse.',
    mount: 'poetry-notes',
    hasDemo: true,
    noLogin: false,
  },
];

// Display order: sciences, maths, humanities, English, languages. Mirrors what
// each tool actually carries in production (recall_chapters subjects, the
// past-papers syllabus codes, Language Hub's two languages). Mock Space is
// deliberately not part of the suite yet.
export const SUITE_SUBJECTS: SuiteSubject[] = [
  {
    slug: 'physics',
    code: '0625',
    name: 'Physics',
    emoji: '⚛️',
    blurb: 'Lock in the definitions, then test them against real exam questions.',
    tools: ['recall-app', 'past-papers'],
  },
  {
    slug: 'chemistry',
    code: '0620',
    name: 'Chemistry',
    emoji: '🧪',
    blurb: 'Lock in the definitions, then test them against real exam questions.',
    tools: ['recall-app', 'past-papers'],
  },
  {
    slug: 'biology',
    code: '0610',
    name: 'Biology',
    emoji: '🧬',
    blurb: 'Build papers from real exam questions, topic by topic.',
    tools: ['past-papers'],
  },
  {
    slug: 'maths',
    code: '0580',
    name: 'Mathematics',
    emoji: '➗',
    blurb: 'Practise past-paper questions chapter by chapter.',
    tools: ['past-papers'],
  },
  {
    slug: 'int-maths',
    code: '0607',
    name: 'International Mathematics',
    emoji: '📊',
    blurb: 'Practise past-paper questions chapter by chapter.',
    tools: ['past-papers'],
  },
  {
    slug: 'add-maths',
    code: '0606',
    name: 'Additional Mathematics',
    emoji: '📐',
    blurb: 'Practise past-paper questions chapter by chapter.',
    tools: ['past-papers'],
  },
  {
    slug: 'computer-science',
    code: '0478',
    name: 'Computer Science',
    emoji: '💻',
    blurb: 'Build papers from real exam questions, topic by topic.',
    tools: ['past-papers'],
  },
  {
    slug: 'economics',
    code: '0455',
    name: 'Economics',
    emoji: '📈',
    blurb: 'Lock in the definitions, then test them against real exam questions.',
    tools: ['recall-app', 'past-papers'],
  },
  {
    slug: 'english-language',
    code: '0500',
    name: 'First Language English',
    emoji: '✍️',
    blurb: 'Download adapted past papers and mark schemes.',
    tools: ['past-papers'],
  },
  {
    slug: 'french',
    code: '0520',
    name: 'French',
    emoji: '🇫🇷',
    blurb: 'Build vocabulary, drill it, and hear it spoken.',
    tools: ['language-hub'],
  },
  {
    slug: 'spanish',
    code: '0530',
    name: 'Spanish',
    emoji: '🇪🇸',
    blurb: 'Build vocabulary, drill it, and hear it spoken.',
    tools: ['language-hub'],
  },
  {
    slug: 'literature',
    code: '0475',
    name: 'Literature',
    emoji: '📖',
    blurb: 'Annotate the set poems and build linked notes around the text.',
    tools: ['poetry-notes'],
  },
];

export function getTool(id: string): SuiteTool | undefined {
  return SUITE_TOOLS.find(t => t.id === id);
}

export function getToolByMount(mount: string): SuiteTool | undefined {
  return SUITE_TOOLS.find(t => t.mount === mount);
}

export function getSubject(slug: string): SuiteSubject | undefined {
  return SUITE_SUBJECTS.find(s => s.slug === slug.toLowerCase());
}

/** By syllabus code, e.g. a saved paper's `subject` ("0625") → Physics. */
export function getSubjectByCode(code: string): SuiteSubject | undefined {
  return SUITE_SUBJECTS.find(s => s.code === code);
}

/** Accepts a bare name, a slug, or a label with its code ("Physics (0625)"). */
export function getSubjectByName(name: string): SuiteSubject | undefined {
  const n = name.toLowerCase().trim();
  const bare = n.replace(/\s*\(\d{4}\)$/, '');
  return SUITE_SUBJECTS.find(
    s => s.name.toLowerCase() === bare || s.slug === bare || subjectLabel(s).toLowerCase() === n,
  );
}

/** "Physics (0625)" — the name with its syllabus code, wherever a subject is named. */
export function subjectLabel(subject: SuiteSubject): string {
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

/** "Physics (0625) Past Papers" — a tool as opened for one subject. */
export function scopedToolTitle(scope: { subject: SuiteSubject; tool: SuiteTool }): string {
  return `${subjectLabel(scope.subject)} ${scope.tool.title}`;
}

export function subjectsForTool(toolId: string): SuiteSubject[] {
  return SUITE_SUBJECTS.filter(s => s.tools.includes(toolId));
}

/** Where picking a subject lands: its page listing its tools, or — when only one
 *  tool covers it (Biology → Past Papers) — straight into that tool. */
export function subjectUrl(slug: string): string {
  const subject = getSubject(slug);
  if (subject && subject.tools.length === 1) return toolUrl(subject.tools[0], subject.slug);
  return `/${slug}`;
}

/** The subject's own page, regardless of how many tools it has. */
export function subjectPageUrl(slug: string): string {
  return `/${slug}`;
}

/** Where picking a tool from the navbar lands: its subject list, or — when the
 *  tool covers exactly one subject (Poetry Notes → Literature) — straight into
 *  the tool, since a one-card picker is just an extra click. */
export function toolIndexUrl(toolId: string): string {
  const tool = getTool(toolId);
  if (!tool) return '/';
  const subjects = subjectsForTool(tool.id);
  return subjects.length === 1 ? toolUrl(tool.id, subjects[0].slug) : `/tools/${tool.mount}`;
}

/** Where a tool lives for one subject, e.g. `/physics/recall`. */
export function toolUrl(toolId: string, subjectSlug: string): string {
  const tool = getTool(toolId);
  return tool ? `/${subjectSlug}/${tool.mount}` : subjectPageUrl(subjectSlug);
}

// ── Page copy ────────────────────────────────────────────────────────────────
// One sentence per tool, said for a given subject. Shown on subject pages and
// baked into their static HTML, so it is what a search visitor reads first.
const TOOL_FOR_SUBJECT: Record<string, (s: SuiteSubject) => string> = {
  'recall-app': () =>
    'Recall Master drills the definitions examiners expect with spaced-repetition cards, taking you from matching each one to writing it from memory.',
  'past-papers': s =>
    s.slug === 'english-language'
      ? 'Past Papers lists adapted First Language English past papers with their mark schemes, ready to download.'
      : 'Past Papers builds a custom paper from real exam questions: pick the chapters and how many questions from each, then download it with the mark scheme.',
  'language-hub': s =>
    `Language Hub has ${s.name} vocabulary sets built around the IGCSE topics, practised as flashcards, drills and dictation.`,
  'poetry-notes': () =>
    'Poetry Notes lets you annotate poems line by line and keep linked notes beside the text.',
};

/** Two or three sentences introducing a subject page. */
export function subjectIntro(subject: SuiteSubject): string[] {
  const lead = subject.code
    ? `Free revision for Cambridge IGCSE ${subject.name} (${subject.code}).`
    : `Free revision for ${subject.name}.`;
  return [lead, ...subject.tools.map(id => TOOL_FOR_SUBJECT[id]?.(subject) ?? '').filter(Boolean)];
}

/** <title> and meta description for /:subject. */
export function subjectPageMeta(subject: SuiteSubject): { title: string; description: string } {
  const tools = subject.tools.map(id => getTool(id)?.title).filter(Boolean).join(' and ');
  return {
    title: `IGCSE ${subjectLabel(subject)} revision: ${tools} · Scholium`,
    description: subjectIntro(subject).join(' '),
  };
}

/** <title> and meta description for /tools/:mount. */
export function toolPageMeta(tool: SuiteTool): { title: string; description: string } {
  const names = subjectsForTool(tool.id).map(s => s.name);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
  return {
    title: `${tool.title} for IGCSE ${list} · Scholium`,
    description: `${tool.description} Free, for Cambridge IGCSE ${list}.`,
  };
}

