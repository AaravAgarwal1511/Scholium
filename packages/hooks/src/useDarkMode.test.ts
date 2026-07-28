import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDarkMode } from './useDarkMode';

/**
 * Every app gets dark mode for free by mounting ScholiumNavbar, which calls this
 * hook — so a regression here goes six ways at once. The two classes matter: apps
 * style against `dark` (Tailwind) and `dark-mode` (poetry-notes' own CSS), and
 * dropping either leaves half a theme applied.
 */

/** Stubs matchMedia, which jsdom does not implement. */
function stubPrefersDark(prefersDark: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockReturnValue({
            matches: prefersDark,
            media: '(prefers-color-scheme: dark)',
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
            onchange: null,
        }),
    );
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    stubPrefersDark(false);
});

describe('initial state', () => {
    it('follows the system preference when nothing is stored', () => {
        stubPrefersDark(true);
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(true);
    });

    it('stays light when the system prefers light', () => {
        stubPrefersDark(false);
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(false);
    });

    it('prefers a stored choice over the system preference', () => {
        stubPrefersDark(true);
        localStorage.setItem('darkMode', 'false');
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(false);
    });

    it('honours a stored true even when the system prefers light', () => {
        stubPrefersDark(false);
        localStorage.setItem('darkMode', 'true');
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(true);
    });

    it('falls back to light rather than throwing on a corrupt stored value', () => {
        localStorage.setItem('darkMode', 'not json');
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(false);
    });
});

describe('applying the theme', () => {
    it('adds both theme classes when dark', () => {
        localStorage.setItem('darkMode', 'true');
        renderHook(() => useDarkMode());
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('dark-mode')).toBe(true);
    });

    it('removes both theme classes when light', () => {
        document.documentElement.classList.add('dark', 'dark-mode');
        localStorage.setItem('darkMode', 'false');
        renderHook(() => useDarkMode());
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(document.documentElement.classList.contains('dark-mode')).toBe(false);
    });
});

describe('toggle', () => {
    it('flips the state and the classes', () => {
        const { result } = renderHook(() => useDarkMode());
        expect(result.current.isDark).toBe(false);

        act(() => result.current.toggle());
        expect(result.current.isDark).toBe(true);
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        act(() => result.current.toggle());
        expect(result.current.isDark).toBe(false);
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists the choice so a reload keeps it', () => {
        const { result } = renderHook(() => useDarkMode());
        act(() => result.current.toggle());
        expect(localStorage.getItem('darkMode')).toBe('true');

        // A fresh mount reads it back rather than re-consulting the system.
        stubPrefersDark(false);
        expect(renderHook(() => useDarkMode()).result.current.isDark).toBe(true);
    });
});
