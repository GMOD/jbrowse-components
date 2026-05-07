import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import icon from 'astro-icon'
import fs from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import path from 'node:path'

const BASE = '/jb2'

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
            /(<a\s[^>]*href=")(\/)(?!jb2\/|\/)/g,
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
  base: '/jb2',
  publicDir: './static',
  trailingSlash: 'always',
  integrations: [react(), icon(), fixAbsoluteLinks()],
})
