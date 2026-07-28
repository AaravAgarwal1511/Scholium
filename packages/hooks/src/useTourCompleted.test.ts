import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTourCompleted } from './useTourCompleted';

/**
 * Onboarding state is per-app (`scholium-onboarding-<appKey>`) because the six
 * apps are separate origins and do not share localStorage. The optional cloud
 * port is what carries it across devices; the package itself never imports a
 * data client, so it is injected.
 */

const KEY = 'scholium-onboarding-recall';

function cloudStub(loadResult: boolean | null) {
    return {
        load: vi.fn().mockResolvedValue(loadResult),
        save: vi.fn().mockResolvedValue(undefined),
        reset: vi.fn().mockResolvedValue(undefined),
    };
}

beforeEach(() => {
    localStorage.clear();
});

describe('local state', () => {
    it('starts incomplete for a new user', () => {
        expect(renderHook(() => useTourCompleted('recall')).result.current.completed).toBe(false);
    });

    it('reads a completed tour back from the app-scoped key', () => {
        localStorage.setItem(KEY, 'true');
        expect(renderHook(() => useTourCompleted('recall')).result.current.completed).toBe(true);
    });

    it('does not read another app key', () => {
        // The apps are separate origins; this also guards against a shared key
        // sneaking in and marking every app's tour done at once.
        localStorage.setItem('scholium-onboarding-language-hub', 'true');
        expect(renderHook(() => useTourCompleted('recall')).result.current.completed).toBe(false);
    });

    it('complete() persists under the app key', async () => {
        const { result } = renderHook(() => useTourCompleted('recall'));
        await act(() => result.current.complete());
        expect(result.current.completed).toBe(true);
        expect(localStorage.getItem(KEY)).toBe('true');
    });

    it('reset() clears it', async () => {
        localStorage.setItem(KEY, 'true');
        const { result } = renderHook(() => useTourCompleted('recall'));
        await act(() => result.current.reset());
        expect(result.current.completed).toBe(false);
        expect(localStorage.getItem(KEY)).toBeNull();
    });
});

describe('cloud sync', () => {
    it('adopts a tour completed on another device', async () => {
        const cloud = cloudStub(true);
        const { result } = renderHook(() => useTourCompleted('recall', cloud));

        await waitFor(() => expect(result.current.completed).toBe(true));
        expect(cloud.load).toHaveBeenCalledTimes(1);
        // Written through, so the next mount needs no round trip.
        expect(localStorage.getItem(KEY)).toBe('true');
    });

    it('stays incomplete when the cloud has nothing', async () => {
        const cloud = cloudStub(null);
        const { result } = renderHook(() => useTourCompleted('recall', cloud));

        await waitFor(() => expect(cloud.load).toHaveBeenCalled());
        expect(result.current.completed).toBe(false);
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    it('does not consult the cloud when already complete locally', async () => {
        localStorage.setItem(KEY, 'true');
        const cloud = cloudStub(true);
        renderHook(() => useTourCompleted('recall', cloud));

        // Nothing to learn: local completion already wins, so the round trip is
        // skipped on every mount after the first.
        await new Promise((r) => setTimeout(r, 20));
        expect(cloud.load).not.toHaveBeenCalled();
    });

    it('pushes completion to the cloud', async () => {
        const cloud = cloudStub(null);
        const { result } = renderHook(() => useTourCompleted('recall', cloud));
        await act(() => result.current.complete());
        expect(cloud.save).toHaveBeenCalledTimes(1);
    });

    it('still completes locally when the cloud save fails', async () => {
        // A dead endpoint must not make the tour replay forever.
        const cloud = cloudStub(null);
        cloud.save.mockRejectedValue(new Error('offline'));

        const { result } = renderHook(() => useTourCompleted('recall', cloud));
        await act(() => result.current.complete());

        expect(result.current.completed).toBe(true);
        expect(localStorage.getItem(KEY)).toBe('true');
    });

    it('reset() clears the cloud too', async () => {
        localStorage.setItem(KEY, 'true');
        const cloud = cloudStub(true);
        const { result } = renderHook(() => useTourCompleted('recall', cloud));
        await act(() => result.current.reset());
        expect(cloud.reset).toHaveBeenCalledTimes(1);
    });
});
