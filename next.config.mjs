/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local: `npm run dev` sets NEXT_DIST_DIR to `.next-dev` so dev and `next build` (`.next`) never
  // trample the same chunk graph (fixes missing ./627.js-style errors). Vercel must use `.next`.
  distDir: process.env.VERCEL ? ".next" : (process.env.NEXT_DIST_DIR || ".next")
};

export default nextConfig;
