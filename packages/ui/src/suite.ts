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

export const SUITE_SUBJECTS: SuiteSubject[] = [
  {
    slug: 'french',
    name: 'French',
    emoji: '🇫🇷',
    blurb: 'Build vocabulary, drill it, and hear it spoken.',
    tools: ['language-hub'],
  },
  {
    slug: 'physics',
    name: 'Physics',
    emoji: '⚛️',
    blurb: 'Lock in the definitions, then test them against real exam questions.',
    tools: ['recall-app', 'past-papers'],
  },
  {
    slug: 'chemistry',
    name: 'Chemistry',
    emoji: '🧪',
    blurb: 'Work through real exam questions, topic by topic.',
    tools: ['past-papers'],
  },
  {
    slug: 'add-maths',
    name: 'Additional Mathematics',
    emoji: '📐',
    blurb: 'Practise past-paper questions chapter by chapter, calculator and non-calculator.',
    tools: ['past-papers'],
  },
  {
    slug: 'literature',
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

export function getSubjectByName(name: string): SuiteSubject | undefined {
  const n = name.toLowerCase();
  return SUITE_SUBJECTS.find(s => s.name.toLowerCase() === n || s.slug === n);
}

export function subjectsForTool(toolId: string): SuiteSubject[] {
  return SUITE_SUBJECTS.filter(s => s.tools.includes(toolId));
}

export function subjectUrl(slug: string): string {
  return `/${slug}`;
}

export function toolIndexUrl(toolId: string): string {
  const tool = getTool(toolId);
  return tool ? `/tools/${tool.mount}` : '/';
}

/** Where a tool lives for one subject, e.g. `/physics/recall`. */
export function toolUrl(toolId: string, subjectSlug: string): string {
  const tool = getTool(toolId);
  return tool ? `/${subjectSlug}/${tool.mount}` : subjectUrl(subjectSlug);
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
    subjects: subjectsForTool(t.id).map(s => s.name),
    has_demo: t.hasDemo,
    no_login: t.noLogin,
  }));
}

/** The navbar's Subjects dropdown: one entry per subject, linking to /:subject. */
export function suiteSubjectLinks(): NavSubjectLink[] {
  return SUITE_SUBJECTS.map(s => ({
    slug: s.slug,
    name: s.name,
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
  return scope;
}
