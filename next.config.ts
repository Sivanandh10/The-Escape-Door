import type { NextConfig } from "next";

// Owner: F2. Keep cacheComponents / partialPrefetching / turbopack rules (CONTRACTS §10.1).
// Images: local /public files + Supabase Storage public objects (CONTRACTS §10.11).
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Every `quality` passed to next/image must be listed here (Next 16 default is [75]).
    qualities: [60, 75, 85],
    remotePatterns: [
      // Exact project host when known, plus any *.supabase.co project as a fallback.
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
      { protocol: "https" as const, hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  // SITEMAP §1 rule 2 / Critic addenda #7: category & arc as query params → clean URLs (308).
  async redirects() {
    return [
      {
        source: "/shop",
        has: [{ type: "query", key: "category", value: "(?<cat>[a-z0-9-]+)" }],
        destination: "/shop/:cat",
        permanent: true,
      },
      {
        source: "/shop",
        has: [{ type: "query", key: "arc", value: "(?<arc>[a-z0-9-]+)" }],
        missing: [{ type: "query", key: "category" }, { type: "query", key: "q" }],
        destination: "/arc/:arc",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
