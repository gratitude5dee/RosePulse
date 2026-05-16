import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/app/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    redirect("/today");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-safe">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
