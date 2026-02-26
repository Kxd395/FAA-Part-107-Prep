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

  // Keep Turbopack workspace-root resolution stable with nested lockfiles.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
