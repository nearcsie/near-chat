import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim())
  : ["laptop.tail544a05.ts.net"];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins,
  output: 'standalone',
};

export default nextConfig;
