/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Leafletとの互換性のため無効化
  output: 'standalone', // Firebase App Hosting用
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/api/v1/images/**',
      },
      {
        protocol: 'https',
        hostname: 'bear-api-service-52533905728.asia-northeast1.run.app',
        pathname: '/api/v1/images/**',
      },
    ],
  },
};

module.exports = nextConfig;
