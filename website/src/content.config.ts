import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

import { docId } from './lib/doc-slug.ts'

const blogBase = new URL('../blog', import.meta.url).pathname
const docsBase = new URL('../docs', import.meta.url).pathname

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sidebar_label: z.string().optional(),
  // Groups the page under a labeled section in both its guide's landing-page
  // index and the sidebar (see src/lib/guide-categories.ts). Only meaningful
  // for user_guides/config_guides/developer_guides pages.
  guide_category: z.string().optional(),
  // Buckets a tutorials/ page under a labeled section on the /docs/tutorials
  // landing page (src/pages/docs/tutorials/index.astro). Independent of
  // guide_category (which keeps every tutorial under the user guide's
  // "Tutorials" section). Pages without it fall into a trailing "More" bucket.
  tutorial_category: z.string().optional(),
  // What it takes to end up with what a tutorials/ page produces, rendered as a
  // chip on its card (see TUTORIAL_DATA_COSTS in src/lib/guide-categories.ts).
  // Optional: a page whose cost is not about data at all leaves it off rather
  // than picking the least wrong of three.
  data: z.string().optional(),
  // introduction.md uses `slug: /` so the glob loader keys it at the docs root
  slug: z.string().optional(),
})

// The doc with `slug: /` frontmatter (introduction.md) serves as the docs root
// at /docs/, so it keys to id "index". Deriving the id here (rather than in a
// post-load remap) means it also holds on the glob loader's HMR change events,
// which re-run generateId but not any wrapping load() — otherwise an edit to
// introduction.md re-keys under its filename and the root keeps serving stale.
// The id derivation itself lives in src/lib/doc-slug.ts, shared with the
// sidebar builder and the docs validators that have to reproduce it.
const docsLoader = glob({
  base: docsBase,
  // `docs/img` and `docs/static` are symlinks into `static/`; skip both so
  // asset-adjacent READMEs (e.g. the R-export gallery index) aren't loaded as
  // doc pages.
  pattern: ['**/*.md', '!**/CLAUDE.md*', '!img/**', '!static/**'],
  generateId: ({ entry, data }) => docId(entry, data.slug),
  // Nothing calls astro:content's render() — pages run entry.body through the
  // richer pipeline in src/lib/markdown.ts — so Astro's own render pass is pure
  // waste. Deferring it halves .astro/data-store.json (27MB -> 12MB) and takes
  // cold `astro dev` startup from ~28s to ~5s.
  deferRender: true,
})

export const collections = {
  blog: defineCollection({
    loader: glob({
      base: blogBase,
      pattern: '*.md',
      generateId: ({ entry }) => entry.replace(/\.md$/, ''),
      // see docsLoader above
      deferRender: true,
    }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      author_url: z.string().optional(),
    }),
  }),
  docs: defineCollection({
    loader: docsLoader,
    schema: docsSchema,
  }),
}
