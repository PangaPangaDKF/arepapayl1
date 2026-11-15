/** @type {import('next').NextConfig} */
// Static export (D-004): emits plain HTML into landing/out/ so the truth and overflow
// gates can probe the real output, and the site deploys to any static host (B4).
//
// NEXT_BASE_PATH (D-024): publish under a sub-path, e.g. GitHub Pages
//   NEXT_BASE_PATH=/arepapay-site npm --prefix landing run build
// Empty by default, so the gates and the file:// probe keep working on the root build.
// NEXT_PUBLIC_BASE_PATH carries the same value into the page for plain <img> paths.
const raw = (process.env.NEXT_BASE_PATH || '').trim();
const basePath = raw && raw !== '/' ? '/' + raw.replace(/^\/+|\/+$/g, '') : '';

const nextConfig = {
  output: 'export',
  trailingSlash: true, // out/probar/index.html etc., so the relative link "probar/" resolves on any static host
  images: { unoptimized: true }, // no image-optimization server on a static host
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
