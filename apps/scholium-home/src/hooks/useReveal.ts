import { useEffect, useRef, useState } from "react";

/**
 * Scroll-triggered reveal. Returns a ref to attach to the element and a
 * `revealed` flag that flips true the first time the element scrolls into view.
 *
 * Respects prefers-reduced-motion: when the user asks for reduced motion (or the
 * browser lacks IntersectionObserver), the element is revealed immediately so
 * content is never left hidden.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
  rootMargin?: string;
}) {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        threshold: options?.threshold ?? 0.15,
        rootMargin: options?.rootMargin ?? "0px 0px -10% 0px",
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin]);

  return { ref, revealed };
}
