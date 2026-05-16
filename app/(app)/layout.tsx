import { AppShell } from "@/components/app/AppShell";
import { GuestCrmProvider } from "@/lib/store/store-context";

export default function AuthenticatedShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestCrmProvider>
      <AppShell>{children}</AppShell>
    </GuestCrmProvider>
  );
}
