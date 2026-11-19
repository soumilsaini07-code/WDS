import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'eds-gorgeous-specialist-picked.trycloudflare.com',
    'monetize-showing-wispy.ngrok-free.dev',
    '*.trycloudflare.com',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
