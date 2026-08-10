/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is required by apps/frontend/Dockerfile for a lean production image.
  // It is gated behind NEXT_STANDALONE=1 because Next.js standalone creates symlinks that
  // Windows blocks (EPERM) outside of Developer Mode — enabling it unconditionally would
  // break local dev builds on Windows.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  },
};

module.exports = nextConfig;
