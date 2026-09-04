import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsLayout, SettingsCard } from "@repo/ui";
import { useDarkMode } from "@repo/hooks";
import { useAnalytics } from "@repo/analytics";
import "@repo/ui/settings-layout.css";
import "@repo/ui/settings-card.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark, toggle } = useDarkMode();
  const { isOptedOut, setOptOut } = useAnalytics();
  const [shareAnalytics, setShareAnalytics] = useState(() => !isOptedOut());
  const toggleAnalytics = () => {
    const next = !shareAnalytics;
    setShareAnalytics(next);
    setOptOut(!next);
  };

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
        icon="📊"
        title="Usage analytics"
        description="Help improve Scholium by sharing anonymous usage data. We never collect the content you create, and you can turn this off anytime."
        action={
          <button
            className="rui-toggle"
            role="switch"
            aria-pressed={shareAnalytics}
            onClick={toggleAnalytics}
            aria-label="Toggle usage analytics"
          />
        }
      />

      <SettingsCard
        icon="📝"
        title="About Notes"
        description="Study notes for a range of subjects, as PDFs. Content is read-only and updated as new notes are added. You need to be signed in to read them."
      />
    </SettingsLayout>
  );
}
