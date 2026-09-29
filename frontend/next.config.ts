import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The E2E suite builds into its own folder so it never touches the developer's build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
