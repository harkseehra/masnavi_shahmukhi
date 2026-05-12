import type { NextConfig } from 'next';

const isReaderBuild = process.env.BUILD_TARGET === 'reader';

const nextConfig: NextConfig = {
  ...(isReaderBuild ? {
    output: 'export',
    basePath: '/masnavi_shahmukhi',
    images: { unoptimized: true },
    env: { NEXT_PUBLIC_BASE_PATH: '/masnavi_shahmukhi' },
  } : {
    env: { NEXT_PUBLIC_BASE_PATH: '' },
  }),
};

export default nextConfig;
