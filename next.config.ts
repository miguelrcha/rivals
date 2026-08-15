import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://raw.githubusercontent.com/PokeAPI/sprites/**"),
      new URL("https://raw.githubusercontent.com/libretro-thumbnails/**"),
    ],
  },
};

export default nextConfig;
