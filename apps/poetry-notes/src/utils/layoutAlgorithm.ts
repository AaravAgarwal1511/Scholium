// Layout algorithm for positioning notes around the poem

import type { Note, NotePosition } from '../types';

interface LayoutConfig {
    canvasWidth: number;
    canvasHeight: number;
    noteWidth: number;
    noteHeight: number;
    padding: number;
    startX: number;
    startY: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
    canvasWidth: 600,
    canvasHeight: 800,
    noteWidth: 200,
    noteHeight: 120,
    padding: 20,
    startX: 50,
    startY: 50,
};

/**
 * Calculate positions for notes to avoid overlapping
 * Uses a simple grid-based approach with collision detection
 */
export function calculateNotePositions(
    notes: Note[],
    config: Partial<LayoutConfig> = {}
): Map<string, NotePosition> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const positions = new Map<string, NotePosition>();
    const occupiedAreas: { x: number; y: number; width: number; height: number }[] = [];

    // Calculate columns and rows available
    const cols = Math.floor((cfg.canvasWidth - cfg.startX) / (cfg.noteWidth + cfg.padding));
    const maxCols = Math.max(cols, 1);

    notes.forEach((note, index) => {
        // If note already has a position, use it
        if (note.position.x !== 0 || note.position.y !== 0) {
            positions.set(note.id, note.position);
            occupiedAreas.push({
                x: note.position.x,
                y: note.position.y,
                width: cfg.noteWidth,
                height: cfg.noteHeight,
            });
            return;
        }

        // Calculate grid position
        const col = index % maxCols;
        const row = Math.floor(index / maxCols);

        let x = cfg.startX + col * (cfg.noteWidth + cfg.padding);
        let y = cfg.startY + row * (cfg.noteHeight + cfg.padding);

        // Check for collisions and adjust
        let attempts = 0;
        while (hasCollision(x, y, cfg.noteWidth, cfg.noteHeight, occupiedAreas) && attempts < 50) {
            // Try moving down
            y += cfg.noteHeight + cfg.padding;

            // If we go off screen, try next column
            if (y + cfg.noteHeight > cfg.canvasHeight) {
                y = cfg.startY;
                x += cfg.noteWidth + cfg.padding;
            }
            attempts++;
        }

        const position = { x, y };
        positions.set(note.id, position);
        occupiedAreas.push({
            x,
            y,
            width: cfg.noteWidth,
            height: cfg.noteHeight,
        });
    });

    return positions;
}

/**
 * Check if a position collides with any occupied area
 */
function hasCollision(
    x: number,
    y: number,
    width: number,
    height: number,
    occupiedAreas: { x: number; y: number; width: number; height: number }[]
): boolean {
    for (const area of occupiedAreas) {
        if (
            x < area.x + area.width &&
            x + width > area.x &&
            y < area.y + area.height &&
            y + height > area.y
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Calculate the best position for a new note near a highlight
 */
export function calculateNewNotePosition(
    existingNotes: Note[],
    highlightRect: DOMRect | null,
    canvasRect: DOMRect | null
): NotePosition {
    const config = { ...DEFAULT_CONFIG };

    if (canvasRect) {
        config.canvasWidth = canvasRect.width;
        config.canvasHeight = canvasRect.height;
    }

    // Start position based on highlight if available
    const startX = config.startX;
    let startY = config.startY;

    if (highlightRect && canvasRect) {
        // Position note to the right of the highlight
        startY = highlightRect.top - canvasRect.top;
    }

    // Find a position that doesn't overlap with existing notes
    const occupiedAreas = existingNotes.map(note => ({
        x: note.position.x,
        y: note.position.y,
        width: config.noteWidth,
        height: config.noteHeight,
    }));

    let x = startX;
    let y = startY;
    let attempts = 0;

    while (hasCollision(x, y, config.noteWidth, config.noteHeight, occupiedAreas) && attempts < 100) {
        y += config.noteHeight + config.padding;

        if (y + config.noteHeight > config.canvasHeight) {
            y = config.startY;
            x += config.noteWidth + config.padding;
        }
        attempts++;
    }

    return { x, y };
}

/**
 * Recalculate all positions when canvas size changes
 */
export function recalculateLayout(
    notes: Note[],
    canvasWidth: number,
    canvasHeight: number
): Map<string, NotePosition> {
    return calculateNotePositions(notes, {
        canvasWidth,
        canvasHeight,
    });
}