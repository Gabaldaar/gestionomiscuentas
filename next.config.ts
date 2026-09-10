import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

const nextConfig = async (phase: string): Promise<NextConfig> => {
  const baseConfig: NextConfig = {
    turbopack: {},
    typescript: {
      ignoreBuildErrors: true,
    },
    images: {
      unoptimized: true,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'placehold.co',
          port: '',
          pathname: '/**',
        },
        {
          protocol: 'https',
          hostname: 'images.unsplash.com',
          port: '',
          pathname: '/**',
        },
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/**',
        },
      ],
    },
  };

  if (phase === PHASE_PRODUCTION_BUILD) {
    try {
      const pwaModule = await (new Function('return import("@ducanh2912/next-pwa")')());
      const withPWAInit = pwaModule.default;
      const withPWA = withPWAInit({
        dest: 'public',
        register: true,
        skipWaiting: true,
        reloadOnOnline: true,
      });
      return withPWA(baseConfig);
    } catch (e) {
      console.warn("PWA initialization skipped:", e);
      return baseConfig;
    }
  }

  return baseConfig;
};

export default nextConfig;


