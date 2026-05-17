import { useEffect, useState } from "react";
import type { AppLink } from "@repo/ui";
import { supabase } from "@/integrations/supabase/client";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import AppGrid from "@/components/AppGrid";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function HomePage() {
  const [apps, setApps] = useState<AppLink[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    supabase
      .from("scholium_apps")
      .select("id, title, url, icon")
      .order("sort_order")
      .then(({ data }) => setApps((data ?? []) as AppLink[]))
      .finally(() => setLoadingApps(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1">
        <Hero onExploreTools={() => scrollTo("tools")} apps={apps} />
        <AppGrid apps={apps} loading={loadingApps} />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}
