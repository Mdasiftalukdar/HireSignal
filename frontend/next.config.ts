import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker runtime
  // image can ship just the server + traced deps instead of the whole node_modules.
  output: "standalone",
};

export default nextConfig;
