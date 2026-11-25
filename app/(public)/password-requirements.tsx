"use client";

import { PASSWORD_REQUIREMENTS } from "@/lib/password-policy";

export function PasswordRequirements({ value }: { value: string }) {
  return (
    <ul
      className="grid gap-1.5 text-xs sm:grid-cols-2"
      aria-label="Requisitos de contraseña"
    >
      {PASSWORD_REQUIREMENTS.map((requirement) => {
        const met = requirement.test(value);
        return (
          <li
            key={requirement.id}
            className={`flex items-center gap-2 ${
              met ? "text-positive" : "text-ink-faint"
            }`}
          >
            <span aria-hidden="true">{met ? "✓" : "○"}</span>
            <span>{requirement.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
