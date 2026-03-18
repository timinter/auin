"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const [invitation, setInvitation] = useState<{
    email: string;
    role: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function validateToken() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("invitations")
        .select("email, role, accepted_at, expires_at")
        .eq("token", params.token)
        .single();

      if (error || !data) {
        setError("Invalid invitation link");
        setLoading(false);
        return;
      }

      if (data.accepted_at) {
        setError("This invitation has already been used");
        setLoading(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired");
        setLoading(false);
        return;
      }

      setInvitation({ email: data.email, role: data.role });
      setLoading(false);
    }

    validateToken();
  }, [params.token]);

  const handleAccept = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?invite_token=${params.token}`,
        scopes: "email profile openid",
      },
    });
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Validating invitation...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle>Invalid Invitation</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">SAMAP</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join as{" "}
          <span className="font-medium capitalize">{invitation?.role}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-center text-muted-foreground">
          Invited email: {invitation?.email}
        </p>
        <Button onClick={handleAccept} className="w-full" size="lg">
          <svg className="mr-2 h-5 w-5" viewBox="0 0 21 21">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Accept & Sign in with Microsoft
        </Button>
      </CardContent>
    </Card>
  );
}
