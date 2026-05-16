import { GuestDetail } from "@/components/app/GuestDetail";

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuestDetail guestId={id} />;
}
