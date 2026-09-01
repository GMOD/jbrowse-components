import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

import { docId } from './lib/doc-slug.ts'

import type { Loader } from 'astro/loaders'

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
// Nothing calls astro:content's render() — pages run entry.body through the
// richer pipeline in src/lib/markdown.ts — so Astro's own render pass is pure
// waste. `deferRender` moves it off the sync (which halved
// .astro/data-store.json, 27MB -> 12MB, and took cold `astro dev` startup from
// ~28s to ~5s), but it does not remove it: a deferred entry is flagged
// `deferredRender`, and the store turns every flagged entry into a line of
// .astro/content-modules.mjs, a Map of dynamic imports of the source .md.
// That Map is reachable from the SSR entry, so `astro build` compiles all ~570
// markdown files through Astro's own remark/rehype/shiki pipeline for a
// render() nobody calls — most of the vite build (80s of a 140s build). Dropping
// the flag on the way into the store empties the Map and leaves everything else
// (ids, digests, dev watching, schema validation) to the glob loader. It goes on
// the store rather than over the entries afterwards because the loader's dev
// watcher writes entries without re-running load().
function withoutDeferredRender(loader: Loader): Loader {
  return {
    ...loader,
    load: context =>
      loader.load({
        ...context,
        store: {
          ...context.store,
          set: entry => context.store.set({ ...entry, deferredRender: false }),
        },
      }),
  }
}

const docsLoader = withoutDeferredRender(
  glob({
    base: docsBase,
    pattern: ['**/*.md', '!**/CLAUDE.md*'],
    generateId: ({ entry, data }) => docId(entry, data.slug),
    deferRender: true,
  }),
)

export const collections = {
  blog: defineCollection({
    loader: withoutDeferredRender(
      glob({
        base: blogBase,
        pattern: '*.md',
        generateId: ({ entry }) => entry.replace(/\.md$/, ''),
        // see docsLoader above
        deferRender: true,
      }),
    ),
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
