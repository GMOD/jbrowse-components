import fs from 'node:fs/promises'
import { glob } from 'node:fs/promises'
import path from 'node:path'

import { unified } from '@astrojs/markdown-remark'
import icon from 'astro-icon'
import { defineConfig, fontProviders } from 'astro/config'

import { emitRawMarkdown } from './src/lib/emit-raw-markdown.ts'
import rehypeBaseUrls from './src/lib/rehype-base-urls.ts'

// allows deploying to an alternative suburi, e.g. for staging builds
const BASE = process.env.SITE_BASE_PATH || '/jb2'
const SITE = 'https://jbrowse.org'

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

// Emit raw `/docs/<slug>.md` files for LLM/agent consumption (see
// src/lib/emit-raw-markdown.ts and the /llms.txt index).
function emitRawMarkdownIntegration() {
  return {
    name: 'emit-raw-markdown',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await emitRawMarkdown({
          docsDir: new URL('./docs', import.meta.url).pathname,
          distDir: dir instanceof URL ? dir.pathname : dir,
          origin: `${SITE}${BASE}`,
        })
      },
    },
  }
}

export default defineConfig({
  site: SITE,
  base: BASE,
  publicDir: './static',
  trailingSlash: 'always',
  // Astro's default HTML minifier strips whitespace-only text nodes between
  // elements, so `<strong>a</strong>\n<strong>b</strong>` renders as "ab" and
  // authoring needs ugly {' '} spacers. Turning it off keeps normal HTML
  // whitespace (the browser collapses runs to one space); the size cost is
  // negligible for a static docs site.
  compressHTML: false,
  // No React integration: every component here is .astro and there are no
  // client: directives, so adding it only emits an unreferenced ~190KB React
  // runtime chunk. Re-add it (and the react deps) if an island comes back.
  integrations: [icon(), fixAbsoluteLinks(), emitRawMarkdownIntegration()],
  // Self-hosted Roboto (downloaded + optimized at build, served from our own
  // origin) — no render-blocking request to fonts.googleapis.com. Exposed as
  // var(--font-roboto); emit the <Font> tags with <Font cssVariable> in the head.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Roboto',
      cssVariable: '--font-roboto',
      weights: [400, 500, 600, 700, 900],
      styles: ['normal'],
      subsets: ['latin'],
    },
  ],
  // NOTE: this only applies to Astro's built-in markdown (the `.md` *pages* like
  // features/gallery/demos — base-URL rewriting only). Docs and blog render
  // through the richer unified pipeline in src/lib/markdown.ts (admonitions,
  // figures, spec-examples, shiki); those extras do NOT work in `.md` pages.
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeBaseUrls, { base: BASE }]],
    }),
  },
})
