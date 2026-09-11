import type { NextConfig } from 'next';

// The wallet API has no CORS layer, so the browser never calls it directly. Every
// request goes to /api/* on this app and Next proxies it server-side to the API.
// Change the target with API_URL (see .env.example).
const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
