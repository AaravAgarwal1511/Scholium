import { useEffect, useCallback, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { useProject } from '../../contexts/ProjectContext';
import { RichTextToolbar } from './RichTextToolbar.tsx';
import { getTextSelection, generateHighlightId } from '../../utils/textSelection';
import { calculateNewNotePosition } from '../../utils/layoutAlgorithm';
import { PoetHighlight } from './PoetHighlight';
import { v4 as uuidv4 } from 'uuid';
import './PoemEditor.css';

interface PoemEditorProps {
    onEditorRef: (ref: HTMLDivElement | null) => void;
}

const COLOR_PALETTE = [
    '#e94560', // Rose
    '#ffc107', // Amber
    '#4cc9f0', // Sky Blue
    '#7209b7', // Purple
    '#4361ee', // Royal Blue
    '#4caf50', // Green
    '#ff9f1c', // Orange
    '#f72585', // Neon Pink
    '#00f5d4', // Teal
    '#fee440', // Yellow
];

export function PoemEditor({ onEditorRef }: PoemEditorProps) {
    const { project, dispatch, viewState, setViewState } = useProject();
    const [showCreateNote, setShowCreateNote] = useState(false);
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    // Container-local position of the floating "+ Note" button. Derived from the
    // selection rect at capture time (an event callback, where reading the
    // container ref is legal) rather than during render.
    const [selectionButtonPos, setSelectionButtonPos] = useState<{ left: number; top: number } | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isCleaningUpRef = useRef(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                code: false,
                blockquote: false,
                bulletList: false,
                orderedList: false,
                listItem: false,
                horizontalRule: false,
            }),
            TextAlign.configure({
                types: ['paragraph'],
                alignments: ['left', 'center', 'right'],
            }),
            PoetHighlight,
        ],
        content: project.poem.content || '<p></p>',
        onUpdate: ({ editor }) => {
            dispatch({ type: 'UPDATE_POEM_CONTENT', payload: editor.getHTML() });
        },
        onSelectionUpdate: ({ editor }) => {
            if (isCleaningUpRef.current) return;

            const { from, to } = editor.state.selection;
            const isCollapsed = from === to;

            if (isCollapsed) {
                setShowCreateNote(false);
                setSelectionRect(null);
                return;
            }

            // Check if selection contains existing highlights
            let hasHighlight = false;
            editor.state.doc.nodesBetween(from, to, (node) => {
                if (node.marks.some(m => m.type.name === 'poetHighlight')) {
                    hasHighlight = true;
                }
            });

            if (hasHighlight) {
                setShowCreateNote(false);
                setSelectionRect(null);
                return;
            }

            // Get selection rectangle for positioning
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Guard against invalid/zero rects (happens during some deletions or rapid updates)
                if (rect.width === 0 && rect.height === 0) {
                    setShowCreateNote(false);
                    setSelectionRect(null);
                    return;
                }

                const containerRect = editorContainerRef.current?.getBoundingClientRect();
                setSelectionRect(rect);
                setSelectionButtonPos({
                    left: rect.right - (containerRect?.left || 0) + 10,
                    top: rect.top - (containerRect?.top || 0) + rect.height / 2 - 16,
                });
                setShowCreateNote(true);
            }
        },
        editorProps: {
            attributes: {
                class: 'poem-editor-content',
                spellcheck: 'false',
            },
            // Handle pointer events for inverse hover
            handleDOMEvents: {
                mouseover: (_view, event) => {

                    const target = event.target as HTMLElement;
                    const highlight = target.closest('.poet-highlight');
                    if (highlight) {
                        const ids = (highlight.getAttribute('data-highlight-id') || '').split(',');
                        // Find the note ID for these highlight IDs
                        // For simplicity, we take the first matching note
                        const note = project.notes.find(n => n.textReferences.some(r => ids.includes(r)));
                        if (note) {
                            setViewState(prev => ({ ...prev, hoveredNoteId: note.id }));
                        }
                    } else {
                        setViewState(prev => ({ ...prev, hoveredNoteId: null }));
                    }
                    return false;
                },
                mouseleave: () => {
                    setViewState(prev => ({ ...prev, hoveredNoteId: null }));
                    return false;
                }
            }
        },
    });

    // ... (sync logic stays the same) ...
    useEffect(() => {
        if (editor && project.poem.content && editor.getHTML() !== project.poem.content) {
            editor.commands.setContent(DOMPurify.sanitize(project.poem.content));
        }
    }, [editor, project.poem.content]);

    // Handle text selection - simplified as logic moved to onSelectionUpdate
    const handleMouseUp = useCallback(() => {
        // We still need this to trigger onSelectionUpdate if TipTap doesn't catch it
        // but TipTap usually does.
    }, []);

    // Cleanup: Remove highlight marks from editor if they no longer exist in project state (deleted notes)
    useEffect(() => {
        if (!editor || !project.poem.highlights) return;

        isCleaningUpRef.current = true;
        const validIds = project.poem.highlights.map(h => h.id);

        // Find all data-highlight-id spans and check if they should be stripped
        editor.state.doc.descendants((node, pos) => {
            const mark = node.marks.find(m => m.type.name === 'poetHighlight');
            if (mark) {
                const ids = (mark.attrs.id || '').split(',');
                const filteredIds = ids.filter((id: string) => validIds.includes(id));

                if (filteredIds.length === 0) {
                    // Strip the mark entirely
                    editor.chain().setTextSelection({ from: pos, to: pos + node.nodeSize }).unsetPoetHighlight().run();
                } else if (filteredIds.length !== ids.length) {
                    // Update attribute with remaining IDs
                    editor.chain().setTextSelection({ from: pos, to: pos + node.nodeSize }).setPoetHighlight({ id: filteredIds.join(',') }).run();
                }

            }
        });

        // Use setTimeout to allow the selection updates to flush before enabling checks again
        setTimeout(() => {
            isCleaningUpRef.current = false;
        }, 0);

    }, [project.poem.highlights, editor]);


    // Create note from selection
    const handleCreateNote = useCallback(() => {
        if (!editorContainerRef.current || !editor) return;

        const selectionInfo = getTextSelection(editorContainerRef.current);
        if (!selectionInfo) return;

        const highlightId = generateHighlightId();
        const color = COLOR_PALETTE[project.notes.length % COLOR_PALETTE.length];

        // Find existing highlights in the selection and merge IDs
        const { from, to } = editor.state.selection;
        let mergedId = highlightId;

        editor.state.doc.nodesBetween(from, to, (node) => {
            const mark = node.marks.find(m => m.type.name === 'poetHighlight');
            if (mark && mark.attrs.id) {
                const existingIds = mark.attrs.id.split(',');
                if (!existingIds.includes(highlightId)) {
                    mergedId = [...new Set([...existingIds, highlightId])].join(',');
                }
            }
        });

        // Apply the highlight mark with merged IDs and color
        editor.chain().setPoetHighlight({ id: mergedId, color }).run();

        // Create highlight object
        const highlight = {
            id: highlightId,
            lineIndex: selectionInfo.lineIndex,
            startOffset: selectionInfo.startOffset,
            endOffset: selectionInfo.endOffset,
            text: selectionInfo.text,
            noteIds: [] as string[],
        };

        // ... (note creation and dispatch - adding color to note if needed for UI)
        // Actually the color is in the mark, but we could put it in the note too if we want the note border to match.
        // Let's assume the user just wants different colors for text highlights.

        // Calculate note position in canvas space (divide screen-offset by zoom)
        const canvasRect = document.querySelector('.notes-panel')?.getBoundingClientRect() || null;
        const rawPosition = calculateNewNotePosition(project.notes, selectionRect, canvasRect);
        const zoom = viewState.camera.zoom;
        const position = { x: rawPosition.x, y: rawPosition.y / zoom };

        // Create note
        const now = new Date().toISOString();
        const noteId = uuidv4();
        const note = {
            id: noteId,
            content: '',
            position,
            textReferences: [highlightId],
            linkedNotes: [],
            createdAt: now,
            lastModified: now,
        };

        highlight.noteIds = [noteId];

        dispatch({ type: 'ADD_HIGHLIGHT', payload: highlight });
        dispatch({ type: 'ADD_NOTE', payload: note });

        setShowCreateNote(false);
        setSelectionRect(null);
        window.getSelection()?.removeAllRanges();
        setViewState(prev => ({
            ...prev,
            selectedNoteId: noteId,
            linkingFromNoteId: null
        }));
    }, [editor, project.notes, selectionRect, viewState.camera.zoom, dispatch, setViewState]);

    // Link selection to existing note
    const handleLinkToNote = useCallback(() => {
        if (!editorContainerRef.current || !editor || !viewState.linkingFromNoteId) return;

        const selectionInfo = getTextSelection(editorContainerRef.current);
        if (!selectionInfo) return;

        const highlightId = generateHighlightId();

        // Find the color of the note we are linking to, or use its existing color if any
        const sourceNote = project.notes.find(n => n.id === viewState.linkingFromNoteId);
        if (!sourceNote) return;

        // Find color from first highlight if available
        let color = COLOR_PALETTE[0];
        if (sourceNote.textReferences.length > 0) {
            // Colors are in the editor marks, so we'll just use the default or next in palette for now
            color = COLOR_PALETTE[project.notes.indexOf(sourceNote) % COLOR_PALETTE.length];
        }

        // Apply the highlight mark
        editor.chain().setPoetHighlight({ id: highlightId, color }).run();

        // Create highlight object
        const highlight = {
            id: highlightId,
            lineIndex: selectionInfo.lineIndex,
            startOffset: selectionInfo.startOffset,
            endOffset: selectionInfo.endOffset,
            text: selectionInfo.text,
            noteIds: [viewState.linkingFromNoteId],
        };

        // Update note with new text reference
        dispatch({ type: 'ADD_HIGHLIGHT', payload: highlight });
        dispatch({ type: 'UPDATE_NOTE_REFERENCES', payload: { id: viewState.linkingFromNoteId, highlightId } });

        setShowCreateNote(false);
        setSelectionRect(null);
        window.getSelection()?.removeAllRanges();
        setViewState(prev => ({ ...prev, linkingFromNoteId: null, selectedNoteId: sourceNote.id }));
    }, [editor, project, viewState.linkingFromNoteId, dispatch, setViewState]);



    // Pass editor ref to parent
    useEffect(() => {
        onEditorRef(editorContainerRef.current);
    }, [onEditorRef]);

    // Highlight text based on viewState
    useEffect(() => {
        if (!editorContainerRef.current) return;

        // Remove all previous hover classes
        const allHighlights = editorContainerRef.current.querySelectorAll('.poet-highlight');
        allHighlights.forEach(el => el.classList.remove('highlight-hovered'));

        // Find highlights that should be emphasized (hovered note)
        const hoveredNoteId = viewState.hoveredNoteId;
        if (hoveredNoteId) {
            const note = project.notes.find(n => n.id === hoveredNoteId);
            if (note) {
                note.textReferences.forEach(hId => {
                    // Use CSS selector to find elements where data-highlight-id contains the hId
                    const highlightEls = editorContainerRef.current?.querySelectorAll(`[data-highlight-id*="${hId}"]`);
                    highlightEls?.forEach(el => {
                        const ids = (el.getAttribute('data-highlight-id') || '').split(',');
                        if (ids.includes(hId)) {
                            el.classList.add('highlight-hovered');
                        }
                    });
                });
            }
        }
    }, [viewState.hoveredNoteId, project.notes]);



    return (
        <div className="poem-editor-wrapper" onMouseLeave={() => {
            // Optional: hide button when leaving editor
        }}>
            <RichTextToolbar editor={editor} />

            <div
                ref={editorContainerRef}
                className="poem-editor-container"
                onMouseUp={handleMouseUp}
            >
                <EditorContent editor={editor} />

                {showCreateNote && selectionButtonPos && (
                    <div
                        className="selection-buttons-container"
                        style={{
                            left: selectionButtonPos.left,
                            top: selectionButtonPos.top,
                        }}
                    >
                        <button
                            className="create-note-button"
                            onClick={handleCreateNote}
                        >
                            + Note
                        </button>

                        {viewState.linkingFromNoteId && (
                            <button
                                className="create-note-button link-selection-button"
                                onClick={handleLinkToNote}
                            >
                                + Link
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
