import { useState } from "react";
import { Laptop } from "lucide-react";

const OVERRIDE_KEY = "mock-space:allow-touch";

/**
 * Mock Space refuses touch devices by default.
 *
 * A virtual keyboard's autocorrect rewrites the word you just typed by firing
 * `insertReplacementText`, and swipe-typing inserts whole words the same way. The
 * append-only editor must refuse those events, so on a phone autocorrect would
 * simply appear broken — and the student would not know which of their words had
 * silently failed to change.
 *
 * The override exists because `pointer: coarse` also matches a touchscreen laptop,
 * where a real keyboard is attached and everything works.
 */
export default function DesktopGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(
    () =>
      typeof window === "undefined" ||
      sessionStorage.getItem(OVERRIDE_KEY) === "1" ||
      !window.matchMedia("(pointer: coarse)").matches,
  );

  if (allowed) return <>{children}</>;

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6 text-center">
      <div>
        <Laptop size={30} className="mx-auto text-muted-foreground" />
        <h1 className="mt-5 font-display text-2xl font-bold">Use a physical keyboard</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Mock Space stops you from going back and rewording an answer. Phone keyboards
          rewrite words as you type &mdash; autocorrect, swipe-typing &mdash; and the editor
          has to block that, so typing here would feel broken.
        </p>
        <button
          onClick={() => {
            sessionStorage.setItem(OVERRIDE_KEY, "1");
            setAllowed(true);
          }}
          className="mt-6 text-xs font-semibold text-primary underline underline-offset-4"
        >
          I have a keyboard attached &mdash; continue anyway
        </button>
      </div>
    </main>
  );
}
