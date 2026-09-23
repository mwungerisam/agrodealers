import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { isStrongPassword } from "@/lib/password-policy";
import { t, formatErrorMessage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({ component: AccountPage });

function AccountPage() {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(password)) return toast.error(t.weakPassword);
    if (password !== confirmation) return toast.error(t.passwordsDontMatch);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(formatErrorMessage(error));
    setPassword("");
    setConfirmation("");
    toast.success(t.passwordUpdated);
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.accountSettings}</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" />
            {t.changePassword}
          </CardTitle>
          <CardDescription>{t.passwordHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">{t.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                minLength={12}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.changePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
