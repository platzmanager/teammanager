"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Users, List, Calendar, Menu, Upload, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileNavProps {
  clubSlug: string;
  isAdmin: boolean;
  hasPlayers: boolean;
  firstGender: string;
}

const NAV_LINK = "flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary hover:bg-primary/5";

export function MobileNav({ clubSlug, isAdmin, hasPlayers, firstGender }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const tabs = [
    { href: `/${clubSlug}/teams`, label: "Teams", icon: Users },
    { href: `/${clubSlug}/events`, label: "Termine", icon: Calendar },
  ];

  const moreItems = [
    ...(hasPlayers
      ? [{ href: `/${clubSlug}/players/${firstGender}/overview`, label: "Meldeliste", icon: List }]
      : []),
    ...(isAdmin
      ? [
          { href: `/${clubSlug}/admin/members`, label: "Mitglieder", icon: UserCog },
          { href: `/${clubSlug}/admin/import`, label: "Import", icon: Upload },
        ]
      : []),
  ];

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Bottom tab bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-golden/20 bg-white z-50 md:hidden">
        <div className="flex items-stretch">
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                isActive(href)
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {isActive(href) && (
                <div className="absolute top-0 h-0.5 w-10 bg-primary" />
              )}
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          {/* Mehr button */}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
              open ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Menu className="h-5 w-5" />
            Mehr
          </button>
        </div>
      </div>

      {/* Sheet for "Mehr" items */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-20">
          <SheetHeader>
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col">
            {/* Show all nav items in the sheet */}
            {tabs.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  NAV_LINK,
                  isActive(href) && "text-primary border-l-2 border-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {moreItems.length > 0 && (
              <>
                <div className="my-2 h-px bg-border" />
                {moreItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      NAV_LINK,
                      isActive(href) && "text-primary border-l-2 border-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </>
            )}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
