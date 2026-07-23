import { useEffect } from 'react';
import { useAnalytics } from './useAnalytics';

/** Emits a `page_view` whenever `path` changes.
 *
 *  Takes the path as an argument rather than importing `react-router-dom`, so this
 *  package stays router-free: the five router apps pass `useLocation().pathname`,
 *  and poetry-notes (no router) passes its own view identifier. Pass the pathname
 *  only — strip the query string at the call site so it never reaches the table. */
export function usePageView(path: string): void {
  const { track } = useAnalytics();
  useEffect(() => {
    if (path) track('page_view', {}, path);
  }, [track, path]);
}
