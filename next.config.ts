// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedRoutes: false },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "shared.akamai.steamstatic.com" },
      { protocol: "https", hostname: "cdn.cloudflare.steamstatic.com" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net" }, // older titles sometimes use this
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com" }, // rare, but seen in the wild
    ],
  },
};

export default nextConfig;
