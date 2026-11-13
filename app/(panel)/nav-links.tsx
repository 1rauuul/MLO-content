"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/mis-cursos", label: "Mis cursos", match: ["/mis-cursos", "/cursos"] },
  { href: "/grupos", label: "Grupos", match: ["/grupos"] },
  { href: "/contenido-extra", label: "Contenido adicional", match: ["/contenido-extra"] },
  { href: "/admin/maestros", label: "Maestros", match: ["/admin/maestros"], adminOnly: true },
];

function PendingDot() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={`ml-1 inline-block size-1 rounded-full bg-accent transition-opacity duration-150 ${
        pending ? "animate-pulse opacity-100" : "opacity-0"
      }`}
    />
  );
}

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="-mx-1 flex w-full flex-nowrap items-center gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible"
      aria-label="Secciones"
    >
      {LINKS.filter((link) => !link.adminOnly || isAdmin).map((link) => {
        const active = link.match.some(
          (base) => pathname === base || pathname.startsWith(`${base}/`),
        );

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`nav-link shrink-0 ${active ? "nav-link-active" : ""}`}
          >
            {link.label}
            <PendingDot />
          </Link>
        );
      })}
    </nav>
  );
}
