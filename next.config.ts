import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product images copied from suppliers live in our own Supabase Storage bucket.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
