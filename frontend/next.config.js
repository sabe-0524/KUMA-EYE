/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Leafletとの互換性のため無効化
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/api/v1/images/**',
      },
    ],
  },
};

module.exports = nextConfig;
