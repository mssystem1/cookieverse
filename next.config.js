/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Make sure Next writes to a folder, not a file
  distDir: ".next",

  // ✅ Required because wallet roast rendering uses @napi-rs/canvas on server
  serverExternalPackages: ["@napi-rs/canvas"],

  // ✅ Required on Vercel:
  // The render API route reads PNG/font files from disk.
  // Vercel serverless functions only include traced files by default,
  // so we must explicitly bundle these assets into this API function.
  outputFileTracingIncludes: {
    "/api/wallet-roast/render": [
      "./public/wallet-roast/templates/**/*",
      "./public/wallet-roast/icons/**/*",
      "./public/fonts/**/*",
    ],
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

console.log(">> next.config.js loaded");
module.exports = nextConfig;