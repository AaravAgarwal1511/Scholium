import { useNavigate } from "react-router-dom";
import { SettingsLayout, SettingsCard } from "@repo/ui";
import { useDarkMode } from "@repo/hooks";
import "@repo/ui/settings-layout.css";
import "@repo/ui/settings-card.css";
import { PAPER_RETENTION_DAYS } from "@/lib/paperRetention";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();

  return (
    <SettingsLayout onBack={() => navigate(-1)}>
      <SettingsCard
        icon="🌙"
        title="Dark Mode"
        description="Toggle between light and dark theme"
        action={
          <button
            className="rui-toggle"
            role="switch"
            aria-pressed={isDark}
            onClick={toggle}
            aria-label="Toggle dark mode"
          />
        }
      />

      <SettingsCard
        icon="📄"
        title="About Mock Space"
        description="Sit a past paper under exam conditions. Typing is append-only — you cannot move the cursor back into text you have already written, and the only way to retract an answer is to cross it out. Export a flattened PDF when you are done."
      />

      <SettingsCard
        icon="💾"
        title="Where your papers live"
        description={`Everything — the question paper, your answers, your crossings-out and the clock — is stored in your Scholium account, not in this browser. Sign in anywhere and your papers are there. Attempts are deleted automatically ${PAPER_RETENTION_DAYS} days after you start them, so export anything you want to keep.`}
      />
    </SettingsLayout>
  );
}
