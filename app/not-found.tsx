import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center p-6">
      <div data-tier="editorial" className="max-w-md rounded-lg p-8 text-center">
        <h1 className="display-1">Not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">This Rosewood workspace route does not exist.</p>
        <Button asChild className="mt-6">
          <Link href="/today">Return to Today</Link>
        </Button>
      </div>
    </main>
  );
}
