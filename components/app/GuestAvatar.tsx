import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { Guest } from "@/lib/types";
import { cn } from "@/lib/utils";

export function GuestAvatar({ guest, className }: { guest: Guest; className?: string }) {
  return (
    <Avatar className={cn("border border-accent/40 bg-secondary", className)}>
      <AvatarImage src={guest.avatarUrl} alt="" />
      <AvatarFallback className="bg-gradient-to-br from-accent/30 to-secondary font-serif text-base text-primary">
        {initials(guest)}
      </AvatarFallback>
    </Avatar>
  );
}
