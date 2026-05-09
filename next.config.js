/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Make sure Next writes to a folder, not a file
  distDir: '.next',
  serverExternalPackages: ['@napi-rs/canvas'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

console.log('>> next.config.js loaded'); // sanity log
module.exports = nextConfig;

