import { useRef, useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import type { Note as NoteType } from '../../types';
import './Note.css';

interface NoteProps {
    note: NoteType;
    zoom: number;
    isSelected: boolean;
    isHovered: boolean;
    isLinkSource: boolean;
    isLinkTarget: boolean;
    onClick: () => void;
    onHover: (hovering: boolean) => void;
    onStartLink: () => void;
    onPositionChange: (x: number, y: number) => void;
    onContentChange: (content: string) => void;
    onAddConnectedNote: () => void;
    onDelete: () => void;
    onToggleCollapse?: () => void;
    onWidthChange?: (width: number) => void;
}

export function Note({
    note,
    zoom,
    isSelected,
    isHovered,
    isLinkSource,
    isLinkTarget,
    onClick,
    onHover,
    onStartLink,
    onAddConnectedNote,
    onPositionChange,
    onContentChange,
    onDelete,
    onToggleCollapse,
    onWidthChange,
}: NoteProps) {
    const noteRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [localContent, setLocalContent] = useState(note.content);

    // Sync local content with prop. Adjusting state during render is React's
    // documented alternative to a setState effect: it re-renders before children
    // see the stale value, without a second commit.
    const [syncedContent, setSyncedContent] = useState(note.content);
    if (syncedContent !== note.content) {
        setSyncedContent(note.content);
        setLocalContent(note.content);
    }

    // Auto-focus new notes
    useEffect(() => {
        if (isSelected && textareaRef.current && note.content === '') {
            // Force focus with a small timeout to ensure the element is ready and other events have cleared
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    textareaRef.current.setSelectionRange(0, 0);
                }
            }, 10);
        }
    }, [isSelected, note.content]);


    // Handle drag start
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).tagName === 'TEXTAREA' ||
            (e.target as HTMLElement).tagName === 'BUTTON') {
            return;
        }

        const canvas = noteRef.current?.closest('.notes-canvas');
        const canvasRect = canvas?.getBoundingClientRect() || { left: 0, top: 0 };
        const localX = (e.clientX - canvasRect.left) / zoom;
        const localY = (e.clientY - canvasRect.top) / zoom;

        e.preventDefault();
        setIsDragging(true);
        setDragOffset({
            x: localX - note.position.x,
            y: localY - note.position.y,
        });
    }, [note.position, zoom]);

    // Handle dragging
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const canvas = noteRef.current?.closest('.notes-canvas');
            const canvasRect = canvas?.getBoundingClientRect() || { left: 0, top: 0 };
            const localX = (e.clientX - canvasRect.left) / zoom;
            const localY = (e.clientY - canvasRect.top) / zoom;

            const newX = localX - dragOffset.x;
            const newY = localY - dragOffset.y;
            onPositionChange(newX, newY);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset, onPositionChange, zoom]);

    // Handle resizing
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeStartX(e.clientX);
        setResizeStartWidth(note.width || 220);
    }, [note.width]);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = (e.clientX - resizeStartX) / zoom;
            const newWidth = Math.max(150, resizeStartWidth + deltaX);
            if (onWidthChange) {
                onWidthChange(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStartX, resizeStartWidth, zoom, onWidthChange]);

    // Handle content change with debounce
    const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setLocalContent(e.target.value);
    };

    const handleContentBlur = () => {
        if (localContent !== note.content) {
            onContentChange(localContent);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [localContent]);

    const classNames = [
        'note',
        isSelected && 'selected',
        isHovered && 'hovered',
        isLinkSource && 'link-source',
        isLinkTarget && 'link-target',
        isDragging && 'dragging',
        note.isCollapsed && 'collapsed',
        `note-type-${note.type || 'default'}`,
    ].filter(Boolean).join(' ');

    const getNoteTitle = () => {
        if (note.type === 'context') return 'Context';
        if (note.type === 'personal-response') return 'Personal Response';
        return null;
    };

    const noteTitle = getNoteTitle();

    return (
        <div
            id={`note-${note.id}`}
            ref={noteRef}
            className={classNames}
            style={{
                left: note.position.x,
                top: note.position.y,
                width: note.width || 220,
            }}
            onClick={onClick}
            onMouseDown={handleMouseDown}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
        >
            <div className="note-header">
                <div className="note-drag-handle" title="Drag to move">
                    {noteTitle ? <span className="note-title">{noteTitle}</span> : '⋮⋮'}
                </div>
                <div className="note-actions">
                    {(onToggleCollapse && note.type) && (
                        <button
                            className="note-action-button collapse-button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleCollapse();
                            }}
                            title={note.isCollapsed ? "Expand" : "Collapse"}
                        >
                            {note.isCollapsed ? '▼' : '▲'}
                        </button>
                    )}
                    {!note.type && (
                        <>
                            <button
                                className="note-action-button link-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onStartLink();
                                }}
                                title="Link to another note"
                            >
                                🔗
                            </button>
                            <button
                                className="note-action-button add-note-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddConnectedNote();
                                }}
                                title="Add connected note"
                            >
                                ➕
                            </button>
                            <button
                                className="note-action-button delete-button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                title="Delete note"
                            >
                                ×
                            </button>
                        </>
                    )}
                </div>
            </div>

            {!note.isCollapsed && (
                <textarea
                    ref={textareaRef}
                    className="note-content"
                    value={localContent}
                    onChange={handleContentChange}
                    onBlur={handleContentBlur}
                    placeholder={note.type ? `Add your ${noteTitle?.toLowerCase()}...` : "Add your note..."}
                    onClick={(e) => e.stopPropagation()}
                />
            )}

            {note.linkedNotes.length > 0 && (
                <div className="note-links-count">
                    {note.linkedNotes.length} link{note.linkedNotes.length !== 1 ? 's' : ''}
                </div>
            )}

            <div
                className="note-resize-handle"
                onMouseDown={handleResizeMouseDown}
            />
        </div>
    );
}
