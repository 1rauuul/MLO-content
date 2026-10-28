import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Panel autenticado y 100% dinámico: PPR no aporta y obligaría a Suspense en
  // cada lectura de cookies. Se usa el modelo de render clásico.
  cacheComponents: false,
  serverExternalPackages: ["postgres"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
