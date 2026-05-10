import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  basePath: "",
  // Cannot use `output: "export"` here: static hosts have no `/api/*` handlers (POST → 405/404).
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
