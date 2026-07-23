import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsLayout, SettingsCard } from "@repo/ui";
import { useDarkMode } from "@repo/hooks";

const Settings = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { isDark, toggle: toggleDark } = useDarkMode();
    const [resetEmail, setResetEmail] = useState(user?.email || "");
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail.trim()) { toast.error("Please enter your email"); return; }
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });
            if (error) throw error;
            setResetSent(true);
            toast.success("Password reset email sent!");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to send reset email");
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        try { await signOut(); toast.success("Logged out successfully"); }
        catch { toast.error("Failed to log out"); }
    };

    return (
        <SettingsLayout onBack={() => navigate("/")}>
            <SettingsCard
                icon="👤"
                title="Account"
                description={`Signed in as ${user?.email ?? ""}`}
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
                            <Label htmlFor="reset-email">Email</Label>
                            <Input id="reset-email" type="email" value={resetEmail}
                                onChange={e => setResetEmail(e.target.value)} disabled={loading} />
                        </div>
                        <div>
                            <Button type="submit" variant="default" size="sm" disabled={loading}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send Reset Link"}
                            </Button>
                        </div>
                    </form>
                )}
            </SettingsCard>

            <SettingsCard
                icon="🚪"
                title="Log Out"
                description="Sign out of your account on this device"
                variant="danger"
                action={<Button variant="destructive" size="sm" onClick={handleSignOut}>Log Out</Button>}
            />

            <SettingsCard
                icon="💬"
                title="About Language Hub"
                description="Build and study flashcard decks for any language. Practice with sentence drills and track your progress on built-in dashboards."
            />
        </SettingsLayout>
    );
};

export default Settings;
