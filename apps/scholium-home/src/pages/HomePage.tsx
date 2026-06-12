import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AppLink } from "@repo/ui";
import Hero from "@/components/Hero";
import PersonaSelector from "@/components/PersonaSelector";
import type { Persona } from "@/components/PersonaSelector";
import TrustStrip from "@/components/TrustStrip";
import SubjectPicker from "@/components/SubjectPicker";
import AppGrid from "@/components/AppGrid";
import FeaturesSection from "@/components/FeaturesSection";
import ClosingCTA from "@/components/ClosingCTA";
import Footer from "@/components/Footer";

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
  const [persona, setPersona] = useState<Persona | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get("highlight");

  useEffect(() => {
    const root = document.documentElement;
    if (persona === "teacher" || persona === "parent") {
      root.setAttribute("data-persona", persona);
    } else {
      root.removeAttribute("data-persona");
    }
    return () => {
      root.removeAttribute("data-persona");
    };
  }, [persona]);

  const handlePersonaSelect = useCallback((p: Persona | null) => {
    setPersona(p);
    if (p) {
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = window.setTimeout(() => {
        setSelectorVisible(false);
        dismissTimerRef.current = null;
      }, 380);
    } else {
      setSelectorVisible(true);
    }
  }, []);

  const handleChangePersona = useCallback(() => {
    setPersona(null);
    setSelectorVisible(true);
  }, []);

  const highlight = useCallback((id: string) => {
    setHighlightedAppId(id);
    requestAnimationFrame(() => scrollTo("tools"));
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
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const filteredApps = subjectFilter
    ? apps.filter((a) => subjectFilter.appIds.includes(a.id))
    : apps;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <Hero
          onScrollToAbout={() => scrollTo("why")}
          onExploreTools={() => scrollTo("tools")}
          apps={apps}
          persona={persona}
          onChangePersona={persona ? handleChangePersona : undefined}
          personaSelector={
            selectorVisible ? (
              <PersonaSelector
                selected={persona}
                onSelect={handlePersonaSelect}
                dismissing={persona !== null}
              />
            ) : undefined
          }
        />
        <TrustStrip />
        <FeaturesSection persona={persona} />
        <SubjectPicker apps={apps} onPick={handleSubjectPick} />
        <AppGrid
          apps={filteredApps}
          loading={loadingApps}
          highlightedAppId={highlightedAppId}
          subject={subjectFilter?.subject ?? null}
        />
        <ClosingCTA />
      </main>
      <Footer apps={apps} />
    </div>
  );
}
