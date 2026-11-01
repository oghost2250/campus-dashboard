import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "web-push"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
};

export default nextConfig;
