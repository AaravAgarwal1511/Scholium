import type { AppLink, NavSubjectLink } from './ScholiumNavbar';

/**
 * Subject-first suite registry (multi-zone prototype).
 *
 * The whole suite lives on one origin. scholium-home owns `/`, `/:subject` and
 * `/tools/:tool`; each tool is its own Vite app mounted under a path prefix and
 * reached as `/:subject/:mount/...`. The tool's assets are served from
 * `/:mount/...` (its Vite `base`), and its router basename is
 * `/:subject/:mount`, so the subject stays in the URL the whole time.
 *
 * This file is the single source of truth for which subjects exist and which
 * tools cover them. Each tool maps the subject slug to its own internal id
 * (recall `physics`, past-papers `0625`, language-hub `french`, …).
 */

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
    description: 'Vocabulary sets and flashcard practice.',
    mount: 'language-hub',
    hasDemo: true,
    noLogin: false,
  },
  {
    id: 'recall-app',
    title: 'Recall Master',
    icon: '🧠',
    description: 'Spaced-repetition revision cards.',
    mount: 'recall',
    hasDemo: true,
    noLogin: false,
  },
  {
    id: 'past-papers',
    title: 'Past Papers',
    icon: '📄',
    description: 'Browse and generate past exam papers.',
    mount: 'past-papers',
    hasDemo: false,
    noLogin: true,
  },
  {
    id: 'poetry-notes',
    title: 'Poetry Notes',
    icon: '📓',
    description: 'Rich-text notes for poetry study.',
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

/** The suite as `AppLink`s for the navbar's Study-tools dropdown and search.
 *  A tool's url is its subject list (`/tools/:mount`), not the tool itself —
 *  picking a tool from the navbar always goes through choosing a subject. */
export function suiteAppLinks(): AppLink[] {
  return SUITE_TOOLS.map(t => ({
    id: t.id,
    title: t.title,
    url: toolIndexUrl(t.id),
    icon: t.icon,
    description: t.description,
    subjects: subjectsForTool(t.id).map(subjectLabel),
    has_demo: t.hasDemo,
    no_login: t.noLogin,
  }));
}

/** The navbar's Subjects dropdown: one entry per subject, linking to /:subject. */
export function suiteSubjectLinks(): NavSubjectLink[] {
  return SUITE_SUBJECTS.map(s => ({
    slug: s.slug,
    name: subjectLabel(s),
    icon: s.emoji,
    url: subjectUrl(s.slug),
  }));
}

/** Navbar search → subject page. */
export function goToSubjectByName(name: string): void {
  const subject = getSubjectByName(name);
  window.location.href = subject ? subjectUrl(subject.slug) : '/';
}

export interface SuiteScope {
  tool: SuiteTool;
  subject: SuiteSubject;
  /** Router basename, e.g. `/physics/recall`. */
  basename: string;
}

/**
 * Reads the subject a tool was opened for from the current URL
 * (`/:subject/:mount/...`). Returns null when the tool was opened without a
 * subject, or for a subject it doesn't cover — callers send the visitor to the
 * tool's subject list instead.
 */
export function getSuiteScope(toolId: string): SuiteScope | null {
  const tool = getTool(toolId);
  if (!tool || typeof window === 'undefined') return null;
  const [first, second] = window.location.pathname.split('/').filter(Boolean);
  if (second !== tool.mount || !first) return null;
  const subject = getSubject(first);
  if (!subject || !subject.tools.includes(tool.id)) return null;
  return { tool, subject, basename: `/${subject.slug}/${tool.mount}` };
}

/** Sets the tab title to the subject + tool, e.g. "Computer Science (0478) Past Papers · Scholium". */
export function applySuiteDocumentTitle(scope: SuiteScope | null): void {
  if (scope && typeof document !== 'undefined') {
    document.title = `${scopedToolTitle(scope)} · Scholium`;
  }
}

/**
 * Resolves the scope or, failing that, sends the browser to the tool's subject
 * list and returns null. Call once at the top of a tool's App.
 */
export function requireSuiteScope(toolId: string): SuiteScope | null {
  const scope = getSuiteScope(toolId);
  // Opened on the tool's own deployment (not through the suite origin), the
  // subject list doesn't exist there and the tool's SPA fallback would serve
  // this same app again — so redirect at most once, never from that URL.
  const target = toolIndexUrl(toolId);
  if (!scope && typeof window !== 'undefined' && window.location.pathname !== target) {
    window.location.replace(target);
  }
  applySuiteDocumentTitle(scope);
  return scope;
}
