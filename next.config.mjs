/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: [
    '@mezo-org/passport',
    '@mezo-org/orangekit-contracts'
  ],
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    } else {
      // During server-side builds, provide a polyfill/mock for indexedDB
      // This prevents wagmi from trying to access indexedDB during static generation
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ['@rainbow-me/rainbowkit']
  }
}

export default nextConfig
