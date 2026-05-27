"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/context";
import { tr } from "@/lib/i18n/tr";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("demo_admin");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(username, password);
      router.push("/projects");
    } catch {
      setError(tr.loginError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lux-login-bg flex min-h-screen items-center justify-center p-4">
      <Card className="lux-card w-full max-w-md border-primary/20 shadow-xl">
        <CardHeader className="space-y-3 text-center">
          <BrandLogo variant="login" linked={false} />
          <CardTitle className="font-heading text-2xl">{tr.loginTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{tr.loginHint}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{tr.username}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="border-border/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tr.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="border-border/80"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {tr.login}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
