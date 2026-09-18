/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.137.1"],
  // Keep live development output isolated from production builds. This avoids
  // stale generated chunks when switching between `next build` and `next dev`.
  distDir: process.env.NODE_ENV === "development" ? ".next-live-dev" : ".next",
};

export default nextConfig;
