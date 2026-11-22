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

export * from './suiteData';
import {
  SUITE_SUBJECTS,
  SUITE_TOOLS,
  getSubject,
  getSubjectByName,
  getTool,
  scopedToolTitle,
  subjectLabel,
  subjectUrl,
  subjectsForTool,
  toolIndexUrl,
  type SuiteSubject,
  type SuiteTool,
} from './suiteData';

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
