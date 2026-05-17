import { ArrowRight, ChevronDown } from "lucide-react";
import type { AppLink } from "@repo/ui";

interface HeroProps {
  onExploreTools: () => void;
  apps: AppLink[];
}

export default function Hero({ onExploreTools, apps }: HeroProps) {
  const toolCountLabel =
    apps.length === 0
      ? "Free forever"
      : `${apps.length} ${apps.length === 1 ? "tool" : "tools"} · Free forever`;

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden gradient-hero">
      {/* Decorative light orbs */}
      <div
        className="absolute top-0 left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%)", filter: "blur(40px)" }}
      />
      <div
        className="absolute bottom-[10%] right-[5%] w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", filter: "blur(60px)" }}
      />

      {/* Fade to background at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative container mx-auto px-4 sm:px-6 py-24 text-center">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-8 animate-fade-in"
          style={{
            background: "rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(255,255,255,0.28)",
            backdropFilter: "blur(8px)",
            animationDelay: "0ms",
          }}
        >
          {toolCountLabel}
        </div>

        <h1
          className="font-display font-extrabold text-white mb-6 animate-fade-in-up"
          style={{
            fontSize: "clamp(2.75rem, 7vw, 5rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            textShadow: "0 2px 24px rgba(0,0,0,0.18)",
            animationDelay: "80ms",
          }}
        >
          Learn Deeper.
          <br />
          Remember More.
        </h1>

        <p
          className="max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up"
          style={{
            fontSize: "clamp(1.05rem, 2.5vw, 1.2rem)",
            color: "rgba(255,255,255,0.80)",
            animationDelay: "180ms",
          }}
        >
          Scholium brings together focused learning tools — built on how your
          memory actually works, not on how apps keep you scrolling.
        </p>

        <div
          className="flex items-center justify-center animate-fade-in-up"
          style={{ animationDelay: "260ms" }}
        >
          <button
            onClick={onExploreTools}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              background: "rgba(255,255,255,0.92)",
              color: "hsl(var(--primary))",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            Explore the Tools
            <ArrowRight size={16} />
          </button>
        </div>

        {/* App preview chips */}
        {apps.length > 0 && (
          <div
            className="flex items-center justify-center gap-3 mt-10 flex-wrap animate-fade-in"
            style={{ animationDelay: "360ms" }}
          >
            {apps.map((app) => (
              <span
                key={app.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.80)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {app.icon ? <span>{app.icon}</span> : null} {app.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scroll hint */}
      <button
        onClick={onExploreTools}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-50 hover:opacity-90 transition-opacity"
        aria-label="Scroll to tools"
        style={{ color: "white" }}
      >
        <ChevronDown size={24} />
      </button>
    </section>
  );
}
