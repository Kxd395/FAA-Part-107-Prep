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
};

module.exports = nextConfig;
