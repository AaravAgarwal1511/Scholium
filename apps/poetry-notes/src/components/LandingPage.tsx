import { useRef, useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { ProjectIndexEntry } from '../contexts/ProjectContext';
import './LandingPage.css';
import './LandingPageProjects.css';

interface LandingPageProps {
    onProjectReady: () => void;
    onSettings: () => void;
    description?: string | null;
}

type Screen = 'home' | 'open';

export function LandingPage({ onProjectReady, description }: LandingPageProps) {
    const { createNewProject, importProject, loadProjectList, openProject, deleteProject } = useProject();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [screen, setScreen] = useState<Screen>('home');
    const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
    const [loadingList, setLoadingList] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [openingId, setOpeningId] = useState<string | null>(null);

    const fetchProjects = useCallback(async () => {
        setLoadingList(true);
        const list = await loadProjectList();
        setProjects(list.sort((a, b) => b.lastModified.localeCompare(a.lastModified)));
        setLoadingList(false);
    }, [loadProjectList]);

    useEffect(() => {
        // Fetching the project list on entry to the "open" screen is exactly the
        // external-system synchronisation effects are for; the flagged setState is
        // the loading flag that has to be raised before the request goes out.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (screen === 'open') fetchProjects();
    }, [screen, fetchProjects]);

    const handleCreateNew = async () => {
        try {
            await createNewProject();
            onProjectReady();
        } catch {
            setError('Failed to create project. Please try again.');
        }
    };

    const handleOpen = async (projectId: string) => {
        setOpeningId(projectId);
        try {
            await openProject(projectId);
            onProjectReady();
        } catch {
            setError('Failed to open project. Please try again.');
        } finally {
            setOpeningId(null);
        }
    };

    const handleDelete = async (projectId: string) => {
        if (!confirm('Delete this project? This cannot be undone.')) return;
        setDeletingId(projectId);
        try {
            await deleteProject(projectId);
            setProjects(prev => prev.filter(p => p.projectId !== projectId));
        } catch {
            setError('Failed to delete project. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.json')) { setError('Please select a valid JSON project file'); return; }
        try {
            await importProject(file);
            setError(null);
            onProjectReady();
        } catch {
            setError('Failed to import project. Please check the file format.');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (screen === 'open') {
        return (
            <div className="landing-page">
                <header className="landing-page-header">
                    <h1>Poetry Notes.</h1>
                    <p>{description ?? 'Your saved annotations, every reading kept beside the verse.'}</p>
                </header>
                <div className="landing-content">
                    <div className="projects-toolbar">
                        <button className="projects-back-btn" onClick={() => setScreen('home')}>← Back</button>
                        <button className="projects-new-btn" onClick={handleCreateNew}>+ New</button>
                    </div>
                    {loadingList ? (
                        <div className="projects-loading">Loading…</div>
                    ) : projects.length === 0 ? (
                        <div className="projects-empty">No saved projects yet.</div>
                    ) : (
                        <ul className="projects-list">
                            {projects.map(p => (
                                <li key={p.projectId} className="project-item">
                                    <button
                                        className="project-open-btn"
                                        onClick={() => handleOpen(p.projectId)}
                                        disabled={openingId === p.projectId}
                                    >
                                        <span className="project-title">{p.title || 'Untitled Project'}</span>
                                        <span className="project-date">
                                            {new Date(p.lastModified).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                        </span>
                                        {openingId === p.projectId && <span className="project-loading">Opening…</span>}
                                    </button>
                                    <button
                                        className="project-delete-btn"
                                        onClick={() => handleDelete(p.projectId)}
                                        disabled={deletingId === p.projectId}
                                        aria-label="Delete project"
                                    >
                                        {deletingId === p.projectId ? '…' : '🗑'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {error && <div className="error-message">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="landing-page">
            <header className="landing-page-header">
                <h1>Poetry Notes.</h1>
                <p>{description ?? 'Marginalia for verse, selections become anchors, notes become a canvas around the text.'}</p>
            </header>

            <div className="landing-content">
                <div className="landing-actions">
                    <button className="action-button primary" onClick={() => setScreen('open')}>
                        <span className="button-icon">📂</span>
                        <span className="button-text">
                            <span className="button-title">Continue Project</span>
                            <span className="button-subtitle">Open or manage your saved notes</span>
                        </span>
                    </button>

                    <button className="action-button" onClick={handleCreateNew}>
                        <span className="button-icon">✨</span>
                        <span className="button-text">
                            <span className="button-title">New Project</span>
                            <span className="button-subtitle">Start a fresh annotation</span>
                        </span>
                    </button>

                    <button className="action-button" onClick={handleUploadClick}>
                        <span className="button-icon">📤</span>
                        <span className="button-text">
                            <span className="button-title">Import from File</span>
                            <span className="button-subtitle">Load a JSON project file</span>
                        </span>
                    </button>

                    <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} style={{ display: 'none' }} />
                </div>

                {error && <div className="error-message">{error}</div>}
            </div>
        </div>
    );
}
