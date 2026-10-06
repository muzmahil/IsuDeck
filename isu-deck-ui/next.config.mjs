/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Disable image optimization (not needed in Tauri static export)
  images: {
    unoptimized: true,
  },
  // Reduce JS bundle size
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Faster HMR rebuild (dev only)
  experimental: {
    // Turbopack is faster on Linux
    turbo: {},
  },
};

export default nextConfig;
