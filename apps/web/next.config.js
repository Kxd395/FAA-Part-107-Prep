const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export for Vercel + PWA
  output: undefined, // Use 'export' for static, undefined for server features (API routes)

  // Allow images from local assets
  images: {
    unoptimized: false,
  },

  // Transpile workspace packages
  transpilePackages: ["@part107/core"],

  // Point output file tracing to the monorepo root so exclude globs resolve correctly.
  outputFileTracingRoot: path.join(__dirname, "../.."),

  // Exclude large static assets from serverless function bundles (Vercel 250 MB limit).
  outputFileTracingExcludes: {
    "/api/questions": [
      "**/source-materials/**",
      "**/PDFtoMD/**",
      "**/out_to_ocr/**",
      "**/public/**",
      "**/.next/cache/**",
    ],
    "*": [
      "**/source-materials/**",
      "**/PDFtoMD/**",
      "**/out_to_ocr/**",
      "**/public/charts/**",
      "**/.next/cache/**",
    ],
  },

  // Keep Turbopack workspace-root resolution stable with nested lockfiles.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
