import { useNavigate } from "react-router-dom";
import { SettingsLayout, SettingsCard } from "@repo/ui";
import { useDarkMode } from "@repo/hooks";
import "@repo/ui/settings-layout.css";
import "@repo/ui/settings-card.css";

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
        icon="📚"
        title="About Past Papers"
        description="Browse topical papers and mark schemes by subject, component, and chapter. Content is read-only and updated as new papers are added."
      />
    </SettingsLayout>
  );
}
