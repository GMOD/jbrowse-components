import { unified } from '@astrojs/markdown-remark'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import icon from 'astro-icon'
import fs from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import path from 'node:path'

import rehypeBaseUrls from './src/lib/rehype-base-urls.ts'

// allows deploying to an alternative suburi, e.g. for staging builds
const BASE = process.env.SITE_BASE_PATH || '/jb2'

function fixAbsoluteLinks() {
  return {
    name: 'fix-absolute-links',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const dirPath = dir instanceof URL ? dir.pathname : dir
        for await (const file of glob('**/*.html', { cwd: dirPath })) {
          const fullPath = path.join(dirPath, file)
          const content = await fs.readFile(fullPath, 'utf-8')
          const fixed = content.replace(
            new RegExp(`(<a\\s[^>]*href=")(/)(?!${BASE.slice(1)}/|/)`, 'g'),
            `$1${BASE}/`,
          )
          if (fixed !== content) {
            await fs.writeFile(fullPath, fixed)
          }
        }
      },
    },
  }
}

export default defineConfig({
  site: 'https://jbrowse.org',
  base: BASE,
  publicDir: './static',
  trailingSlash: 'always',
  // Astro's default HTML minifier strips whitespace-only text nodes between
  // elements, so `<strong>a</strong>\n<strong>b</strong>` renders as "ab" and
  // authoring needs ugly {' '} spacers. Turning it off keeps normal HTML
  // whitespace (the browser collapses runs to one space); the size cost is
  // negligible for a static docs site.
  compressHTML: false,
  integrations: [react(), icon(), fixAbsoluteLinks()],
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeBaseUrls, { base: BASE }]],
    }),
  },
})
