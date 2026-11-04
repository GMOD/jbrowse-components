// What a page downloads before it can run, read off the build: the closure over
// **static** chunk imports from the chunks its HTML names. A dynamic `import()`
// is excluded, which is the point — everything JBrowse defers is deferred, and
// this is what is left. Shared by measureEagerBundle.mjs (how big) and
// eagerGraph.mjs (why), over the chunk records `eagerGraphDump` writes.
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { eagerGraphFile } from './eagerGraphDump.mjs'

export const site = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const dist = path.join(site, 'dist')

// the landing page is `index`: it runs a demo of its own, so it downloads the
// engine like every other page here, but it is dist/index.html rather than a
// directory of its own
export function htmlFor(page) {
  return page === 'index'
    ? path.join(dist, 'index.html')
    : path.join(dist, page, 'index.html')
}

export function readEagerGraph() {
  if (!existsSync(eagerGraphFile)) {
    throw new Error(`no module graph at ${eagerGraphFile}: run astro build`)
  }
  return JSON.parse(readFileSync(eagerGraphFile, 'utf8'))
}

// One build runs a server pass and a client pass into the same dump; the
// client's chunks are the ones the HTML names, keyed `_astro/<file>`.
export function chunkFor(graph, file) {
  return graph.chunks[`_astro/${file}`]
}

export function entryChunks(page) {
  return [
    ...readFileSync(htmlFor(page), 'utf8').matchAll(/_astro\/([\w.$-]+\.js)/g),
  ].map(m => m[1])
}

// A plain `pnpm build` between the dump and now rewrites dist/ with fresh
// content hashes, and the ones that happen to be unchanged (react, astro's
// runtime) still resolve — so a stale dump does not fail, it silently reports
// a five-chunk eager set for a page with 191. The entries are checked first.
export function eagerChunks(graph, page) {
  const entries = entryChunks(page)
  const missing = entries.filter(f => !chunkFor(graph, f))
  if (missing.length) {
    throw new Error(
      `the module graph and dist/ are out of step: ${missing.length} of ` +
        `${entries.length} entry chunk(s) for "${page}" are not in it ` +
        `(e.g. ${missing[0]}). Something rebuilt dist/ since: rebuild.`,
    )
  }
  const seen = new Set()
  const queue = [...entries]
  while (queue.length) {
    const file = queue.pop()
    if (!seen.has(file)) {
      seen.add(file)
      queue.push(...chunkFor(graph, file).imports.map(i => path.basename(i)))
    }
  }
  return seen
}

// `@mui/material` for any module under its node_modules directory, pnpm's
// virtual store included; undefined for a first-party module
export function npmPackageOf(id) {
  return /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(
    id,
  )?.[1]
}
