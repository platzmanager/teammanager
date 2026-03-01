"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/damen", label: "Damen" },
  { href: "/herren", label: "Herren" },
];

export function GenderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
