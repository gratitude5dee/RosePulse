"use client";

import dynamic from "next/dynamic";

const WalkiePanel = dynamic(() => import("@/components/app/WalkiePanel").then((mod) => mod.WalkiePanel), {
  ssr: false,
  loading: () => <div className="rounded-lg border bg-background/72 p-6 text-sm text-muted-foreground">Loading radio...</div>
});

export function RadioView() {
  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-5">
        <h1 className="display-1">Radio</h1>
        <p className="text-sm text-muted-foreground">Full-screen push-to-talk filing.</p>
      </div>
      <WalkiePanel variant="full" />
    </div>
  );
}
