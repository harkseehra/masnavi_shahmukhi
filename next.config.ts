import type { NextConfig } from 'next';

const isReaderBuild = process.env.BUILD_TARGET === 'reader';

const nextConfig: NextConfig = {
  ...(isReaderBuild ? {
    output: 'export',
    basePath: '/masnavi_shahmukhi',
    images: { unoptimized: true },
  } : {}),
};

export default nextConfig;
