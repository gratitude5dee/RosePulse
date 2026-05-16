"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const next = searchParams.get("next") || "/today";
  const missingMembership = searchParams.get("error") === "membership";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("Sign in failed", { description: error.message });
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <section data-tier="editorial" className="w-full max-w-md rounded-lg border bg-background/86 p-6 shadow-xl backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">RosePulse</p>
        <h1 className="mt-2 font-serif text-3xl font-medium">Staff sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use a Supabase staff account with active membership for the Rosewood Sand Hill property.
        </p>
      </div>

      {missingMembership ? (
        <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          This account is signed in but is not an active staff member for this property.
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="grid gap-2">
          <Label>Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="pl-9"
            />
          </div>
        </label>
        <label className="grid gap-2">
          <Label>Password</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="pl-9"
            />
          </div>
        </label>
        <Button type="submit" disabled={loading} className="min-h-11 w-full">
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          Sign in
        </Button>
      </form>
    </section>
  );
}
