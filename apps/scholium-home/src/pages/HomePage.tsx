import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScholiumFooter } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import Hero from "@/components/Hero";
import SubjectPicker from "@/components/SubjectPicker";
import AppGrid from "@/components/AppGrid";
import TrustStrip from "@/components/TrustStrip";
import InfoSection from "@/components/InfoSection";
import BackedBySection from "@/components/BackedBySection";
import ClosingCTA from "@/components/ClosingCTA";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

interface HomePageProps {
  apps: AppLink[];
  loadingApps: boolean;
}

interface SubjectFilter {
  subject: string;
  appIds: string[];
}

export default function HomePage({ apps, loadingApps }: HomePageProps) {
  const [highlightedAppId, setHighlightedAppId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get("highlight");

  const highlight = useCallback((id: string) => {
    setHighlightedAppId(id);
    // Scroll to the matching card. Scrolling to the section instead parks every
    // subject on the suite header, where the first card reads as the match.
    requestAnimationFrame(() => {
      const card = document.getElementById(`app-${id}`);
      if (card) card.scrollIntoView({ behavior: "smooth" });
      else scrollTo("tools");
    });
    if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setHighlightedAppId(null);
      clearTimerRef.current = null;
    }, 2800);
  }, []);

  const handleSubjectPick = useCallback(
    (subject: string, appIds: string[]) => {
      if (appIds.length === 1) {
        const app = apps.find((a) => a.id === appIds[0]);
        if (app) {
          window.location.href = app.url;
        }
        return;
      }
      setSubjectFilter({ subject, appIds });
      requestAnimationFrame(() => scrollTo("tools"));
    },
    [apps],
  );

  // React to ?highlight=<appId> changes (either initial load or in-app navigation).
  useEffect(() => {
    if (!target) return;
    if (!apps.some((a) => a.id === target)) return;
    highlight(target);
    const next = new URLSearchParams(searchParams);
    next.delete("highlight");
    setSearchParams(next, { replace: true });
  }, [target, apps, highlight, searchParams, setSearchParams]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const filteredApps = subjectFilter
    ? apps.filter((a) => subjectFilter.appIds.includes(a.id))
    : apps;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col" style={{ minHeight: "calc(100dvh - 3.5rem)" }}>
          <Hero
            onScrollToScience={() => scrollTo("science")}
            onExploreTools={() => scrollTo("tools")}
            apps={apps}
          />
        </div>
        {/* Subject-intent lead: the first question a revising visitor asks is
            "do you cover my subject?" — so the picker + suite come first, and
            the memory-science manifesto is demoted below them. */}
        <SubjectPicker apps={apps} onPick={handleSubjectPick} />
        <AppGrid
          apps={filteredApps}
          loading={loadingApps}
          highlightedAppId={highlightedAppId}
          subject={subjectFilter?.subject ?? null}
        />
        <TrustStrip apps={apps} />
        <InfoSection />
        <BackedBySection />
        <ClosingCTA apps={apps} />
      </main>
      <ScholiumFooter homeUrl="/" />
    </div>
  );
}
