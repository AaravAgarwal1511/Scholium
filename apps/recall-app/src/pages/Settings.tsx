import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { SettingsLayout, SettingsCard } from "@repo/ui";
import { useDarkMode } from "@repo/hooks";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const navigate = useNavigate();
  const { user, loadingAuth, resetProgress, logout } = useApp();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [resetEmail, setResetEmail] = useState(user?.email || "");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error("Please enter your email"); return; }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Password reset email sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  if (loadingAuth) return null;
  if (!user) { navigate("/signin"); return null; }

  return (
    <SettingsLayout onBack={() => navigate("/")}>
      <SettingsCard
        icon="👤"
        title={user.name}
        description={user.email}
      />

      <SettingsCard
        icon="🌙"
        title="Dark Mode"
        description="Toggle between light and dark theme"
        action={
          <button
            className="rui-toggle"
            role="switch"
            aria-pressed={isDark}
            onClick={toggleDark}
            aria-label="Toggle dark mode"
          />
        }
      />

      <SettingsCard
        icon="🔑"
        title="Reset Password"
        description="We'll send a password reset link to your email"
      >
        {resetSent ? (
          <div>
            <p className="text-success text-sm font-medium mb-1">Reset link sent!</p>
            <p className="text-muted-foreground text-sm mb-3">Check your email and follow the link.</p>
            <Button variant="outline" size="sm" onClick={() => setResetSent(false)}>Send Again</Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ra-reset-email">Email</Label>
              <Input id="ra-reset-email" type="email" value={resetEmail}
                onChange={e => setResetEmail(e.target.value)} disabled={resetLoading} />
            </div>
            <div>
              <Button type="submit" variant="default" size="sm" disabled={resetLoading}>
                {resetLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send Reset Link"}
              </Button>
            </div>
          </form>
        )}
      </SettingsCard>

      <SettingsCard
        icon="🔄"
        title="Reset All Progress"
        description="Return all chapters to Pass 1"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (confirm("Reset all chapters to Pass 1?")) {
                await resetProgress();
                toast.success("All chapters reset to Pass 1");
              }
            }}
          >
            Reset
          </Button>
        }
      />

      <SettingsCard
        icon="🚪"
        title="Log Out"
        description="Sign out of your account on this device"
        variant="danger"
        action={
          <Button variant="destructive" size="sm"
            onClick={async () => { await logout(); navigate("/signin"); }}>
            Log Out
          </Button>
        }
      />

      <SettingsCard
        icon="⚛️"
        title="About Recall Master"
        description="Spaced-repetition study sessions across your chapters. Track passes, mistakes, and progress over time."
      />
    </SettingsLayout>
  );
}
