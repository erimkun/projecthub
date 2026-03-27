import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  allowedDevOrigins: ['172.16.29.161'],
};


export default nextConfig;
