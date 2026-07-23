import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password.trim() || !confirmPassword.trim()) {
            toast.error("Please fill in both fields");
            return;
        }

        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password.trim(),
            });

            if (error) throw error;
            setSuccess(true);
        } catch (error) {
            console.error("Update password error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to update password");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <Card className="w-full max-w-md shadow-card animate-slide-up">
                    <CardContent className="pt-8 pb-8 text-center">
                        <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
                        <h2 className="text-2xl font-bold font-display mb-2">Password Updated!</h2>
                        <p className="text-muted-foreground mb-6">
                            Your password has been successfully reset.
                        </p>
                        <Button
                            variant="hero"
                            className="mt-2"
                            onClick={() => navigate("/")}
                        >
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-8 animate-slide-up">
                    <h1 className="text-4xl font-bold font-display gradient-hero bg-clip-text text-white pt-5 pb-5 rounded-md">
                        💬 Language Flash Hub!
                    </h1>
                    <p className="text-muted-foreground mt-2 pt-5">
                        Set your new password
                    </p>
                </div>

                <Card className="shadow-card animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <CardContent className="pt-6 pb-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-10"
                                        disabled={loading}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Must be at least 6 characters
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-10"
                                        disabled={loading}
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                variant="hero"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    "Update Password"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ResetPassword;
