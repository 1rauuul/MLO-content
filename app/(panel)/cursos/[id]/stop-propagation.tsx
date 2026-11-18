"use client";

export function StopPropagation({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // Evita que los botones dentro de un <summary> abran o cierren el detalle.
  return (
    <span className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </span>
  );
}
