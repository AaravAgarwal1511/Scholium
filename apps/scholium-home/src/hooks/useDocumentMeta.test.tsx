import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useDocumentMeta } from "./useDocumentMeta";

/**
 * Best-effort SPA metadata. It sets the title and a few OG/SEO tags while a page
 * is mounted and restores the title on unmount. The behaviour worth pinning is
 * the create-vs-reuse split: a tag the document lacks is created once, and a tag
 * it already has is updated in place rather than duplicated.
 */

function Meta(props: { title: string; description?: string; canonicalPath?: string }) {
    useDocumentMeta(props);
    return null;
}

const metaContent = (selector: string) =>
    document.head.querySelector<HTMLMetaElement>(selector)?.getAttribute("content");

beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "Scholium";
});

afterEach(() => {
    cleanup();
});

describe("title", () => {
    it("sets the document title while mounted", () => {
        render(<Meta title="About · Scholium" />);
        expect(document.title).toBe("About · Scholium");
    });

    it("restores the previous title on unmount", () => {
        document.title = "Home";
        const { unmount } = render(<Meta title="About · Scholium" />);
        unmount();
        expect(document.title).toBe("Home");
    });

    it("always sets og:title to the current title", () => {
        render(<Meta title="Memory Science" />);
        expect(metaContent('meta[property="og:title"]')).toBe("Memory Science");
    });
});

describe("description", () => {
    it("writes description and og:description when provided", () => {
        render(<Meta title="About" description="How Scholium works" />);
        expect(metaContent('meta[name="description"]')).toBe("How Scholium works");
        expect(metaContent('meta[property="og:description"]')).toBe("How Scholium works");
    });

    it("writes no description tags when none is given", () => {
        render(<Meta title="About" />);
        expect(document.head.querySelector('meta[name="description"]')).toBeNull();
        expect(document.head.querySelector('meta[property="og:description"]')).toBeNull();
    });
});

describe("create vs reuse", () => {
    it("reuses an existing meta tag instead of adding a second", () => {
        // index.html already ships a description tag; the hook must overwrite it,
        // not append a duplicate the crawler then sees twice.
        const existing = document.createElement("meta");
        existing.setAttribute("name", "description");
        existing.setAttribute("content", "old");
        document.head.appendChild(existing);

        render(<Meta title="About" description="new" />);

        const all = document.head.querySelectorAll('meta[name="description"]');
        expect(all).toHaveLength(1);
        expect(all[0].getAttribute("content")).toBe("new");
    });

    it("creates the canonical link when absent and reuses it when present", () => {
        const { unmount } = render(<Meta title="About" canonicalPath="/about" />);
        let links = document.head.querySelectorAll('link[rel="canonical"]');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute("href")).toBe(`${window.location.origin}/about`);

        // Re-render for another route: still one link, updated in place.
        unmount();
        render(<Meta title="Memory" canonicalPath="/memory-science" />);
        links = document.head.querySelectorAll('link[rel="canonical"]');
        expect(links).toHaveLength(1);
        expect(links[0].getAttribute("href")).toBe(`${window.location.origin}/memory-science`);
    });

    it("adds no canonical link when no path is given", () => {
        render(<Meta title="About" />);
        expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    });
});

describe("reacting to prop changes", () => {
    it("updates the title when the prop changes", () => {
        const { rerender } = render(<Meta title="First" />);
        expect(document.title).toBe("First");
        rerender(<Meta title="Second" />);
        expect(document.title).toBe("Second");
        expect(metaContent('meta[property="og:title"]')).toBe("Second");
    });
});
