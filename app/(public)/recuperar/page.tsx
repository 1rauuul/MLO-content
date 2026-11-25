import type { Metadata } from "next";

import { RequestResetForm } from "./request-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Recuperar contraseña · MLO",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RecoverPage() {
  return (
    <>
      <p className="eyebrow">Cuenta de maestro</p>
      <h1 className="page-title mt-2">Recupera tu contraseña</h1>
      <p className="page-lead mt-2">
        Escribe tu correo y te enviaremos un enlace para elegir una nueva.
      </p>
      <RequestResetForm />
    </>
  );
}
