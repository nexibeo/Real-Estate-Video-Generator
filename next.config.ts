import type { NextConfig } from 'next';

const config: NextConfig = {
  // ffmpeg.wasm / SharedArrayBuffer are not used: rendering runs on
  // WebCodecs + canvas, so no cross-origin isolation headers are needed.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
