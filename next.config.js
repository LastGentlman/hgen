const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true
  },
  // Optimize compilation
  swcMinify: true,
  // Improve file watching for faster change detection
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding once the first file changed
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/temp_crops',
          '**/schedules examples',
        ],
      }
    }
    return config
  },
}

module.exports = withBundleAnalyzer(nextConfig)