import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const githubRepository = process.env.GITHUB_REPOSITORY ?? "";
const repositoryName = githubRepository.split("/")[1] ?? "";
const isUserOrOrgSite = repositoryName.endsWith(".github.io");
const basePath = isGithubActions && !isUserOrOrgSite ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
