import { type Loader, glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { defineCollection } from 'astro:content'

const blogBase = new URL('../blog', import.meta.url).pathname
const docsBase = new URL('../docs', import.meta.url).pathname

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  draft: z.boolean().default(false),
  // Docusaurus-specific fields, kept for compatibility
  id: z.string().optional(),
  slug: z.string().optional(),
  sidebar_label: z.string().optional(),
  toplevel: z.boolean().optional(),
  redirect: z.string().optional(),
})

/**
 * Wrap the glob loader to remap introduction.md (slug: /) to id "index"
 * so it serves as the docs root at /docs/.
 */
function jbrowseDocsLoader(): Loader {
  const inner = glob({ base: docsBase, pattern: '**/*.md' })
  return {
    name: 'jbrowse-docs-loader',
    async load(ctx) {
      await inner.load(ctx)
      const slashEntry = ctx.store.get('/')
      if (slashEntry) {
        ctx.store.delete('/')
        ctx.store.set({ ...slashEntry, id: 'index' })
      }
    },
  }
}

export const collections = {
  blog: defineCollection({
    loader: glob({
      base: blogBase,
      pattern: '*.md',
      generateId: ({ entry }) => entry.replace(/\.md$/, ''),
    }),
    schema: z.object({
      title: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).optional(),
      author: z.string().optional(),
      author_url: z.string().optional(),
    }),
  }),
  docs: defineCollection({
    loader: jbrowseDocsLoader(),
    schema: docsSchema,
  }),
}
