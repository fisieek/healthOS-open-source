import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    cpus: 1,
  },
  serverExternalPackages: ["@prisma/client", "better-sqlite3"],
  // Standalone śledzi całe drzewo projektu (outputFileTracingRoot). Bez tego
  // katalogi buildów/danych (zwłaszcza dist-desktop z poprzednią paczką) wpadają
  // rekursywnie do nowego standalone i puchną z każdym buildem (§6.6).
  outputFileTracingExcludes: {
    "**/*": [
      "dist-desktop/**",
      "dist-electron/**",
      "backups/**",
      "storage/**",
      "scratch/**",
      ".next_old_*/**",
    ],
  },
  async redirects() {
    return [
      {
        source: "/log",
        destination: "/",
        permanent: true,
      },
      {
        source: "/analytics",
        destination: "/",
        permanent: true,
      },
      {
        source: "/plan",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
