"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Gender, GENDER_LABELS } from "@/lib/types";

interface GenderNavProps {
  allowedGenders: Gender[];
  clubSlug: string;
}

export function GenderNav({ allowedGenders, clubSlug }: GenderNavProps) {
  const pathname = usePathname();

  const links = allowedGenders.map((gender) => ({
    href: `/${clubSlug}/players/${gender}/all`,
    label: GENDER_LABELS[gender],
    gender,
  }));

  if (links.length === 0) return null;

  return (
    <nav className="flex gap-1">
      {links.map(({ href, label, gender }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname.includes(`/players/${gender}`)
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
