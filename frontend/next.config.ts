import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image (see Dockerfile) builds a self-contained server; `next start` keeps working locally.
  output: process.env.NEXT_STANDALONE ? "standalone" : undefined,
  // The E2E suite builds into its own folder so it never touches the developer's build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
