import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server.js with minimal node_modules.
  // Required for the Docker multi-stage build to produce a small production image.
  output: "standalone",
  typescript: {
    // Type checking is handled by CI (tsc --noEmit). Vercel's build environment
    // resolves Prisma's complex generic types differently, causing false positives.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      }
    ],
  },
};

export default nextConfig;
