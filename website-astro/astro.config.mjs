import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import { sidebar } from './src/sidebar.ts'
import { resolve } from 'node:path'

export default defineConfig({
  site: 'https://jbrowse.org',
  base: '/jb2',
  trailingSlash: 'always',
  vite: {
    resolve: {
      alias: {
        // Shim for figure.jsx used in several docs pages
        '@docusaurus/useBaseUrl': resolve('./src/shims/docusaurus-use-base-url.js'),
      },
    },
  },
  integrations: [
    starlight({
      title: 'JBrowse',
      tagline: 'Next generation genome browser',
      logo: {
        src: './public/img/logo.svg',
        alt: 'JBrowse',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/GMOD/jbrowse-components',
        },
      ],
      customCss: ['./src/styles/global.css'],
      // Sidebar is auto-converted from website/sidebars.json via src/sidebar.ts
      sidebar,
    }),
    react(),
  ],
})
