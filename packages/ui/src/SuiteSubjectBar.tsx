import { getTool, subjectUrl, toolUrl, type SuiteSubject } from './suite';
import './SuiteSubjectBar.css';

export interface SuiteSubjectBarProps {
  subject: SuiteSubject;
  /** The tool this page is, highlighted in the tab row. Omit on the subject page itself. */
  currentToolId?: string;
}

/**
 * Second row under the navbar on every subject-scoped page: a breadcrumb back
 * to the subject, plus a tab per tool that covers it. This is what makes
 * `/physics/recall` and `/physics/past-papers` read as one "Physics" space
 * rather than two separate apps.
 */
export function SuiteSubjectBar({ subject, currentToolId }: SuiteSubjectBarProps) {
  return (
    <nav className="rui-subjectbar" aria-label={`${subject.name} tools`}>
      <div className="rui-subjectbar-inner">
        <a
          href={subjectUrl(subject.slug)}
          className={`rui-subjectbar-subject${currentToolId ? '' : ' rui-subjectbar-subject--current'}`}
          aria-current={currentToolId ? undefined : 'page'}
        >
          <span aria-hidden="true">{subject.emoji}</span>
          {subject.name}
        </a>
        <span className="rui-subjectbar-sep" aria-hidden="true">/</span>
        <ul className="rui-subjectbar-tabs">
          {subject.tools.map(id => {
            const tool = getTool(id);
            if (!tool) return null;
            const current = id === currentToolId;
            return (
              <li key={id}>
                <a
                  href={toolUrl(id, subject.slug)}
                  className={`rui-subjectbar-tab${current ? ' rui-subjectbar-tab--current' : ''}`}
                  aria-current={current ? 'page' : undefined}
                >
                  <span aria-hidden="true">{tool.icon}</span>
                  {tool.title}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
