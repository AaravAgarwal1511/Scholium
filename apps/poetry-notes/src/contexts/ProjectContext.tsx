import { createContext, useContext, useReducer, useEffect, useCallback, useState, useRef } from 'react';
import { useAnalytics } from '@repo/analytics';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import type { Project, ProjectAction, ViewState, Note, NotePosition } from '../types';
import { supabase, BUCKET } from '../integrations/supabase/client';

const AUTO_SAVE_INTERVAL = 30000;

export interface ProjectIndexEntry {
    projectId: string;
    title: string;
    lastModified: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function indexPath(userId: string) {
    return `${userId}/_index.json`;
}
function projectPath(userId: string, projectId: string) {
    return `${userId}/${projectId}.json`;
}

async function readIndex(userId: string): Promise<ProjectIndexEntry[]> {
    const { data, error } = await supabase.storage.from(BUCKET).download(indexPath(userId));
    if (error || !data) return [];
    try { return JSON.parse(await data.text()); } catch { return []; }
}

async function writeIndex(userId: string, entries: ProjectIndexEntry[]) {
    const blob = new Blob([JSON.stringify(entries)], { type: 'application/json' });
    await supabase.storage.from(BUCKET).upload(indexPath(userId), blob, { upsert: true });
}

async function saveProjectToStorage(userId: string, project: Project) {
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    await supabase.storage.from(BUCKET).upload(projectPath(userId, project.projectId), blob, { upsert: true });

    // Update index entry
    const index = await readIndex(userId);
    const existing = index.findIndex(e => e.projectId === project.projectId);
    const entry: ProjectIndexEntry = { projectId: project.projectId, title: project.title, lastModified: project.lastModified };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);
    await writeIndex(userId, index);
}

async function loadProjectFromStorage(userId: string, projectId: string): Promise<Project | null> {
    const { data, error } = await supabase.storage.from(BUCKET).download(projectPath(userId, projectId));
    if (error || !data) return null;
    try { return JSON.parse(await data.text()) as Project; } catch { return null; }
}

async function deleteProjectFromStorage(userId: string, projectId: string) {
    await supabase.storage.from(BUCKET).remove([projectPath(userId, projectId)]);
    const index = await readIndex(userId);
    await writeIndex(userId, index.filter(e => e.projectId !== projectId));
}

// ── Project factory ───────────────────────────────────────────────────────────

const createEmptyProject = (): Project => {
    const now = new Date().toISOString();
    return {
        projectId: uuidv4(),
        version: '1.0',
        title: 'Untitled Project',
        createdAt: now,
        lastModified: now,
        poem: { content: '', highlights: [] },
        notes: [
            { id: 'note-context', content: '', position: { x: 50, y: 50 }, textReferences: [], linkedNotes: [], createdAt: now, lastModified: now, type: 'context', isCollapsed: true },
            { id: 'note-personal-response', content: '', position: { x: 50, y: 150 }, textReferences: [], linkedNotes: [], createdAt: now, lastModified: now, type: 'personal-response', isCollapsed: true },
        ],
        connections: [],
    };
};

function ensureSpecialNotes(p: Project): Project {
    const now = new Date().toISOString();
    const hasContext = p.notes.some(n => n.id === 'note-context');
    const hasPersonal = p.notes.some(n => n.id === 'note-personal-response');
    if (hasContext && hasPersonal) return p;
    const updatedNotes = [...p.notes];
    if (!hasContext) updatedNotes.push({ id: 'note-context', content: '', position: { x: 50, y: 50 }, textReferences: [], linkedNotes: [], createdAt: now, lastModified: now, type: 'context', isCollapsed: true });
    if (!hasPersonal) updatedNotes.push({ id: 'note-personal-response', content: '', position: { x: 50, y: 150 }, textReferences: [], linkedNotes: [], createdAt: now, lastModified: now, type: 'personal-response', isCollapsed: true });
    return { ...p, notes: updatedNotes };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function projectReducer(state: Project, action: ProjectAction): Project {
    const now = new Date().toISOString();
    switch (action.type) {
        case 'SET_PROJECT': return action.payload;
        case 'UPDATE_TITLE': return { ...state, title: action.payload, lastModified: now };
        case 'UPDATE_POEM_CONTENT': {
            const newContent = action.payload;
            const updatedHighlights = state.poem.highlights.filter(h =>
                newContent.includes(`data-highlight-id="${h.id}"`) ||
                newContent.includes(`data-highlight-id="${h.id},`) ||
                newContent.includes(`,${h.id}"`) || newContent.includes(`,${h.id},`)
            );
            const updatedNotes = state.notes.filter(note => {
                if (note.type) return true;
                const hasHighlights = updatedHighlights.some(h => note.textReferences.includes(h.id));
                const hasConnections = state.connections.some(c => c.fromNoteId === note.id || c.toNoteId === note.id);
                const hasLinkedNotes = note.linkedNotes.length > 0 || state.notes.some(n => n.linkedNotes.includes(note.id));
                return hasHighlights || hasConnections || hasLinkedNotes;
            });
            return { ...state, poem: { ...state.poem, content: newContent, highlights: updatedHighlights }, notes: updatedNotes, lastModified: now };
        }
        case 'ADD_HIGHLIGHT': return { ...state, poem: { ...state.poem, highlights: [...state.poem.highlights, action.payload] }, lastModified: now };
        case 'REMOVE_HIGHLIGHT': return { ...state, poem: { ...state.poem, highlights: state.poem.highlights.filter(h => h.id !== action.payload) }, lastModified: now };
        case 'ADD_NOTE': return { ...state, notes: [...state.notes, action.payload], lastModified: now };
        case 'UPDATE_NOTE': return { ...state, notes: state.notes.map(note => note.id === action.payload.id ? { ...note, ...action.payload, lastModified: now } : note), lastModified: now };
        case 'UPDATE_NOTE_REFERENCES': {
            const { id, highlightId } = action.payload;
            return { ...state, notes: state.notes.map(note => note.id === id && !note.textReferences.includes(highlightId) ? { ...note, textReferences: [...note.textReferences, highlightId], lastModified: now } : note), lastModified: now };
        }
        case 'UPDATE_NOTE_POSITION': return { ...state, notes: state.notes.map(note => note.id === action.payload.id ? { ...note, position: action.payload.position } : note), lastModified: now };
        case 'DELETE_NOTE': {
            const noteId = action.payload;
            const noteToDelete = state.notes.find(n => n.id === noteId);
            if (noteToDelete?.type) return state;
            const updatedHighlights = state.poem.highlights.map(h => ({ ...h, noteIds: h.noteIds.filter(id => id !== noteId) })).filter(h => h.noteIds.length > 0);
            const updatedConnections = state.connections.filter(c => c.fromNoteId !== noteId && c.toNoteId !== noteId);
            const updatedNotes = state.notes.filter(n => n.id !== noteId).map(n => ({ ...n, linkedNotes: n.linkedNotes.filter(id => id !== noteId) }));
            return { ...state, notes: updatedNotes, poem: { ...state.poem, highlights: updatedHighlights }, connections: updatedConnections, lastModified: now };
        }
        case 'LINK_NOTES': {
            const { fromId, toId } = action.payload;
            return { ...state, notes: state.notes.map(note => note.id === fromId && !note.linkedNotes.includes(toId) ? { ...note, linkedNotes: [...note.linkedNotes, toId] } : note), lastModified: now };
        }
        case 'UNLINK_NOTES': {
            const { fromId, toId } = action.payload;
            return { ...state, notes: state.notes.map(note => note.id === fromId ? { ...note, linkedNotes: note.linkedNotes.filter(id => id !== toId) } : note), connections: state.connections.filter(c => !(c.fromNoteId === fromId && c.toNoteId === toId)), lastModified: now };
        }
        case 'ADD_CONNECTION': return { ...state, connections: [...state.connections, action.payload], lastModified: now };
        case 'REMOVE_CONNECTION': return { ...state, connections: state.connections.filter(c => c.id !== action.payload), lastModified: now };
        case 'TOGGLE_NOTE_COLLAPSE': return { ...state, notes: state.notes.map(note => note.id === action.payload ? { ...note, isCollapsed: !note.isCollapsed, lastModified: now } : note), lastModified: now };
        default: return state;
    }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface ProjectContextType {
    project: Project;
    viewState: ViewState;
    dispatch: Dispatch<ProjectAction>;
    setViewState: Dispatch<SetStateAction<ViewState>>;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    createNote: (highlightId: string, position: NotePosition) => Note;
    saveToCloud: () => Promise<void>;
    loadProjectList: () => Promise<ProjectIndexEntry[]>;
    openProject: (projectId: string) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    createNewProject: () => Promise<void>;
    hasUnsavedChanges: boolean;
    userId: string | null;
    setUserId: (id: string | null) => void;
    // Legacy compat
    exportProject: () => void;
    importProject: (file: File) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const initialViewState: ViewState = { hoveredNoteId: null, selectedNoteId: null, linkingFromNoteId: null, isCreatingNote: false, camera: { x: 0, y: 0, zoom: 1 } };

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [project, dispatch] = useReducer(projectReducer, createEmptyProject());
    const [viewState, setViewState] = useState<ViewState>(initialViewState);
    const [lastSavedAt, setLastSavedAt] = useState<string>(project.lastModified);
    const [userId, setUserId] = useState<string | null>(null);
    const isSavingRef = useRef(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('darkMode');
            if (saved !== null) return JSON.parse(saved);
        }
        return false;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark-mode', isDarkMode);
        localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    const toggleDarkMode = useCallback(() => setIsDarkMode((prev: boolean) => !prev), []);
    const hasUnsavedChanges = project.lastModified !== lastSavedAt;

    const { track } = useAnalytics();

    const saveToCloud = useCallback(async () => {
        if (!userId || isSavingRef.current) return;
        isSavingRef.current = true;
        const startedAt = Date.now();
        try {
            await saveProjectToStorage(userId, project);
            setLastSavedAt(project.lastModified);
            track("cloud_save", { ok: true, duration_ms: Date.now() - startedAt });
        } catch (e) {
            track("cloud_save", { ok: false, duration_ms: Date.now() - startedAt });
            throw e;
        } finally {
            isSavingRef.current = false;
        }
    }, [userId, project, track]);

    // Auto-save every 30s
    useEffect(() => {
        if (!userId) return;
        const interval = setInterval(() => {
            if (hasUnsavedChanges) saveToCloud();
        }, AUTO_SAVE_INTERVAL);
        return () => clearInterval(interval);
    }, [userId, hasUnsavedChanges, saveToCloud]);

    const loadProjectList = useCallback(async (): Promise<ProjectIndexEntry[]> => {
        if (!userId) return [];
        return readIndex(userId);
    }, [userId]);

    const openProject = useCallback(async (projectId: string) => {
        if (!userId) return;
        const loaded = await loadProjectFromStorage(userId, projectId);
        if (loaded) {
            dispatch({ type: 'SET_PROJECT', payload: ensureSpecialNotes(loaded) });
            setLastSavedAt(loaded.lastModified);
            track("project_opened");
        }
    }, [userId, track]);

    const deleteProject = useCallback(async (projectId: string) => {
        if (!userId) return;
        await deleteProjectFromStorage(userId, projectId);
    }, [userId]);

    const createNote = useCallback((highlightId: string, position: NotePosition): Note => {
        const now = new Date().toISOString();
        const note: Note = { id: uuidv4(), content: '', position, textReferences: [highlightId], linkedNotes: [], createdAt: now, lastModified: now };
        dispatch({ type: 'ADD_NOTE', payload: note });
        return note;
    }, []);

    const createNewProject = useCallback(async () => {
        const newProject = createEmptyProject();
        dispatch({ type: 'SET_PROJECT', payload: newProject });
        setLastSavedAt(newProject.lastModified);
        track("project_created");
        if (userId) await saveProjectToStorage(userId, newProject);
    }, [userId, track]);

    // Legacy: export as JSON download
    const exportProject = useCallback(() => {
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        const safeTitle = (project.title || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase();
        link.href = url;
        link.download = `${safeTitle}-${timestamp}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, [project]);

    // Legacy: import from JSON file
    const importProject = useCallback(async (file: File): Promise<void> => {
        const text = await file.text();
        const projectData = JSON.parse(text) as Project;
        if (!projectData.projectId || !projectData.poem || !projectData.notes) throw new Error('Invalid project file');
        const sanitized: Project = {
            ...projectData,
            poem: {
                ...projectData.poem,
                content: DOMPurify.sanitize(projectData.poem.content),
            },
        };
        const imported = ensureSpecialNotes(sanitized);
        dispatch({ type: 'SET_PROJECT', payload: imported });
        setLastSavedAt(imported.lastModified);
        if (userId) await saveProjectToStorage(userId, imported);
    }, [userId]);

    return (
        <ProjectContext.Provider value={{
            project, viewState, dispatch, setViewState, isDarkMode, toggleDarkMode,
            createNote, saveToCloud, loadProjectList, openProject, deleteProject,
            createNewProject, hasUnsavedChanges, userId, setUserId,
            exportProject, importProject,
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject() {
    const ctx = useContext(ProjectContext);
    if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
    return ctx;
}
