import React from 'react';
import { useProject } from '../../contexts/ProjectContext';
import './Header.css';

interface HeaderProps {
    onBackToLanding: () => void;
}

export function Header({ onBackToLanding }: HeaderProps) {
    const { project, viewState, setViewState, dispatch, saveToCloud, exportProject, hasUnsavedChanges, isDarkMode, toggleDarkMode } = useProject();
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [titleValue, setTitleValue] = React.useState(project.title);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Re-sync the draft title when the project's title changes upstream. Adjusting
    // state during render is React's documented alternative to a setState effect:
    // it re-renders before children see the stale value, without a second commit.
    const [syncedTitle, setSyncedTitle] = React.useState(project.title);
    if (syncedTitle !== project.title) {
        setSyncedTitle(project.title);
        setTitleValue(project.title);
    }

    const handleToggleDarkMode = () => {
        toggleDarkMode();
    };

    React.useEffect(() => {
        if (isEditingTitle && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditingTitle]);

    const handleTitleClick = () => {
        setIsEditingTitle(true);
    };

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitleValue(e.target.value);
    };

    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (titleValue.trim() && titleValue !== project.title) {
            dispatch({ type: 'UPDATE_TITLE', payload: titleValue.trim() });
        } else {
            setTitleValue(project.title);
        }
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleTitleBlur();
        } else if (e.key === 'Escape') {
            setTitleValue(project.title);
            setIsEditingTitle(false);
        }
    };

    const handleSave = () => {
        saveToCloud();
    };

    const handleExport = () => {
        exportProject();
    };

    const zoomAroundCenter = (newZoom: number) => {
        setViewState(prev => {
            const vw = window.innerWidth;
            const vh = window.innerHeight - 60; // subtract header height
            const cx = vw / 2;
            const cy = vh / 2;
            const worldX = cx / prev.camera.zoom + prev.camera.x;
            const worldY = cy / prev.camera.zoom + prev.camera.y;
            return {
                ...prev,
                camera: {
                    x: worldX - cx / newZoom,
                    y: worldY - cy / newZoom,
                    zoom: newZoom,
                },
            };
        });
    };

    const handleZoomIn = () => {
        zoomAroundCenter(Math.min(viewState.camera.zoom + 0.1, 4.0));
    };

    const handleZoomOut = () => {
        zoomAroundCenter(Math.max(viewState.camera.zoom - 0.1, 0.2));
    };

    const handleZoomReset = () => {
        setViewState(prev => ({ ...prev, camera: { x: 0, y: 0, zoom: 1 } }));
    };

    const handleRecenter = () => {
        setViewState(prev => ({ ...prev, camera: { ...prev.camera, x: 0, y: 0 } }));
    };

    return (
        <header className="app-header">
            <div className="header-left">
                <button className="back-button" onClick={onBackToLanding} title="Back to Home">
                    ←
                </button>

                <div className="title-section">
                    {isEditingTitle ? (
                        <input
                            ref={inputRef}
                            type="text"
                            className="title-input"
                            value={titleValue}
                            onChange={handleTitleChange}
                            onBlur={handleTitleBlur}
                            onKeyDown={handleTitleKeyDown}
                            placeholder="Project title..."
                        />
                    ) : (
                        <h1 className="project-title" onClick={handleTitleClick} title="Click to edit">
                            {project.title}
                            <span className="edit-hint">✏️</span>
                        </h1>
                    )}
                    {hasUnsavedChanges && <span className="unsaved-indicator">●</span>}
                </div>
            </div>

            <div className="header-right">
                <button
                    className="header-button"
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges}
                >
                    <span className="button-icon">💾</span>
                    Save
                </button>
                <button className="header-button" onClick={handleExport}>
                    <span className="button-icon">📥</span>
                    Export
                </button>

                <button
                    className="header-button dark-mode-toggle"
                    onClick={handleToggleDarkMode}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    <span className="button-icon">{isDarkMode ? '☀️' : '🌙'}</span>
                    {isDarkMode ? 'Light' : 'Dark'}
                </button>

                <button className="header-button" onClick={handleRecenter} title="Recenter poem">
                    <span className="button-icon">🎯</span>
                    Recenter
                </button>

                <div className="zoom-controls">
                    <button className="zoom-button" onClick={handleZoomOut} title="Zoom Out">
                        −
                    </button>
                    <span className="zoom-level">{Math.round(viewState.camera.zoom * 100)}%</span>
                    <button className="zoom-button" onClick={handleZoomIn} title="Zoom In">
                        +
                    </button>
                    <button className="zoom-reset" onClick={handleZoomReset} title="Reset Zoom">
                        ↺
                    </button>
                </div>
            </div>
        </header>
    );
}
