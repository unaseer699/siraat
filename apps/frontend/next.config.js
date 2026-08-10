/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles server + minimal node_modules for a lean Docker image.
  // See apps/frontend/Dockerfile for how this is consumed.
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
};

module.exports = nextConfig;
