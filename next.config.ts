import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },  
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  // ✅ This silences the "webpack config with no turbopack config" error
  turbopack: {},
  
  // ✅ This fixes the Watchpack EINVAL error on secondary drives
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /System Volume Information|pagefile\.sys/,
      };
    }
    return config;
  },
};

export default nextConfig;