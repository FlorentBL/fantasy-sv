import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "downloads.soccerverse.com",
        pathname: "/svpack/**",
      },
      {
        protocol: "https",
        hostname: "elrincondeldt.com",
        pathname: "/sv/photos/**",
      },
    ],
  },
};

export default nextConfig;
