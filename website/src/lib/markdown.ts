import { getCollection } from 'astro:content'

import { baseUrl } from './base-url.ts'
import { createRenderMarkdown } from './markdown-core.ts'

import type { RenderedMarkdown } from './markdown-core.ts'

// The Astro-side binding of the pipeline in markdown-core.ts: it supplies the
// two values that file deliberately does not import, so that everything below
// it can also run in a worker. Held as a promise rather than a value because
// the corpus is fetched, and several pages render before any of them finish.
let renderer: Promise<ReturnType<typeof createRenderMarkdown>> | undefined

export function renderMarkdown(
  body: string,
  id = '',
  { feed = false }: { feed?: boolean } = {},
): Promise<RenderedMarkdown> {
  renderer ??= getCollection('docs').then(docs =>
    createRenderMarkdown({ baseUrl, docs }),
  )
  return renderer.then(render => render(body, id, { feed }))
}
