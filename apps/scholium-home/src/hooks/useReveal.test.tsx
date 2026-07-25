import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useReveal } from "./useReveal";

/**
 * Scroll-triggered reveal. The one rule that matters for accessibility: content
 * must never be left hidden. So reduced-motion and a missing IntersectionObserver
 * both reveal immediately, and the observer path reveals on the first
 * intersection and then stops watching.
 */

// A controllable IntersectionObserver. `trigger()` fires the callback as the
// browser would when the element scrolls into view.
let observers: FakeObserver[] = [];
class FakeObserver {
    callback: IntersectionObserverCallback;
    observed: Element[] = [];
    disconnected = false;
    options?: IntersectionObserverInit;
    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = cb;
        this.options = options;
        observers.push(this);
    }
    observe(el: Element) {
        this.observed.push(el);
    }
    disconnect() {
        this.disconnected = true;
    }
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
        return [];
    }
    trigger(isIntersecting: boolean) {
        this.callback(
            [{ isIntersecting, target: this.observed[0] } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
        );
    }
}

function stubReducedMotion(reduce: boolean) {
    vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({
            matches: reduce,
            media: "(prefers-reduced-motion: reduce)",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
            onchange: null,
        }),
    );
}

// The hook only observes once it has a node, so the harness must render a real
// element and attach the ref.
function Probe(props: { threshold?: number; rootMargin?: string }) {
    const { ref, revealed } = useReveal<HTMLDivElement>(props);
    return (
        <div ref={ref} data-revealed={revealed}>
            content
        </div>
    );
}

const isRevealed = (c: HTMLElement) =>
    c.querySelector("div")!.getAttribute("data-revealed") === "true";

beforeEach(() => {
    observers = [];
    stubReducedMotion(false);
    vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the observer path", () => {
    it("starts hidden and observes the node", () => {
        const { container } = render(<Probe />);
        expect(isRevealed(container)).toBe(false);
        expect(observers).toHaveLength(1);
        expect(observers[0].observed).toHaveLength(1);
    });

    it("reveals on the first intersection", () => {
        const { container } = render(<Probe />);
        act(() => observers[0].trigger(true));
        expect(isRevealed(container)).toBe(true);
    });

    it("stays hidden while the element is out of view", () => {
        const { container } = render(<Probe />);
        act(() => observers[0].trigger(false));
        expect(isRevealed(container)).toBe(false);
    });

    it("stops observing once revealed, so it never toggles back", () => {
        const { container } = render(<Probe />);
        act(() => observers[0].trigger(true));
        expect(observers[0].disconnected).toBe(true);

        // A later "left the viewport" event must not un-reveal it.
        act(() => observers[0].trigger(false));
        expect(isRevealed(container)).toBe(true);
    });

    it("passes through threshold and rootMargin, with sensible defaults", () => {
        render(<Probe threshold={0.5} rootMargin="10px" />);
        expect(observers[0].options).toMatchObject({ threshold: 0.5, rootMargin: "10px" });

        observers = [];
        render(<Probe />);
        expect(observers[0].options).toMatchObject({
            threshold: 0.15,
            rootMargin: "0px 0px -10% 0px",
        });
    });

    it("disconnects on unmount", () => {
        const { unmount } = render(<Probe />);
        const observer = observers[0];
        unmount();
        expect(observer.disconnected).toBe(true);
    });
});

describe("content is never left hidden", () => {
    it("reveals immediately under prefers-reduced-motion, without observing", () => {
        stubReducedMotion(true);
        const { container } = render(<Probe />);
        expect(isRevealed(container)).toBe(true);
        expect(observers).toHaveLength(0);
    });

    it("reveals immediately when IntersectionObserver is unavailable", () => {
        vi.stubGlobal("IntersectionObserver", undefined);
        const { container } = render(<Probe />);
        expect(isRevealed(container)).toBe(true);
    });
});
