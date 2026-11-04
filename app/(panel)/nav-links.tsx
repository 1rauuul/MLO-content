"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mis-cursos", label: "Mis cursos", match: ["/mis-cursos", "/cursos"] },
  { href: "/clases", label: "Clases", match: ["/clases"] },
  { href: "/contenido-extra", label: "Contenido extra", match: ["/contenido-extra"] },
  { href: "/admin/maestros", label: "Maestros", match: ["/admin/maestros"], adminOnly: true },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Secciones">
      {LINKS.filter((link) => !link.adminOnly || isAdmin).map((link) => {
        const active = link.match.some(
          (base) => pathname === base || pathname.startsWith(`${base}/`),
        );

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`nav-link ${active ? "nav-link-active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
