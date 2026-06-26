import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server.js with minimal node_modules.
  // Required for the Docker multi-stage build to produce a small production image.
  output: "standalone",
  typescript: {
    // Type checking runs separately via tsc. Vercel's Next.js build resolves
    // Prisma's complex generic types differently without incremental cache,
    // producing false-positive errors that don't occur locally.
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
