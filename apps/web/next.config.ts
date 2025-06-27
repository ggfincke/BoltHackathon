import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    // allow loading images from placeholder service and retailer domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      },
      // Amazon images
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/**',
      },
      // Walmart images
      {
        protocol: 'https',
        hostname: 'i5.walmartimages.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.walmartimages.com',
        pathname: '/**',
      },
      // Target images
      {
        protocol: 'https',
        hostname: 'target.scene7.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'a.fsdn.com',
        pathname: '/**',
      },
      // Generic CDN patterns that retailers might use
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.akamaized.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
