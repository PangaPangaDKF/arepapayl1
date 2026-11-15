/** @type {import('next').NextConfig} */
// Static export (D-004): emits plain HTML into landing/out/ so the truth and overflow
// gates can probe the real output, and the site deploys to any static host (B4).
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true }, // no image-optimization server on a static host
  reactStrictMode: true,
};

export default nextConfig;
