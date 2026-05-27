"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMe } from "@/lib/api/client";
import { formatApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/context";
import { tr } from "@/lib/i18n/tr";

export default function SettingsPage() {
  const { me, refreshMe } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setDisplayName(me?.profile?.display_name ?? "");
    setPhone(me?.profile?.phone ?? "");
  }, [me]);

  const profileMutation = useMutation({
    mutationFn: () => updateMe({ display_name: displayName, phone }),
    onSuccess: async () => {
      toast.success(tr.success);
      await refreshMe();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      updateMe({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: async () => {
      toast.success(tr.success);
      setCurrentPassword("");
      setNewPassword("");
      await refreshMe();
    },
    onError: (err) => toast.error(formatApiError(err)),
  });

  return (
    <div>
      <PageHeader title={tr.settings} description={me?.user.username} />

      <div className="grid max-w-lg gap-6">
        <Card className="lux-card">
          <CardHeader>
            <CardTitle>{tr.displayName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{tr.displayName}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <Label>{tr.phone}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button
              onClick={() => profileMutation.mutate()}
              disabled={profileMutation.isPending}
            >
              {tr.save}
            </Button>
          </CardContent>
        </Card>

        <Card className="lux-card">
          <CardHeader>
            <CardTitle>{tr.changePassword}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>{tr.currentPassword}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label>{tr.newPassword}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={() => passwordMutation.mutate()}
              disabled={passwordMutation.isPending}
            >
              {tr.changePassword}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
