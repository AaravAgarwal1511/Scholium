import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScholiumLogo } from "@repo/ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const { isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/"), 2500);
    }
  }

  if (!isPasswordRecovery && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <div className="mb-6 flex justify-center">
            <ScholiumLogo size="lg" />
          </div>
          <p className="text-muted-foreground text-sm">
            This link is invalid or has already been used.{" "}
            <a href="/" className="text-primary hover:underline font-medium">
              Return home
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div
        className="w-full max-w-sm bg-card rounded-2xl border border-border p-8"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="mb-6 flex justify-center">
          <ScholiumLogo size="lg" />
        </div>

        <h1 className="font-display font-bold text-xl text-foreground text-center mb-1">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Choose a strong password for your Scholium account.
        </p>

        {success ? (
          <div
            className="text-center text-sm font-medium rounded-lg px-4 py-3"
            style={{
              background: "hsl(var(--success) / 0.1)",
              color: "hsl(var(--success))",
            }}
          >
            Password updated! Redirecting you home…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 transition-shadow"
                style={{ "--tw-ring-color": "hsl(var(--primary) / 0.4)" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 transition-shadow"
                style={{ "--tw-ring-color": "hsl(var(--primary) / 0.4)" } as React.CSSProperties}
              />
            </div>

            {error && (
              <p
                className="text-xs rounded-lg px-3 py-2"
                style={{
                  background: "hsl(var(--destructive) / 0.1)",
                  color: "hsl(var(--destructive))",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg transition-opacity disabled:opacity-60"
              style={{ background: "hsl(var(--primary))" }}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
