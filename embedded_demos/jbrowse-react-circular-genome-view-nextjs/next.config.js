/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@jbrowse/react-circular-genome-view'],
  basePath: '/demos/cgv-nextjs',
}

module.exports = nextConfig
