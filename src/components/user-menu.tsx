"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { UserRole, Team } from "@/lib/types";

interface UserMenuProps {
  email: string;
  role: UserRole;
  teams: Team[];
  hasMultipleClubs?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  captain: "Mannschaftsführer",
  player: "Spieler",
};

export function UserMenu({ email, role, teams, hasMultipleClubs }: UserMenuProps) {
  const initials = email
    .split("@")[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
          {initials || "?"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{email}</p>
            <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
            {teams.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {teams.map((t) => (
                  <span
                    key={t.id}
                    className="inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasMultipleClubs && (
          <DropdownMenuItem asChild>
            <Link href="/club-select" className="w-full">
              Club wechseln
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <form action="/api/logout" method="POST" className="w-full">
            <button type="submit" className="w-full text-left">
              Abmelden
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
