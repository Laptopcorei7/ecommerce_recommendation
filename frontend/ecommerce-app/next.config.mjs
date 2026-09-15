/** @type {import('next').NextConfig} */
const nextConfig = {
  // The previous config set eslint.ignoreDuringBuilds and
  // typescript.ignoreBuildErrors, so `next build` reported success on a
  // codebase that did not type-check. Both are gone: a build that passes now
  // means something.
  images: {
    // Product images are Amazon CDN URLs. next/image validates the host even
    // when it is not optimizing.
    remotePatterns: [
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
    ],
    // Deliberate, not leftover. These are third-party CDN images that are
    // already sized and cached; routing 62,222 of them through the Next
    // optimizer would add a hop and a disk cache for no gain.
    unoptimized: true,
  },
  async redirects() {
    return [
      // /products was the old listing route. It is /catalog now, and the old
      // path is kept as a redirect rather than a second page.
      { source: '/products', destination: '/catalog', permanent: true },
      { source: '/categories', destination: '/catalog', permanent: true },
    ]
  },
}

export default nextConfig
