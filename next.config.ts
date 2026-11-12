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
};

export default nextConfig;
