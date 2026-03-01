"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Gender, GENDER_LABELS } from "@/lib/types";

const allLinks: { href: string; label: string; gender: Gender }[] = [
  { href: "/female/all", label: GENDER_LABELS.female, gender: "female" },
  { href: "/male/all", label: GENDER_LABELS.male, gender: "male" },
];

interface GenderNavProps {
  allowedGenders: Gender[];
}

export function GenderNav({ allowedGenders }: GenderNavProps) {
  const pathname = usePathname();
  const links = allLinks.filter((l) => allowedGenders.includes(l.gender));

  if (links.length === 0) return null;

  return (
    <nav className="flex gap-1">
      {links.map(({ href, label, gender }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname.startsWith(`/${gender}`)
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
