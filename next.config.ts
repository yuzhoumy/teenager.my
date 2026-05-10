import type { NextConfig } from "next";

/** GitHub Pages (and similar) only serve static files — emit `out/`. Full Next deployments omit this so `/api/*` works. */
const staticExport =
  process.env.GITHUB_PAGES === "true" || process.env.STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const } : {}),
  trailingSlash: true,
  basePath: "",
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
