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

// The docs render pool (src/lib/markdown-pool.ts) spawns workers off a real
// source file, which the SSR bundle it runs from cannot point at. This config
// can: it is the one module in the build whose import.meta.url is still in the
// tree. On `astro:build:start` rather than `astro:config:setup`, because the
// pool is for the build — `astro dev` renders one page at a time and would pay
// the whole corpus to serve the first request.
function markdownWorkerPath() {
  return {
    name: 'markdown-worker-path',
    hooks: {
      'astro:build:start': () => {
        process.env.MARKDOWN_WORKER_PATH = new URL(
          './src/lib/markdown-worker.ts',
          import.meta.url,
        ).pathname
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
  // A renamed docs page keeps its old URL working, but only when that URL was
  // ever live: the site has no other redirect layer (S3 + CloudFront serve the
  // built files as-is), and a page that only ever reached staging has nothing
  // pointing at it. Check with `curl -o /dev/null -w '%{http_code}'` against
  // https://jbrowse.org/jb2/docs/<old-slug>/ before adding an entry — prod is
  // well behind staging, so most new pages are not there.
  // The destination carries BASE itself: Astro writes it verbatim into the
  // `<meta http-equiv="refresh">`, and fixAbsoluteLinks only rewrites `<a href>`.
  redirects: {
    '/docs/jbrowse_jupyter/': `${BASE}/docs/jbrowse_anywidget/`,
    '/docs/config_and_session_json/': `${BASE}/docs/automating/`,
  },
  // Astro's default HTML minifier strips whitespace-only text nodes between
  // elements, so `<strong>a</strong>\n<strong>b</strong>` renders as "ab" and
  // authoring needs ugly {' '} spacers. Turning it off keeps normal HTML
  // whitespace (the browser collapses runs to one space); the size cost is
  // negligible for a static docs site.
  compressHTML: false,
  // No React integration: every component here is .astro and there are no
  // client: directives, so adding it only emits an unreferenced ~190KB React
  // runtime chunk. Re-add it (and the react deps) if an island comes back.
  integrations: [
    icon(),
    markdownWorkerPath(),
    fixAbsoluteLinks(),
    emitRawMarkdownIntegration(),
  ],
  // Self-hosted Roboto, served from our own origin — no render-blocking request
  // to fonts.googleapis.com. Exposed as var(--font-roboto); emit the <Font> tags
  // with <Font cssVariable> in the head.
  //
  // The file is VENDORED rather than fetched, which is the difference between
  // this and what it replaced. `fontProviders.google()` downloads from
  // fonts.gstatic.com at build time, so a docs build depended on Google being
  // reachable — and on 2026-08-10 it wasn't, and `Build website` failed on
  // CannotFetchFontFile with nothing wrong in the tree. Same objection as
  // website/scripts/third-party-hosts.txt makes about figure specs: a build
  // should not need a server we do not run.
  //
  // One file covers every weight because Roboto v51's latin subset is a variable
  // font (wght axis 100-900, 363 glyphs, 42 kB) — the five weights below all
  // resolved to the same URL from Google. Apache-2.0, so vendoring is clean; the
  // licence travels in fonts/LICENSE.txt beside it.
  //
  // To update: fetch the css2 URL in fonts/README.md with a browser user-agent,
  // take the `/* latin */` woff2, and drop it in. Not automated on purpose —
  // automating it would put the network back in the build.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Roboto',
      cssVariable: '--font-roboto',
      // under `options`, not alongside `name` — the family type puts every
      // provider-specific key there
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/roboto-latin-variable.woff2'],
            weight: '100 900',
            style: 'normal',
          },
        ],
      },
    },
  ],
  // NOTE: this only applies to Astro's built-in markdown (the `.md` *pages* like
  // features/gallery — base-URL rewriting only). Docs and blog render
  // through the richer unified pipeline in src/lib/markdown.ts (admonitions,
  // figures, spec-examples, shiki); those extras do NOT work in `.md` pages.
  markdown: {
    processor: unified({
      rehypePlugins: [[rehypeBaseUrls, { base: BASE }]],
    }),
  },
})
