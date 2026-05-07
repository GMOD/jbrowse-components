import { defineCollection } from 'astro:content'
import { glob, type Loader } from 'astro/loaders'
import { docsSchema } from '@astrojs/starlight/schema'
import { z } from 'astro/zod'

const docsBase = new URL('../../../website/docs', import.meta.url).pathname

/**
 * Wrap the glob loader to remap introduction.md's id from "/" to "introduction".
 * Docusaurus uses `slug: /` to make intro the docs root; in Astro, the homepage
 * is a separate src/pages/index.astro so we remap the entry id here.
 */
function jbrowseDocsLoader(): Loader {
  const inner = glob({ base: docsBase, pattern: '**/*.{md,mdx}' })
  return {
    name: 'jbrowse-docs-loader',
    async load(ctx) {
      await inner.load(ctx)
      const slashEntry = ctx.store.get('/')
      if (slashEntry) {
        ctx.store.delete('/')
        ctx.store.set({ ...slashEntry, id: 'introduction' })
      }
    },
  }
}

export const collections = {
  docs: defineCollection({
    loader: jbrowseDocsLoader(),
    schema: docsSchema({
      extend: z.object({
        // Docusaurus-specific fields, ignored by Astro
        redirect: z.string().optional(),
        toplevel: z.boolean().optional(),
      }),
    }),
  }),
}
